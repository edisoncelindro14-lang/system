-- Transaction history for code redemptions — visible to both store and user
create table if not exists public.code_redemption_history (
  id uuid primary key default gen_random_uuid(),
  code_id uuid references public.maintenance_codes(id) on delete set null,
  code text not null,
  redeemed_by_member_id uuid references public.members(id) on delete cascade,
  redeemed_by_username text,
  store_member_id uuid references public.members(id) on delete set null,
  redeemed_at timestamptz default now(),
  status text default 'completed'
);

create index if not exists idx_code_redemption_by_member on public.code_redemption_history(redeemed_by_member_id);
create index if not exists idx_code_redemption_store on public.code_redemption_history(store_member_id);

grant select, insert, update, delete on public.code_redemption_history to anon;
