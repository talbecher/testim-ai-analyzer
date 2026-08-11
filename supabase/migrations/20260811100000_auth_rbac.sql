-- Authentication & RBAC for Testim AI Analyzer
-- Roles: admin | member (default on signup = member)
-- Data tables: all authenticated users get full read/write (role checks in UI only)

-- ---------------------------------------------------------------------------
-- user_roles
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  id uuid references auth.users on delete cascade primary key,
  role text not null check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_roles_role_idx on public.user_roles (role);

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
create or replace function public.get_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.user_roles where id = auth.uid()),
    'member'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_user_role() = 'admin';
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-assign member role on signup (OAuth or email)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_roles (id, role)
  values (new.id, 'member')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists user_roles_updated_at on public.user_roles;
create trigger user_roles_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
alter table public.analysis_reports enable row level security;
alter table public.analysis_results enable row level security;
alter table public.bug_categories enable row level security;
alter table public.learning_patterns enable row level security;
alter table public.regression_buckets enable row level security;
alter table public.user_roles enable row level security;

-- ---------------------------------------------------------------------------
-- Data tables: authenticated users full access
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated full access" on public.analysis_reports;
create policy "Authenticated full access"
  on public.analysis_reports
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated full access" on public.analysis_results;
create policy "Authenticated full access"
  on public.analysis_results
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated full access" on public.bug_categories;
create policy "Authenticated full access"
  on public.bug_categories
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated full access" on public.learning_patterns;
create policy "Authenticated full access"
  on public.learning_patterns
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Authenticated full access" on public.regression_buckets;
create policy "Authenticated full access"
  on public.regression_buckets
  for all
  to authenticated
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- user_roles: read own role; admins manage all
-- ---------------------------------------------------------------------------
drop policy if exists "Users read own role" on public.user_roles;
create policy "Users read own role"
  on public.user_roles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Admins manage all roles" on public.user_roles;
create policy "Admins manage all roles"
  on public.user_roles
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.analysis_reports to authenticated;
grant select, insert, update, delete on public.analysis_results to authenticated;
grant select, insert, update, delete on public.bug_categories to authenticated;
grant select, insert, update, delete on public.learning_patterns to authenticated;
grant select, insert, update, delete on public.regression_buckets to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;

-- Bootstrap first admin (run manually after your account exists):
-- update public.user_roles set role = 'admin' where id = (
--   select id from auth.users where email = 'you@company.com'
-- );
