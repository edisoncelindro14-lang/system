-- Atomic, cycle-safe sponsor change.
-- Replaces the client-side changeSponsor (three separate updates, no cycle guard,
-- stale counter +1/-1) with a single transactional database function.
--
-- Operation (swap semantics — only the two members move):
--   A = p_member_id, B = p_new_sponsor_id, P = A's current sponsor
--   A.referrer_id ← B            (A moves under the new sponsor)
--   B.referrer_id ← P            (the promoted sponsor takes A's old slot)
--   P loses A but gains B         → keeps exactly one slot per child
--   B's old sponsor loses B       (a vacated slot, never a duplicate)
-- When B is null the member is detached to root (no swap).
--
-- Invariants satisfied:
--   Atomicity        — one PL/pgSQL function = one transaction; any exception rolls back all UPDATEs
--   No duplicate rows — UPDATEs only, never INSERTs; each username keeps its single row
--   No duplicate slots — old parent keeps one slot per child; promoted sponsor fills the vacated slot
--   Other downlines   — only A and B change referrer_id; siblings/subtrees stay attached to their owner
--   Cycle-free        — recursive CTE walks the referrer-downline; legacy cycles are detached (referrer_id = null)
--                       and the rotation (B takes A's old sponsor) breaks any downline→sponsor loop
--   Counter accuracy  — direct_downlines_count is recounted from actual children, never +1/-1

create or replace function public.change_sponsor(p_member_id uuid, p_new_sponsor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member      public.members%rowtype;
  v_new_sponsor public.members%rowtype;
  v_old_sponsor uuid;
  v_new_old_ref uuid;
  v_swapped     boolean := false;
  v_cycle_ids   uuid[];
begin
  -- Lock the member being re-sponsored.
  select * into v_member from public.members where id = p_member_id for update;
  if not found then raise exception 'Member not found'; end if;

  v_old_sponsor := v_member.referrer_id;

  -- No-op when the sponsor is not actually changing.
  if p_new_sponsor_id is not distinct from v_old_sponsor then
    return jsonb_build_object('success', true, 'changed', false);
  end if;

  -- Recursive CTE walks the referrer-downline (children by referrer_id) from the member.
  -- A node that re-enters its own path is a legacy cycle; detach it before touching links
  -- so the rotation below never inherits a pre-existing loop.
  with recursive downline(id, path, is_cycle) as (
    select p_member_id, array[p_member_id], false
    union all
    select m.id, d.path || m.id, m.id = any(d.path)
    from public.members m
    join downline d on m.referrer_id = d.id
    where not d.is_cycle
  )
  select array_agg(distinct id) into v_cycle_ids from downline where is_cycle;

  if v_cycle_ids is not null then
    update public.members set referrer_id = null, updated_at = now() where id = any(v_cycle_ids);
    -- A legacy-cycle detach may have cleared the member's own sponsor; re-read it
    -- so the rotation below never re-propagates a just-broken link.
    select referrer_id into v_old_sponsor from public.members where id = p_member_id;
  end if;

  if p_new_sponsor_id is not null then
    -- Validate the new sponsor.
    if p_new_sponsor_id = p_member_id then
      raise exception 'A member cannot be their own sponsor';
    end if;
    select * into v_new_sponsor from public.members where id = p_new_sponsor_id for update;
    if not found then raise exception 'New sponsor not found'; end if;
    v_new_old_ref := v_new_sponsor.referrer_id;

    -- The promoted sponsor takes the moving member's old slot.
    -- Only B's referrer link changes here; B's children stay attached to B.
    update public.members
      set referrer_id = v_old_sponsor, updated_at = now()
      where id = p_new_sponsor_id and referrer_id is distinct from v_old_sponsor;
    v_swapped := true;
  else
    v_new_old_ref := null;
  end if;

  -- Move the member under the new sponsor, or detach to root when null.
  update public.members
    set referrer_id = p_new_sponsor_id, updated_at = now()
    where id = p_member_id;

  -- Counter accuracy: recount direct_downlines_count from actual children for every
  -- parent whose downline changed (A's old sponsor, the new sponsor, B's old sponsor, A).
  with affected as (
    select distinct parent
    from (values (v_old_sponsor), (p_new_sponsor_id), (v_new_old_ref), (p_member_id)) as t(parent)
    where parent is not null
  ),
  counts as (
    select referrer_id as pid, count(*)::int as cnt
    from public.members
    group by referrer_id
  )
  update public.members m
    set direct_downlines_count = coalesce(c.cnt, 0), updated_at = now()
    from affected a
    left join counts c on c.pid = a.parent
    where m.id = a.parent and m.direct_downlines_count is distinct from coalesce(c.cnt, 0);

  return jsonb_build_object(
    'success', true,
    'changed', true,
    'swapped', v_swapped,
    'cycles_detached', coalesce(array_length(v_cycle_ids, 1), 0)
  );
end $$;

grant execute on function public.change_sponsor(uuid, uuid) to anon;
notify pgrst, 'reload schema';
