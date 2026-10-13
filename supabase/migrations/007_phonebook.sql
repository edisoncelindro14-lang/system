-- Store phonebook: a curated list of usernames a store can send codes to.
create table if not exists public.store_phonebook (
  id uuid primary key default gen_random_uuid(),
  store_member_id uuid references public.members(id) on delete cascade,
  username text not null,
  member_id uuid references public.members(id) on delete set null,
  created_at timestamptz default now(),
  unique (store_member_id, username)
);

create index if not exists idx_store_phonebook_store_member on public.store_phonebook(store_member_id);

grant select, insert, update, delete on public.store_phonebook to anon;
