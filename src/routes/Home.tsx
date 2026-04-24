import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type { PhaseRow as Phase, WorkoutDayRow as WorkoutDay } from '../lib/database.types';

const DOW_LABEL = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function Home() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [phases, setPhases] = useState<Phase[]>([]);
  const [days, setDays] = useState<Record<string, WorkoutDay[]>>({});
  const [week, setWeek] = useState<number>(1);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [startingDayId, setStartingDayId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: ph } = await supabase.from('phases').select('*').order('order_idx');
      setPhases(ph ?? []);
      if (ph && ph.length > 0) {
        setSelectedPhaseId(ph[0].id);
        setWeek(ph[0].week_start);
        const { data: wd } = await supabase
          .from('workout_days')
          .select('*')
          .in('phase_id', ph.map((p) => p.id))
          .order('order_idx');
        const byPhase: Record<string, WorkoutDay[]> = {};
        for (const d of wd ?? []) {
          (byPhase[d.phase_id] ??= []).push(d);
        }
        setDays(byPhase);
      }
    })();
  }, []);

  const phase = phases.find((p) => p.id === selectedPhaseId) ?? null;

  async function startSession(dayId: string) {
    if (!user || !phase) return;
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
    if (error) {
      alert('Error al iniciar sesión: ' + error.message);
      return;
    }
    nav(`/session/${data.id}`);
  }

  if (phases.length === 0) {
    return (
      <div className="card">
        <h2>Sin datos todavía</h2>
        <p className="muted">
          Ejecuta <code>npx tsx scripts/import-to-supabase.ts</code> para cargar tu plantilla de Excel.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="row gap">
        <label className="col gap-sm">
          <span className="label">Fase</span>
          <select
            value={selectedPhaseId ?? ''}
            onChange={(e) => {
              const p = phases.find((ph) => ph.id === e.target.value);
              setSelectedPhaseId(e.target.value);
              if (p) setWeek(p.week_start);
            }}
          >
            {phases.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        {phase && (
          <label className="col gap-sm">
            <span className="label">Semana</span>
            <input
              type="number"
              min={phase.week_start}
              max={phase.week_end}
              value={week}
              onChange={(e) => setWeek(parseInt(e.target.value, 10))}
            />
          </label>
        )}
      </div>

      <h2 className="mt-lg">Día de entrenamiento</h2>
      <div className="col gap">
        {(days[selectedPhaseId ?? ''] ?? []).map((d) => (
          <button
            key={d.id}
            className="card day-card"
            onClick={() => startSession(d.id)}
            disabled={startingDayId === d.id}
          >
            <div className="day-dow">{d.day_of_week ? DOW_LABEL[d.day_of_week] : '—'}</div>
            <div className="day-name">{d.name}</div>
            <div className="arrow">→</div>
          </button>
        ))}
      </div>

      <p className="mt-lg">
        <Link to="/history" className="link">Ver historial →</Link>
      </p>
    </>
  );
}
