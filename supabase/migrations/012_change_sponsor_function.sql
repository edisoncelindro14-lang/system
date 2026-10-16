-- Atomic sponsor rotation with matching genealogy placement.
-- Re-run this migration on external Supabase after updating the app.
-- Re-selecting an existing sponsor also repairs a stale placement link.
-- An ancestor keeps its incoming link instead of being rotated below itself.

create or replace function public.change_sponsor(p_member_id uuid, p_new_sponsor_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member public.members%rowtype;
  v_new_sponsor public.members%rowtype;
  v_old_sponsor uuid;
  v_old_placement uuid;
  v_target_placement uuid;
  v_sponsor_changed boolean;
  v_sponsor_ancestor boolean := false;
  v_placement_ancestor boolean := false;
  v_cycle_ids uuid[];
  v_base_id uuid;
  v_base_level integer;
begin
  select * into v_member from public.members where id = p_member_id for update;
  if not found then raise exception 'Member not found'; end if;
  if p_member_id = p_new_sponsor_id then
    raise exception 'Cannot attach a member to themselves';
  end if;

  if p_new_sponsor_id is not null then
    select * into v_new_sponsor from public.members where id = p_new_sponsor_id for update;
    if not found then raise exception 'New sponsor not found'; end if;
  end if;

  v_old_sponsor := v_member.referrer_id;
  v_sponsor_changed := p_new_sponsor_id is distinct from v_old_sponsor;
  -- Match placementParent() in the frontend, including explicit level-zero roots.
  v_old_placement := coalesce(v_member.placement_id,
    case when v_member.status = 'approved' and v_member.tree_level = 0 then null else v_member.referrer_id end);
  v_target_placement := coalesce(v_new_sponsor.placement_id,
    case when v_new_sponsor.status = 'approved' and v_new_sponsor.tree_level = 0 then null else v_new_sponsor.referrer_id end);

  if not v_sponsor_changed
     and v_member.placement_id is not distinct from p_new_sponsor_id
     and v_member.tree_level = (case when p_new_sponsor_id is null then 0 else v_new_sponsor.tree_level + 1 end) then
    return jsonb_build_object('success', true, 'changed', false);
  end if;

  -- Inspect placement before changing referral links used by legacy placements.
  with recursive ancestors(id, parent_id, path) as (
    select m.id, coalesce(m.placement_id,
      case when m.status = 'approved' and m.tree_level = 0 then null else m.referrer_id end), array[m.id]
    from public.members m where m.id = p_member_id
    union all
    select m.id, coalesce(m.placement_id,
      case when m.status = 'approved' and m.tree_level = 0 then null else m.referrer_id end), a.path || m.id
    from public.members m join ancestors a on m.id = a.parent_id
    where not m.id = any(a.path)
  )
  select exists(select 1 from ancestors where id = p_new_sponsor_id) into v_placement_ancestor;

  if v_sponsor_changed then
    -- Detach a legacy referral cycle before rotating the pair.
    with recursive downline(id, path, is_cycle) as (
      select p_member_id, array[p_member_id], false
      union all
      select m.id, d.path || m.id, m.id = any(d.path)
      from public.members m join downline d on m.referrer_id = d.id
      where not d.is_cycle
    )
    select array_agg(distinct id) into v_cycle_ids from downline where is_cycle;
    if v_cycle_ids is not null then
      update public.members set referrer_id = null, updated_at = now() where id = any(v_cycle_ids);
      select referrer_id into v_old_sponsor from public.members where id = p_member_id;
    end if;

    with recursive ancestors(id, parent_id, path) as (
      select m.id, m.referrer_id, array[m.id] from public.members m where m.id = p_member_id
      union all
      select m.id, m.referrer_id, a.path || m.id
      from public.members m join ancestors a on m.id = a.parent_id
      where not m.id = any(a.path)
    )
    select exists(select 1 from ancestors where id = p_new_sponsor_id) into v_sponsor_ancestor;

    if p_new_sponsor_id is not null and not v_sponsor_ancestor then
      update public.members set referrer_id = v_old_sponsor, updated_at = now()
      where id = p_new_sponsor_id;
    end if;
    update public.members set referrer_id = p_new_sponsor_id, updated_at = now()
    where id = p_member_id;
  end if;

  -- Rotate genealogy positions as well: changing only referrer_id leaves the
  -- member invisible beneath the new sponsor whenever placement_id is set.
  if p_new_sponsor_id is not null then
    if not v_placement_ancestor then
      v_target_placement := v_old_placement;
    end if;
    update public.members
    set placement_id = v_target_placement,
        placement_order = case when v_placement_ancestor then placement_order else v_member.placement_order end,
        tree_level = case when v_target_placement is null then 0 else greatest(1, tree_level) end,
        updated_at = now()
    where id = p_new_sponsor_id;
  end if;

  update public.members
  set placement_id = p_new_sponsor_id,
      placement_order = case when placement_id is not distinct from p_new_sponsor_id then placement_order else null end,
      tree_level = case when p_new_sponsor_id is null then 0 else 1 end,
      updated_at = now()
  where id = p_member_id;

  -- Find the actual depth, not a stale stored level, then refresh both moved
  -- subtrees without changing their owners, approvals, maintenance or earnings.
  v_base_id := coalesce(p_new_sponsor_id, p_member_id);
  with recursive ancestors(id, parent_id, depth, path) as (
    select m.id, coalesce(m.placement_id,
      case when m.status = 'approved' and m.tree_level = 0 then null else m.referrer_id end), 0, array[m.id]
    from public.members m where m.id = v_base_id
    union all
    select m.id, coalesce(m.placement_id,
      case when m.status = 'approved' and m.tree_level = 0 then null else m.referrer_id end), a.depth + 1, a.path || m.id
    from public.members m join ancestors a on m.id = a.parent_id
    where not m.id = any(a.path)
  )
  select depth into v_base_level from ancestors where parent_id is null;
  if v_base_level is null then
    raise exception 'The existing placement chain needs repair; no sponsor changes were saved';
  end if;

  with recursive subtree(id, depth, path) as (
    select v_base_id, v_base_level, array[v_base_id]
    union all
    select m.id, s.depth + 1, s.path || m.id
    from public.members m join subtree s on coalesce(m.placement_id,
      case when m.status = 'approved' and m.tree_level = 0 then null else m.referrer_id end) = s.id
    where not m.id = any(s.path)
  )
  update public.members m set tree_level = s.depth, updated_at = now()
  from subtree s where m.id = s.id and m.tree_level is distinct from s.depth;

  -- Genealogy counters describe approved placement children, like the tree UI.
  with affected(id) as (
    select distinct id from unnest(array[v_member.referrer_id, v_old_placement,
      v_new_sponsor.referrer_id, v_new_sponsor.placement_id, p_new_sponsor_id, p_member_id]) as ids(id)
    where id is not null
  ), counts as (
    select coalesce(placement_id,
      case when status = 'approved' and tree_level = 0 then null else referrer_id end) as parent_id, count(*)::int as cnt
    from public.members where status = 'approved'
    group by 1
  )
  update public.members m set direct_downlines_count = coalesce(c.cnt, 0), updated_at = now()
  from affected a left join counts c on c.parent_id = a.id
  where m.id = a.id and m.direct_downlines_count is distinct from coalesce(c.cnt, 0);

  return jsonb_build_object('success', true, 'changed', true,
    'swapped', v_sponsor_changed and p_new_sponsor_id is not null and not v_sponsor_ancestor,
    'cycles_detached', coalesce(array_length(v_cycle_ids, 1), 0));
end $$;

grant execute on function public.change_sponsor(uuid, uuid) to anon;
notify pgrst, 'reload schema';
