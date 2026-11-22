-- Repairs public.ownership_payments in the external Supabase project so a recorded
-- payment shows up in member ownership and the admin ownership tab: creates the
-- table when it is missing, adds the columns older copies lack (including the
-- created_date used for the newest-first list), and gives it the same permissive
-- row-level security policy the other app tables use — without a policy, RLS
-- silently returns no rows and rejects every recorded payment.
--
-- Idempotent: re-running it is safe.

create extension if not exists "pgcrypto";

create table if not exists public.ownership_payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  amount numeric default 0,
  total_amount numeric default 0,
  discount numeric default 0,
  note text,
  recorded_by uuid references public.members(id),
  created_at timestamptz default now(),
  created_date timestamptz default now()
);

alter table public.ownership_payments add column if not exists member_id uuid references public.members(id) on delete cascade;
alter table public.ownership_payments add column if not exists amount numeric default 0;
alter table public.ownership_payments add column if not exists total_amount numeric default 0;
alter table public.ownership_payments add column if not exists discount numeric default 0;
alter table public.ownership_payments add column if not exists note text;
alter table public.ownership_payments add column if not exists recorded_by uuid references public.members(id);
alter table public.ownership_payments add column if not exists created_at timestamptz default now();
alter table public.ownership_payments add column if not exists created_date timestamptz default now();

-- Older rows may have no created_date; the payment list sorts on it.
update public.ownership_payments
  set created_date = coalesce(created_date, created_at, now())
  where created_date is null;

create index if not exists idx_ownership_payments_member on public.ownership_payments(member_id);

alter table public.ownership_payments enable row level security;

do $$ begin
  create policy "allow_all_ownership_payments" on public.ownership_payments for all using (true) with check (true);
exception when duplicate_object then null;
end $$;

grant usage on schema public to anon;
grant select, insert, update, delete on public.ownership_payments to anon;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant usage on schema public to authenticated;
    grant select, insert, update, delete on public.ownership_payments to authenticated;
  end if;
end $$;

notify pgrst, 'reload schema';
