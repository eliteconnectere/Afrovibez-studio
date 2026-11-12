-- AfroVibe Studio: initial isolated database schema.
-- Apply only to the dedicated Studio Supabase project, never to Elite Connectere.
create extension if not exists pgcrypto;

create table if not exists public.studio_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'artist' check (role in ('artist','admin')),
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_artists (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null unique references auth.users(id) on delete cascade,
  stage_name text not null,
  bio text,
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.studio_tracks (
  id uuid primary key default gen_random_uuid(),
  artist_id uuid not null references public.studio_artists(id) on delete cascade,
  title text not null,
  genre text not null,
  release_type text not null default 'Single' check (release_type in ('Single','EP','Album')),
  language text,
  description text,
  audio_path text,
  artwork_path text,
  status text not null default 'draft' check (status in ('draft','pending','approved','rejected')),
  review_note text,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  approved_at timestamptz,
  afro_vibez_track_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_tracks_artist_id_idx on public.studio_tracks(artist_id);
create index if not exists studio_tracks_status_idx on public.studio_tracks(status);
create index if not exists studio_tracks_approved_at_idx on public.studio_tracks(approved_at desc) where status = 'approved';

alter table public.studio_profiles enable row level security;
alter table public.studio_artists enable row level security;
alter table public.studio_tracks enable row level security;

-- Profile owners can read their own profile. Admin access is determined by the protected role column.
create policy "profiles read own or admin" on public.studio_profiles
for select to authenticated
using (id = (select auth.uid()) or exists (
  select 1 from public.studio_profiles p
  where p.id = (select auth.uid()) and p.role = 'admin'
));

create policy "artists read own or admin" on public.studio_artists
for select to authenticated
using (owner_user_id = (select auth.uid()) or exists (
  select 1 from public.studio_profiles p
  where p.id = (select auth.uid()) and p.role = 'admin'
));

create policy "artists create own profile" on public.studio_artists
for insert to authenticated
with check (owner_user_id = (select auth.uid()));

create policy "artists update own or admin" on public.studio_artists
for update to authenticated
using (owner_user_id = (select auth.uid()) or exists (
  select 1 from public.studio_profiles p
  where p.id = (select auth.uid()) and p.role = 'admin'
))
with check (owner_user_id = (select auth.uid()) or exists (
  select 1 from public.studio_profiles p
  where p.id = (select auth.uid()) and p.role = 'admin'
));

-- Approved tracks are readable to the listener app. Artists can read their own tracks;
-- administrators can review every submission.
create policy "approved tracks publicly readable" on public.studio_tracks
for select to anon, authenticated
using (
  status = 'approved'
  or exists (
    select 1 from public.studio_artists a
    where a.id = studio_tracks.artist_id and a.owner_user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.studio_profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

create policy "artists create own tracks" on public.studio_tracks
for insert to authenticated
with check (exists (
  select 1 from public.studio_artists a
  where a.id = studio_tracks.artist_id and a.owner_user_id = (select auth.uid())
));

create policy "artists update own drafts and admin updates" on public.studio_tracks
for update to authenticated
using (
  (status in ('draft','rejected') and exists (
    select 1 from public.studio_artists a
    where a.id = studio_tracks.artist_id and a.owner_user_id = (select auth.uid())
  ))
  or exists (
    select 1 from public.studio_profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.studio_artists a
    where a.id = studio_tracks.artist_id
      and a.owner_user_id = (select auth.uid())
  )
  and status in ('draft','pending','rejected')
  or exists (
    select 1 from public.studio_profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  )
);

-- Private bucket: signed playback URLs / server-mediated delivery should be used.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-audio',
  'studio-audio',
  false,
  104857600,
  array['audio/mpeg','audio/wav','audio/mp4','audio/aac','audio/flac']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'studio-artwork',
  'studio-artwork',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do nothing;

-- Storage object names must begin with the authenticated artist UUID.
create policy "artist upload own audio" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'studio-audio'
  and (storage.foldername(name))[1] in (
    select a.id::text from public.studio_artists a where a.owner_user_id = (select auth.uid())
  )
);

create policy "artist read own audio or admin" on storage.objects
for select to authenticated
using (
  bucket_id in ('studio-audio','studio-artwork')
  and (
    (storage.foldername(name))[1] in (
      select a.id::text from public.studio_artists a where a.owner_user_id = (select auth.uid())
    )
    or exists (select 1 from public.studio_profiles p where p.id = (select auth.uid()) and p.role = 'admin')
  )
);

create policy "artist upload own artwork" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'studio-artwork'
  and (storage.foldername(name))[1] in (
    select a.id::text from public.studio_artists a where a.owner_user_id = (select auth.uid())
  )
);

-- NOTE: Do not grant admin role from user-editable auth metadata.
-- Provision the first admin explicitly from a trusted SQL/admin workflow.
-- AfroVibez integration should consume only approved rows and must never expose private storage keys.
