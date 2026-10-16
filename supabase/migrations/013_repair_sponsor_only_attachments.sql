-- Repair sponsor-only genealogy attachments.
-- Approved members with a sponsor (referrer_id) but no placement_id were
-- hidden as orphan roots by the level-zero root rule: placementParent() treats
-- an approved tree_level=0 member as a root even when it retains a sponsor, so
-- such members never appeared under their sponsor in the genealogy even though
-- direct_downlines_count counted them (the "3/8 in the dropdown but 0/8 in the
-- tree" symptom). Attach each to its sponsor so the existing tree logic renders
-- them. A member whose sponsor is already a descendant (e.g. a member swapped
-- into the root slot retains its sponsor but must stay a root) is left in place
-- to avoid creating a cycle. Re-run on external Supabase after deploying; local
-- Compose applies it automatically. Idempotent: only acts on placement_id is null.

with recursive
  edges(child, parent) as (
    select id, placement_id from public.members where placement_id is not null
  ),
  descendant(start, node) as (
    select id, id from public.members
    union
    select d.start, e.child from edges e join descendant d on e.parent = d.node
  )
update public.members m
set placement_id = m.referrer_id, updated_at = now()
where m.placement_id is null
  and m.referrer_id is not null
  and m.status = 'approved'
  and m.tree_level = 0
  and not exists (
    select 1 from descendant d where d.start = m.id and d.node = m.referrer_id
  );

-- Recompute tree_level for every member from the placement roots down, using
-- the same placementParent() rule as the frontend (an approved level-zero member
-- with no placement_id is a root).
with recursive roots(id) as (
  select m.id from public.members m
  where coalesce(m.placement_id,
    case when m.status = 'approved' and m.tree_level = 0 then null else m.referrer_id end) is null
), levels(id, lvl) as (
  select id, 0 from roots
  union
  select c.id, l.lvl + 1 from public.members c join levels l
    on coalesce(c.placement_id,
      case when c.status = 'approved' and c.tree_level = 0 then null else c.referrer_id end) = l.id
)
update public.members m set tree_level = l.lvl, updated_at = now()
from levels l where m.id = l.id and m.tree_level is distinct from l.lvl;

-- Recompute direct_downlines_count from approved placement children so the
-- stored counter matches the tree after repair.
with counts(parent_id, cnt) as (
  select coalesce(placement_id,
      case when status = 'approved' and tree_level = 0 then null else referrer_id end), count(*)::int
  from public.members where status = 'approved'
  group by 1
)
update public.members m set direct_downlines_count = coalesce(c.cnt, 0), updated_at = now()
from counts c where c.parent_id = m.id and m.direct_downlines_count is distinct from coalesce(c.cnt, 0);

notify pgrst, 'reload schema';
