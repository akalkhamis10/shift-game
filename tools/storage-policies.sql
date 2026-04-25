-- Storage policies for the `media` bucket.
-- The objects table lives in the `storage` schema.

drop policy if exists media_read_all      on storage.objects;
drop policy if exists media_admin_insert  on storage.objects;
drop policy if exists media_admin_update  on storage.objects;
drop policy if exists media_admin_delete  on storage.objects;

-- Everyone can SELECT objects in the media bucket (game needs media URLs to
-- be fetchable without auth).
create policy media_read_all on storage.objects
  for select
  using (bucket_id = 'media');

-- Only admins can write/replace/delete objects in the media bucket.
create policy media_admin_insert on storage.objects
  for insert
  with check (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admins)
  );

create policy media_admin_update on storage.objects
  for update
  using (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admins)
  )
  with check (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admins)
  );

create policy media_admin_delete on storage.objects
  for delete
  using (
    bucket_id = 'media'
    and (auth.jwt() ->> 'email') in (select email from public.admins)
  );
