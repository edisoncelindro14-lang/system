-- Break existing placement cycles in the genealogy tree.
-- A cycle occurs when following placement_id links from a member leads back to
-- that member (e.g. A.placement_id = B and B.placement_id = A). The TreeNode
-- component has a cycle guard that prevents infinite recursion, but the data is
-- still corrupt: each member in the cycle appears as a child in the other's
-- tree, producing the "copy from a different upline genealogy group" symptom.
--
-- This migration detects cycles and breaks them. For the two known cycles the
-- user specified which node to keep "above" (as root):
--   1. "a above k"  → detach a  (a becomes root, k stays under a)
--   2. "an above j" → detach an (an becomes root, j stays under an)
-- For any other cycles not covered by the explicit list, the youngest node
-- (most recent created_date) is detached as a fallback.
-- The detached member keeps its sponsor (referrer_id) but is no longer placed
-- under anyone, so it stops appearing as a duplicate in the other group's tree.
-- Run the UPDATED 012_change_sponsor_function.sql on external Supabase first
-- so future moves cannot recreate cycles.
-- Local Compose applies this automatically; re-run on external Supabase after deploying.
-- Idempotent: only acts on members that are part of a cycle.

with recursive
  -- Walk the placement chain from every member, tracking the path.
  -- A cycle is detected when the next placement_id is already in the path.
  -- That step IS emitted (so the cycle is visible) but recursion stops there
  -- because cycle_member is set — subsequent rows with cycle_member IS NOT NULL
  -- are excluded by the WHERE clause.
  walk(start_id, current_id, next_id, path, cycle_member) as (
    select id, id, placement_id, array[id], null::uuid
    from public.members
    where placement_id is not null
    union
    select
      w.start_id,
      m.placement_id,
      m2.placement_id,
      w.path || m.placement_id,
      case when m.placement_id = any(w.path) then m.placement_id else null end
    from walk w
    join public.members m on m.id = w.current_id
    left join public.members m2 on m2.id = m.placement_id
    where w.cycle_member is null
      and m.placement_id is not null
  ),
  -- Collect the distinct set of members that are IN a cycle (not just
  -- leading to one). A member is in a cycle when the walk from them returns
  -- to them: start_id = cycle_member. Members that merely lead into a cycle
  -- (start_id <> cycle_member) are excluded so we don't detach them.
  cycle_nodes(id) as (
    select distinct w.start_id
    from walk w
    where w.cycle_member = w.start_id
  ),
  -- User-specified detach priorities for the two known cycles.
  -- "a above k"  → detach a  (a becomes root, k stays under a)
  -- "an above j" → detach an (an becomes root, j stays under an)
  explicit_detach(id) as (
    select m.id
    from public.members m
    where m.username in ('a', 'an')
      and m.id in (select id from cycle_nodes)
  ),
  -- Cycle nodes already handled by the explicit list: the detached node
  -- itself plus the other node in its 2-node cycle (the one it points to).
  handled_cycle_nodes(id) as (
    select id from explicit_detach
    union
    select m.placement_id
    from public.members m
    where m.id in (select id from explicit_detach)
      and m.placement_id in (select id from cycle_nodes)
  ),
  -- For any remaining cycles not covered above, fall back to the youngest
  -- node (most recent created_date). Breaking one link dissolves the cycle.
  fallback_detach(id) as (
    select c.id
    from cycle_nodes c
    join public.members m on m.id = c.id
    where c.id not in (select id from handled_cycle_nodes)
      and m.placement_id in (select id from cycle_nodes)
      and m.created_date = (
        select max(m2.created_date)
        from public.members m2
        where m2.id in (select id from cycle_nodes)
          and m2.id not in (select id from handled_cycle_nodes)
      )
  ),
  detach_target(id) as (
    select id from explicit_detach
    union
    select id from fallback_detach
  )
update public.members m
set placement_id = null,
    tree_level = 0,
    updated_at = now()
from detach_target d
where m.id = d.id;

-- Recompute tree_level for every member from the placement roots down.
-- placement_id only — no referrer_id fallback (matches frontend placementParent).
with recursive roots(id) as (
  select m.id from public.members m
  where m.placement_id is null
), levels(id, lvl) as (
  select id, 0 from roots
  union
  select c.id, l.lvl + 1 from public.members c join levels l
    on c.placement_id = l.id
)
update public.members m set tree_level = l.lvl, updated_at = now()
from levels l where m.id = l.id and m.tree_level is distinct from l.lvl;

-- Recompute direct_downlines_count from approved placement children so the
-- stored counter matches the tree after repair.
with counts(parent_id, cnt) as (
  select placement_id, count(*)::int
  from public.members where status = 'approved' and placement_id is not null
  group by 1
)
update public.members m set direct_downlines_count = coalesce(c.cnt, 0), updated_at = now()
from counts c where c.parent_id = m.id and m.direct_downlines_count is distinct from coalesce(c.cnt, 0);

notify pgrst, 'reload schema';
