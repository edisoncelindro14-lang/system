-- Apply to the Supabase project used by Vercel (SQL Editor or Supabase CLI).
-- Frontend deployments do not apply database migrations automatically.
begin;
alter table public.members
  add column if not exists placement_id uuid references public.members(id) on delete set null;
create index if not exists idx_members_placement on public.members(placement_id);
notify pgrst, 'reload schema';
commit;
