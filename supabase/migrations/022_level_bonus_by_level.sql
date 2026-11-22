-- Level bonuses on every redeemed code: when a downline redeems a maintenance
-- code, each upline receives the bonus for that level. Mirrors LEVEL_CONFIG in
-- src/lib/helpers.js (6 levels, ₱300 each).
--
-- The auto-redeem function created in 019_auto_redeem_ownership.sql still paid a
-- flat ₱1 for 5 levels, and member_is_green used a 12-hour window instead of the
-- 720-hour maintenance cycle the app shows. Both are corrected here.
--
-- Run this whole file in the external Supabase project's SQL Editor. It is
-- idempotent, so re-running it is safe.

-- Same green rule as maintenanceStatus() in the app: 720 h (2592000 s) of green
-- maintenance after the last redeemed code.
create or replace function public.member_is_green(m public.members) returns boolean
language plpgsql as $$
declare last_used timestamptz;
begin
  if m.maintenance_override = 'green' then return true; end if;
  if m.maintenance_override = 'red' then return false; end if;
  if coalesce(m.maintenance_timer_seconds, 0) > 0 and m.maintenance_timer_set_at is not null then
    return m.maintenance_timer_seconds - extract(epoch from clock_timestamp() - m.maintenance_timer_set_at) > 0;
  end if;
  select max(used_at) into last_used from public.maintenance_codes where is_used and used_by_member_id = m.id and used_at is not null;
  if last_used is null then return false; end if;
  return 2592000 - extract(epoch from clock_timestamp() - last_used) > 0;
end $$;

create or replace function public.run_auto_redeem() returns int
language plpgsql as $$
declare
  start_t text; tz text; local_now timestamp; today text; last_run text;
  r record; c record; up public.members; cur uuid; lvl int; n int := 0;
  -- LEVEL_CONFIG levels; Level 6 can be switched off in Admin Settings.
  max_bonus_level int := case when exists (
    select 1 from public.system_settings where setting_key = 'level6_enabled' and setting_value = 'false'
  ) then 5 else 6 end;
  level_bonus numeric := 300;  -- LEVEL_CONFIG bonus_amount, same for every level
begin
  if not pg_try_advisory_xact_lock(884201) then return 0; end if;

  -- If the admin has disabled auto-redeem, do nothing
  if exists (select 1 from public.system_settings where setting_key = 'auto_redeem_enabled' and setting_value = 'false') then
    return 0;
  end if;

  select setting_value into start_t from public.system_settings where setting_key = 'auto_redeem_start_time' limit 1;
  if start_t is null or start_t = '' then return 0; end if;
  select setting_value into tz from public.system_settings where setting_key = 'auto_redeem_timezone' limit 1;
  tz := coalesce(nullif(tz, ''), 'Asia/Manila');
  local_now := clock_timestamp() at time zone tz;
  today := local_now::date::text;
  if local_now::time < start_t::time then return 0; end if;

  select setting_value into last_run from public.system_settings where setting_key = 'auto_redeem_last_run' limit 1;
  -- Record the day (for display only), then redeem. A missing last_run row must NOT skip the day,
  -- otherwise the very first scheduled run (e.g. 8:30am) would be swallowed.
  if exists (select 1 from public.system_settings where setting_key = 'auto_redeem_last_run') then
    update public.system_settings set setting_value = today where setting_key = 'auto_redeem_last_run';
  else
    insert into public.system_settings (setting_key, setting_value) values ('auto_redeem_last_run', today);
  end if;

  -- Uplines first (shallowest referral depth), so each upline is already green when their downlines redeem
  for r in
    with recursive t(id, depth) as (
      select id, 0 from public.members where referrer_id is null
      union all select m.id, t.depth + 1 from public.members m join t on m.referrer_id = t.id
    )
    select m.* from public.members m join t on t.id = m.id
    where m.status = 'approved'
    order by t.depth, m.created_at
  loop
    -- one auto-redeem per member per local day (a code that arrives after the start time is still picked up)
    -- checks both maintenance_codes and code_redemption_history so a manual redeem
    -- (by the user or by a store on their behalf) is never double-redeemed by auto-redeem
    if exists (select 1 from public.maintenance_codes where is_used and used_by_member_id = r.id
               and (used_at at time zone tz)::date = local_now::date)
       or exists (select 1 from public.code_redemption_history where redeemed_by_member_id = r.id
                  and status = 'completed'
                  and (redeemed_at at time zone tz)::date = local_now::date) then continue; end if;

    select * into c from public.maintenance_codes
      where not is_used and assigned_username = r.username order by created_at limit 1 for update skip locked;
    if not found then continue; end if;

    update public.maintenance_codes set is_used = true, used_by_member_id = r.id, used_at = clock_timestamp() where id = c.id;
    insert into public.transactions (member_id, type, amount, description, status)
      values (r.id, 'maintenance_code', coalesce(c.amount, 0), 'Redeemed maintenance code: ' || c.code, 'completed');
    insert into public.code_redemption_history (code_id, code, redeemed_by_member_id, redeemed_by_username, store_member_id, redeemed_at, status)
      values (c.id, c.code, r.id, r.username, c.generated_by_store_id, clock_timestamp(), 'completed');

    -- The code's amount is an ownership payment; its discount lowers the payable
    if coalesce(c.amount, 0) > 0 then
      insert into public.ownership_payments (member_id, amount, note)
        values (r.id, c.amount, 'Maintenance code ' || c.code
          || case when coalesce(c.discount, 0) > 0 then ' (discount ' || c.discount || ')' else '' end);
      update public.system_settings
        set setting_value = greatest(0, coalesce(setting_value::numeric, 0) - c.amount)::text
        where setting_key = 'ownership_total_amount';
    end if;
    if coalesce(c.discount, 0) > 0 then
      if exists (select 1 from public.system_settings where setting_key = 'ownership_discount_amount') then
        update public.system_settings
          set setting_value = (coalesce(setting_value::numeric, 0) + c.discount)::text
          where setting_key = 'ownership_discount_amount';
      else
        insert into public.system_settings (setting_key, setting_value)
          values ('ownership_discount_amount', c.discount::text);
      end if;
    end if;

    -- Every code redeemed by a downline pays each upline the bonus for that level
    cur := r.id;
    for lvl in 1..max_bonus_level loop
      select u.* into up from public.members u where u.id = (select referrer_id from public.members where id = cur);
      if not found then exit; end if;
      if up.status = 'approved' and public.member_is_green(up) then
        insert into public.transactions (member_id, type, amount, bonus_level, description, status, from_member_id)
          values (up.id, 'referral_bonus', level_bonus, lvl, 'Level ' || lvl || ' bonus from ' || r.username, 'completed', r.id);
      end if;
      cur := up.id;
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;

do $$ begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('auto-redeem', '* * * * *', 'select public.run_auto_redeem()');
  end if;
exception when others then raise notice 'auto-redeem cron not scheduled: %', sqlerrm; end $$;

notify pgrst, 'reload schema';
