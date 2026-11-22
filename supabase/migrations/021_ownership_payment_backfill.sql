-- Backfills ownership payments for maintenance codes redeemed before the code's
-- amount was recorded as a payment: every already-used code with an amount counts
-- as a payment for the member who redeemed it, dated when it was redeemed. Codes
-- without an amount credit nothing, and payments that already exist (live
-- redemption, auto-redeem) are left alone, so re-running this file is safe.
--
-- Run this whole file in the external Supabase project's SQL Editor.

insert into public.ownership_payments (member_id, amount, note, created_date)
select c.used_by_member_id,
       coalesce(c.amount, 0),
       'Maintenance code ' || c.code,
       coalesce(c.used_at, now())
from public.maintenance_codes c
where c.is_used
  and c.used_by_member_id is not null
  and coalesce(c.amount, 0) > 0
  and not exists (
    select 1 from public.ownership_payments p
    where p.member_id = c.used_by_member_id
      and p.note like 'Maintenance code ' || c.code || '%'
  );

notify pgrst, 'reload schema';
