-- Enable RLS on all four tables.
alter table sections   enable row level security;
alter table categories enable row level security;
alter table questions  enable row level security;
alter table admins     enable row level security;

-- Drop any existing policies (so this file is re-runnable).
drop policy if exists read_all       on sections;
drop policy if exists read_all       on categories;
drop policy if exists read_all       on questions;
drop policy if exists mutate_admins  on sections;
drop policy if exists mutate_admins  on categories;
drop policy if exists mutate_admins  on questions;
drop policy if exists read_self      on admins;

-- Public read on content tables.
create policy read_all on sections   for select using (true);
create policy read_all on categories for select using (true);
create policy read_all on questions  for select using (true);

-- Admin-only mutations on content tables.
create policy mutate_admins on sections
  for all
  using      ((auth.jwt() ->> 'email') in (select email from admins))
  with check ((auth.jwt() ->> 'email') in (select email from admins));

create policy mutate_admins on categories
  for all
  using      ((auth.jwt() ->> 'email') in (select email from admins))
  with check ((auth.jwt() ->> 'email') in (select email from admins));

create policy mutate_admins on questions
  for all
  using      ((auth.jwt() ->> 'email') in (select email from admins))
  with check ((auth.jwt() ->> 'email') in (select email from admins));

-- Admins can read their own row only (so the client can check "am I an admin?").
-- Insert/update/delete on admins: NO POLICY → blocked for everyone via the API.
-- The owner manages the allowlist using the SQL editor (service_role context).
create policy read_self on admins
  for select
  using ((auth.jwt() ->> 'email') = email);
