-- Hyrox Tracker MVP schema.
-- Run this whole file once in Supabase: SQL Editor > New query > Run.

-- 1. Profiles: one row per user, created automatically at sign-up.
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('coach', 'athlete')),
  name text,
  email text
);

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, role, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'athlete'),
    new.raw_user_meta_data->>'name',
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- 2. Coach-athlete links. A coach asks; the athlete must accept before the coach can see data.
create table if not exists coach_athletes (
  coach_id uuid not null references profiles(id) on delete cascade,
  athlete_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  primary key (coach_id, athlete_id)
);

-- 3. Sessions logged by athletes.
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles(id) on delete cascade,
  session_date date not null default current_date,
  category text not null default 'training' check (category in ('training', 'full_simulation', 'half_sim', 'benchmark')),
  rpe integer check (rpe between 1 and 10),
  type text default 'training',
  total_time_sec integer,
  created_at timestamptz not null default now()
);

-- 4. One row per leg: legs 1,3,5...15 are runs; 2,4,...,16 are stations.
create table if not exists station_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  leg integer not null check (leg between 1 and 16),
  time_sec integer not null check (time_sec >= 0),
  weight_kg numeric,
  reps integer,
  unique (session_id, leg)
);

-- Helper: is the current user an accepted coach of this athlete?
create or replace function is_accepted_coach_of(athlete uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from coach_athletes
    where coach_id = auth.uid()
      and athlete_id = athlete
      and status = 'accepted'
  );
$$;

-- Coach asks to link to an athlete by email. Returns 'requested', 'not_found', or 'not_allowed'.
-- Security definer so the email lookup does not need to be exposed through table access.
create or replace function request_athlete(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_athlete uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'coach') then
    return 'not_allowed';
  end if;

  select id into v_athlete
  from profiles
  where lower(email) = lower(trim(p_email)) and role = 'athlete';

  if v_athlete is null then
    return 'not_found';
  end if;

  insert into coach_athletes (coach_id, athlete_id, status)
  values (auth.uid(), v_athlete, 'pending')
  on conflict (coach_id, athlete_id) do nothing;

  return 'requested';
end;
$$;

-- Row Level Security: every table locked down by default.
alter table profiles enable row level security;
alter table coach_athletes enable row level security;
alter table sessions enable row level security;
alter table station_results enable row level security;

-- Profiles: you see your own, plus the name/email of anyone you are linked to
-- (pending or accepted), so requests show up with a name. Session data is still gated separately.
create policy "profiles: read own or linked" on profiles for select
  using (
    id = auth.uid()
    or exists (
      select 1 from coach_athletes ca
      where (ca.coach_id = auth.uid() and ca.athlete_id = profiles.id)
         or (ca.athlete_id = auth.uid() and ca.coach_id = profiles.id)
    )
  );

create policy "profiles: update own" on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- Links: both sides can see the link. Athlete can accept (update) or decline (delete).
-- Coach can remove their own link. Coach creates links only through request_athlete().
create policy "links: read" on coach_athletes for select
  using (coach_id = auth.uid() or athlete_id = auth.uid());

create policy "links: athlete accepts" on coach_athletes for update
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

create policy "links: athlete declines or coach removes" on coach_athletes for delete
  using (athlete_id = auth.uid() or coach_id = auth.uid());

-- Sessions: athletes manage their own; accepted coaches read.
create policy "sessions: read own or coached" on sessions for select
  using (athlete_id = auth.uid() or is_accepted_coach_of(athlete_id));

create policy "sessions: athlete inserts own" on sessions for insert
  with check (athlete_id = auth.uid());

create policy "sessions: athlete deletes own" on sessions for delete
  using (athlete_id = auth.uid());

-- Station results follow their session.
create policy "results: read via session" on station_results for select
  using (exists (
    select 1 from sessions s
    where s.id = session_id
      and (s.athlete_id = auth.uid() or is_accepted_coach_of(s.athlete_id))
  ));

create policy "results: athlete inserts via own session" on station_results for insert
  with check (exists (
    select 1 from sessions s
    where s.id = session_id and s.athlete_id = auth.uid()
  ));

create policy "results: athlete deletes via own session" on station_results for delete
  using (exists (
    select 1 from sessions s
    where s.id = session_id and s.athlete_id = auth.uid()
  ));

grant execute on function request_athlete(text) to authenticated;
