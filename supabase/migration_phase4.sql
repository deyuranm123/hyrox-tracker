-- ==============================================================================
-- RŌXCOACH Phase 4 Schema Migration
-- Normalization: Decouples 'type' into 'category' and 'rpe', cascades deletes
-- ==============================================================================

-- 1. Add category and rpe columns to sessions if they don't exist
alter table public.sessions 
  add column if not exists category text not null default 'training' check (category in ('training', 'full_simulation', 'half_sim', 'benchmark'));

alter table public.sessions 
  add column if not exists rpe integer check (rpe between 1 and 10);

-- 2. Drop the restrictive check constraint on legacy 'type' column if present
alter table public.sessions 
  drop constraint if exists sessions_type_check;

-- 3. Ensure station_results has foreign key with cascade delete
alter table public.station_results
  drop constraint if exists station_results_session_id_fkey,
  add constraint station_results_session_id_fkey
    foreign key (session_id) references public.sessions(id) on delete cascade;

-- 4. Update existing rows to map legacy type values into category
update public.sessions 
  set category = case 
    when type = 'race' then 'full_simulation'
    else 'training'
  end
  where category = 'training' and type is not null;
