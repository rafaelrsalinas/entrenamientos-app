import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { SkeletonCard } from '../components/Skeleton';
import { haptic } from '../lib/haptics';
import type { PhaseRow as Phase, WorkoutDayRow as WorkoutDay } from '../lib/database.types';

const DOW_LABEL = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const JS_TO_APP_DOW = [7, 1, 2, 3, 4, 5, 6]; // JS getDay: 0=Sun..6=Sat → app: 1=Mon..7=Sun

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [days, setDays] = useState<WorkoutDay[]>([]);
  const [week, setWeek] = useState<number>(1);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [startingDayId, setStartingDayId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: ph, error } = await supabase.from('phases').select('*').order('order_idx');
      if (!mounted) return;
      if (error) {
        toast.error('No se pudieron cargar las fases.');
        setLoading(false);
        return;
      }
      setPhases(ph ?? []);
      if (ph && ph.length > 0) {
        setSelectedPhaseId(ph[0].id);
        setWeek(ph[0].week_start);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [toast]);

  useEffect(() => {
    if (!selectedPhaseId) { setDays([]); return; }
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('workout_days')
        .select('*')
        .eq('phase_id', selectedPhaseId)
        .order('order_idx');
      if (!mounted) return;
      if (error) {
        toast.error('No se pudieron cargar los días.');
        return;
      }
      setDays(data ?? []);
    })();
    return () => { mounted = false; };
  }, [selectedPhaseId, toast]);

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
      toast.error('No se pudo iniciar la sesión. Reintenta.');
      return;
    }
    nav(`/session/${data.id}`);
  }

  if (loading) {
    return (
      <>
        <h1 className="large-title">Hoy</h1>
        <div className="col gap">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (phases.length === 0) {
    return (
      <>
        <h1 className="large-title">Hoy</h1>
        <div className="card">
          <h2>Sin datos todavía</h2>
          <p className="muted">
            Ejecuta <code>npx tsx scripts/import-v10.ts</code> para cargar tu plantilla de Excel.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="large-title">Hoy</h1>

      {phases.length > 1 && (
        <div className="segmented mt-sm" role="tablist">
          {phases.map((p) => (
            <button
              key={p.id}
              role="tab"
              aria-selected={p.id === selectedPhaseId}
              className={`seg-btn${p.id === selectedPhaseId ? ' seg-active' : ''}`}
              onClick={() => {
                haptic('light');
                setSelectedPhaseId(p.id);
                setWeek(p.week_start);
              }}
            >
              {p.code}
            </button>
          ))}
        </div>
      )}

      {phase && (
        <div className="row between mt-sm">
          <div className="muted small">{phase.name}</div>
          <div className="row gap-sm">
            <span className="label">Semana</span>
            <input
              className="input-inline"
              type="number"
              inputMode="numeric"
              min={phase.week_start}
              max={phase.week_end}
              value={week}
              onChange={(e) => setWeek(parseInt(e.target.value, 10) || phase.week_start)}
            />
          </div>
        </div>
      )}

      <div className="col gap mt-md">
        {days.length === 0 ? (
          <SkeletonCard />
        ) : (
          days.map((d) => {
            const isToday = d.day_of_week === todayDow;
            return (
              <button
                key={d.id}
                className={`day-card${isToday ? ' today' : ''}`}
                onClick={() => startSession(d.id)}
                disabled={startingDayId === d.id}
              >
                <div className="day-dow">{d.day_of_week ? DOW_LABEL[d.day_of_week] : '—'}</div>
                <div className="day-body">
                  <div className="day-name">{d.name}</div>
                  {isToday && <div className="day-today-tag">Hoy</div>}
                </div>
                <div className="arrow">{startingDayId === d.id ? '…' : '→'}</div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
