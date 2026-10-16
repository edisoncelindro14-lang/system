-- Simple sponsor transfer: set referrer_id + placement_id to the new sponsor.
-- No cycle restrictions, no position rotation, no duplicate checks.
-- Re-run this migration on external Supabase after updating the app.

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
  v_new_level integer;
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
  -- Match placementParent() in the frontend, including explicit level-zero roots.
  v_old_placement := coalesce(v_member.placement_id,
    case when v_member.status = 'approved' and v_member.tree_level = 0 then null else v_member.referrer_id end);

  -- No-op if nothing changed
  if p_new_sponsor_id is not distinct from v_old_sponsor
     and v_member.placement_id is not distinct from p_new_sponsor_id
     and v_member.tree_level = (case when p_new_sponsor_id is null then 0 else v_new_sponsor.tree_level + 1 end) then
    return jsonb_build_object('success', true, 'changed', false);
  end if;

  -- Simple transfer: set referrer_id and placement_id to the new sponsor.
  v_new_level := case when p_new_sponsor_id is null then 0 else v_new_sponsor.tree_level + 1 end;

  update public.members
  set referrer_id = p_new_sponsor_id,
      placement_id = p_new_sponsor_id,
      tree_level = v_new_level,
      updated_at = now()
  where id = p_member_id;

  -- Recalculate tree_level for the entire subtree under the member.
  with recursive subtree(id, depth, path) as (
    select p_member_id, v_new_level, array[p_member_id]
    union all
    select m.id, s.depth + 1, s.path || m.id
    from public.members m join subtree s on coalesce(m.placement_id,
      case when m.status = 'approved' and m.tree_level = 0 then null else m.referrer_id end) = s.id
    where not m.id = any(s.path)
  )
  update public.members m set tree_level = s.depth, updated_at = now()
  from subtree s where m.id = s.id and m.tree_level is distinct from s.depth;

  -- Recount direct_downlines_count for old and new sponsors (and old/new placement parents).
  with affected(id) as (
    select distinct id from unnest(array[v_old_sponsor, v_old_placement,
      p_new_sponsor_id, p_new_sponsor_id]) as ids(id)
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

  return jsonb_build_object('success', true, 'changed', true);
end $$;

grant execute on function public.change_sponsor(uuid, uuid) to anon;
notify pgrst, 'reload schema';
