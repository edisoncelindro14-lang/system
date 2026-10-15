-- Persist horizontal slots so a position swap also exchanges sibling positions.
-- Apply to the Supabase project used by deployed frontends as well as local dev.
begin;
alter table public.members add column if not exists placement_order integer;
notify pgrst, 'reload schema';
commit;
