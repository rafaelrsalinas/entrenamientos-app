import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SetRow from '../components/SetRow';
import RestTimer, { parseRestSeconds } from '../components/RestTimer';
import ActionSheet from '../components/ActionSheet';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
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

export default function SessionView() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nav = useNavigate();
  const toast = useToast();
  const [sess, setSess] = useState<Session | null>(null);
  const [items, setItems] = useState<PlannedItem[]>([]);
  const [sets, setSets] = useState<SetRowDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [activeTimerFor, setActiveTimerFor] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) { nav('/', { replace: true }); return; }
    let mounted = true;
    (async () => {
      const { data: s, error: sErr } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (!mounted) return;
      if (sErr || !s) {
        toast.error('Sesión no encontrada.');
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

      const [{ data: exRows }, wpRes, { data: setRows }] = await Promise.all([
        supabase.from('exercises').select('*').in('id', exerciseIds),
        s.week_number != null
          ? supabase.from('weekly_plan').select('*').in('planned_exercise_id', plannedIds).eq('week_number', s.week_number)
          : Promise.resolve({ data: [] as WeeklyPlanRow[] }),
        supabase.from('workout_sets').select('*').eq('session_id', s.id).order('set_number'),
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
      setLoading(false);
    })();
    return () => { mounted = false; };
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
      toast.error('No se pudo añadir la serie.');
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
      toast.error('No se pudo guardar.');
      return;
    }
    setSets((prev) => prev.map((s) => (s.id === id ? data : s)));
    if ((patch.weight_kg != null || patch.reps != null) && data.planned_exercise_id) {
      setActiveTimerFor(data.planned_exercise_id);
      haptic('success');
    }
  }

  async function deleteSet(id: string) {
    const { error } = await supabase.from('workout_sets').delete().eq('id', id);
    if (error) { toast.error('No se pudo borrar.'); return; }
    setSets((prev) => prev.filter((s) => s.id !== id));
    haptic('warning');
  }

  async function finish() {
    setFinishing(true);
    haptic('success');
    const { error } = await supabase
      .from('workout_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId!);
    if (error) {
      toast.error('No se pudo finalizar. Reintenta.');
      setFinishing(false);
      return;
    }
    toast.success('Sesión guardada.');
    nav('/history', { replace: true });
  }

  async function discard() {
    haptic('warning');
    const { error } = await supabase
      .from('workout_sessions')
      .delete()
      .eq('id', sessionId!);
    if (error) { toast.error('No se pudo descartar.'); return; }
    toast.info('Sesión descartada.');
    nav('/', { replace: true });
  }

  const stats = useMemo(() => {
    let volume = 0;
    for (const s of sets) {
      if (s.weight_kg != null && s.reps != null) volume += Number(s.weight_kg) * s.reps;
    }
    return { sets: sets.length, volume: Math.round(volume) };
  }, [sets]);

  if (loading) {
    return (
      <>
        <div className="session-topbar">
          <button className="ios-back" onClick={() => nav(-1)} aria-label="Volver">‹</button>
          <div className="session-title-wrap">
            <div className="small muted">Sesión</div>
            <strong>Cargando…</strong>
          </div>
          <div style={{ width: 44 }} />
        </div>
        <div className="col gap mt-md">
          <SkeletonCard />
          <SkeletonCard lines={3} />
          <SkeletonCard />
        </div>
      </>
    );
  }
  if (!sess) return null;

  return (
    <>
      <div className="session-topbar">
        <button className="ios-back" onClick={() => setDiscardOpen(true)} aria-label="Atrás">‹</button>
        <div className="session-title-wrap">
          <div className="small muted">
            Semana {sess.week_number} · {items.length} ejercicios
          </div>
          <strong>{stats.sets} series · {stats.volume} kg</strong>
        </div>
        <button
          className="primary session-finish"
          onClick={() => setConfirmOpen(true)}
          disabled={finishing}
        >
          {finishing ? '…' : 'Finalizar'}
        </button>
      </div>

      <div className="col gap mt-md">
        {items.map((it) => {
          const exSets = sets.filter((s) => s.planned_exercise_id === it.id);
          const exerciseName = it.exercise?.name ?? 'Ejercicio';
          return (
            <section key={it.id} className="card exercise-card">
              <header className="row between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ex-block">{it.block_label}</div>
                  <h3 style={{ margin: '2px 0' }}>
                    {it.number_label ? `${it.number_label}. ` : ''}
                    {it.exercise ? (
                      <Link to={`/exercise/${it.exercise.id}`} className="ex-link">
                        {exerciseName}
                      </Link>
                    ) : (
                      exerciseName
                    )}
                  </h3>
                  <div className="muted small">
                    {[it.target_scheme, it.rest_text, it.rir_text].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {it.plan_text && (
                  <div className="plan-tag">
                    <span className="label">Plan S{sess.week_number}</span>
                    <strong>{it.plan_text}</strong>
                  </div>
                )}
              </header>

              {it.notes && <p className="muted small" style={{ marginTop: 8 }}>📝 {it.notes}</p>}

              {exSets.length > 0 && (
                <table className="sets-table">
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Peso (kg)</th>
                      <th>Reps</th>
                      <th>RIR</th>
                      <th aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {exSets.map((s) => (
                      <SetRow key={s.id} set={s} onUpdate={updateSet} onDelete={deleteSet} />
                    ))}
                  </tbody>
                </table>
              )}

              <button className="ghost full" onClick={() => addSet(it.id, it.exercise_id)}>
                + Añadir serie{exSets.length > 0 ? ' (copia la anterior)' : ''}
              </button>

              {activeTimerFor === it.id && it.rest_seconds > 0 && (
                <RestTimer
                  key={`${it.id}-${exSets.length}`}
                  defaultSeconds={it.rest_seconds}
                  label={`Descanso ${it.rest_text ?? ''}`}
                  onComplete={() => setActiveTimerFor(null)}
                />
              )}
            </section>
          );
        })}
      </div>

      <ActionSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Finalizar sesión"
        description={`${stats.sets} series · ${stats.volume} kg de volumen`}
        actions={[{
          label: finishing ? 'Finalizando…' : 'Finalizar y guardar',
          onPress: finish,
        }]}
      />

      <ActionSheet
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        title="¿Salir de la sesión?"
        description={stats.sets > 0
          ? `Tienes ${stats.sets} series registradas. Descartarlas las borra permanentemente.`
          : 'No has registrado ninguna serie aún.'}
        actions={stats.sets > 0 ? [
          { label: 'Guardar como en curso', onPress: () => nav('/') },
          { label: 'Descartar sesión', onPress: discard, destructive: true },
        ] : [
          { label: 'Descartar sesión', onPress: discard, destructive: true },
        ]}
      />
    </>
  );
}
