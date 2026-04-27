import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SetRow from '../components/SetRow';
import RestTimer, { parseRestSeconds } from '../components/RestTimer';
import ActionSheet from '../components/ActionSheet';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import Badge from '../components/Badge';
import { haptic } from '../lib/haptics';
import type {
  WorkoutSessionRow as Session,
  PlannedExerciseRow,
  ExerciseRow,
  WeeklyPlanRow,
  WorkoutSetRow as SetRowDB,
} from '../lib/database.types';

type PlannedItem = PlannedExerciseRow & {
  exercise: ExerciseRow | null;
  plan_text: string | null;
  rest_seconds: number;
};

function formatElapsed(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const [sess, setSess] = useState<Session | null>(null);
  const [items, setItems] = useState<PlannedItem[]>([]);
  const [sets, setSets] = useState<SetRowDB[]>([]);
  const [bestPerExercise, setBestPerExercise] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [activeTimerFor, setActiveTimerFor] = useState<string | null>(null);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!sessionId) {
      nav('/', { replace: true });
      return;
    }
    let mounted = true;
    (async () => {
      const { data: s, error: sErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (!mounted) return;
      if (sErr || !s) {
        toast.error('Sesión no encontrada');
        nav('/', { replace: true });
        return;
      }
      setSess(s);

      const { data: plannedRows } = await supabase
        .from('planned_exercises')
        .select('*')
        .eq('workout_day_id', s.workout_day_id!)
        .order('order_idx');

      const plannedIds = (plannedRows ?? []).map((p) => p.id);
      const exerciseIds = [...new Set((plannedRows ?? []).map((p) => p.exercise_id))];

      const [{ data: exRows }, wpRes, { data: setRows }, { data: prevSets }] = await Promise.all([
        supabase.from('exercises').select('*').in('id', exerciseIds),
        s.week_number != null
          ? supabase
              .from('weekly_plan')
              .select('*')
              .in('planned_exercise_id', plannedIds)
              .eq('week_number', s.week_number)
          : Promise.resolve({ data: [] as WeeklyPlanRow[] }),
        supabase.from('workout_sets').select('*').eq('session_id', s.id).order('set_number'),
        supabase
          .from('workout_sets')
          .select('exercise_id, weight_kg')
          .in('exercise_id', exerciseIds)
          .neq('session_id', s.id),
      ]);

      if (!mounted) return;
      const exMap = new Map((exRows ?? []).map((e) => [e.id, e]));
      const planMap = new Map((wpRes.data ?? []).map((w) => [w.planned_exercise_id, w.plan_text]));
      const combined: PlannedItem[] = (plannedRows ?? []).map((p) => ({
        ...p,
        exercise: exMap.get(p.exercise_id) ?? null,
        plan_text: planMap.get(p.id) ?? null,
        rest_seconds: parseRestSeconds(p.rest_text),
      }));
      setItems(combined);
      setSets(setRows ?? []);

      // Mejor peso histórico por ejercicio (para detectar PR)
      const best = new Map<string, number>();
      for (const ps of prevSets ?? []) {
        if (ps.weight_kg == null) continue;
        const cur = best.get(ps.exercise_id) ?? 0;
        if (Number(ps.weight_kg) > cur) best.set(ps.exercise_id, Number(ps.weight_kg));
      }
      setBestPerExercise(best);

      // Activar primer ejercicio
      const firstNotDone = combined.find(
        (it) => !(setRows ?? []).some((r) => r.planned_exercise_id === it.id && r.weight_kg != null),
      );
      setActiveKey(firstNotDone?.id ?? combined[0]?.id ?? null);

      setLoading(false);

      // Reloj sesión
      const startMs = new Date(s.started_at).getTime();
      const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
      tick();
      const interval = window.setInterval(tick, 1000);
      return () => window.clearInterval(interval);
    })();
    return () => {
      mounted = false;
    };
  }, [sessionId, nav, toast]);

  async function addSet(plannedId: string, exerciseId: string) {
    const existing = sets.filter((s) => s.planned_exercise_id === plannedId);
    const last = existing[existing.length - 1];
    haptic('light');
    const { data, error } = await supabase
      .from('workout_sets')
      .insert({
        session_id: sessionId!,
        planned_exercise_id: plannedId,
        exercise_id: exerciseId,
        set_number: existing.length + 1,
        reps: last?.reps ?? null,
        weight_kg: last?.weight_kg ?? null,
        rir: last?.rir ?? null,
      })
      .select('*')
      .single();
    if (error || !data) {
      toast.error('No se pudo añadir');
      return;
    }
    setSets((prev) => [...prev, data]);
  }

  async function updateSet(id: string, patch: Partial<SetRowDB>) {
    const { data, error } = await supabase
      .from('workout_sets')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error || !data) {
      toast.error('Error guardando');
      return;
    }
    setSets((prev) => prev.map((s) => (s.id === id ? data : s)));
    if (
      (patch.weight_kg != null || patch.reps != null) &&
      data.planned_exercise_id
    ) {
      setActiveTimerFor(data.planned_exercise_id);
    }
  }

  async function deleteSet(id: string) {
    const { error } = await supabase.from('workout_sets').delete().eq('id', id);
    if (error) {
      toast.error('No se pudo borrar');
      return;
    }
    setSets((prev) => prev.filter((s) => s.id !== id));
  }

  async function finish() {
    setFinishing(true);
    haptic('success');
    const { error } = await supabase
      .from('workout_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId!);
    if (error) {
      toast.error('Error finalizando');
      setFinishing(false);
      return;
    }
    nav(`/session/${sessionId}/summary`, { replace: true });
  }

  async function discard() {
    haptic('warning');
    const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId!);
    if (error) {
      toast.error('Error');
      return;
    }
    nav('/', { replace: true });
  }

  const stats = useMemo(() => {
    let count = 0;
    let vol = 0;
    for (const s of sets) {
      if (s.weight_kg != null && s.reps != null) {
        count++;
        vol += Number(s.weight_kg) * s.reps;
      }
    }
    return { count, vol: Math.round(vol) };
  }, [sets]);

  if (loading) {
    return (
      <div className="session-view">
        <div className="session-topbar">
          <div className="session-topbar-row">
            <button className="session-close" onClick={() => nav(-1)}>‹</button>
            <div>
              <div className="session-title-tag">CARGANDO…</div>
              <div className="session-title">SESIÓN<span className="dot">.</span></div>
            </div>
            <div style={{ width: 60 }} />
          </div>
        </div>
        <div className="session-body">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }
  if (!sess) return null;

  return (
    <div className="session-view">
      <div className="session-topbar">
        <div className="session-topbar-row">
          <button className="session-close" onClick={() => setDiscardOpen(true)} aria-label="Salir">✕</button>
          <div className="session-title-wrap">
            <div className="session-title-tag">F1·S{sess.week_number} · {items.length} EJERCICIOS</div>
            <div className="session-title">PULL<span className="dot">.</span></div>
          </div>
          <button
            className="session-finish"
            onClick={() => setConfirmFinishOpen(true)}
            disabled={finishing}
          >
            {finishing ? '…' : 'FINALIZAR'}
          </button>
        </div>
        <div className="session-stats">
          <div className="session-stats-group">
            <div>
              <div className="stat-label">TIEMPO</div>
              <div className="stat-value">{formatElapsed(elapsed)}</div>
            </div>
            <div>
              <div className="stat-label">SERIES</div>
              <div className="stat-value">{stats.count}/{items.length * 4}</div>
            </div>
            <div>
              <div className="stat-label">VOL</div>
              <div className="stat-value orange">
                {stats.vol.toLocaleString()}
                <span className="muted">kg</span>
              </div>
            </div>
          </div>
          <div className="stat-live">● LIVE</div>
        </div>
      </div>

      <div className="session-body">
        {items.map((it) => {
          const exSets = sets.filter((s) => s.planned_exercise_id === it.id);
          const doneCount = exSets.filter((s) => s.weight_kg != null || s.reps != null).length;
          const allDone = exSets.length > 0 && doneCount === exSets.length;
          const isActive = it.id === activeKey;
          const blockNum = `${it.block_label?.charAt(0) ?? 'A'} · ${String(it.order_idx).padStart(2, '0')}`;
          const exerciseName = it.exercise?.name ?? 'Ejercicio';
          const bestKg = bestPerExercise.get(it.exercise_id) ?? 0;

          if (!isActive) {
            // Tarjeta colapsada (siguiente o pendiente)
            const isUpcoming = doneCount === 0;
            return (
              <button
                key={it.id}
                className={`ex-card ${isUpcoming ? 'upcoming' : ''}${allDone ? ' all-done' : ''}`}
                onClick={() => setActiveKey(it.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px' }}
              >
                <div className="row between">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ex-meta">
                      <Badge variant="ghost">{blockNum}</Badge>
                      <span className="ex-scheme">{it.target_scheme}</span>
                      {allDone && <span style={{ color: 'var(--green)', fontSize: 12 }}>✓</span>}
                    </div>
                    <div className="ex-name">{exerciseName}</div>
                    {!isUpcoming && (
                      <div className="ex-scheme" style={{ marginTop: 3 }}>
                        {doneCount}/{exSets.length || 4} COMPLETADAS
                      </div>
                    )}
                  </div>
                  <div className="ex-plan">
                    <div className="ex-plan-label">PLAN</div>
                    <div className="ex-plan-value">{it.plan_text ?? '—'}</div>
                  </div>
                </div>
              </button>
            );
          }

          // Tarjeta activa expandida
          return (
            <section key={it.id} className="ex-card active">
              <header className="ex-header">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ex-meta">
                    <Badge>{blockNum}</Badge>
                    <span className="ex-scheme">
                      {[it.target_scheme, it.rest_text, it.rir_text].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="ex-name">
                    {it.exercise ? (
                      <Link to={`/exercise/${it.exercise.id}`} className="ex-name-link">
                        {exerciseName}
                      </Link>
                    ) : (
                      exerciseName
                    )}
                  </div>
                </div>
                <div className="ex-plan">
                  <div className="ex-plan-label">PLAN S{sess.week_number}</div>
                  <div className="ex-plan-value">{it.plan_text ?? '—'}</div>
                </div>
              </header>

              {it.notes && (
                <div className="ex-notes">△ {it.notes}</div>
              )}

              <div className="sets-table">
                <div className="sets-head">
                  <div>#</div>
                  <div>PESO</div>
                  <div>REPS</div>
                  <div>RIR</div>
                  <div></div>
                </div>
                {exSets.map((s) => {
                  const isPR =
                    s.weight_kg != null && bestKg > 0 && Number(s.weight_kg) > bestKg;
                  return (
                    <SetRow
                      key={s.id}
                      set={s}
                      onUpdate={updateSet}
                      onDelete={deleteSet}
                      isPR={isPR}
                    />
                  );
                })}
                <button className="add-set" onClick={() => addSet(it.id, it.exercise_id)}>
                  + AÑADIR SERIE
                </button>
              </div>

              {activeTimerFor === it.id && it.rest_seconds > 0 && (
                <RestTimer
                  key={`${it.id}-${exSets.length}`}
                  defaultSeconds={it.rest_seconds}
                  label={it.rest_text ?? undefined}
                  onComplete={() => setActiveTimerFor(null)}
                />
              )}
            </section>
          );
        })}
      </div>

      <ActionSheet
        open={confirmFinishOpen}
        onClose={() => setConfirmFinishOpen(false)}
        title="¿FINALIZAR MISIÓN?"
        description={`${stats.count} series · ${stats.vol.toLocaleString()} kg de volumen`}
        actions={[
          {
            label: finishing ? 'FINALIZANDO…' : 'GUARDAR Y CONTINUAR',
            onPress: finish,
          },
        ]}
      />
      <ActionSheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="¿SALIR DE LA SESIÓN?"
        description={
          stats.count > 0
            ? `${stats.count} series registradas. Descartar las elimina.`
            : 'Sin series registradas todavía.'
        }
        actions={
          stats.count > 0
            ? [
                { label: 'DEJAR EN CURSO', onPress: () => nav('/') },
                { label: 'DESCARTAR SESIÓN', onPress: discard, destructive: true },
              ]
            : [{ label: 'DESCARTAR SESIÓN', onPress: discard, destructive: true }]
        }
      />
    </div>
  );
}
