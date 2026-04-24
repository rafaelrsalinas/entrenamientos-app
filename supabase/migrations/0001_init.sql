-- entrenamientos-app · esquema inicial
-- Modelo derivado de plantilla_bombero_v9.xlsx:
--   fases (F1..F4) → días de entrenamiento → ejercicios planificados → planes semanales (S1..S26)
--   sesiones reales (ejecutadas en una fase/semana/día) → sets registrados

set search_path = public;

create extension if not exists "pgcrypto";

------------------------------------------------------------------
-- 1. Catálogo de ejercicios (globales y personalizados por usuario)
------------------------------------------------------------------
create table exercises (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users(id) on delete cascade,  -- null = global
  name           text not null,
  muscle_group   text,
  equipment      text,
  notes          text,
  created_at     timestamptz not null default now(),
  unique (user_id, name)
);
create index on exercises (user_id);

------------------------------------------------------------------
-- 2. Fases del plan de entrenamiento
------------------------------------------------------------------
create table phases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  code           text not null,       -- F1_HIPERTROFIA, F2_TRANSICION...
  name           text not null,
  description    text,
  week_start     int  not null,       -- p.ej. F1 = 1
  week_end       int  not null,       -- p.ej. F1 = 26
  order_idx      int  not null,
  created_at     timestamptz not null default now(),
  unique (user_id, code),
  check (week_end >= week_start)
);
create index on phases (user_id, order_idx);

------------------------------------------------------------------
-- 3. Días de entrenamiento dentro de una fase
------------------------------------------------------------------
create table workout_days (
  id             uuid primary key default gen_random_uuid(),
  phase_id       uuid not null references phases(id) on delete cascade,
  day_of_week    int,                 -- 1=lunes..7=domingo (null si sábado libre)
  name           text not null,       -- "LUNES — LOWER", "MIÉ — UPPER A"
  description    text,
  order_idx      int  not null,
  created_at     timestamptz not null default now()
);
create index on workout_days (phase_id, order_idx);

------------------------------------------------------------------
-- 4. Ejercicios planificados para cada día
------------------------------------------------------------------
create table planned_exercises (
  id              uuid primary key default gen_random_uuid(),
  workout_day_id  uuid not null references workout_days(id) on delete cascade,
  exercise_id     uuid not null references exercises(id),
  order_idx       int  not null,
  number_label    text,                  -- "1", "2", "—" (warm-up/transición)
  block_label     text,                  -- "Principal", "[SS-A1] Posterior"
  target_scheme   text,                  -- "4x6-8", "3x10-12/pierna"
  rest_text       text,                  -- "90s", "0s → SS-A2"
  rir_text        text,                  -- "RIR 2", "RPE 7"
  substitution    text,
  notes           text,
  superset_key    text,                  -- "A", "B" (derivado de [SS-A1]/[SS-A2])
  created_at      timestamptz not null default now()
);
create index on planned_exercises (workout_day_id, order_idx);

------------------------------------------------------------------
-- 5. Plan semanal (S1..S26) — valor planificado por semana
------------------------------------------------------------------
create table weekly_plan (
  planned_exercise_id  uuid not null references planned_exercises(id) on delete cascade,
  week_number          int  not null check (week_number >= 1),
  plan_text            text,               -- "45", "BW 6→8 reps", "10x2"
  primary key (planned_exercise_id, week_number)
);

------------------------------------------------------------------
-- 6. Sesiones de entrenamiento reales
------------------------------------------------------------------
create table workout_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  phase_id       uuid references phases(id) on delete set null,
  workout_day_id uuid references workout_days(id) on delete set null,
  week_number    int,
  started_at     timestamptz not null default now(),
  ended_at       timestamptz,
  notes          text
);
create index on workout_sessions (user_id, started_at desc);

------------------------------------------------------------------
-- 7. Sets registrados durante una sesión
------------------------------------------------------------------
create table workout_sets (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references workout_sessions(id) on delete cascade,
  planned_exercise_id   uuid references planned_exercises(id) on delete set null,
  exercise_id           uuid not null references exercises(id),  -- denormalizado: permite logs sin plan
  set_number            int  not null check (set_number >= 1),
  reps                  int,
  weight_kg             numeric(6,2),
  rir                   numeric(3,1),
  rpe                   numeric(3,1),
  is_warmup             boolean not null default false,
  notes                 text,
  created_at            timestamptz not null default now()
);
create index on workout_sets (session_id, set_number);
create index on workout_sets (exercise_id, created_at desc);

------------------------------------------------------------------
-- Row Level Security
------------------------------------------------------------------
alter table exercises          enable row level security;
alter table phases             enable row level security;
alter table workout_days       enable row level security;
alter table planned_exercises  enable row level security;
alter table weekly_plan        enable row level security;
alter table workout_sessions   enable row level security;
alter table workout_sets       enable row level security;

-- exercises: globales (user_id null) visibles para todos; personales solo para su dueño
create policy exercises_select on exercises for select
  using (user_id is null or user_id = auth.uid());
create policy exercises_modify on exercises for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- phases/workout_days/planned_exercises/weekly_plan: acceso vía user_id de phase
create policy phases_owner on phases for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy wd_owner on workout_days for all
  using (exists (select 1 from phases p where p.id = workout_days.phase_id and p.user_id = auth.uid()))
  with check (exists (select 1 from phases p where p.id = workout_days.phase_id and p.user_id = auth.uid()));

create policy pe_owner on planned_exercises for all
  using (exists (
    select 1 from workout_days wd
    join phases p on p.id = wd.phase_id
    where wd.id = planned_exercises.workout_day_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from workout_days wd
    join phases p on p.id = wd.phase_id
    where wd.id = planned_exercises.workout_day_id and p.user_id = auth.uid()
  ));

create policy wp_owner on weekly_plan for all
  using (exists (
    select 1 from planned_exercises pe
    join workout_days wd on wd.id = pe.workout_day_id
    join phases p on p.id = wd.phase_id
    where pe.id = weekly_plan.planned_exercise_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from planned_exercises pe
    join workout_days wd on wd.id = pe.workout_day_id
    join phases p on p.id = wd.phase_id
    where pe.id = weekly_plan.planned_exercise_id and p.user_id = auth.uid()
  ));

create policy sess_owner on workout_sessions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy sets_owner on workout_sets for all
  using (exists (
    select 1 from workout_sessions s
    where s.id = workout_sets.session_id and s.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from workout_sessions s
    where s.id = workout_sets.session_id and s.user_id = auth.uid()
  ));
