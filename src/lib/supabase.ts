import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Copia .env.example a .env.local y rellénalos.',
  );
}

// Nota: no tipamos el cliente con Database porque Supabase v2 tiene un sistema de
// tipos complejo que genera errores con tipos manuales. Los tipos de filas se
// aplican explícitamente en cada consulta (p.ej. `.returns<PhaseRow[]>()`).
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
