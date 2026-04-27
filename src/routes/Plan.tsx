import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import HazardBand from '../components/HazardBand';
import { SkeletonCard } from '../components/Skeleton';
import { useToast } from '../components/Toast';
import type { PhaseRow, WorkoutDayRow, WorkoutSessionRow } from '../lib/database.types';

const DOW_LABEL = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
const JS_TO_APP_DOW = [7, 1, 2, 3, 4, 5, 6];

export default function Plan() {
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<PhaseRow | null>(null);
  const [days, setDays] = useState<WorkoutDayRow[]>([]);
  const [sessions, setSessions] = useState<WorkoutSessionRow[]>([]);
  const [weekVolume, setWeekVolume] = useState<Record<number, number>>({});
  const toast = useToast();
  const todayDow = JS_TO_APP_DOW[new Date().getDay()];

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: phases, error } = await supabase.from('phases').select('*').order('order_idx');
      if (!mounted) return;
      if (error || !phases || phases.length === 0) {
        if (error) toast.error('Error cargando plan');
        setLoading(false);
        return;
      }
      const cur = phases[0];
      setPhase(cur);

      const { data: dRows } = await supabase
        .from('workout_days')
        .select('*')
        .eq('phase_id', cur.id)
        .order('order_idx');
      if (!mounted) return;
      setDays(dRows ?? []);

      const { data: sRows } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('phase_id', cur.id)
        .order('started_at');
      if (!mounted) return;
      setSessions(sRows ?? []);

      // Volumen por semana
      const sessIds = (sRows ?? []).map((x) => x.id);
      if (sessIds.length) {
        const { data: setsRows } = await supabase
          .from('workout_sets')
          .select('session_id, weight_kg, reps')
          .in('session_id', sessIds);
        if (!mounted) return;
        const sessMap = new Map((sRows ?? []).map((s) => [s.id, s.week_number ?? 0]));
        const vol: Record<number, number> = {};
        for (const set of setsRows ?? []) {
          if (set.weight_kg == null || set.reps == null) continue;
          const w = sessMap.get(set.session_id) ?? 0;
          vol[w] = (vol[w] ?? 0) + Number(set.weight_kg) * set.reps;
        }
        setWeekVolume(vol);
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [toast]);

  const grid = useMemo(() => {
    if (!phase) return [];
    const totalWeeks = phase.week_end - phase.week_start + 1;
    const out: { week: number; cells: Array<'done' | 'today' | 'pending'> }[] = [];
    const completed = new Set<string>(); // `${week}|${dayId}`
    for (const s of sessions) {
      if (s.ended_at && s.workout_day_id && s.week_number != null) {
        completed.add(`${s.week_number}|${s.workout_day_id}`);
      }
    }
    const currentWeek = (() => {
      // semana actual basada en latest session
      const latest = sessions[sessions.length - 1];
      return latest?.week_number ?? phase.week_start;
    })();
    for (let i = 0; i < totalWeeks; i++) {
      const w = phase.week_start + i;
      const cells = days.map((d) => {
        const key = `${w}|${d.id}`;
        if (completed.has(key)) return 'done' as const;
        if (w === currentWeek && d.day_of_week === todayDow) return 'today' as const;
        return 'pending' as const;
      });
      out.push({ week: w, cells });
    }
    return out;
  }, [phase, days, sessions, todayDow]);

  const stats = useMemo(() => {
    if (!phase) return { done: 0, total: 0, pct: 0 };
    const totalWeeks = phase.week_end - phase.week_start + 1;
    const total = totalWeeks * Math.max(days.length, 1);
    const done = sessions.filter((s) => s.ended_at).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }, [phase, days, sessions]);

  const volumeData = useMemo(() => {
    if (!phase) return [];
    const totalWeeks = phase.week_end - phase.week_start + 1;
    const out: { w: number; vol: number }[] = [];
    for (let i = 0; i < totalWeeks; i++) {
      const w = phase.week_start + i;
      out.push({ w, vol: weekVolume[w] ?? 0 });
    }
    return out;
  }, [phase, weekVolume]);

  const maxVol = Math.max(...volumeData.map((x) => x.vol), 1);

  if (loading) {
    return (
      <div className="container">
        <div className="tac-op">CARGANDO PLAN…</div>
        <h1 className="tac-title">PLAN<span className="dot">.</span></h1>
        <HazardBand thickness={5} />
        <SkeletonCard />
      </div>
    );
  }

  if (!phase) {
    return (
      <div className="container">
        <h1 className="tac-title">PLAN<span className="dot">.</span></h1>
        <HazardBand thickness={5} />
        <div className="card mt-md">
          <h3>SIN PLAN</h3>
          <p className="muted small">Importa una plantilla para ver el plan.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="tac-op">OPERATIVO · {phase.code.replace('_', ' ')}</div>
      <h1 className="tac-title">PLAN<span className="dot">.</span></h1>
      <div className="tac-op" style={{ marginTop: 6 }}>
        {stats.done}/{stats.total} MISIONES · {stats.pct}% · OBJ. SEM {phase.week_end}
      </div>

      <HazardBand thickness={5} />

      <div className="plan-grid mt-md">
        <div className="plan-grid-head">
          <div></div>
          {days.map((d) => (
            <div key={d.id}>{d.day_of_week ? DOW_LABEL[d.day_of_week] : '—'}</div>
          ))}
        </div>
        {grid.map((row) => {
          const isCurrentWeek = row.cells.some((c) => c === 'today');
          return (
            <div key={row.week} className={`plan-grid-row${isCurrentWeek ? ' current' : ''}`}>
              <div className="plan-week-num">S{String(row.week).padStart(2, '0')}</div>
              {row.cells.map((cell, i) => (
                <div key={i} className={`plan-cell plan-cell-${cell}`}>
                  {cell === 'done' ? '✓' : cell === 'today' ? 'HOY' : '—'}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="tac-section">VOLUMEN SEMANAL · KG</div>
      <div className="chart-card">
        <svg viewBox="0 0 300 90" style={{ width: '100%', height: 90 }}>
          {volumeData.map((v, i) => {
            const colWidth = 300 / volumeData.length;
            const x = i * colWidth + 4;
            const w = colWidth - 8;
            const h = v.vol > 0 ? (v.vol / maxVol) * 70 : 0;
            const isLast = v.vol > 0 && i === volumeData.findIndex((d) => d.vol === 0) - 1;
            return (
              <g key={i}>
                {v.vol > 0 ? (
                  <rect
                    x={x}
                    y={80 - h}
                    width={w}
                    height={h}
                    fill={isLast ? '#ff5b00' : '#8a8a8a'}
                  />
                ) : (
                  <rect
                    x={x}
                    y={70}
                    width={w}
                    height={10}
                    fill="none"
                    stroke="#272727"
                    strokeDasharray="2 2"
                  />
                )}
                <text
                  x={x + w / 2}
                  y="88"
                  fill="#8a8a8a"
                  fontSize="8"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                >
                  S{v.w}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
