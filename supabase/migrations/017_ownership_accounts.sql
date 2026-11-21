-- Per-member ownership overrides: the admin can set an individual total amount,
-- next amount to be paid and discount instead of the system-wide defaults.
-- A null column means "use the system setting".
--
-- Run this whole file in the external Supabase project's SQL Editor. It is
-- idempotent, so re-running it is safe.

create extension if not exists "pgcrypto";

create table if not exists public.ownership_accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid unique references public.members(id) on delete cascade,
  total_amount numeric,
  next_payment_amount numeric,
  next_payment_due date,
  discount numeric,
  updated_by uuid references public.members(id),
  created_at timestamptz default now(),
  created_date timestamptz default now()
);

-- Existing projects created before the due date was added need the column too.
alter table public.ownership_accounts add column if not exists next_payment_due date;

create index if not exists idx_ownership_accounts_member on public.ownership_accounts(member_id);

alter table public.ownership_accounts enable row level security;

do $$ begin
  create policy "allow_all_ownership_accounts" on public.ownership_accounts for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

grant usage on schema public to anon;
grant select, insert, update, delete on public.ownership_accounts to anon;

-- Supabase projects also have the authenticated role; a plain local Postgres
-- used for development does not, so grant only when it exists.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on public.ownership_accounts to authenticated;
  end if;
end $$;

-- Without this the REST API keeps serving its cached schema and every request
-- to the new table fails with "Could not find the table ... in the schema cache".
notify pgrst, 'reload schema';
