-- ==============================================================================
-- RŌXCOACH Stage 2 Schema Migration
-- AI-Powered HYROX Coaching & Adaptive Workout Generation
-- ==============================================================================

-- 1. EXERCISES (Official Stations, Substitutions & Supporting Movements)
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  station_slug text check (station_slug in ('skierg', 'sled_push', 'sled_pull', 'burpee_broad_jump', 'rowing', 'farmers_carry', 'sandbag_lunges', 'wall_balls', 'running', 'strength', 'conditioning', 'mobility')),
  is_official_station boolean not null default false,
  movement_category text not null, -- 'horizontal_push', 'horizontal_pull', 'vertical_push', 'quad_dominant', 'posterior_chain', 'aerobic_capacity'
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  movement_pattern text not null, -- 'push', 'pull', 'squat', 'hinge', 'lunge', 'carry', 'locomotion'
  equipment_required text[] not null default '{}',
  difficulty_level text not null default 'intermediate' check (difficulty_level in ('beginner', 'intermediate', 'advanced', 'elite')),
  training_objective text not null, -- 'aerobic_power', 'lactate_tolerance', 'compromised_running', 'muscular_endurance', 'strength'
  instructions text not null,
  safety_considerations text,
  space_required text not null default 'compact' check (space_required in ('compact', 'open_floor', 'turf_track', 'outdoor_field')),
  created_at timestamptz not null default now()
);

-- 2. EXERCISE SUBSTITUTION MATRIX
create table if not exists public.exercise_substitutions (
  id uuid primary key default gen_random_uuid(),
  original_exercise_id uuid not null references public.exercises(id) on delete cascade,
  substitute_exercise_id uuid not null references public.exercises(id) on delete cascade,
  movement_similarity_pct integer not null check (movement_similarity_pct between 1 and 100),
  cardio_demand_pct integer not null check (cardio_demand_pct between 1 and 100),
  muscular_overlap_pct integer not null check (muscular_overlap_pct between 1 and 100),
  transfer_rating text not null check (transfer_rating in ('direct_equivalent', 'high_transfer', 'moderate_conditioning', 'general_fitness')),
  rationale text not null,
  scaling_guidance text not null,
  created_at timestamptz not null default now(),
  unique(original_exercise_id, substitute_exercise_id)
);

-- 3. ATHLETE EQUIPMENT INVENTORY
create table if not exists public.athlete_equipment (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  equipment_slug text not null,
  display_name text not null,
  category text not null default 'standard' check (category in ('specialised', 'standard', 'minimal')),
  quantity integer not null default 1,
  load_spec text, -- e.g. "pair of 15kg", "heavy loop", "20kg backpack"
  source text not null default 'manual' check (source in ('manual', 'ai_vision_scan')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(athlete_id, equipment_slug)
);

-- 4. EQUIPMENT VISION SCANS
create table if not exists public.equipment_scans (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  image_url text,
  detected_items jsonb not null default '[]'::jsonb,
  confirmed_items jsonb not null default '[]'::jsonb,
  status text not null default 'pending_confirmation' check (status in ('pending_confirmation', 'confirmed', 'discarded')),
  created_at timestamptz not null default now()
);

-- 5. WORKOUT TEMPLATES & GENERATED WORKOUTS
create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  training_objective text not null,
  structure_type text not null check (structure_type in ('amrap', 'emom', 'for_time', 'intervals', 'circuit', 'strength_conditioning', 'running_intervals', 'compromised_running', 'hyrox_simulation', 'station_specific')),
  estimated_duration_min integer not null,
  warmup_protocol text,
  cooldown_protocol text,
  is_ai_generated boolean not null default false,
  generation_params jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  custom_exercise_name text,
  block_index integer not null default 1,
  order_index integer not null,
  sets integer,
  reps integer,
  distance_m integer,
  duration_sec integer,
  rest_sec integer,
  target_intensity text,
  notes text,
  is_substitution boolean not null default false,
  substitute_reason text,
  created_at timestamptz not null default now()
);

-- 6. COACH WORKOUT PRESCRIPTIONS
create table if not exists public.workout_prescriptions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  scheduled_date date not null,
  status text not null default 'published' check (status in ('draft', 'published', 'in_progress', 'completed', 'missed', 'cancelled')),
  coaching_notes text,
  target_total_time_sec integer,
  completed_session_id uuid references public.sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. COACH DEBRIEF & FEEDBACK
create table if not exists public.coach_feedback (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete cascade,
  prescription_id uuid references public.workout_prescriptions(id) on delete set null,
  general_feedback text not null,
  station_feedback jsonb default '{}'::jsonb,
  recommendations text,
  athlete_response text,
  is_read_by_athlete boolean not null default false,
  created_at timestamptz not null default now()
);

-- 8. TRAINING PROGRAMMES (8 & 12 WEEKS)
create table if not exists public.programmes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid references public.profiles(id) on delete set null,
  title text not null,
  category text not null check (category in ('beginner_8wk', 'foundation_12wk', 'performance_12wk', 'race_prep_8wk', 'custom')),
  duration_weeks integer not null check (duration_weeks between 4 and 16),
  description text,
  is_equipment_adaptive boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.programme_weeks (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes(id) on delete cascade,
  week_number integer not null,
  focus_theme text not null,
  is_deload boolean not null default false,
  total_prescribed_sessions integer not null default 4,
  created_at timestamptz not null default now(),
  unique(programme_id, week_number)
);

create table if not exists public.programme_sessions (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references public.programme_weeks(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 1 and 7),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  order_index integer not null default 1,
  notes text,
  created_at timestamptz not null default now()
);

-- 9. ATHLETE-TO-COACH INVITATION FUNCTION
create or replace function public.invite_coach_by_athlete(p_coach_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid;
begin
  if not exists (select 1 from profiles where id = auth.uid() and role = 'athlete') then
    return 'not_allowed';
  end if;

  select id into v_coach
  from profiles
  where lower(email) = lower(trim(p_coach_email)) and role = 'coach';

  if v_coach is null then
    return 'coach_not_registered';
  end if;

  insert into coach_athletes (coach_id, athlete_id, status)
  values (v_coach, auth.uid(), 'accepted')
  on conflict (coach_id, athlete_id) do update set status = 'accepted';

  return 'connected';
end;
$$;

-- 10. ROW LEVEL SECURITY
alter table public.exercises enable row level security;
alter table public.exercise_substitutions enable row level security;
alter table public.athlete_equipment enable row level security;
alter table public.equipment_scans enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_prescriptions enable row level security;
alter table public.coach_feedback enable row level security;
alter table public.programmes enable row level security;
alter table public.programme_weeks enable row level security;
alter table public.programme_sessions enable row level security;

-- Read policies for common resources
create policy "exercises: read authenticated" on public.exercises for select using (true);
create policy "substitutions: read authenticated" on public.exercise_substitutions for select using (true);
create policy "programmes: read authenticated" on public.programmes for select using (true);
create policy "programme_weeks: read authenticated" on public.programme_weeks for select using (true);
create policy "programme_sessions: read authenticated" on public.programme_sessions for select using (true);

-- Athlete Equipment
create policy "equipment: athlete manages own" on public.athlete_equipment
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

create policy "equipment: coach reads accepted athletes" on public.athlete_equipment
  for select using (is_accepted_coach_of(athlete_id));

-- Equipment Scans
create policy "scans: athlete manages own" on public.equipment_scans
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

-- Workouts
create policy "workouts: creator manages" on public.workouts
  for all using (creator_id = auth.uid() or creator_id is null);

create policy "workout_exercises: read via workout" on public.workout_exercises
  for select using (true);

create policy "workout_exercises: creator manages" on public.workout_exercises
  for all using (exists (
    select 1 from public.workouts w where w.id = workout_id and (w.creator_id = auth.uid() or w.creator_id is null)
  ));

-- Prescriptions
create policy "prescriptions: coach manages" on public.workout_prescriptions
  for all using (coach_id = auth.uid() and is_accepted_coach_of(athlete_id));

create policy "prescriptions: athlete reads & updates status" on public.workout_prescriptions
  for select using (athlete_id = auth.uid());

create policy "prescriptions: athlete updates progress" on public.workout_prescriptions
  for update using (athlete_id = auth.uid());

-- Coach Feedback
create policy "feedback: coach creates & updates" on public.coach_feedback
  for all using (coach_id = auth.uid());

create policy "feedback: athlete reads & replies" on public.coach_feedback
  for select using (athlete_id = auth.uid());

create policy "feedback: athlete updates reply" on public.coach_feedback
  for update using (athlete_id = auth.uid());
