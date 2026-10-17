-- ========== ADMIN -> MEMBER NOTIFICATIONS ==========
-- One-way messages from the admin to a specific member. The user cannot reply.
-- The sender is always branded "Zistem Client Service" on the member's end.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.members(id) on delete cascade,
  sender_name text not null default 'Zistem Client Service',
  message text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_notifications_member on public.notifications(member_id);
create index if not exists idx_notifications_created on public.notifications(created_at desc);

-- PostgREST/anon access (the bootstrap grant in 000_local_init.sql only covers
-- tables that existed when it ran, so repeat it for this new table).
-- No sequence grant: ids use gen_random_uuid(), so there is no *_id_seq.
grant select, insert, update, delete on public.notifications to anon;
