import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import type { WorkoutSessionRow as SessionRow, WorkoutDayRow as WorkoutDay } from '../lib/database.types';

type SessionWithDay = SessionRow & { day?: WorkoutDay | null };

function formatDate(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const isSameDay = d.toDateString() === today.toDateString();
  if (isSameDay) {
    return `Hoy · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function History() {
  const [sessions, setSessions] = useState<SessionWithDay[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: sRows, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(100);
      if (!mounted) return;
      if (error) {
        toast.error('No se pudo cargar el historial.');
        setLoading(false);
        return;
      }
      const dayIds = [...new Set((sRows ?? []).map((s) => s.workout_day_id).filter(Boolean) as string[])];
      const { data: days } = dayIds.length
        ? await supabase.from('workout_days').select('*').in('id', dayIds)
        : { data: [] as WorkoutDay[] };
      if (!mounted) return;
      const dayMap = new Map((days ?? []).map((d) => [d.id, d]));
      setSessions(
        (sRows ?? []).map((s) => ({
          ...s,
          day: s.workout_day_id ? dayMap.get(s.workout_day_id) ?? null : null,
        })),
      );
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [toast]);

  return (
    <>
      <h1 className="large-title">Historial</h1>
      {loading ? (
        <div className="col gap"><SkeletonCard /><SkeletonCard /><SkeletonCard /></div>
      ) : sessions.length === 0 ? (
        <div className="card">
          <h2>Sin sesiones aún</h2>
          <p className="muted">Cuando registres tu primer entrenamiento, aparecerá aquí.</p>
        </div>
      ) : (
        <div className="col gap">
          {sessions.map((s) => (
            <Link to={`/session/${s.id}`} key={s.id} className="card row between history-card">
              <div style={{ minWidth: 0 }}>
                <div className="small muted">{formatDate(s.started_at)}</div>
                <div className="history-day-name">{s.day?.name ?? 'Sesión libre'}</div>
              </div>
              <div className="col gap-xs" style={{ alignItems: 'flex-end' }}>
                <span className="small muted">S{s.week_number}</span>
                <span className={`history-badge${s.ended_at ? ' ok' : ' pending'}`}>
                  {s.ended_at ? '✓' : 'En curso'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
