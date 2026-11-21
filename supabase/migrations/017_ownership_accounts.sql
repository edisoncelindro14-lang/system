-- Per-member ownership overrides: the admin can set an individual total amount,
-- next amount to be paid and discount instead of the system-wide defaults.
-- A null column means "use the system setting".

create extension if not exists "pgcrypto";

create table if not exists public.ownership_accounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid unique references public.members(id) on delete cascade,
  total_amount numeric,
  next_payment_amount numeric,
  discount numeric,
  updated_by uuid references public.members(id),
  created_at timestamptz default now(),
  created_date timestamptz default now()
);

create index if not exists idx_ownership_accounts_member on public.ownership_accounts(member_id);

grant usage on schema public to anon;
grant select, insert, update, delete on public.ownership_accounts to anon;
