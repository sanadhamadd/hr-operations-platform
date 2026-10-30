-- Feasibility checks for the planned database authorization model:
-- separate non-login roles that own the tables and the privileged functions,
-- FORCE ROW LEVEL SECURITY, narrowly scoped SECURITY DEFINER functions and
-- tests that run as non-bypassing identities.
--
-- Everything is created in a throwaway "probe" schema with synthetic data and
-- rolled back at the end, so the database is left unchanged.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(60);

-- ---------------------------------------------------------------------------
-- Fixtures (created as postgres, the role used by migrations)
-- ---------------------------------------------------------------------------

create role probe_table_owner nologin noinherit;
create role probe_function_owner nologin noinherit;
grant probe_table_owner, probe_function_owner to postgres;

create schema probe authorization probe_table_owner;
grant usage on schema probe to authenticated, probe_function_owner;
-- Lets pgTAP assertions run while impersonating the owner roles.
grant usage on schema extensions to probe_table_owner, probe_function_owner;

set local role probe_table_owner;

create table probe.staff (
  user_id uuid primary key,
  is_hr boolean not null default false
);

create table probe.requests (
  id bigint generated always as identity primary key,
  owner_id uuid not null,
  body text not null,
  status text not null default 'submitted'
);

alter table probe.staff enable row level security;
alter table probe.staff force row level security;
alter table probe.requests enable row level security;
alter table probe.requests force row level security;

reset role;

-- The function owner may create functions only while the fixtures are set up.
grant create on schema probe to probe_function_owner;
set local role probe_function_owner;

-- The owner roles cannot use the auth schema, so code that runs as the function
-- owner reads the caller's id from the request claims, as auth.uid() does.
create function probe.current_user_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

-- The only way to approve a request: HR staff call this function, which runs
-- with the function owner's privileges. Nobody has a direct UPDATE grant.
create function probe.approve_request(request_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from probe.staff s where s.user_id = probe.current_user_id() and s.is_hr
  ) then
    raise exception 'only HR staff can approve requests' using errcode = '42501';
  end if;

  update probe.requests set status = 'approved'
  where id = request_id and status = 'submitted';

  if not found then
    raise exception 'request % is not awaiting approval', request_id using errcode = 'P0002';
  end if;
end;
$$;

reset role;

-- Runs as the caller, so RLS limits the lookup to the caller's own staff record.
-- Created as postgres because the function owner cannot reference auth.uid().
create function probe.is_hr()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select s.is_hr from probe.staff s where s.user_id = (select auth.uid())),
    false
  )
$$;
alter function probe.is_hr() owner to probe_function_owner;

revoke create on schema probe from probe_function_owner;

create policy staff_select_own on probe.staff
  for select to authenticated using (user_id = (select auth.uid()));
create policy staff_select_caller on probe.staff
  for select to probe_function_owner using (user_id = (select probe.current_user_id()));

create policy requests_select_own on probe.requests
  for select to authenticated using (owner_id = (select auth.uid()));
create policy requests_select_hr on probe.requests
  for select to authenticated using ((select probe.is_hr()));
create policy requests_insert_own on probe.requests
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and status = 'submitted');
-- PostgreSQL also checks updated rows against SELECT policies, so the function
-- owner can read every request but can only move submitted ones to approved.
create policy requests_select_function_owner on probe.requests
  for select to probe_function_owner using (true);
create policy requests_approve on probe.requests
  for update to probe_function_owner
  using (status = 'submitted') with check (status = 'approved');

grant select on probe.staff to authenticated;
grant select, insert on probe.requests to authenticated;
grant select on probe.staff, probe.requests to probe_function_owner;
grant update (status) on probe.requests to probe_function_owner;

revoke execute on all functions in schema probe from public;
grant execute on function probe.is_hr() to authenticated;
grant execute on function probe.approve_request(bigint) to authenticated;

-- Synthetic identities: employee A, employee B and an HR administrator.
insert into probe.staff (user_id, is_hr) values
  ('00000000-0000-4000-8000-00000000000a', false),
  ('00000000-0000-4000-8000-00000000000b', false),
  ('00000000-0000-4000-8000-0000000000c0', true);

insert into probe.requests (owner_id, body) values
  ('00000000-0000-4000-8000-00000000000a', 'Synthetic request from employee A'),
  ('00000000-0000-4000-8000-00000000000b', 'Synthetic request from employee B');

-- ---------------------------------------------------------------------------
-- Role attributes
-- ---------------------------------------------------------------------------

select ok(
  (select not rolsuper and not rolbypassrls from pg_roles where rolname = 'authenticated'),
  'authenticated is subject to RLS'
);
select ok(
  (select not rolsuper and not rolbypassrls from pg_roles where rolname = 'anon'),
  'anon is subject to RLS'
);
select ok(
  (select rolbypassrls from pg_roles where rolname = 'postgres'),
  'postgres bypasses RLS, so tests must not assert access while running as postgres'
);
select ok(
  (select not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole
   from pg_roles where rolname = 'probe_table_owner'),
  'the table owner role cannot log in and does not bypass RLS'
);
select ok(
  (select not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole
   from pg_roles where rolname = 'probe_function_owner'),
  'the function owner role cannot log in and does not bypass RLS'
);
select is_empty(
  $$ select 1 from pg_auth_members
     where member in ('probe_table_owner'::regrole, 'probe_function_owner'::regrole) $$,
  'the owner roles are not members of any other role, including each other'
);
select ok(
  not has_schema_privilege('probe_table_owner', 'auth', 'usage')
  and not has_schema_privilege('probe_function_owner', 'auth', 'usage'),
  'the owner roles cannot use the auth schema'
);

-- ---------------------------------------------------------------------------
-- Ownership, FORCE RLS and function configuration
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(pg_get_userbyid(relowner)::text order by relname)
   from pg_class where relnamespace = 'probe'::regnamespace and relkind = 'r'),
  array['probe_table_owner', 'probe_table_owner'],
  'probe tables are owned by the table owner role'
);
select is(
  (select array_agg(distinct pg_get_userbyid(proowner)::text)
   from pg_proc where pronamespace = 'probe'::regnamespace),
  array['probe_function_owner'],
  'probe functions are owned by the function owner role'
);
select is_empty(
  $$ select 1 from pg_class where relowner = 'probe_function_owner'::regrole $$,
  'the function owner role owns no tables'
);
select ok(
  (select bool_and(relrowsecurity and relforcerowsecurity)
   from pg_class where relnamespace = 'probe'::regnamespace and relkind = 'r'),
  'probe tables enable and force row level security'
);
select ok(
  (select prosecdef and pg_get_userbyid(proowner) = 'probe_function_owner'
          and proconfig @> array['search_path=""']
   from pg_proc where oid = 'probe.approve_request(bigint)'::regprocedure),
  'approve_request is SECURITY DEFINER, owned by the function owner, with an empty search_path'
);
select is(
  (select array_agg(proname::text)
   from pg_proc where pronamespace = 'probe'::regnamespace and prosecdef),
  array['approve_request'],
  'approve_request is the only SECURITY DEFINER function'
);

-- ---------------------------------------------------------------------------
-- Privilege boundaries
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('probe_function_owner', 'probe.staff', 'select')
  and has_table_privilege('probe_function_owner', 'probe.requests', 'select'),
  'the function owner can read both tables'
);
select ok(
  not has_table_privilege('probe_function_owner', 'probe.staff',
                          'insert, update, delete, truncate, references, trigger')
  and not has_table_privilege('probe_function_owner', 'probe.requests',
                              'insert, delete, truncate, references, trigger'),
  'the function owner cannot insert, delete or truncate rows, or update staff'
);
select ok(
  has_column_privilege('probe_function_owner', 'probe.requests', 'status', 'update')
  and not has_table_privilege('probe_function_owner', 'probe.requests', 'update')
  and not has_column_privilege('probe_function_owner', 'probe.requests', 'id', 'update')
  and not has_column_privilege('probe_function_owner', 'probe.requests', 'owner_id', 'update')
  and not has_column_privilege('probe_function_owner', 'probe.requests', 'body', 'update'),
  'the function owner can update only the request status column'
);
select ok(
  not has_schema_privilege('probe_function_owner', 'probe', 'create'),
  'the function owner cannot create objects in the probe schema'
);
select ok(
  not has_function_privilege('probe_table_owner', 'probe.approve_request(bigint)', 'execute'),
  'the table owner cannot execute approve_request'
);
select ok(
  has_table_privilege('authenticated', 'probe.staff', 'select')
  and has_table_privilege('authenticated', 'probe.requests', 'select')
  and has_table_privilege('authenticated', 'probe.requests', 'insert')
  and not has_table_privilege('authenticated', 'probe.staff', 'insert, update, delete, truncate')
  and not has_table_privilege('authenticated', 'probe.requests', 'update, delete, truncate'),
  'authenticated can only read staff, and read and insert requests'
);
select is(
  (select count(*)::int from pg_proc
   where pronamespace = 'probe'::regnamespace and has_function_privilege('anon', oid, 'execute')),
  0,
  'anon cannot execute any probe function'
);
select ok(
  not has_table_privilege('anon', 'probe.staff', 'select, insert, update, delete')
  and not has_table_privilege('anon', 'probe.requests', 'select, insert, update, delete'),
  'anon has no privileges on probe tables'
);

-- ---------------------------------------------------------------------------
-- Employee A
-- ---------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

select ok(
  (select current_user = 'authenticated' and not rolbypassrls
   from pg_roles where rolname = current_user),
  'employee checks run as authenticated without RLS bypass'
);
select is(
  (select count(*)::int from probe.requests), 1,
  'employee A sees only their own request'
);
select is_empty(
  $$ select 1 from probe.requests where owner_id = '00000000-0000-4000-8000-00000000000b' $$,
  'employee A cannot see employee B''s request'
);
select is(
  (select count(*)::int from probe.staff), 1,
  'employee A sees only their own staff record'
);
select is(probe.is_hr(), false, 'employee A is not HR');
select lives_ok(
  $$ insert into probe.requests (owner_id, body)
     values ('00000000-0000-4000-8000-00000000000a', 'Second synthetic request from A') $$,
  'employee A can submit a request for themselves'
);
select throws_ok(
  $$ insert into probe.requests (owner_id, body)
     values ('00000000-0000-4000-8000-00000000000b', 'Forged request') $$,
  '42501', null,
  'employee A cannot submit a request on behalf of employee B'
);
select throws_ok(
  $$ insert into probe.requests (owner_id, body, status)
     values ('00000000-0000-4000-8000-00000000000a', 'Self-approved', 'approved') $$,
  '42501', null,
  'employee A cannot submit an already approved request'
);
select throws_ok(
  $$ update probe.requests set status = 'approved' $$,
  '42501', null,
  'employee A cannot update requests directly'
);
select throws_ok(
  $$ delete from probe.requests $$,
  '42501', null,
  'employee A cannot delete requests'
);
select throws_ok(
  $$ select probe.approve_request(1) $$,
  '42501', 'only HR staff can approve requests',
  'employee A cannot approve requests through the privileged function'
);

-- ---------------------------------------------------------------------------
-- HR administrator
-- ---------------------------------------------------------------------------

set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000c0","role":"authenticated"}';

select is(probe.is_hr(), true, 'the HR administrator is HR');
select is(
  (select count(*)::int from probe.requests), 3,
  'the HR administrator sees every request'
);
select throws_ok(
  $$ update probe.requests set status = 'approved' $$,
  '42501', null,
  'the HR administrator cannot update requests directly'
);
select lives_ok(
  $$ select probe.approve_request(
       (select id from probe.requests
        where owner_id = '00000000-0000-4000-8000-00000000000a' order by id limit 1)) $$,
  'the HR administrator can approve a request through the privileged function'
);
select throws_ok(
  $$ select probe.approve_request(
       (select id from probe.requests
        where owner_id = '00000000-0000-4000-8000-00000000000a' order by id limit 1)) $$,
  'P0002', null,
  'an approved request cannot be approved again'
);

-- ---------------------------------------------------------------------------
-- Missing or anonymous identity
-- ---------------------------------------------------------------------------

set local "request.jwt.claims" to '';

select is_empty(
  $$ select 1 from probe.requests $$,
  'authenticated without a user id sees no requests'
);

reset role;
set local role anon;

select ok(current_user = 'anon', 'anonymous checks run as anon');
select throws_ok(
  $$ select 1 from probe.requests $$,
  '42501', null,
  'anon cannot read requests'
);
select throws_ok(
  $$ select probe.approve_request(1) $$,
  '42501', null,
  'anon cannot call the privileged function'
);

-- ---------------------------------------------------------------------------
-- The function owner is limited by its own grants and policies
-- ---------------------------------------------------------------------------

reset role;
set local role probe_function_owner;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000c0","role":"authenticated"}';

select ok(
  (select current_user = 'probe_function_owner' and not rolbypassrls
   from pg_roles where rolname = current_user),
  'function owner checks run as the function owner without RLS bypass'
);
select lives_ok(
  $$ update probe.requests set status = 'approved'
     where owner_id = '00000000-0000-4000-8000-00000000000b' $$,
  'the function owner can approve a submitted request'
);
select is(
  (select count(*)::int from probe.staff), 1,
  'the function owner sees only the caller''s staff record'
);
select throws_ok(
  $$ update probe.requests set body = 'Altered' $$,
  '42501', null,
  'the function owner cannot change request text'
);
select throws_ok(
  $$ update probe.requests set status = 'rejected' $$,
  '42501', null,
  'the function owner cannot set a status other than approved'
);
select lives_ok(
  $$ update probe.requests set status = 'submitted' where status = 'approved' $$,
  'updates by the function owner skip approved requests without error'
);
select is(
  (select count(*)::int from probe.requests where status = 'approved'), 2,
  'the function owner cannot reopen an approved request'
);
select throws_ok(
  $$ insert into probe.requests (owner_id, body)
     values ('00000000-0000-4000-8000-00000000000a', 'Function owner insert') $$,
  '42501', null,
  'the function owner cannot insert requests'
);
select throws_ok(
  $$ delete from probe.requests $$,
  '42501', null,
  'the function owner cannot delete requests'
);

-- ---------------------------------------------------------------------------
-- FORCE RLS applies to the table owner
-- ---------------------------------------------------------------------------

reset role;
set local role probe_table_owner;

select ok(
  (select current_user = 'probe_table_owner' and not rolbypassrls
   from pg_roles where rolname = current_user),
  'table owner checks run as the table owner without RLS bypass'
);
select is_empty(
  $$ select 1 from probe.requests $$,
  'with FORCE RLS the table owner sees no rows without a matching policy'
);
select throws_ok(
  $$ insert into probe.requests (owner_id, body)
     values ('00000000-0000-4000-8000-00000000000a', 'Owner insert') $$,
  '42501', null,
  'with FORCE RLS the table owner cannot insert without a matching policy'
);
select throws_ok(
  $$ select probe.approve_request(1) $$,
  '42501', null,
  'the table owner cannot call the privileged function'
);
select throws_ok(
  $$ select auth.uid() $$,
  '42501', null,
  'the table owner cannot call auth.uid()'
);

reset role;
alter table probe.requests no force row level security;
set local role probe_table_owner;

select is(
  (select count(*)::int from probe.requests), 3,
  'without FORCE RLS the table owner bypasses policies (control)'
);

reset role;
alter table probe.requests force row level security;

-- ---------------------------------------------------------------------------
-- Controls run as postgres
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from probe.requests), 3,
  'postgres sees every row despite FORCE RLS because it has BYPASSRLS'
);
select is(
  (select status from probe.requests
   where owner_id = '00000000-0000-4000-8000-00000000000a' order by id limit 1),
  'approved',
  'the approval made through the privileged function was persisted'
);

create table public.probe_default_grants (id int);
select ok(
  has_table_privilege('anon', 'public.probe_default_grants', 'select'),
  'tables postgres creates in public are readable by anon by default'
);

create table probe.probe_default_grants (id int);
select ok(
  not has_table_privilege('anon', 'probe.probe_default_grants', 'select')
  and not has_table_privilege('authenticated', 'probe.probe_default_grants', 'select'),
  'tables postgres creates in a dedicated schema receive no default grants'
);

select * from finish();

rollback;
