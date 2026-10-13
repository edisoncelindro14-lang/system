-- ==========================================
-- Mamlakah Network — Complete Database Setup
-- Run this in: Supabase Dashboard → SQL Editor → New query → Paste → Run
-- Safe to run on a fresh project (uses IF NOT EXISTS / ON CONFLICT)
-- ==========================================

create extension if not exists "pgcrypto";

-- ========== MEMBERS ==========
create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password text,
  full_name text default '',
  referral_code text,
  referrer_id uuid references public.members(id),
  status text default 'pending',
  role text default 'member',
  tree_level int default 0,
  gcash_number text,
  gcash_name text,
  phone text,
  address text,
  email text,
  age int,
  facebook_name text,
  backup_mobile text,
  approved_date timestamptz,
  created_date timestamptz default now(),
  created_at timestamptz default now(),
  direct_downlines_count int default 0,
  level1_count int default 0,
  level2_count int default 0,
  level3_count int default 0,
  total_earnings numeric(14,2) default 0,
  available_balance numeric(14,2) default 0,
  maintenance_override text default 'auto',
  maintenance_timer_seconds int default 0,
  maintenance_timer_set_at timestamptz,
  updated_at timestamptz default now()
);

-- ========== MAINTENANCE CODES ==========
create table if not exists public.maintenance_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  amount numeric default 0,
  is_used boolean default false,
  description text,
  assigned_username text,
  assigned_sub_admin_id uuid references public.members(id),
  used_by_member_id uuid references public.members(id),
  redeemed_by_sub_admin_id uuid references public.members(id),
  used_at timestamptz,
  created_at timestamptz default now()
);

-- ========== TRANSACTIONS ==========
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  type text not null,
  amount numeric default 0,
  description text,
  status text default 'completed',
  bonus_level int,
  from_member_id uuid references public.members(id),
  created_date timestamptz default now(),
  created_at timestamptz default now()
);

-- ========== CONVERSION REQUESTS (WITHDRAWALS) ==========
create table if not exists public.conversion_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  amount numeric default 0,
  status text default 'pending',
  admin_note text,
  created_date timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== GCASH INFO ==========
create table if not exists public.gcash_info (
  id uuid primary key default gen_random_uuid(),
  gcash_number text,
  gcash_name text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== SYSTEM SETTINGS ==========
create table if not exists public.system_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text unique,
  setting_value text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== GCASH RECEIPTS ==========
create table if not exists public.gcash_receipts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id),
  member_name text,
  receipt_url text,
  status text default 'pending',
  admin_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== LEVEL BONUSES ==========
create table if not exists public.level_bonuses (
  id uuid primary key default gen_random_uuid(),
  level integer unique check (level between 1 and 5),
  bonus_amount numeric(14,2) not null,
  is_active boolean not null default true,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ========== AUDIT LOGS ==========
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  actor_role text,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz default now()
);

-- ========== INDEXES ==========
create index if not exists idx_members_referrer on public.members(referrer_id);
create index if not exists idx_members_status on public.members(status);
create index if not exists idx_codes_username on public.maintenance_codes(assigned_username);
create index if not exists idx_codes_used on public.maintenance_codes(is_used);
create index if not exists idx_transactions_member on public.transactions(member_id);
create index if not exists idx_withdrawals_status on public.conversion_requests(status);

-- ========== ENABLE RLS ==========
alter table public.members enable row level security;
alter table public.maintenance_codes enable row level security;
alter table public.transactions enable row level security;
alter table public.conversion_requests enable row level security;
alter table public.gcash_info enable row level security;
alter table public.system_settings enable row level security;
alter table public.gcash_receipts enable row level security;
alter table public.level_bonuses enable row level security;
alter table public.audit_logs enable row level security;

-- ========== RLS POLICIES (open access — app uses client-side auth) ==========
-- Drop existing policies first to avoid conflicts
drop policy if exists "allow_all_members" on public.members;
drop policy if exists "allow_all_maintenance_codes" on public.maintenance_codes;
drop policy if exists "allow_all_transactions" on public.transactions;
drop policy if exists "allow_all_conversion_requests" on public.conversion_requests;
drop policy if exists "allow_all_gcash_info" on public.gcash_info;
drop policy if exists "allow_all_system_settings" on public.system_settings;
drop policy if exists "allow_all_gcash_receipts" on public.gcash_receipts;
drop policy if exists "allow_all_level_bonuses" on public.level_bonuses;
drop policy if exists "allow_all_audit_logs" on public.audit_logs;

create policy "allow_all_members" on public.members for all using (true) with check (true);
create policy "allow_all_maintenance_codes" on public.maintenance_codes for all using (true) with check (true);
create policy "allow_all_transactions" on public.transactions for all using (true) with check (true);
create policy "allow_all_conversion_requests" on public.conversion_requests for all using (true) with check (true);
create policy "allow_all_gcash_info" on public.gcash_info for all using (true) with check (true);
create policy "allow_all_system_settings" on public.system_settings for all using (true) with check (true);
create policy "allow_all_gcash_receipts" on public.gcash_receipts for all using (true) with check (true);
create policy "allow_all_level_bonuses" on public.level_bonuses for all using (true) with check (true);
create policy "allow_all_audit_logs" on public.audit_logs for all using (true) with check (true);

-- ========== COMPUTE MAINTENANCE STATUS FUNCTION ==========
create or replace function public.compute_maintenance_status(p_member_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare m public.members%rowtype; last_used timestamptz; seconds_left bigint;
begin
  select * into m from public.members where id=p_member_id;
  if m.maintenance_override='green' then return jsonb_build_object('isGreen',true,'secondsLeft',null,'neverRedeemed',false); end if;
  if m.maintenance_override='red' then return jsonb_build_object('isGreen',false,'secondsLeft',0,'neverRedeemed',false); end if;
  if m.maintenance_timer_seconds is not null and m.maintenance_timer_set_at is not null then
    seconds_left := greatest(0, m.maintenance_timer_seconds - extract(epoch from (now()-m.maintenance_timer_set_at))::bigint);
    return jsonb_build_object('isGreen',seconds_left>0,'secondsLeft',seconds_left,'neverRedeemed',false);
  end if;
  select max(used_at) into last_used from public.maintenance_codes where used_by_member_id=p_member_id and is_used=true;
  if last_used is not null then
    seconds_left := greatest(0, 2592000 - extract(epoch from (now()-last_used))::bigint);
    return jsonb_build_object('isGreen',seconds_left>0,'secondsLeft',seconds_left,'neverRedeemed',false);
  end if;
  seconds_left := greatest(0, 432000 - extract(epoch from (now()-coalesce(m.approved_date,m.created_at)))::bigint);
  return jsonb_build_object('isGreen',seconds_left>0,'secondsLeft',seconds_left,'neverRedeemed',true);
end $$;

-- ========== REDEEM MAINTENANCE CODE FUNCTION ==========
create or replace function public.redeem_maintenance_code(p_code text, p_member_id uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare c public.maintenance_codes%rowtype; m public.members%rowtype; u public.members%rowtype; lvl integer; bonus numeric;
begin
  select * into m from public.members where id=p_member_id and status='approved' for update;
  if not found then raise exception 'Member not found'; end if;

  select * into c from public.maintenance_codes where code=p_code for update;
  if not found then raise exception 'Maintenance code not found'; end if;
  if c.is_used then raise exception 'Maintenance code has already been used'; end if;
  if c.assigned_username is not null and c.assigned_username <> m.username then raise exception 'This code is locked to another username'; end if;
  if c.assigned_sub_admin_id is not null and c.assigned_sub_admin_id <> p_member_id and m.role <> 'admin' then raise exception 'Code is assigned to another sub-admin'; end if;

  update public.maintenance_codes
  set is_used=true, used_by_member_id=p_member_id, used_at=now()
  where id=c.id;

  update public.members
  set maintenance_timer_seconds=null, maintenance_timer_set_at=null, updated_at=now()
  where id=p_member_id;

  for lvl in 1..1 loop
    if lvl=1 then
      select * into u from public.members where id=m.referrer_id and status='approved';
    else
      select * into u from public.members where id=(select referrer_id from public.members where id=u.id) and status='approved';
    end if;
    exit when not found;
    if u.id=p_member_id then continue; end if;
    if (public.compute_maintenance_status(u.id)->>'isGreen')::boolean then
      select bonus_amount into bonus from public.level_bonuses where level=lvl and is_active=true;
      if bonus is not null then
        insert into public.transactions(member_id,type,amount,description,status,from_member_id,bonus_level)
        values(u.id,'level_bonus',bonus,'Level '||lvl||' bonus from maintenance redemption','completed',p_member_id,lvl);
        update public.members set total_earnings=total_earnings+bonus, available_balance=available_balance+bonus, updated_at=now() where id=u.id;
      end if;
    end if;
  end loop;

  return jsonb_build_object('success',true,'code',c.code,'member_id',p_member_id);
end $$;

-- ========== STORAGE BUCKET FOR RECEIPTS ==========
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', true)
  on conflict (id) do nothing;

-- ========== DEFAULT LEVEL BONUSES ==========
insert into public.level_bonuses(level, bonus_amount, is_active) values
  (1, 200, true), (2, 0, false), (3, 0, false), (4, 0, false), (5, 0, false)
on conflict (level) do update set bonus_amount=excluded.bonus_amount, is_active=excluded.is_active;

-- ========== DEFAULT SYSTEM SETTINGS ==========
insert into public.system_settings (setting_key, setting_value, description) values
  ('withdrawal_minimum_amount', '300', 'Minimum withdrawal amount'),
  ('tab_monitoring_visible', 'true', 'Monitoring tab visibility'),
  ('tab_subadmin_visible', 'true', 'Sub-admin tab visibility'),
  ('tab_terms_visible', 'true', 'Terms visibility'),
  ('tab_complan_visible', 'true', 'ComPlan visibility')
on conflict (setting_key) do nothing;

-- ========== CREATE ADMIN ACCOUNT ==========
-- Default: username "admin", password "admin123"
-- Change the password after first login!
insert into public.members (username, password, full_name, referral_code, status, role, tree_level)
values ('admin', 'admin123', 'Administrator', 'ADMIN001', 'approved', 'admin', 0)
on conflict (username) do nothing;
