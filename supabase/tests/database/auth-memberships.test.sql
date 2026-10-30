-- Checks for the memberships migration: owner roles, privileges, caller identity, and the
-- access each identity has to memberships. Synthetic accounts are created inside the
-- transaction and rolled back at the end.

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(52);

-- ---------------------------------------------------------------------------
-- Fixtures (created as postgres)
-- ---------------------------------------------------------------------------

-- Lets pgTAP assertions run while impersonating the owner roles.
grant usage on schema extensions to app_table_owner, app_function_owner, app_provisioner;

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000e1', 'employee@example.com'),
  ('00000000-0000-4000-8000-0000000000a1', 'hr.admin@example.com'),
  ('00000000-0000-4000-8000-0000000000d1', 'disabled@example.com'),
  ('00000000-0000-4000-8000-0000000000f1', 'no.membership@example.com');

-- Memberships are created the same way the provisioning module creates them.
set local role service_role;
select public.provision_membership('00000000-0000-4000-8000-0000000000e1', 'employee', 'active');
select public.provision_membership('00000000-0000-4000-8000-0000000000a1', 'hr_admin', 'active');
select public.provision_membership('00000000-0000-4000-8000-0000000000d1', 'employee', 'disabled');
reset role;

-- ---------------------------------------------------------------------------
-- Owner roles
-- ---------------------------------------------------------------------------

select ok(
  (select bool_and(not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole
                   and not rolcreatedb and not rolinherit)
   from pg_roles where rolname in ('app_table_owner', 'app_function_owner', 'app_provisioner')),
  'the owner roles cannot log in, are not superusers, do not bypass RLS and do not inherit'
);
select is(
  (select count(*)::int from pg_roles
   where rolname in ('app_table_owner', 'app_function_owner', 'app_provisioner')),
  3,
  'all three owner roles exist'
);
select is_empty(
  $$ select 1 from pg_auth_members
     where member in ('app_table_owner'::regrole, 'app_function_owner'::regrole,
                      'app_provisioner'::regrole) $$,
  'the owner roles are not members of any other role'
);
select ok(
  not has_schema_privilege('app_table_owner', 'auth', 'usage')
  and not has_schema_privilege('app_function_owner', 'auth', 'usage')
  and not has_schema_privilege('app_provisioner', 'auth', 'usage'),
  'the owner roles cannot use the auth schema'
);
select ok(
  not has_schema_privilege('app_function_owner', 'app_private', 'create')
  and not has_schema_privilege('app_provisioner', 'app_private', 'create')
  and not has_schema_privilege('app_function_owner', 'public', 'create')
  and not has_schema_privilege('app_provisioner', 'public', 'create'),
  'the function owner roles cannot create objects once the migration has finished'
);

-- ---------------------------------------------------------------------------
-- Schema, table and function configuration
-- ---------------------------------------------------------------------------

select ok(
  not has_schema_privilege('anon', 'app_private', 'usage')
  and not has_schema_privilege('authenticated', 'app_private', 'usage')
  and not has_schema_privilege('service_role', 'app_private', 'usage'),
  'API roles cannot use the private schema'
);
select is(
  (select pg_get_userbyid(relowner)::text from pg_class
   where oid = 'app_private.memberships'::regclass),
  'app_table_owner',
  'memberships is owned by the table owner role'
);
select ok(
  (select relrowsecurity and relforcerowsecurity from pg_class
   where oid = 'app_private.memberships'::regclass),
  'memberships enables and forces row level security'
);
select ok(
  (select prosecdef and pg_get_userbyid(proowner) = 'app_function_owner'
          and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.current_membership()'::regprocedure),
  'current_membership is SECURITY DEFINER, owned by the function owner, with an empty search_path'
);
select ok(
  (select prosecdef and pg_get_userbyid(proowner) = 'app_provisioner'
          and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.provision_membership(uuid, text, text)'::regprocedure),
  'provision_membership is SECURITY DEFINER, owned by the provisioner, with an empty search_path'
);
select ok(
  (select not prosecdef and pg_get_userbyid(proowner) = 'app_function_owner'
          and proconfig @> array['search_path=""']
   from pg_proc where oid = 'app_private.caller_id()'::regprocedure),
  'caller_id runs as its caller and has an empty search_path'
);
select is(
  (select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text)
   from pg_proc p
   where p.prosecdef
     and pg_get_userbyid(p.proowner) in ('app_table_owner', 'app_function_owner', 'app_provisioner')),
  array['current_membership()', 'provision_membership(uuid,text,text)'],
  'current_membership and provision_membership are the only SECURITY DEFINER functions of the owner roles'
);

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------

select ok(
  has_table_privilege('app_function_owner', 'app_private.memberships', 'select')
  and not has_table_privilege('app_function_owner', 'app_private.memberships',
                              'insert, update, delete, truncate, references, trigger'),
  'the function owner can only read memberships'
);
select ok(
  has_table_privilege('app_provisioner', 'app_private.memberships', 'select, insert')
  and not has_table_privilege('app_provisioner', 'app_private.memberships',
                              'update, delete, truncate, references, trigger'),
  'the provisioner can read and insert memberships but cannot delete or truncate them'
);
select ok(
  has_column_privilege('app_provisioner', 'app_private.memberships', 'role', 'update')
  and has_column_privilege('app_provisioner', 'app_private.memberships', 'status', 'update')
  and has_column_privilege('app_provisioner', 'app_private.memberships', 'updated_at', 'update')
  and not has_column_privilege('app_provisioner', 'app_private.memberships', 'user_id', 'update')
  and not has_column_privilege('app_provisioner', 'app_private.memberships', 'created_at', 'update'),
  'the provisioner can update only role, status and updated_at'
);
select ok(
  not has_table_privilege('anon', 'app_private.memberships', 'select, insert, update, delete')
  and not has_table_privilege('authenticated', 'app_private.memberships',
                              'select, insert, update, delete')
  and not has_table_privilege('service_role', 'app_private.memberships',
                              'select, insert, update, delete'),
  'API roles have no direct privileges on memberships'
);
select ok(
  has_function_privilege('authenticated', 'public.current_membership()', 'execute')
  and not has_function_privilege('anon', 'public.current_membership()', 'execute')
  and not has_function_privilege('service_role', 'public.current_membership()', 'execute'),
  'only authenticated can execute current_membership'
);
select ok(
  has_function_privilege('service_role', 'public.provision_membership(uuid, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.provision_membership(uuid, text, text)',
                                 'execute')
  and not has_function_privilege('anon', 'public.provision_membership(uuid, text, text)', 'execute'),
  'only service_role can execute provision_membership'
);
select ok(
  not has_function_privilege('anon', 'app_private.caller_id()', 'execute')
  and not has_function_privilege('authenticated', 'app_private.caller_id()', 'execute')
  and not has_function_privilege('app_provisioner', 'app_private.caller_id()', 'execute'),
  'only the function owner can execute caller_id'
);

-- ---------------------------------------------------------------------------
-- caller_id reads the request identity exactly as auth.uid() does
-- ---------------------------------------------------------------------------

select ok(
  (select prosrc like '%current_setting(''request.jwt.claim.sub'', true)%'
          and prosrc like '%current_setting(''request.jwt.claims'', true)%'
   from pg_proc where oid = 'auth.uid()'::regprocedure),
  'auth.uid() still reads request.jwt.claim.sub and request.jwt.claims'
);

set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';
select is(
  app_private.caller_id(), auth.uid(),
  'caller_id matches auth.uid() for a claims object with a subject'
);
select is(
  app_private.caller_id(), '00000000-0000-4000-8000-0000000000e1'::uuid,
  'caller_id returns the subject of the request claims'
);

set local "request.jwt.claim.sub" to '00000000-0000-4000-8000-0000000000a1';
select is(
  app_private.caller_id(), auth.uid(),
  'caller_id matches auth.uid() when the legacy subject setting is also present'
);

set local "request.jwt.claim.sub" to '';
set local "request.jwt.claims" to '{"role":"anon"}';
select ok(
  app_private.caller_id() is null and auth.uid() is null,
  'caller_id and auth.uid() are both null for anonymous claims'
);

set local "request.jwt.claims" to '';
select ok(
  app_private.caller_id() is null and auth.uid() is null,
  'caller_id and auth.uid() are both null without claims'
);

-- ---------------------------------------------------------------------------
-- Active employee
-- ---------------------------------------------------------------------------

set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';

select results_eq(
  $$ select role, status from public.current_membership() $$,
  $$ values ('employee'::text, 'active'::text) $$,
  'an active employee sees their own employee membership'
);
select is(
  (select count(*)::int from public.current_membership()), 1,
  'current_membership returns only the caller''s row'
);

set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated",
    "user_role":"hr_admin","user_metadata":{"role":"hr_admin"},"app_metadata":{"role":"hr_admin"}}';
select results_eq(
  $$ select role, status from public.current_membership() $$,
  $$ values ('employee'::text, 'active'::text) $$,
  'role values inside the JWT claims do not change the membership'
);

select throws_ok(
  $$ select * from app_private.memberships $$,
  '42501', null,
  'an employee cannot read the memberships table directly'
);
select throws_ok(
  $$ select app_private.caller_id() $$,
  '42501', null,
  'an employee cannot call caller_id'
);
select throws_ok(
  $$ select public.provision_membership(
       '00000000-0000-4000-8000-0000000000e1', 'hr_admin', 'active') $$,
  '42501', null,
  'an employee cannot promote themselves through provision_membership'
);

-- ---------------------------------------------------------------------------
-- HR administrator, disabled account, no membership, unknown and missing identity
-- ---------------------------------------------------------------------------

set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$ select role, status from public.current_membership() $$,
  $$ values ('hr_admin'::text, 'active'::text) $$,
  'an active HR administrator sees their HR membership'
);

set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}';
select results_eq(
  $$ select role, status from public.current_membership() $$,
  $$ values ('employee'::text, 'disabled'::text) $$,
  'a disabled account sees its disabled status'
);

set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}';
select is_empty(
  $$ select * from public.current_membership() $$,
  'an account without a membership gets no rows'
);

set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-00000000dead","role":"authenticated"}';
select is_empty(
  $$ select * from public.current_membership() $$,
  'an unknown user id gets no rows'
);

set local "request.jwt.claims" to '';
select is_empty(
  $$ select * from public.current_membership() $$,
  'a request without claims gets no rows'
);

-- ---------------------------------------------------------------------------
-- Role changes take effect on the next call
-- ---------------------------------------------------------------------------

reset role;
set local role service_role;
select lives_ok(
  $$ select public.provision_membership(
       '00000000-0000-4000-8000-0000000000a1', 'employee', 'active') $$,
  'service_role can change a membership role'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}';
select results_eq(
  $$ select role, status from public.current_membership() $$,
  $$ values ('employee'::text, 'active'::text) $$,
  'a removed HR role is no longer returned on the next call'
);

reset role;
set local role service_role;
select public.provision_membership('00000000-0000-4000-8000-0000000000a1', 'hr_admin', 'disabled');
reset role;
set local role authenticated;
select results_eq(
  $$ select role, status from public.current_membership() $$,
  $$ values ('hr_admin'::text, 'disabled'::text) $$,
  'a disabled HR administrator is reported as disabled on the next call'
);

-- ---------------------------------------------------------------------------
-- Anonymous and service_role callers
-- ---------------------------------------------------------------------------

reset role;
set local role anon;
set local "request.jwt.claims" to '{"role":"anon"}';

select throws_ok(
  $$ select * from public.current_membership() $$,
  '42501', null,
  'anon cannot call current_membership'
);
select throws_ok(
  $$ select public.provision_membership(
       '00000000-0000-4000-8000-0000000000f1', 'hr_admin', 'active') $$,
  '42501', null,
  'anon cannot call provision_membership'
);
select throws_ok(
  $$ select * from app_private.memberships $$,
  '42501', null,
  'anon cannot read the memberships table'
);

reset role;
set local role service_role;

select throws_ok(
  $$ select * from app_private.memberships $$,
  '42501', null,
  'service_role cannot read the memberships table directly'
);
select throws_ok(
  $$ select public.provision_membership(
       '00000000-0000-4000-8000-0000000000f1', 'owner', 'active') $$,
  '23514', null,
  'provision_membership rejects an unknown role'
);
select throws_ok(
  $$ select public.provision_membership(
       '00000000-0000-4000-8000-0000000000f1', 'employee', 'suspended') $$,
  '23514', null,
  'provision_membership rejects an unknown status'
);
select throws_ok(
  $$ select public.provision_membership(
       '00000000-0000-4000-8000-00000000dead', 'employee', 'active') $$,
  '23503', null,
  'provision_membership rejects a user that does not exist'
);

-- ---------------------------------------------------------------------------
-- Owner roles are limited by their own grants and policies
-- ---------------------------------------------------------------------------

reset role;
set local role app_function_owner;
set local "request.jwt.claims" to
  '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}';

select is(
  (select count(*)::int from app_private.memberships), 1,
  'the function owner sees only the caller''s membership'
);
select throws_ok(
  $$ update app_private.memberships set role = 'hr_admin' $$,
  '42501', null,
  'the function owner cannot change memberships'
);

reset role;
set local role app_provisioner;

select throws_ok(
  $$ delete from app_private.memberships $$,
  '42501', null,
  'the provisioner cannot delete memberships'
);
select throws_ok(
  $$ update app_private.memberships
     set user_id = '00000000-0000-4000-8000-0000000000f1'
     where user_id = '00000000-0000-4000-8000-0000000000e1' $$,
  '42501', null,
  'the provisioner cannot move a membership to another user'
);

reset role;
set local role app_table_owner;

select is_empty(
  $$ select 1 from app_private.memberships $$,
  'with FORCE RLS the table owner sees no memberships'
);

-- ---------------------------------------------------------------------------
-- Deleting an account removes its membership
-- ---------------------------------------------------------------------------

reset role;
delete from auth.users where id = '00000000-0000-4000-8000-0000000000e1';
select is_empty(
  $$ select 1 from app_private.memberships
     where user_id = '00000000-0000-4000-8000-0000000000e1' $$,
  'deleting an auth user deletes the membership'
);

select * from finish();

rollback;
