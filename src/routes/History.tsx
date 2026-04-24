import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { WorkoutSessionRow as SessionRow, WorkoutDayRow as WorkoutDay } from '../lib/database.types';

type SessionWithDay = SessionRow & { day?: WorkoutDay | null };

export default function History() {
  const [sessions, setSessions] = useState<SessionWithDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sRows } = await supabase
        .from('workout_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50);
      const dayIds = [...new Set((sRows ?? []).map((s) => s.workout_day_id).filter(Boolean) as string[])];
      const { data: days } = dayIds.length
        ? await supabase.from('workout_days').select('*').in('id', dayIds)
        : { data: [] as WorkoutDay[] };
      const dayMap = new Map((days ?? []).map((d) => [d.id, d]));
      setSessions(
        (sRows ?? []).map((s) => ({
          ...s,
          day: s.workout_day_id ? dayMap.get(s.workout_day_id) ?? null : null,
        })),
      );
      setLoading(false);
    })();
  }, []);

  if (loading) return <p>Cargando…</p>;

  return (
    <>
      <h2>Historial</h2>
      {sessions.length === 0 ? (
        <p className="muted">Aún no hay sesiones registradas.</p>
      ) : (
        <div className="col gap">
          {sessions.map((s) => (
            <Link to={`/session/${s.id}`} key={s.id} className="card row between">
              <div>
                <div className="small muted">{new Date(s.started_at).toLocaleString()}</div>
                <div>{s.day?.name ?? 'Sesión libre'}</div>
              </div>
              <div className="small muted">
                S{s.week_number} {s.ended_at ? '· ✔' : '· en curso'}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
