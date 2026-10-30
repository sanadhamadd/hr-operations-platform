-- Application memberships: the authoritative record of each account's role and status.
--
-- The table lives in a private schema that the API does not expose. Signed-in users read only
-- their own membership through current_membership(); memberships are written only through
-- provision_membership(), which only the server-side secret key (service_role) can call.
-- Each function runs as a dedicated non-login owner role that holds only the privileges the
-- function needs, and row level security is forced on the table.

create role app_table_owner nologin noinherit;
create role app_function_owner nologin noinherit;
create role app_provisioner nologin noinherit;
-- Lets migrations, which run as postgres, create objects owned by these roles.
grant app_table_owner, app_function_owner, app_provisioner to postgres;

create schema app_private authorization app_table_owner;
grant usage on schema app_private to app_function_owner, app_provisioner;

create table app_private.memberships (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('employee', 'hr_admin')),
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table app_private.memberships owner to app_table_owner;
alter table app_private.memberships enable row level security;
alter table app_private.memberships force row level security;

-- Function owners need CREATE on a schema to own functions in it. Granted only while the
-- functions are set up and revoked at the end of this migration.
grant create on schema app_private to app_function_owner;
grant create on schema public to app_function_owner, app_provisioner;

-- The owner roles cannot use the auth schema, so they cannot call auth.uid(). This reads the
-- caller's user id from the request claims exactly as auth.uid() does. The API sets these claims
-- for each transaction from a verified JWT, and clients have no way to set them directly.
create function app_private.caller_id()
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

alter function app_private.caller_id() owner to app_function_owner;

-- Returns the caller's own membership, or no rows when the caller has none.
create function public.current_membership()
returns table (role text, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select m.role, m.status
  from app_private.memberships m
  where m.user_id = app_private.caller_id()
$$;

alter function public.current_membership() owner to app_function_owner;

-- Creates or updates a membership. Called by the server-side provisioning module only.
create function public.provision_membership(target_user_id uuid, new_role text, new_status text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into app_private.memberships (user_id, role, status)
  values (target_user_id, new_role, new_status)
  on conflict (user_id) do update
    set role = excluded.role, status = excluded.status, updated_at = now()
$$;

alter function public.provision_membership(uuid, text, text) owner to app_provisioner;

create policy memberships_select_caller on app_private.memberships
  for select to app_function_owner using (user_id = (select app_private.caller_id()));

create policy memberships_select_provisioner on app_private.memberships
  for select to app_provisioner using (true);
create policy memberships_insert_provisioner on app_private.memberships
  for insert to app_provisioner with check (true);
create policy memberships_update_provisioner on app_private.memberships
  for update to app_provisioner using (true) with check (true);

grant select on app_private.memberships to app_function_owner;
grant select, insert on app_private.memberships to app_provisioner;
grant update (role, status, updated_at) on app_private.memberships to app_provisioner;

revoke create on schema app_private from app_function_owner;
revoke create on schema public from app_function_owner, app_provisioner;

-- Functions are executable by PUBLIC by default, and Supabase also grants functions created in
-- the public schema to anon, authenticated and service_role. Replace both with explicit grants.
revoke execute on function app_private.caller_id() from public;
revoke execute on function public.current_membership() from public, anon, authenticated, service_role;
revoke execute on function public.provision_membership(uuid, text, text)
  from public, anon, authenticated, service_role;

grant execute on function app_private.caller_id() to app_function_owner;
grant execute on function public.current_membership() to authenticated;
grant execute on function public.provision_membership(uuid, text, text) to service_role;
