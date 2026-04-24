import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import type { ExerciseRow, WorkoutSetRow } from '../lib/database.types';

type HistEntry = {
  date: string;
  top_weight: number | null;
  top_reps: number | null;
  top_e1rm: number | null;
  total_volume: number;
};

function epley1RM(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

export default function ExerciseHistory() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const [exercise, setExercise] = useState<ExerciseRow | null>(null);
  const [history, setHistory] = useState<HistEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!exerciseId) return;
    let mounted = true;
    (async () => {
      const [exRes, setsRes] = await Promise.all([
        supabase.from('exercises').select('*').eq('id', exerciseId).single(),
        supabase
          .from('workout_sets')
          .select('*, workout_sessions!inner(started_at)')
          .eq('exercise_id', exerciseId)
          .order('created_at', { ascending: true })
          .limit(1000),
      ]);
      if (!mounted) return;
      if (exRes.error) {
        toast.error('Ejercicio no encontrado.');
        setLoading(false);
        return;
      }
      setExercise(exRes.data as ExerciseRow);

      const rows = (setsRes.data ?? []) as unknown as Array<
        WorkoutSetRow & { workout_sessions: { started_at: string } | null }
      >;

      const byDate = new Map<string, WorkoutSetRow[]>();
      for (const row of rows) {
        const date = row.workout_sessions?.started_at?.slice(0, 10) ?? row.created_at.slice(0, 10);
        const arr = byDate.get(date) ?? [];
        arr.push(row);
        byDate.set(date, arr);
      }

      const entries: HistEntry[] = [];
      for (const [date, daySets] of byDate) {
        let topWeight: number | null = null;
        let topReps: number | null = null;
        let top1rm: number | null = null;
        let volume = 0;
        for (const s of daySets) {
          const w = Number(s.weight_kg ?? 0);
          const r = Number(s.reps ?? 0);
          if (w > 0 && r > 0) {
            volume += w * r;
            const e1 = epley1RM(w, r);
            if (top1rm == null || e1 > top1rm) {
              top1rm = e1;
              topWeight = w;
              topReps = r;
            }
          }
        }
        entries.push({
          date,
          top_weight: topWeight,
          top_reps: topReps,
          top_e1rm: top1rm ? Math.round(top1rm * 10) / 10 : null,
          total_volume: Math.round(volume),
        });
      }
      entries.sort((a, b) => a.date.localeCompare(b.date));
      setHistory(entries);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [exerciseId, toast]);

  const chartData = useMemo(
    () =>
      history
        .filter((h) => h.top_e1rm != null)
        .map((h) => ({ date: h.date.slice(5), e1rm: h.top_e1rm })),
    [history],
  );

  const allTime = useMemo(() => {
    const pr = history
      .filter((h) => h.top_e1rm != null)
      .sort((a, b) => (b.top_e1rm! - a.top_e1rm!))[0];
    return pr ?? null;
  }, [history]);

  if (loading) {
    return (
      <>
        <div className="row center-v gap-sm">
          <button className="ios-back" onClick={() => nav(-1)} aria-label="Volver">‹</button>
          <h1 className="large-title" style={{ margin: 0 }}>Ejercicio</h1>
        </div>
        <div className="col gap mt-md"><SkeletonCard /><SkeletonCard lines={3} /></div>
      </>
    );
  }
  if (!exercise) {
    return (
      <div className="card">
        <h2>Ejercicio no encontrado</h2>
        <button className="link" onClick={() => nav(-1)}>← Volver</button>
      </div>
    );
  }

  return (
    <>
      <div className="row center-v gap-sm">
        <button className="ios-back" onClick={() => nav(-1)} aria-label="Volver">‹</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="large-title" style={{ margin: 0 }}>{exercise.name}</h1>
          {exercise.muscle_group && <p className="muted small" style={{ margin: 0 }}>{exercise.muscle_group}</p>}
        </div>
      </div>

      {history.length === 0 ? (
        <div className="card mt-md">
          <p className="muted">Aún no hay series registradas para este ejercicio.</p>
        </div>
      ) : (
        <>
          <div className="row gap mt-md kpi-row">
            <div className="kpi">
              <div className="kpi-label">Sesiones</div>
              <div className="kpi-value">{history.length}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">PR e1RM</div>
              <div className="kpi-value">
                {allTime?.top_e1rm != null ? `${allTime.top_e1rm} kg` : '—'}
              </div>
              {allTime?.top_weight != null && (
                <div className="kpi-sub">
                  {allTime.top_weight} × {allTime.top_reps}
                </div>
              )}
            </div>
          </div>

          {chartData.length >= 2 && (
            <div className="card mt-md">
              <div className="label">Progresión e1RM (Epley)</div>
              <div style={{ width: '100%', height: 220, marginTop: 8 }}>
                <ResponsiveContainer>
                  <LineChart data={chartData}>
                    <CartesianGrid stroke="#2a2f3a" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="#9aa2b1" fontSize={12} />
                    <YAxis stroke="#9aa2b1" fontSize={12} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ background: '#1f232d', border: '1px solid #2a2f3a' }}
                      labelStyle={{ color: '#e4e7ee' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="e1rm"
                      stroke="#a855f7"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#a855f7' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <h3 className="mt-md">Últimas sesiones</h3>
          <div className="col gap">
            {[...history].reverse().slice(0, 15).map((h) => (
              <div key={h.date} className="card">
                <div className="row between">
                  <strong>{h.date}</strong>
                  <span className="small muted">Volumen {h.total_volume} kg</span>
                </div>
                <div className="small" style={{ marginTop: 4 }}>
                  {h.top_weight != null
                    ? `Top: ${h.top_weight} × ${h.top_reps}  ·  e1RM ${h.top_e1rm} kg`
                    : '—'}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
