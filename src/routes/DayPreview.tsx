import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import HazardBand from '../components/HazardBand';
import Badge from '../components/Badge';
import ActionSheet from '../components/ActionSheet';
import { SkeletonCard } from '../components/Skeleton';
import { haptic } from '../lib/haptics';
import type {
  WorkoutDayRow,
  PlannedExerciseRow,
  ExerciseRow,
  WeeklyPlanRow,
  WorkoutSessionRow,
  PhaseRow,
} from '../lib/database.types';

const DOW_LABEL = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

type LocState = { weekNumber?: number; phaseId?: string } | null;

type ExItem = PlannedExerciseRow & {
  exercise: ExerciseRow | null;
  plan_text: string | null;
};

export default function DayPreview() {
  const { dayId } = useParams<{ dayId: string }>();
  const nav = useNavigate();
  const loc = useLocation();
  const { user } = useAuth();
  const toast = useToast();
  const state = (loc.state ?? null) as LocState;

  const [day, setDay] = useState<WorkoutDayRow | null>(null);
  const [phase, setPhase] = useState<PhaseRow | null>(null);
  const [items, setItems] = useState<ExItem[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSessionRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const week = state?.weekNumber ?? 1;

  useEffect(() => {
    if (!dayId || !user) return;
    let mounted = true;
    (async () => {
      const { data: d } = await supabase.from('workout_days').select('*').eq('id', dayId).single();
      if (!mounted) return;
      if (!d) {
        toast.error('Día no encontrado');
        nav('/', { replace: true });
        return;
      }
      setDay(d);

      const { data: ph } = await supabase
        .from('phases')
        .select('*')
        .eq('id', d.phase_id)
        .single();
      if (mounted) setPhase(ph ?? null);

      const { data: planned } = await supabase
        .from('planned_exercises')
        .select('*')
        .eq('workout_day_id', d.id)
        .order('order_idx');
      const plannedIds = (planned ?? []).map((p) => p.id);
      const exIds = [...new Set((planned ?? []).map((p) => p.exercise_id))];

      const [{ data: exRows }, wpRes, sessRes] = await Promise.all([
        exIds.length
          ? supabase.from('exercises').select('*').in('id', exIds)
          : Promise.resolve({ data: [] as ExerciseRow[] }),
        plannedIds.length
          ? supabase
              .from('weekly_plan')
              .select('*')
              .in('planned_exercise_id', plannedIds)
              .eq('week_number', week)
          : Promise.resolve({ data: [] as WeeklyPlanRow[] }),
        supabase
          .from('workout_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('workout_day_id', d.id)
          .eq('week_number', week)
          .is('ended_at', null)
          .order('started_at', { ascending: false })
          .limit(1),
      ]);

      if (!mounted) return;
      const exMap = new Map((exRows ?? []).map((e) => [e.id, e]));
      const planMap = new Map((wpRes.data ?? []).map((w) => [w.planned_exercise_id, w.plan_text]));
      const combined: ExItem[] = (planned ?? []).map((p) => ({
        ...p,
        exercise: exMap.get(p.exercise_id) ?? null,
        plan_text: planMap.get(p.id) ?? null,
      }));
      setItems(combined);
      setActiveSession((sessRes.data ?? [])[0] ?? null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [dayId, user, week, toast, nav]);

  async function startNew() {
    if (!user || !day) return;
    setStarting(true);
    haptic('medium');
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        phase_id: day.phase_id,
        workout_day_id: day.id,
        week_number: week,
      })
      .select('id')
      .single();
    setStarting(false);
    if (error || !data) {
      toast.error('No se pudo iniciar');
      return;
    }
    nav(`/session/${data.id}`);
  }

  async function discardActiveAndStart() {
    if (!activeSession) {
      await startNew();
      return;
    }
    haptic('warning');
    const { error } = await supabase.from('workout_sessions').delete().eq('id', activeSession.id);
    if (error) {
      toast.error('No se pudo descartar');
      return;
    }
    setActiveSession(null);
    setConfirmRestart(false);
    await startNew();
  }

  function continueActive() {
    if (!activeSession) return;
    haptic('medium');
    nav(`/session/${activeSession.id}`);
  }

  const dayName = useMemo(() => {
    if (!day) return '';
    return day.name.split('—')[0]?.trim().toUpperCase() ?? day.name.toUpperCase();
  }, [day]);
  const dayBlock = useMemo(() => {
    if (!day) return '';
    return day.name.split('—')[1]?.trim() ?? day.description ?? '';
  }, [day]);

  if (loading) {
    return (
      <div className="container">
        <button className="link-btn" onClick={() => nav(-1)}>‹ VOLVER</button>
        <h1 className="tac-title mt-sm">CARGANDO<span className="dot">.</span></h1>
        <HazardBand thickness={5} />
        <div className="col gap mt-md">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  if (!day) return null;

  return (
    <div className="container">
      <button className="link-btn" onClick={() => nav(-1)}>‹ VOLVER</button>
      <div className="tac-op mt-sm">
        {phase?.code.replace('_', ' · ') ?? 'PLAN'} · S{String(week).padStart(2, '0')} ·{' '}
        {day.day_of_week ? DOW_LABEL[day.day_of_week] : '—'}
      </div>
      <h1 className="tac-title">
        {dayName}
        <span className="dot">.</span>
      </h1>
      {dayBlock && <div className="day-block-large">{dayBlock.toUpperCase()}</div>}

      <HazardBand thickness={5} />

      {activeSession && (
        <div className="active-banner mt-md">
          <div>
            <div className="active-banner-label">⚠ SESIÓN EN CURSO</div>
            <div className="active-banner-meta">
              Iniciada {new Date(activeSession.started_at).toLocaleString('es-ES', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
          <div className="active-banner-actions">
            <button className="primary active-banner-btn" onClick={continueActive}>
              CONTINUAR →
            </button>
            <button className="active-banner-discard" onClick={() => setConfirmRestart(true)}>
              EMPEZAR DE CERO
            </button>
          </div>
        </div>
      )}

      <div className="tac-section">{items.length} EJERCICIOS · PLAN S{week}</div>

      {items.length === 0 ? (
        <div className="card">
          <h3>SIN EJERCICIOS</h3>
          <p className="muted small">Este día no tiene ejercicios planificados.</p>
        </div>
      ) : (
        <div className="col gap-sm">
          {items.map((it) => {
            const exerciseName = it.exercise?.name ?? 'Ejercicio';
            const blockNum = `${it.block_label?.charAt(0) ?? 'A'} · ${String(it.order_idx).padStart(2, '0')}`;
            return (
              <div key={it.id} className="ex-card preview">
                <div className="row between" style={{ alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="ex-meta">
                      <Badge variant="ghost">{blockNum}</Badge>
                      <span className="ex-scheme">
                        {[it.target_scheme, it.rest_text, it.rir_text].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <div className="ex-name">{exerciseName}</div>
                  </div>
                  {it.plan_text && (
                    <div className="ex-plan">
                      <div className="ex-plan-label">PLAN</div>
                      <div className="ex-plan-value">{it.plan_text}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!activeSession && (
        <button className="start-mission" onClick={startNew} disabled={starting || items.length === 0}>
          {starting ? 'INICIANDO…' : '▶ EMPEZAR MISIÓN'}
        </button>
      )}

      <ActionSheet
        open={confirmRestart}
        onClose={() => setConfirmRestart(false)}
        title="¿EMPEZAR DE CERO?"
        description="Se descartará la sesión en curso (incluidas las series ya registradas). Esto no se puede deshacer."
        actions={[
          {
            label: 'DESCARTAR Y EMPEZAR',
            onPress: discardActiveAndStart,
            destructive: true,
          },
        ]}
      />
    </div>
  );
}
