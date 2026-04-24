import { useEffect, useRef, useState } from 'react';

type Props = {
  /** Default seconds to run. 0 = stopped. */
  defaultSeconds: number;
  /** Triggered when timer reaches 0. */
  onComplete?: () => void;
  /** Small label shown above the clock. */
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
  const [running, setRunning] = useState(false);
  const tickRef = useRef<number | null>(null);

  useEffect(() => setRemaining(defaultSeconds), [defaultSeconds]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          setRunning(false);
          onComplete?.();
          try { navigator.vibrate?.(500); } catch { /* ignore */ }
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
    if (!running && delta > 0) setRunning(true);
  }

  if (defaultSeconds === 0) return null;

  return (
    <div className={`rest-timer${running ? ' active' : ''}${remaining === 0 ? ' done' : ''}`}>
      {label && <span className="rest-label">{label}</span>}
      <button className="rest-clock" onClick={toggle} aria-label={running ? 'Pausar' : 'Iniciar'}>
        {remaining === 0 ? '✓' : formatTime(remaining)}
      </button>
      <button className="rest-delta" onClick={() => addSeconds(-15)} aria-label="−15s">−15</button>
      <button className="rest-delta" onClick={() => addSeconds(15)} aria-label="+15s">+15</button>
    </div>
  );
}

/**
 * Parse "90s", "120 s", "90-120 s", "60-90s/ronda", "0s → SS-A2" to seconds.
 * Returns 0 when the string doesn't contain a numeric duration (e.g. "continuo", "—").
 * When a range is found, returns the max (longer rest by default).
 */
export function parseRestSeconds(rest: string | null | undefined): number {
  if (!rest) return 0;
  const low = rest.toLowerCase();
  if (/continu|ronda|no sentarse/.test(low)) return 0;
  // match "90s", "90 s", "90-120s", "90–120 s", "3-4 min", "1 min"
  const minMatch = rest.match(/(\d+)\s*(?:-|–)?\s*(\d+)?\s*min/i);
  if (minMatch) {
    const max = Number(minMatch[2] ?? minMatch[1]);
    return max * 60;
  }
  const sMatch = rest.match(/(\d+)\s*(?:-|–)?\s*(\d+)?\s*s/i);
  if (sMatch) {
    return Number(sMatch[2] ?? sMatch[1]);
  }
  return 0;
}
