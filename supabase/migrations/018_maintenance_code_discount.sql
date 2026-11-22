-- Optional discount carried by a generated maintenance code. On redemption the
-- code's discount is added to the system ownership discount so it lowers the
-- payable amount for the member.
--
-- Run this whole file in the external Supabase project's SQL Editor. It is
-- idempotent, so re-running it is safe.

alter table public.maintenance_codes add column if not exists discount numeric default 0;

-- Ask PostgREST to pick up the new column immediately.
notify pgrst, 'reload schema';
