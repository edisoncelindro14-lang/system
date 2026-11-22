-- Ownership tracking: every payment a member makes toward their ownership,
-- plus the system-wide total amount and discount set by the admin.

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

create index if not exists idx_ownership_payments_member on public.ownership_payments(member_id);

grant usage on schema public to anon;
grant select, insert, update, delete on public.ownership_payments to anon;

insert into public.system_settings (setting_key, setting_value, description) values
  ('ownership_total_amount', '0', 'System ownership total amount charged per member'),
  ('ownership_discount_amount', '0', 'System ownership discount deducted from the total amount')
on conflict (setting_key) do nothing;
