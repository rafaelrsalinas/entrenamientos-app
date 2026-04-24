/**
 * Importador para plantilla v10 (una sola hoja 01_PLAN_SEMANAL_45_60, 12 semanas).
 * Estructura:
 *   Día | Sesión | Prioridad | Orden | Ejercicio | Grupo | Series | Reps/pauta | Descanso | Intensidad
 *
 * Uso:
 *   npx tsx scripts/import-v10.ts "G:/Mi unidad/entrenamientos/plantilla_bombero_v10_45_60_pesos_recalibrados.xlsx"
 */
import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });

import * as XLSX from 'xlsx';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !IMPORT_USER_ID) {
  console.error('Faltan variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID');
  process.exit(1);
}

const file = process.argv[2] ?? 'G:/Mi unidad/entrenamientos/plantilla_bombero_v10_45_60_pesos_recalibrados.xlsx';
const userId = IMPORT_USER_ID;
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DOW: Record<string, number> = {
  lunes: 1, martes: 2, miercoles: 3,
  jueves: 4, viernes: 5, sabado: 6, domingo: 7,
};

type Row = {
  dia: string;
  sesion: string;
  prioridad: string;
  orden: number;
  ejercicio: string;
  grupo: string;
  series: string;
  reps: string;
  descanso: string;
  intensidad: string;
};

function parse(): Row[] {
  const wb = XLSX.read(readFileSync(file));
  const sheet = wb.Sheets['01_PLAN_SEMANAL_45_60'];
  if (!sheet) throw new Error('sheet 01_PLAN_SEMANAL_45_60 no encontrada');
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false });
  const out: Row[] = [];
  for (let i = 2; i < raw.length; i++) {
    const r = raw[i].map(c => String(c ?? '').trim());
    if (!r[0] || !r[4]) continue;
    out.push({
      dia: r[0], sesion: r[1], prioridad: r[2],
      orden: Number(r[3]) || i,
      ejercicio: r[4], grupo: r[5],
      series: r[6], reps: r[7], descanso: r[8], intensidad: r[9],
    });
  }
  return out;
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

async function main() {
  console.log(`Parseando ${file}...`);
  const rows = parse();
  console.log(`  ${rows.length} filas`);

  const uniqueEx = [...new Map(rows.map(r => [r.ejercicio, r.grupo])).entries()];
  console.log(`  ${uniqueEx.length} ejercicios únicos`);

  console.log('Upsert exercises...');
  const { data: exRows, error: exErr } = await sb
    .from('exercises')
    .upsert(
      uniqueEx.map(([name, grupo]) => ({ user_id: userId, name, muscle_group: grupo || null })),
      { onConflict: 'user_id,name' },
    )
    .select('id,name');
  if (exErr) throw exErr;
  const exMap = new Map(exRows!.map(e => [e.name, e.id]));

  console.log('Borrando fases previas...');
  await sb.from('phases').delete().eq('user_id', userId);

  console.log('Creando fase F1_BASE_45_60...');
  const { data: phase, error: pErr } = await sb
    .from('phases')
    .insert({
      user_id: userId,
      code: 'F1_BASE_45_60',
      name: 'F1 · Base 45-60 min (v10)',
      description: 'Plan semanal operativo recalibrado. 12 semanas. Sesiones 45-60 min.',
      week_start: 1,
      week_end: 12,
      order_idx: 0,
    })
    .select('id')
    .single();
  if (pErr) throw pErr;
  const phaseId = phase!.id;

  const byDay = new Map<string, Row[]>();
  for (const r of rows) {
    if (!byDay.has(r.dia)) byDay.set(r.dia, []);
    byDay.get(r.dia)!.push(r);
  }

  let dayOrder = 0;
  for (const [dia, exs] of byDay) {
    const dow = DOW[normalize(dia)] ?? null;
    const { data: day, error: dErr } = await sb
      .from('workout_days')
      .insert({
        phase_id: phaseId,
        name: `${dia} — ${exs[0].sesion}`,
        day_of_week: dow,
        order_idx: dayOrder++,
      })
      .select('id')
      .single();
    if (dErr) throw dErr;
    console.log(`  ${dia} (${exs.length} ejercicios)`);

    for (const [i, r] of exs.entries()) {
      const exerciseId = exMap.get(r.ejercicio);
      if (!exerciseId) { console.warn(`    ⚠ sin id para "${r.ejercicio}"`); continue; }
      const target = [r.series, r.reps].filter(Boolean).join(' × ').trim() || r.reps;
      const { data: pe, error: peErr } = await sb
        .from('planned_exercises')
        .insert({
          workout_day_id: day!.id,
          exercise_id: exerciseId,
          order_idx: i,
          number_label: String(r.orden),
          block_label: r.prioridad ? `Prioridad ${r.prioridad}` : null,
          target_scheme: target || null,
          rest_text: r.descanso || null,
          rir_text: r.intensidad || null,
        })
        .select('id')
        .single();
      if (peErr) throw peErr;

      // v10 usa el mismo plan en las 12 semanas → replico el target
      const weekRows = Array.from({ length: 12 }, (_, w) => ({
        planned_exercise_id: pe!.id,
        week_number: w + 1,
        plan_text: target || r.reps,
      }));
      await sb.from('weekly_plan').insert(weekRows);
    }
  }
  console.log('\n✔ Importación v10 completa.');
}

main().catch(err => { console.error('✘ Error:', err); process.exit(1); });
