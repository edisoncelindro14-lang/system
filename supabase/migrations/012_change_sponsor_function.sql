-- Latest placement wins: replace the old attachment, never copy it.
-- If the selected upline is below the member (or has circular ancestry), lift
-- that upline to a root first, preserving its referral sponsor. Then move the
-- member and remaining downline below it, all in one transaction.
-- Re-run this file in the Supabase project the frontend actually uses.
begin;
alter table public.members
  add column if not exists placement_id uuid references public.members(id) on delete set null;
alter table public.members add column if not exists placement_order integer;
create index if not exists idx_members_placement on public.members(placement_id);

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
  v_target_old_placement uuid;
  v_cursor uuid;
  v_seen uuid[] := array[]::uuid[];
  v_detach_target boolean := false;
  v_new_level integer;
  v_new_order integer;
  v_relevel_root uuid;
  v_relevel_depth integer;
begin
  -- Serialize graph edits, including concurrent moves in opposite directions.
  -- Acquire before reading ancestry so every transfer uses the latest links.
  lock table public.members in share row exclusive mode;
  select * into v_member from public.members where id = p_member_id;
  if not found then raise exception 'Member not found'; end if;
  if p_member_id = p_new_sponsor_id then
    raise exception 'Cannot attach a member to themselves';
  end if;

  if p_new_sponsor_id is not null then
    select * into v_new_sponsor from public.members where id = p_new_sponsor_id;
    if not found then raise exception 'New sponsor not found'; end if;

    v_cursor := p_new_sponsor_id;
    while v_cursor is not null loop
      if v_cursor = p_member_id or v_cursor = any(v_seen) then
        v_detach_target := true;
        exit;
      end if;
      v_seen := array_append(v_seen, v_cursor);
      select placement_id into v_cursor from public.members where id = v_cursor;
    end loop;

    if v_detach_target then
      v_target_old_placement := v_new_sponsor.placement_id;
      update public.members
      set placement_id = null, placement_order = null, tree_level = 0, updated_at = now()
      where id = p_new_sponsor_id;
      v_new_sponsor.tree_level := 0;
    end if;
  end if;

  v_old_sponsor := v_member.referrer_id;
  v_old_placement := v_member.placement_id;
  v_new_level := case when p_new_sponsor_id is null then 0 else coalesce(v_new_sponsor.tree_level, 0) + 1 end;

  if not v_detach_target
     and p_new_sponsor_id is not distinct from v_old_sponsor
     and v_old_placement is not distinct from p_new_sponsor_id
     and v_member.tree_level = v_new_level then
    return jsonb_build_object('success', true, 'changed', false);
  end if;

  if p_new_sponsor_id is null then
    v_new_order := null;
  elsif v_old_placement is distinct from p_new_sponsor_id then
    select greatest(coalesce(max(placement_order), 0), count(*)::int) + 1 into v_new_order
    from public.members
    where placement_id = p_new_sponsor_id and status = 'approved' and id <> p_member_id;
  else
    v_new_order := v_member.placement_order;
  end if;

  -- Updating this one existing row removes its old placement immediately.
  update public.members
  set referrer_id = p_new_sponsor_id,
      placement_id = p_new_sponsor_id,
      placement_order = v_new_order,
      tree_level = v_new_level,
      updated_at = now()
  where id = p_member_id;

  v_relevel_root := case when v_detach_target then p_new_sponsor_id else p_member_id end;
  v_relevel_depth := case when v_detach_target then 0 else v_new_level end;
  with recursive subtree(id, depth, path) as (
    select v_relevel_root, v_relevel_depth, array[v_relevel_root]
    union all
    select m.id, s.depth + 1, s.path || m.id
    from public.members m join subtree s on m.placement_id = s.id
    where not m.id = any(s.path)
  )
  update public.members m set tree_level = s.depth, updated_at = now()
  from subtree s where m.id = s.id and m.tree_level is distinct from s.depth;

  -- Compact every changed sibling group, including the lifted upline's old group.
  with renumbered as (
    select id, row_number() over (
      partition by placement_id order by placement_order nulls last, created_date, id
    )::int as new_order
    from public.members
    where placement_id = any(array[v_old_placement, v_target_old_placement, p_new_sponsor_id])
      and status = 'approved'
  )
  update public.members m set placement_order = r.new_order, updated_at = now()
  from renumbered r where m.id = r.id and m.placement_order is distinct from r.new_order;

  with affected(id) as (
    select distinct id from unnest(array[v_old_sponsor, v_old_placement,
      v_target_old_placement, p_new_sponsor_id, p_member_id]) as ids(id)
    where id is not null
  ), counts as (
    select placement_id as parent_id, count(*)::int as cnt
    from public.members where status = 'approved' and placement_id is not null
    group by 1
  )
  update public.members m set direct_downlines_count = coalesce(c.cnt, 0), updated_at = now()
  from affected a left join counts c on c.parent_id = a.id
  where m.id = a.id and m.direct_downlines_count is distinct from coalesce(c.cnt, 0);

  return jsonb_build_object('success', true, 'changed', true);
end $$;

grant execute on function public.change_sponsor(uuid, uuid) to anon;
notify pgrst, 'reload schema';
commit;
