/**
 * Borra TODAS las sesiones del usuario (workout_sessions) y, por cascade,
 * todos sus workout_sets. NO toca el plan (phases/days/exercises/weekly_plan).
 *
 * Uso:
 *   npx tsx scripts/cleanup-sessions.ts
 *
 * Requiere en .env.local: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID.
 */
import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !IMPORT_USER_ID) {
  console.error('Faltan variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, IMPORT_USER_ID');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  const userId = IMPORT_USER_ID!;

  console.log(`Buscando sesiones de usuario ${userId}…`);
  const { data: sessions, error: sErr } = await sb
    .from('workout_sessions')
    .select('id, started_at')
    .eq('user_id', userId);
  if (sErr) throw sErr;
  console.log(`  ${sessions?.length ?? 0} sesiones encontradas`);

  if (!sessions || sessions.length === 0) {
    console.log('Nada que borrar.');
    return;
  }

  const ids = sessions.map((s) => s.id);
  const { count: setCount } = await sb
    .from('workout_sets')
    .select('id', { count: 'exact', head: true })
    .in('session_id', ids);
  console.log(`  ${setCount ?? 0} series asociadas (se borrarán en cascada)`);

  console.log('Borrando…');
  const { error: dErr } = await sb.from('workout_sessions').delete().eq('user_id', userId);
  if (dErr) throw dErr;
  console.log('✔ Cleanup completo.');
}

main().catch((err) => {
  console.error('✘ Error:', err);
  process.exit(1);
});
