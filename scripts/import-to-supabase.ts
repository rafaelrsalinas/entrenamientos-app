/**
 * Importa el workbook plantilla_bombero_v9.xlsx a Supabase para un usuario concreto.
 *
 * Requiere en .env:
 *   SUPABASE_URL=...
 *   SUPABASE_SERVICE_ROLE_KEY=...    (solo para esta importación; NO se envía al frontend)
 *   IMPORT_USER_ID=<uuid del usuario destino en auth.users>
 *
 * Uso:
 *   npx tsx scripts/import-to-supabase.ts "G:/Mi unidad/entrenamientos/plantilla_bombero_v9.xlsx"
 *
 * Es idempotente: reaplicarlo elimina las fases del usuario y las vuelve a crear.
 * Los ejercicios se upsertean por (user_id, name).
 */
import 'dotenv/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { parseWorkbook, ParsedPhase, ParsedPlannedExercise } from './parse-workbook.ts';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !IMPORT_USER_ID) {
  console.error('Faltan variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID');
  process.exit(1);
}

const file = process.argv[2] ?? 'G:/Mi unidad/entrenamientos/plantilla_bombero_v9.xlsx';
const userId = IMPORT_USER_ID;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function upsertExercises(names: string[]): Promise<Map<string, string>> {
  const rows = names.map(name => ({ user_id: userId, name }));
  const { data, error } = await sb
    .from('exercises')
    .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: false })
    .select('id,name');
  if (error) throw error;
  const byName = new Map<string, string>();
  for (const r of data ?? []) byName.set(r.name, r.id);
  return byName;
}

async function resetPhases() {
  // Cascade delete: borrar fases del usuario elimina workout_days, planned_exercises, weekly_plan
  const { error } = await sb.from('phases').delete().eq('user_id', userId);
  if (error) throw error;
}

async function insertPhase(p: ParsedPhase): Promise<string> {
  const { data, error } = await sb
    .from('phases')
    .insert({
      user_id: userId,
      code: p.code,
      name: p.name,
      description: p.description,
      week_start: p.week_start,
      week_end: p.week_end,
      order_idx: p.order_idx,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function insertWorkoutDay(phaseId: string, name: string, dow: number | null, orderIdx: number): Promise<string> {
  const { data, error } = await sb
    .from('workout_days')
    .insert({ phase_id: phaseId, name, day_of_week: dow, order_idx: orderIdx })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function insertPlannedExercise(
  workoutDayId: string,
  exerciseId: string,
  e: ParsedPlannedExercise,
): Promise<string> {
  const { data, error } = await sb
    .from('planned_exercises')
    .insert({
      workout_day_id: workoutDayId,
      exercise_id: exerciseId,
      order_idx: e.order_idx,
      number_label: e.number_label || null,
      block_label: e.block_label || null,
      target_scheme: e.target_scheme || null,
      rest_text: e.rest_text || null,
      rir_text: e.rir_text || null,
      substitution: e.substitution || null,
      notes: e.notes || null,
      superset_key: e.superset_key,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function insertWeeklyPlan(plannedExerciseId: string, weekly: Record<number, string>) {
  const rows = Object.entries(weekly).map(([w, text]) => ({
    planned_exercise_id: plannedExerciseId,
    week_number: Number(w),
    plan_text: text,
  }));
  if (rows.length === 0) return;
  const { error } = await sb.from('weekly_plan').insert(rows);
  if (error) throw error;
}

async function main() {
  console.log(`Parseando ${file}...`);
  const { phases, unique_exercises } = parseWorkbook(file);
  console.log(`  ${phases.length} fases · ${unique_exercises.length} ejercicios únicos`);

  console.log('Upsert ejercicios...');
  const exMap = await upsertExercises(unique_exercises);
  console.log(`  ${exMap.size} ejercicios listos`);

  console.log('Borrando fases previas del usuario...');
  await resetPhases();

  for (const phase of phases) {
    console.log(`\n== ${phase.code}: ${phase.name} ==`);
    const phaseId = await insertPhase(phase);
    for (const day of phase.workout_days) {
      const dayId = await insertWorkoutDay(phaseId, day.name, day.day_of_week, day.order_idx);
      console.log(`  ${day.name}  (${day.planned_exercises.length} ejercicios)`);
      for (const e of day.planned_exercises) {
        const exerciseId = exMap.get(e.exercise_name);
        if (!exerciseId) {
          console.warn(`    ⚠ sin id para "${e.exercise_name}", salto`);
          continue;
        }
        const peId = await insertPlannedExercise(dayId, exerciseId, e);
        await insertWeeklyPlan(peId, e.weekly_plan);
      }
    }
  }
  console.log('\n✔ Importación completa.');
}

main().catch(err => {
  console.error('✘ Error:', err);
  process.exit(1);
});
