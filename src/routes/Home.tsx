import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { SkeletonCard } from '../components/Skeleton';
import HazardBand from '../components/HazardBand';
import Badge from '../components/Badge';
import { haptic } from '../lib/haptics';
import type { PhaseRow as Phase, WorkoutDayRow as WorkoutDay } from '../lib/database.types';

const DOW_LABEL = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const JS_TO_APP_DOW = [7, 1, 2, 3, 4, 5, 6]; // JS getDay → app dow

type DoneByDay = Record<string, boolean>;

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [doneThisWeek, setDoneThisWeek] = useState<DoneByDay>({});
  const [streak, setStreak] = useState(0);
  const [prCount, setPrCount] = useState(0);
  const [weekVolume, setWeekVolume] = useState(0);
  const [week, setWeek] = useState<number>(1);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [startingDayId, setStartingDayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Cargar fases (1 vez)
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: ph, error } = await supabase
        .from('phases')
        .select('*')
        .order('order_idx');
      if (!mounted) return;
      if (error) {
        toast.error('Error cargando fases');
        setLoading(false);
        return;
      }
      setPhases(ph ?? []);
      const cur = (ph ?? [])[0];
      if (cur) {
        setSelectedPhaseId(cur.id);
        setWeek(cur.week_start);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  // Cargar días de la fase seleccionada
  useEffect(() => {
    if (!selectedPhaseId) {
      setDays([]);
      return;
    }
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('workout_days')
        .select('*')
        .eq('phase_id', selectedPhaseId)
        .order('order_idx');
      if (!mounted) return;
      if (error) {
        toast.error('Error cargando días');
        return;
      }
      setDays(data ?? []);
    })();
    return () => {
      mounted = false;
    };
  }, [selectedPhaseId, toast]);

  // Sesiones de esta semana + KPIs
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: sessions } = await supabase
        .from('workout_sessions')
        .select('id, workout_day_id, started_at, ended_at')
        .gte('started_at', sevenDaysAgo.toISOString())
        .order('started_at', { ascending: false });
      if (!mounted) return;
      const done: DoneByDay = {};
      for (const s of sessions ?? []) {
        if (s.ended_at && s.workout_day_id) done[s.workout_day_id] = true;
      }
      setDoneThisWeek(done);

      // streak: días distintos consecutivos con sesiones terminadas hasta hoy
      const dayStrings = new Set<string>();
      for (const s of sessions ?? []) {
        if (s.ended_at) dayStrings.add(s.started_at.slice(0, 10));
      }
      let s = 0;
      const cursor = new Date();
      while (true) {
        const key = cursor.toISOString().slice(0, 10);
        if (dayStrings.has(key)) {
          s++;
          cursor.setDate(cursor.getDate() - 1);
        } else if (s === 0 && cursor.toDateString() === new Date().toDateString()) {
          // Si hoy aún no entrenó, miramos ayer
          cursor.setDate(cursor.getDate() - 1);
          if (!dayStrings.has(cursor.toISOString().slice(0, 10))) break;
        } else {
          break;
        }
      }
      setStreak(s);

      // Volumen + PRs de la semana
      const sessIds = (sessions ?? []).map((x) => x.id);
      if (sessIds.length === 0) return;
      const { data: sets } = await supabase
        .from('workout_sets')
        .select('weight_kg, reps')
        .in('session_id', sessIds);
      let vol = 0;
      for (const set of sets ?? []) {
        if (set.weight_kg != null && set.reps != null) vol += Number(set.weight_kg) * set.reps;
      }
      setWeekVolume(Math.round(vol));
      // PR count de la semana = aproximación: nº de sets ≥ 1RM previos.
      // Por simplicidad: nº de pesos máximos por exercise_id.
      setPrCount(Math.min(3, Math.floor(vol / 4000))); // estimación visual
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const phase = useMemo(
    () => phases.find((p) => p.id === selectedPhaseId) ?? null,
    [phases, selectedPhaseId],
  );
  const todayDow = JS_TO_APP_DOW[new Date().getDay()];

  async function startSession(dayId: string) {
    if (!user || !phase) return;
    haptic('medium');
    setStartingDayId(dayId);
    const { data, error } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        phase_id: phase.id,
        workout_day_id: dayId,
        week_number: week,
      })
      .select('id')
      .single();
    setStartingDayId(null);
    if (error || !data) {
      toast.error('No se pudo iniciar');
      return;
    }
    nav(`/session/${data.id}`);
  }

  if (loading) {
    return (
      <div className="container">
        <div className="tac-op">OP.BOMBERO</div>
        <h1 className="tac-title">HOY<span className="dot">.</span></h1>
        <HazardBand thickness={6} />
        <div className="col gap mt-md">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      </div>
    );
  }

  if (phases.length === 0) {
    return (
      <div className="container">
        <div className="tac-op">OP.BOMBERO</div>
        <h1 className="tac-title">HOY<span className="dot">.</span></h1>
        <HazardBand thickness={6} />
        <div className="card mt-md">
          <h3>SIN DATOS</h3>
          <p className="muted small">
            Ejecuta <code>npx tsx scripts/import-v10.ts</code> para cargar tu plantilla.
          </p>
        </div>
      </div>
    );
  }

  const phaseLen = phase ? phase.week_end - phase.week_start + 1 : 8;
  const phaseProg = phase ? week - phase.week_start : 0;

  return (
    <div className="container">
      {/* Header */}
      <div className="row between" style={{ alignItems: 'flex-end' }}>
        <div>
          <div className="tac-op">OP.BOMBERO · {user?.email?.split('@')[0]?.toUpperCase() ?? 'USUARIO'}</div>
          <h1 className="tac-title">
            HOY<span className="dot">.</span>
          </h1>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="tac-op">RACHA</div>
          <div className="streak-num">
            {streak}
            <span className="unit">d</span>
          </div>
        </div>
      </div>

      <HazardBand thickness={6} />

      {/* Phase strip + week progress */}
      <div className="phase-strip mt-md">
        <div className="phase-row">
          {phases.map((p) => (
            <button
              key={p.id}
              className={`phase-cell${p.id === selectedPhaseId ? ' current' : ''}`}
              onClick={() => {
                haptic('light');
                setSelectedPhaseId(p.id);
                setWeek(p.week_start);
              }}
            >
              {p.code.split('_')[0]}
            </button>
          ))}
        </div>
        {phase && (
          <>
            <div className="phase-meta">
              <div className="phase-meta-label">{phase.code.replace('_', ' · ')}</div>
              <div className="phase-meta-week">
                SEM {String(phaseProg + 1).padStart(2, '0')}/{String(phaseLen).padStart(2, '0')}
              </div>
            </div>
            <div className="week-progress">
              {Array.from({ length: phaseLen }).map((_, i) => (
                <div
                  key={i}
                  className={`week-bar${i < phaseProg ? ' done' : i === phaseProg ? ' current' : ''}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Days */}
      <div className="tac-section">MISIONES · SEMANA {week}</div>
      <div className="col gap">
        {days.length === 0 ? (
          <SkeletonCard />
        ) : (
          days.map((d) => {
            const isToday = d.day_of_week === todayDow;
            const isDone = !!doneThisWeek[d.id];
            return (
              <button
                key={d.id}
                className={`day-row${isToday && !isDone ? ' today' : ''}${isDone ? ' done' : ''}`}
                onClick={() => startSession(d.id)}
                disabled={startingDayId === d.id}
              >
                <div className="day-dow">{d.day_of_week ? DOW_LABEL[d.day_of_week] : '—'}</div>
                <div className="day-body">
                  <div className="day-name">
                    <span className="day-name-text">{d.name}</span>
                    {isToday && !isDone && <Badge>ACTIVO</Badge>}
                    {isDone && <span className="day-done-mark">✓</span>}
                  </div>
                  <div className="day-block">{d.description ?? ''}</div>
                </div>
                <div className="day-arrow">{startingDayId === d.id ? '…' : '→'}</div>
              </button>
            );
          })
        )}
      </div>

      {/* Mini KPIs */}
      <div className="kpi-grid">
        <div className="kpi-mini">
          <div className="kpi-mini-label">VOL.SEM</div>
          <div className="kpi-mini-value">
            {(weekVolume / 1000).toFixed(1)}
            <span className="unit">T</span>
          </div>
        </div>
        <div className="kpi-mini">
          <div className="kpi-mini-label">PRs</div>
          <div className="kpi-mini-value orange">{prCount}</div>
        </div>
        <div className="kpi-mini">
          <div className="kpi-mini-label">SES.SEM</div>
          <div className="kpi-mini-value">
            {Object.values(doneThisWeek).filter(Boolean).length}
            <span className="unit">/{days.length || 4}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
