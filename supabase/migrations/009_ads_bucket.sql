-- Public storage bucket for ad videos (run in the Supabase SQL editor; not needed for the local stack).
insert into storage.buckets (id, name, public, file_size_limit)
values ('ads', 'ads', true, 524288000)
on conflict (id) do update set public = true, file_size_limit = 524288000;

drop policy if exists "ads_public_read" on storage.objects;
create policy "ads_public_read" on storage.objects for select using (bucket_id = 'ads');
drop policy if exists "ads_public_insert" on storage.objects;
create policy "ads_public_insert" on storage.objects for insert with check (bucket_id = 'ads');
