import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import SetRow from '../components/SetRow';
import RestTimer, { parseRestSeconds } from '../components/RestTimer';
import type {
  WorkoutSessionRow as Session,
  PlannedExerciseRow,
  ExerciseRow,
  WeeklyPlanRow,
  WorkoutSetRow as SetRowDB,
} from '../lib/database.types';

type PlannedItem = PlannedExerciseRow & {
  exercise: ExerciseRow;
  plan_text: string | null;
  rest_seconds: number;
};

export default function Session() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const nav = useNavigate();
  const [sess, setSess] = useState<Session | null>(null);
  const [items, setItems] = useState<PlannedItem[]>([]);
  const [sets, setSets] = useState<SetRowDB[]>([]);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const [activeTimerFor, setActiveTimerFor] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data: s } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      if (!s) { nav('/'); return; }
      setSess(s);

      const { data: plannedRows } = await supabase
        .from('planned_exercises')
        .select('*')
        .eq('workout_day_id', s.workout_day_id!)
        .order('order_idx');

      const plannedIds = (plannedRows ?? []).map((p) => p.id);
      const exerciseIds = [...new Set((plannedRows ?? []).map((p) => p.exercise_id))];

      const [{ data: exRows }, { data: wpRows }, { data: setRows }] = await Promise.all([
        supabase.from('exercises').select('*').in('id', exerciseIds),
        s.week_number != null
          ? supabase.from('weekly_plan').select('*').in('planned_exercise_id', plannedIds).eq('week_number', s.week_number)
          : Promise.resolve({ data: [] as WeeklyPlanRow[] }),
        supabase.from('workout_sets').select('*').eq('session_id', s.id).order('set_number'),
      ]);

      const exMap = new Map((exRows ?? []).map((e) => [e.id, e]));
      const planMap = new Map((wpRows ?? []).map((w) => [w.planned_exercise_id, w.plan_text]));
      const combined: PlannedItem[] = (plannedRows ?? []).map((p) => ({
        ...p,
        exercise: exMap.get(p.exercise_id)!,
        plan_text: planMap.get(p.id) ?? null,
        rest_seconds: parseRestSeconds(p.rest_text),
      }));
      setItems(combined);
      setSets(setRows ?? []);
      setLoading(false);
    })();
  }, [sessionId, nav]);

  async function addSet(plannedId: string, exerciseId: string) {
    const existing = sets.filter((s) => s.planned_exercise_id === plannedId);
    const last = existing[existing.length - 1];
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
    if (error) { alert(error.message); return; }
    if (data) setSets((prev) => [...prev, data]);
  }

  async function updateSet(id: string, patch: Partial<SetRowDB>) {
    const { data, error } = await supabase
      .from('workout_sets')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    if (error) { alert(error.message); return; }
    if (data) {
      setSets((prev) => prev.map((s) => (s.id === id ? data : s)));
      // If weight or reps was just set, fire the rest timer for this exercise
      if ((patch.weight_kg != null || patch.reps != null) && data.planned_exercise_id) {
        setActiveTimerFor(data.planned_exercise_id);
      }
    }
  }

  async function deleteSet(id: string) {
    const { error } = await supabase.from('workout_sets').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    setSets((prev) => prev.filter((s) => s.id !== id));
  }

  async function finish() {
    setFinishing(true);
    await supabase
      .from('workout_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId!);
    nav('/history');
  }

  if (loading) return <p>Cargando sesión…</p>;
  if (!sess) return null;

  const loggedSetCount = sets.length;

  return (
    <>
      <div className="row between sticky-header">
        <div>
          <h2 style={{ margin: 0 }}>Sesión en curso</h2>
          <p className="muted" style={{ margin: 0 }}>
            Semana {sess.week_number} · {items.length} ejercicios · {loggedSetCount} series loggeadas
          </p>
        </div>
        <button className="primary" onClick={finish} disabled={finishing}>
          {finishing ? 'Finalizando…' : 'Finalizar'}
        </button>
      </div>

      <div className="col gap mt-md">
        {items.map((it) => {
          const exSets = sets.filter((s) => s.planned_exercise_id === it.id);
          return (
            <section key={it.id} className="card">
              <header className="row between">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ex-block">{it.block_label}</div>
                  <h3 style={{ margin: '2px 0' }}>
                    {it.number_label ? `${it.number_label}. ` : ''}
                    <Link to={`/exercise/${it.exercise_id}`} className="ex-link">
                      {it.exercise.name}
                    </Link>
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
                      <th></th>
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
                  label={`Descanso ${it.rest_text}`}
                  onComplete={() => setActiveTimerFor(null)}
                />
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
