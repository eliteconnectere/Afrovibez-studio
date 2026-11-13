-- AfroVibe Music: required Studio submission guardrails.
-- Apply only to project crjacwqhajlfazcmeitw. Never apply to Elite Connectere.

alter table public.studio_tracks
  alter column title drop not null,
  alter column genre drop not null;
alter table public.studio_tracks
  add column if not exists rights_confirmed boolean not null default false,
  add column if not exists metadata_confirmed boolean not null default false;

create or replace function public.enforce_studio_release_requirements()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  artist_row record;
  missing_fields text[] := array[]::text[];
begin
  if new.status not in ('pending','approved') then return new; end if;

  select stage_name, artist_type, country, city, bio, avatar_path, contact_email
    into artist_row
  from public.studio_artists where id = new.artist_id;

  if not found then raise exception 'A saved artist profile is required before submitting a release.'; end if;

  if nullif(btrim(artist_row.stage_name),'') is null then missing_fields := array_append(missing_fields,'artist/stage name'); end if;
  if nullif(btrim(artist_row.artist_type),'') is null then missing_fields := array_append(missing_fields,'artist type'); end if;
  if nullif(btrim(artist_row.country),'') is null then missing_fields := array_append(missing_fields,'country'); end if;
  if nullif(btrim(artist_row.city),'') is null then missing_fields := array_append(missing_fields,'city'); end if;
  if nullif(btrim(artist_row.bio),'') is null then missing_fields := array_append(missing_fields,'artist biography'); end if;
  if nullif(btrim(artist_row.avatar_path),'') is null then missing_fields := array_append(missing_fields,'artist profile photo'); end if;
  if nullif(btrim(artist_row.contact_email),'') is null then missing_fields := array_append(missing_fields,'professional contact email'); end if;

  if nullif(btrim(new.title),'') is null then missing_fields := array_append(missing_fields,'release title'); end if;
  if nullif(btrim(new.genre),'') is null then missing_fields := array_append(missing_fields,'genre'); end if;
  if new.release_type is distinct from 'Single' then missing_fields := array_append(missing_fields,'supported release type (Single only until multi-track releases are implemented)'); end if;
  if nullif(btrim(new.language),'') is null then missing_fields := array_append(missing_fields,'language'); end if;
  if new.release_date is null then missing_fields := array_append(missing_fields,'release date'); end if;
  if nullif(btrim(new.explicit_content),'') is null then missing_fields := array_append(missing_fields,'explicit-content classification'); end if;
  if nullif(btrim(new.audio_path),'') is null or nullif(btrim(new.audio_filename),'') is null then missing_fields := array_append(missing_fields,'audio file'); end if;
  if nullif(btrim(new.artwork_path),'') is null then missing_fields := array_append(missing_fields,'cover artwork'); end if;
  if nullif(btrim(new.producers),'') is null and nullif(btrim(new.songwriters),'') is null and nullif(btrim(new.composers),'') is null then
    missing_fields := array_append(missing_fields,'at least one producer, songwriter or composer credit');
  end if;
  if new.rights_confirmed is not true then missing_fields := array_append(missing_fields,'distribution-rights confirmation'); end if;
  if new.metadata_confirmed is not true then missing_fields := array_append(missing_fields,'metadata-accuracy confirmation'); end if;

  if coalesce(array_length(missing_fields,1),0) > 0 then
    raise exception 'Cannot submit or publish this release. Complete required items: %', array_to_string(missing_fields, ', ');
  end if;
  if new.status = 'pending' and new.submitted_at is null then new.submitted_at := now(); end if;
  return new;
end;
$$;

drop trigger if exists studio_release_requirements_guard on public.studio_tracks;
create trigger studio_release_requirements_guard
before insert or update on public.studio_tracks
for each row execute function public.enforce_studio_release_requirements();

drop policy if exists "artist insert own tracks" on public.studio_tracks;
create policy "artist insert own draft or submission" on public.studio_tracks
for insert to authenticated
with check (
  status in ('draft','pending')
  and exists (select 1 from public.studio_artists a
    where a.id = studio_tracks.artist_id and a.owner_user_id = (select auth.uid()))
);

drop policy if exists "artists delete own media" on storage.objects;
create policy "artists delete own media" on storage.objects
for delete to authenticated
using (
  bucket_id in ('studio-audio','studio-artwork')
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (storage.foldername(name))[1] in (
      select a.id::text from public.studio_artists a where a.owner_user_id = (select auth.uid())
    )
  )
);

-- Consolidate equivalent permissive policies to keep RLS evaluation efficient.
drop policy if exists "admins read all artist profiles" on public.studio_artists;
drop policy if exists "artist self read" on public.studio_artists;
create policy "artists and admins read permitted profiles" on public.studio_artists
for select to authenticated
using (
  owner_user_id = (select auth.uid())
  or exists (select 1 from public.studio_profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);

drop policy if exists "admins read all studio tracks" on public.studio_tracks;
drop policy if exists "approved tracks or own submissions readable" on public.studio_tracks;
create policy "listeners artists and admins read permitted tracks" on public.studio_tracks
for select to anon, authenticated
using (
  status = 'approved'
  or exists (select 1 from public.studio_artists a where a.id = studio_tracks.artist_id and a.owner_user_id = (select auth.uid()))
  or exists (select 1 from public.studio_profiles p where p.id = (select auth.uid()) and p.role = 'admin')
);

drop policy if exists "admins review studio tracks" on public.studio_tracks;
drop policy if exists "artist update own nonapproved tracks" on public.studio_tracks;
create policy "artists and admins update permitted tracks" on public.studio_tracks
for update to authenticated
using (
  exists (select 1 from public.studio_profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  or (status in ('draft','rejected') and exists (
    select 1 from public.studio_artists a where a.id = studio_tracks.artist_id and a.owner_user_id = (select auth.uid())
  ))
)
with check (
  exists (select 1 from public.studio_profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  or (status in ('draft','pending','rejected') and exists (
    select 1 from public.studio_artists a where a.id = studio_tracks.artist_id and a.owner_user_id = (select auth.uid())
  ))
);

create index if not exists studio_tracks_reviewed_by_idx on public.studio_tracks(reviewed_by);
