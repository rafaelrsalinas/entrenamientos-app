import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import HazardBand from '../components/HazardBand';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';

type ExerciseSummary = {
  exercise_id: string;
  name: string;
  bestKg: number;
  bestReps: number;
  prevBest: number;
};

export default function Summary() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    sets: 0,
    volume: 0,
    durationMin: 0,
    week: 0,
    dayName: '',
  });
  const [prs, setPrs] = useState<ExerciseSummary[]>([]);
  const [prevWeekVolume, setPrevWeekVolume] = useState<number | null>(null);

  useEffect(() => {
    if (!sessionId) {
      nav('/', { replace: true });
      return;
    }
    let mounted = true;
    (async () => {
      const { data: s, error } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (!mounted) return;
      if (error || !s) {
        toast.error('Sesión no encontrada');
        nav('/history', { replace: true });
        return;
      }

      const [{ data: setRows }, dayRes] = await Promise.all([
        supabase.from('workout_sets').select('*').eq('session_id', s.id),
        s.workout_day_id
          ? supabase.from('workout_days').select('name').eq('id', s.workout_day_id).single()
          : Promise.resolve({ data: null }),
      ]);

      const sets = setRows ?? [];
      const exerciseIds = [...new Set(sets.map((x) => x.exercise_id))];
      const { data: exRows } = exerciseIds.length
        ? await supabase.from('exercises').select('id, name').in('id', exerciseIds)
        : { data: [] };
      const { data: prevSets } = exerciseIds.length
        ? await supabase
            .from('workout_sets')
            .select('exercise_id, weight_kg, reps')
            .in('exercise_id', exerciseIds)
            .neq('session_id', s.id)
        : { data: [] };

      if (!mounted) return;

      // Volumen + best by exercise this session
      let volume = 0;
      const bestThis = new Map<string, { kg: number; reps: number }>();
      for (const set of sets) {
        if (set.weight_kg != null && set.reps != null) {
          volume += Number(set.weight_kg) * set.reps;
        }
        if (set.weight_kg != null) {
          const cur = bestThis.get(set.exercise_id);
          if (!cur || Number(set.weight_kg) > cur.kg) {
            bestThis.set(set.exercise_id, { kg: Number(set.weight_kg), reps: set.reps ?? 0 });
          }
        }
      }

      // Best previous by exercise
      const bestPrev = new Map<string, number>();
      for (const ps of prevSets ?? []) {
        if (ps.weight_kg == null) continue;
        const cur = bestPrev.get(ps.exercise_id) ?? 0;
        if (Number(ps.weight_kg) > cur) bestPrev.set(ps.exercise_id, Number(ps.weight_kg));
      }

      const exMap = new Map((exRows ?? []).map((e) => [e.id, e.name]));
      const prList: ExerciseSummary[] = [];
      bestThis.forEach((cur, exId) => {
        const prev = bestPrev.get(exId) ?? 0;
        if (cur.kg > prev) {
          prList.push({
            exercise_id: exId,
            name: exMap.get(exId) ?? 'Ejercicio',
            bestKg: cur.kg,
            bestReps: cur.reps,
            prevBest: prev,
          });
        }
      });

      // Previous week volume (any sessions in 7-14 days ago)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 14);
      const startedTs = new Date(s.started_at);
      const sevenAgo = new Date(startedTs.getTime() - 7 * 86400000);
      const { data: prevWeekSessions } = await supabase
        .from('workout_sessions')
        .select('id')
        .gte('started_at', weekAgo.toISOString())
        .lt('started_at', sevenAgo.toISOString());
      const prevSessIds = (prevWeekSessions ?? []).map((x) => x.id);
      let prevVol = 0;
      if (prevSessIds.length) {
        const { data: prevWeekSets } = await supabase
          .from('workout_sets')
          .select('weight_kg, reps')
          .in('session_id', prevSessIds);
        for (const ws of prevWeekSets ?? []) {
          if (ws.weight_kg != null && ws.reps != null) prevVol += Number(ws.weight_kg) * ws.reps;
        }
      }

      const durationMs = s.ended_at
        ? new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()
        : 0;

      setStats({
        sets: sets.length,
        volume: Math.round(volume),
        durationMin: Math.round(durationMs / 60000),
        week: s.week_number ?? 0,
        dayName: dayRes.data?.name ?? 'Sesión',
      });
      setPrs(prList);
      setPrevWeekVolume(Math.round(prevVol));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId, nav, toast]);

  if (loading) {
    return (
      <div className="container">
        <div className="tac-op">CARGANDO RESUMEN…</div>
        <h1 className="tac-title">RESUMEN<span className="dot">.</span></h1>
        <SkeletonCard />
      </div>
    );
  }

  const volDelta = prevWeekVolume != null ? stats.volume - prevWeekVolume : 0;
  const dayLabel = stats.dayName.split('—')[0]?.trim().toUpperCase() ?? 'SESIÓN';
  const blockLabel = stats.dayName.split('—')[1]?.trim().toUpperCase() ?? '';

  return (
    <div className="container container-narrow summary-screen">
      <div className="summary-status">● MISIÓN COMPLETADA</div>
      <h1 className="summary-title">
        {dayLabel}
        {blockLabel && (
          <>
            <br />
            {blockLabel}
          </>
        )}
        <span className="dot">.</span>
      </h1>
      <div className="summary-meta">
        F1·S{stats.week} · {stats.durationMin} MIN · {stats.sets} SERIES
      </div>

      <HazardBand thickness={5} />

      <div className="summary-kpis">
        <div className="kpi">
          <div className="kpi-label">VOLUMEN TOTAL</div>
          <div className="kpi-value orange">
            {(stats.volume / 1000).toFixed(1)}
            <span className="unit">T</span>
          </div>
          {prevWeekVolume != null && prevWeekVolume > 0 && (
            <div className={`kpi-sub ${volDelta >= 0 ? 'green' : ''}`}>
              {volDelta >= 0 ? '▲' : '▼'} {Math.abs(volDelta).toLocaleString()}kg vs semana ant.
            </div>
          )}
        </div>
        <div className="kpi">
          <div className="kpi-label">PRs ROTOS</div>
          <div className="kpi-value yellow">{String(prs.length).padStart(2, '0')}</div>
          <div className="kpi-sub">DE {Math.max(prs.length, 1)} EJERCICIOS</div>
        </div>
      </div>

      {prs.length > 0 && (
        <>
          <div className="tac-section">NUEVOS RECORDS</div>
          <div className="col gap-sm">
            {prs.map((r) => (
              <div key={r.exercise_id} className="pr-row">
                <div className="pr-row-bar" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pr-name">{r.name.toUpperCase()}</div>
                  <div className="pr-detail">
                    {r.prevBest > 0 ? `${r.prevBest}kg → ` : ''}
                    <span className="pr-new">
                      {r.bestKg}×{r.bestReps}
                    </span>
                  </div>
                </div>
                {r.prevBest > 0 && (
                  <div className="pr-delta">+{(r.bestKg - r.prevBest).toFixed(1)}KG</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <button className="primary full mt-md" onClick={() => nav('/history', { replace: true })}>
        GUARDAR Y CONTINUAR →
      </button>
    </div>
  );
}
