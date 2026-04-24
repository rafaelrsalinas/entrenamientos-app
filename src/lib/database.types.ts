// Tipos manuales para las tablas del esquema inicial.
// Cuando Supabase CLI esté configurado, reemplazar por:
//   supabase gen types typescript --linked > src/lib/database.types.ts

export interface ExerciseRow {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: string | null;
  equipment: string | null;
  notes: string | null;
  created_at: string;
}

export interface PhaseRow {
  id: string;
  user_id: string;
  code: string;
  name: string;
  description: string | null;
  week_start: number;
  week_end: number;
  order_idx: number;
  created_at: string;
}

export interface WorkoutDayRow {
  id: string;
  phase_id: string;
  day_of_week: number | null;
  name: string;
  description: string | null;
  order_idx: number;
  created_at: string;
}

export interface PlannedExerciseRow {
  id: string;
  workout_day_id: string;
  exercise_id: string;
  order_idx: number;
  number_label: string | null;
  block_label: string | null;
  target_scheme: string | null;
  rest_text: string | null;
  rir_text: string | null;
  substitution: string | null;
  notes: string | null;
  superset_key: string | null;
  created_at: string;
}

export interface WeeklyPlanRow {
  planned_exercise_id: string;
  week_number: number;
  plan_text: string | null;
}

export interface WorkoutSessionRow {
  id: string;
  user_id: string;
  phase_id: string | null;
  workout_day_id: string | null;
  week_number: number | null;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export interface WorkoutSetRow {
  id: string;
  session_id: string;
  planned_exercise_id: string | null;
  exercise_id: string;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  rir: number | null;
  rpe: number | null;
  is_warmup: boolean;
  notes: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      exercises: {
        Row: ExerciseRow;
        Insert: Partial<ExerciseRow> & { name: string };
        Update: Partial<ExerciseRow>;
        Relationships: [];
      };
      phases: {
        Row: PhaseRow;
        Insert: Omit<PhaseRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<PhaseRow>;
        Relationships: [];
      };
      workout_days: {
        Row: WorkoutDayRow;
        Insert: Omit<WorkoutDayRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<WorkoutDayRow>;
        Relationships: [];
      };
      planned_exercises: {
        Row: PlannedExerciseRow;
        Insert: Omit<PlannedExerciseRow, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<PlannedExerciseRow>;
        Relationships: [];
      };
      weekly_plan: {
        Row: WeeklyPlanRow;
        Insert: WeeklyPlanRow;
        Update: Partial<WeeklyPlanRow>;
        Relationships: [];
      };
      workout_sessions: {
        Row: WorkoutSessionRow;
        Insert: Partial<Omit<WorkoutSessionRow, 'id' | 'started_at'>> & { user_id: string };
        Update: Partial<WorkoutSessionRow>;
        Relationships: [];
      };
      workout_sets: {
        Row: WorkoutSetRow;
        Insert: Omit<WorkoutSetRow, 'id' | 'created_at' | 'is_warmup'> & {
          id?: string;
          created_at?: string;
          is_warmup?: boolean;
        };
        Update: Partial<WorkoutSetRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
