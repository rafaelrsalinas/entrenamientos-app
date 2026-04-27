import { useEffect, useRef, useState } from 'react';

type Props = {
  defaultSeconds: number;
  onComplete?: () => void;
  label?: string;
};

function formatTime(s: number): string {
  if (s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function RestTimer({ defaultSeconds, onComplete, label }: Props) {
  const [remaining, setRemaining] = useState(defaultSeconds);
  const [running, setRunning] = useState(true);
  const tickRef = useRef<number | null>(null);

  useEffect(() => setRemaining(defaultSeconds), [defaultSeconds]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          onComplete?.();
          try { navigator.vibrate?.([15, 40, 15]); } catch { /* noop */ }
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [running, onComplete]);

  function toggle() {
    if (remaining === 0) setRemaining(defaultSeconds);
    setRunning((r) => !r);
  }

  function addSeconds(delta: number) {
    setRemaining((r) => Math.max(0, r + delta));
    if (delta > 0 && remaining === 0) setRunning(true);
  }

  if (defaultSeconds === 0) return null;

  const pct = defaultSeconds > 0 ? (remaining / defaultSeconds) * 100 : 0;
  const done = remaining === 0;

  return (
    <div className={`rest-timer${done ? ' done' : ''}`}>
      <div className="rest-info">
        <div className="rest-info-label">⏱ DESCANSO{label ? ` · OBJ ${label}` : ''}</div>
        <button className="rest-clock" onClick={toggle} aria-label={running ? 'Pausar' : 'Iniciar'}>
          {done ? '✓' : formatTime(remaining)}
        </button>
      </div>
      <button className="rest-btn" onClick={() => addSeconds(-15)} aria-label="−15s">−15</button>
      <button className="rest-btn" onClick={() => addSeconds(15)} aria-label="+15s">+15</button>
      <button className="rest-btn" onClick={() => { setRemaining(0); setRunning(false); }} aria-label="Saltar">✕</button>
      <div className="rest-progress" aria-hidden>
        <div className="rest-progress-bar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * Parse "90s", "120 s", "2'30", "3-4 min", "60-90s/ronda", "0s → SS-A2" to seconds.
 */
export function parseRestSeconds(rest: string | null | undefined): number {
  if (!rest) return 0;
  const low = rest.toLowerCase();
  if (/continu|ronda|no sentarse/.test(low)) return 0;
  // "2'30" or "2'30"
  const minSec = rest.match(/(\d+)\s*['']\s*(\d+)?\s*["]?/);
  if (minSec) {
    return Number(minSec[1]) * 60 + Number(minSec[2] ?? 0);
  }
  // "3-4 min"
  const minMatch = rest.match(/(\d+)\s*(?:-|–)?\s*(\d+)?\s*min/i);
  if (minMatch) {
    const max = Number(minMatch[2] ?? minMatch[1]);
    return max * 60;
  }
  // "90-120s" / "90s"
  const sMatch = rest.match(/(\d+)\s*(?:-|–)?\s*(\d+)?\s*s/i);
  if (sMatch) {
    return Number(sMatch[2] ?? sMatch[1]);
  }
  return 0;
}
