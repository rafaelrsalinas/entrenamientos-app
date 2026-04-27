import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import HazardBand from '../components/HazardBand';
import type { WorkoutSessionRow as SessionRow, WorkoutDayRow as WorkoutDay } from '../lib/database.types';

type SessionWithDay = SessionRow & {
  day: WorkoutDay | null;
  setCount: number;
  volume: number;
  durationMin: number;
};

const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

function formatDate(iso: string): { day: string; month: string } {
  const d = new Date(iso);
  return { day: String(d.getDate()).padStart(2, '0'), month: MONTHS_ES[d.getMonth()] };
}

function getWeekNumber(d: Date): number {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
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
        .limit(60);
      if (!mounted) return;
      if (error) {
        toast.error('Error cargando historial');
        setLoading(false);
        return;
      }
      const dayIds = [
        ...new Set((sRows ?? []).map((s) => s.workout_day_id).filter(Boolean) as string[]),
      ];
      const sessIds = (sRows ?? []).map((s) => s.id);
      const [{ data: days }, { data: setsRows }] = await Promise.all([
        dayIds.length
          ? supabase.from('workout_days').select('*').in('id', dayIds)
          : Promise.resolve({ data: [] as WorkoutDay[] }),
        sessIds.length
          ? supabase
              .from('workout_sets')
              .select('session_id, weight_kg, reps')
              .in('session_id', sessIds)
          : Promise.resolve({ data: [] }),
      ]);
      if (!mounted) return;
      const dayMap = new Map((days ?? []).map((d) => [d.id, d]));
      const aggBySession = new Map<string, { count: number; volume: number }>();
      for (const set of setsRows ?? []) {
        const cur = aggBySession.get(set.session_id) ?? { count: 0, volume: 0 };
        cur.count++;
        if (set.weight_kg != null && set.reps != null) {
          cur.volume += Number(set.weight_kg) * set.reps;
        }
        aggBySession.set(set.session_id, cur);
      }
      setSessions(
        (sRows ?? []).map((s) => {
          const agg = aggBySession.get(s.id) ?? { count: 0, volume: 0 };
          const dur = s.ended_at
            ? Math.round(
                (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000,
              )
            : 0;
          return {
            ...s,
            day: s.workout_day_id ? dayMap.get(s.workout_day_id) ?? null : null,
            setCount: agg.count,
            volume: Math.round(agg.volume),
            durationMin: dur,
          };
        }),
      );
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const grouped = useMemo(() => {
    const groups: Record<string, SessionWithDay[]> = {};
    const now = new Date();
    const currentWeek = getWeekNumber(now);
    const currentYear = now.getFullYear();
    for (const s of sessions) {
      const d = new Date(s.started_at);
      const w = getWeekNumber(d);
      let label: string;
      if (w === currentWeek && d.getFullYear() === currentYear) {
        label = 'ESTA SEMANA';
      } else if (w === currentWeek - 1 && d.getFullYear() === currentYear) {
        label = 'SEMANA PASADA';
      } else {
        label = `SEMANA ${w}`;
      }
      (groups[label] ??= []).push(s);
    }
    return groups;
  }, [sessions]);

  const kpis = useMemo(() => {
    const total = sessions.filter((s) => s.ended_at).length;
    const monthAgo = Date.now() - 30 * 86400000;
    let monthVol = 0;
    for (const s of sessions) {
      if (new Date(s.started_at).getTime() >= monthAgo) monthVol += s.volume;
    }
    return {
      total,
      volume: monthVol,
      prs: 0, // TODO: contar PRs reales del mes
    };
  }, [sessions]);

  return (
    <div className="container">
      <div className="tac-op">BITÁCORA DE SESIONES</div>
      <h1 className="tac-title">LOG<span className="dot">.</span></h1>

      <HazardBand thickness={5} />

      <div className="kpi-grid mt-md">
        <div className="kpi-mini">
          <div className="kpi-mini-label">TOTAL</div>
          <div className="kpi-mini-value">
            {String(kpis.total).padStart(2, '0')}
            <span className="unit">SES</span>
          </div>
        </div>
        <div className="kpi-mini">
          <div className="kpi-mini-label">VOL.MES</div>
          <div className="kpi-mini-value">
            {(kpis.volume / 1000).toFixed(1)}
            <span className="unit">T</span>
          </div>
        </div>
        <div className="kpi-mini">
          <div className="kpi-mini-label">PRs</div>
          <div className="kpi-mini-value orange">{String(kpis.prs).padStart(2, '0')}</div>
        </div>
      </div>

      {loading ? (
        <div className="col gap mt-md">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : sessions.length === 0 ? (
        <div className="card mt-md">
          <h3>SIN SESIONES</h3>
          <p className="muted small">Tu primer entrenamiento aparecerá aquí.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([label, rows]) => (
          <div key={label}>
            <div className="tac-section">{label}</div>
            <div className="col gap-sm">
              {rows.map((s) => {
                const fd = formatDate(s.started_at);
                return (
                  <Link
                    key={s.id}
                    to={s.ended_at ? `/session/${s.id}/summary` : `/session/${s.id}`}
                    className="log-row"
                  >
                    <div className="log-date-box">
                      <div className="log-date-day">{fd.day}</div>
                      <div className="log-date-month">{fd.month}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div className="log-day-name">
                        {(s.day?.name ?? 'Sesión libre').toUpperCase()}
                      </div>
                      <div className="log-meta">
                        {s.setCount} SERIES
                        {s.volume > 0 && ` · ${s.volume.toLocaleString()} KG`}
                        {s.durationMin > 0 && ` · ${s.durationMin}MIN`}
                        {!s.ended_at && ' · EN CURSO'}
                      </div>
                    </div>
                    <div className="log-arrow">→</div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
