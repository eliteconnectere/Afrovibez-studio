-- AfroVibez artist stream analytics
-- Apply to the dedicated AfroVibe Music project: crjacwqhajlfazcmeitw
-- Counts a stream after at least 30 seconds of playback, deduplicated per
-- browser/device and release for 30 minutes. Device IDs are estimates, not
-- verified people; person-level unique listeners require listener accounts.

create table if not exists public.studio_track_streams (
  id bigint generated always as identity primary key,
  track_id uuid not null references public.studio_tracks(id) on delete cascade,
  listener_key uuid not null,
  listened_seconds integer not null check (listened_seconds >= 30 and listened_seconds <= 86400),
  streamed_at timestamptz not null default now()
);
create index if not exists studio_track_streams_track_time_idx
  on public.studio_track_streams (track_id, streamed_at desc);
create index if not exists studio_track_streams_listener_idx
  on public.studio_track_streams (track_id, listener_key, streamed_at desc);
alter table public.studio_track_streams enable row level security;
revoke all on table public.studio_track_streams from anon, authenticated;
grant select on table public.studio_track_streams to authenticated;
drop policy if exists "Artists can read streams for their own releases" on public.studio_track_streams;
create policy "Artists can read streams for their own releases"
on public.studio_track_streams for select to authenticated
using (
  exists (
    select 1 from public.studio_tracks t
    join public.studio_artists a on a.id = t.artist_id
    where t.id = studio_track_streams.track_id
      and a.owner_user_id = (select auth.uid())
  )
);
create or replace function public.record_track_stream(
  p_track_id uuid, p_listener_key uuid, p_listened_seconds integer
) returns boolean
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if p_track_id is null or p_listener_key is null
     or p_listened_seconds is null
     or p_listened_seconds < 30 or p_listened_seconds > 86400 then
    return false;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_track_id::text || ':' || p_listener_key::text, 0));
  if not exists (
    select 1 from public.studio_tracks
    where id = p_track_id and status = 'approved' and release_date <= current_date
  ) then return false; end if;
  if exists (
    select 1 from public.studio_track_streams
    where track_id = p_track_id and listener_key = p_listener_key
      and streamed_at >= now() - interval '30 minutes'
  ) then return false; end if;
  insert into public.studio_track_streams(track_id, listener_key, listened_seconds)
  values (p_track_id, p_listener_key, p_listened_seconds);
  return true;
end;
$$;
revoke all on function public.record_track_stream(uuid, uuid, integer) from public;
grant execute on function public.record_track_stream(uuid, uuid, integer) to anon, authenticated;
