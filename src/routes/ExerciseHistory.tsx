import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import HazardBand from '../components/HazardBand';
import Badge from '../components/Badge';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import type { ExerciseRow, WorkoutSetRow } from '../lib/database.types';

type SetWithSession = WorkoutSetRow & { startedAt: string };

const MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
function fmtShort(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS_ES[d.getMonth()]}`;
}

function epley(kg: number, reps: number) {
  return reps === 1 ? kg : kg * (1 + reps / 30);
}

export default function ExerciseHistory() {
  const { exerciseId } = useParams<{ exerciseId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const [exercise, setExercise] = useState<ExerciseRow | null>(null);
  const [sets, setSets] = useState<SetWithSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!exerciseId) return;
    let mounted = true;
    (async () => {
      const [{ data: ex, error: eErr }, { data: setsData }] = await Promise.all([
        supabase.from('exercises').select('*').eq('id', exerciseId).single(),
        supabase
          .from('workout_sets')
          .select('*, workout_sessions!inner(started_at)')
          .eq('exercise_id', exerciseId)
          .order('created_at', { ascending: true }),
      ]);
      if (!mounted) return;
      if (eErr || !ex) {
        toast.error('Ejercicio no encontrado');
        return;
      }
      setExercise(ex);
      const flat: SetWithSession[] =
        (setsData as unknown as Array<WorkoutSetRow & { workout_sessions: { started_at: string } }>)
          ?.map((s) => ({ ...s, startedAt: s.workout_sessions.started_at })) ?? [];
      setSets(flat);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [exerciseId, toast]);

  const data = useMemo(() => {
    if (sets.length === 0) {
      return {
        pr: null as { kg: number; reps: number; date: string } | null,
        est1RM: 0,
        history: [] as { x: number; kg: number; date: string; reps: number }[],
        recent: [] as { date: string; top: string; volume: number }[],
      };
    }
    let pr: { kg: number; reps: number; date: string } | null = null;
    let bestE1RM = 0;
    for (const s of sets) {
      if (s.weight_kg == null || s.reps == null) continue;
      const e = epley(Number(s.weight_kg), s.reps);
      if (!pr || Number(s.weight_kg) > pr.kg) pr = { kg: Number(s.weight_kg), reps: s.reps, date: s.startedAt };
      if (e > bestE1RM) bestE1RM = e;
    }

    const byDate = new Map<string, SetWithSession[]>();
    for (const s of sets) {
      const k = s.startedAt.slice(0, 10);
      const arr = byDate.get(k) ?? [];
      arr.push(s);
      byDate.set(k, arr);
    }
    const history: { x: number; kg: number; date: string; reps: number }[] = [];
    const recent: { date: string; top: string; volume: number }[] = [];
    let i = 0;
    [...byDate.entries()]
      .sort()
      .forEach(([date, arr]) => {
        let topSet = arr[0];
        let vol = 0;
        for (const s of arr) {
          if (s.weight_kg != null && s.reps != null) vol += Number(s.weight_kg) * s.reps;
          if (
            s.weight_kg != null &&
            (topSet.weight_kg == null || Number(s.weight_kg) > Number(topSet.weight_kg))
          ) {
            topSet = s;
          }
        }
        if (topSet.weight_kg != null) {
          history.push({ x: i++, kg: Number(topSet.weight_kg), date, reps: topSet.reps ?? 0 });
          recent.push({
            date,
            top: `${topSet.weight_kg}×${topSet.reps ?? 0}`,
            volume: Math.round(vol),
          });
        }
      });
    recent.reverse();
    return { pr, est1RM: bestE1RM, history, recent };
  }, [sets]);

  if (loading) {
    return (
      <div className="container">
        <button className="link-btn" onClick={() => nav(-1)}>‹ VOLVER</button>
        <h1 className="tac-title mt-sm">CARGANDO<span className="dot">.</span></h1>
        <HazardBand thickness={4} />
        <SkeletonCard />
      </div>
    );
  }

  if (!exercise) {
    return (
      <div className="container">
        <button className="link-btn" onClick={() => nav(-1)}>‹ VOLVER</button>
        <h1 className="tac-title mt-sm">NO ENCONTRADO<span className="dot">.</span></h1>
      </div>
    );
  }

  const { pr, est1RM, history, recent } = data;
  const minKg = history.length ? Math.min(...history.map((h) => h.kg)) : 0;
  const maxKg = history.length ? Math.max(...history.map((h) => h.kg)) : 100;
  const range = Math.max(maxKg - minKg, 1);
  const labelLines = [maxKg, maxKg - range / 4, maxKg - range / 2, minKg].map((v) => Math.round(v));
  const trend = history.length >= 2 ? history[history.length - 1].kg - history[0].kg : 0;

  return (
    <div className="container">
      <button className="link-btn" onClick={() => nav(-1)}>‹ VOLVER</button>
      <h1 className="tac-title mt-sm">{exercise.name.toUpperCase()}<span className="dot">.</span></h1>
      {exercise.muscle_group && (
        <div className="tac-op" style={{ marginTop: 6 }}>{exercise.muscle_group.toUpperCase()}</div>
      )}

      <HazardBand thickness={4} />

      {pr ? (
        <div className="kpi-row">
          <div className="kpi">
            <div className="kpi-label">PR · {fmtShort(pr.date)}</div>
            <div className="kpi-value orange">{pr.kg}<span className="unit">kg</span></div>
            <div className="kpi-sub">× {pr.reps} REPS</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">1RM EST.</div>
            <div className="kpi-value">{est1RM.toFixed(1)}<span className="unit">kg</span></div>
            <div className={`kpi-sub${trend >= 0 ? ' green' : ''}`}>
              {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)} · {history.length}S
            </div>
          </div>
        </div>
      ) : (
        <div className="card mt-md">
          <h3>SIN DATOS</h3>
          <p className="muted small">Loggea series de este ejercicio para ver progresión.</p>
        </div>
      )}

      {history.length >= 2 && (
        <>
          <div className="tac-section">PROGRESIÓN · TOP SET</div>
          <div className="chart-card">
            <svg viewBox="0 0 300 130" style={{ width: '100%', height: 130 }}>
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1="28" y1={20 + i * 28} x2="290" y2={20 + i * 28} stroke="#272727" strokeDasharray="2 3" />
              ))}
              {labelLines.map((v, i) => (
                <text key={i} x="4" y={24 + i * 28} fill="#8a8a8a" fontSize="8" fontFamily="JetBrains Mono">{v}</text>
              ))}
              <polyline
                points={history
                  .map((h) => {
                    const x = 34 + (h.x / Math.max(history.length - 1, 1)) * 256;
                    const y = 104 - ((h.kg - minKg) / range) * 84;
                    return `${x},${y}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#ff5b00"
                strokeWidth="2.5"
              />
              {history.map((h, i) => {
                const x = 34 + (h.x / Math.max(history.length - 1, 1)) * 256;
                const y = 104 - ((h.kg - minKg) / range) * 84;
                const isLast = i === history.length - 1;
                return (
                  <g key={i}>
                    <rect x={x - 5} y={y - 5} width="10" height="10" fill={isLast ? '#ff5b00' : '#000'} stroke="#ff5b00" strokeWidth="2" />
                    {isLast && (
                      <text x={x} y={y - 10} fill="#ededed" fontSize="9" fontFamily="JetBrains Mono" textAnchor="middle" fontWeight="700">{h.kg}</text>
                    )}
                    <text x={x} y="122" fill="#8a8a8a" fontSize="8" fontFamily="JetBrains Mono" textAnchor="middle">S{i + 1}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}

      {recent.length > 0 && (
        <>
          <div className="tac-section">HISTORIAL</div>
          <div>
            {recent.map((r, i) => (
              <div key={i} className="history-row">
                <div className="history-date">{fmtShort(r.date)}</div>
                <div className="history-day">
                  {r.top}
                  {i === 0 && <> <Badge variant="yellow">PR</Badge></>}
                </div>
                <div className="history-right">{r.volume.toLocaleString()}kg</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
