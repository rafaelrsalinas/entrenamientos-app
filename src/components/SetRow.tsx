import { useEffect, useRef, useState } from 'react';
import NumericKeyboard, { type NumericField } from './NumericKeyboard';
import { haptic } from '../lib/haptics';
import type { WorkoutSetRow } from '../lib/database.types';

type Props = {
  set: WorkoutSetRow;
  onUpdate: (id: string, patch: Partial<WorkoutSetRow>) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onConfirm?: (id: string) => void;
  isPR?: boolean;
};

const SWIPE_THRESHOLD = 50;
const SWIPE_MAX = 88;

/**
 * Una serie en la tabla tactical. Al tocar peso/reps/RIR abre el teclado numérico custom.
 * Swipe-left revela el botón rojo de borrar.
 */
export default function SetRow({ set, onUpdate, onDelete, onConfirm, isPR }: Props) {
  const [kbField, setKbField] = useState<NumericField | null>(null);
  const [swipeX, setSwipeX] = useState(0);
  const [saved, setSaved] = useState(false);
  const startX = useRef<number | null>(null);

  useEffect(() => {
    if (!saved) return;
    const t = window.setTimeout(() => setSaved(false), 900);
    return () => window.clearTimeout(t);
  }, [saved]);

  const done = set.weight_kg != null || set.reps != null;

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }
  function handleTouchMove(e: React.TouchEvent) {
    if (startX.current == null) return;
    const dx = e.touches[0].clientX - startX.current;
    setSwipeX(Math.max(-SWIPE_MAX, Math.min(0, dx)));
  }
  function handleTouchEnd() {
    if (swipeX < -SWIPE_THRESHOLD) setSwipeX(-SWIPE_MAX);
    else setSwipeX(0);
    startX.current = null;
  }

  async function handleDelete() {
    haptic('warning');
    await onDelete(set.id);
  }

  async function handleSave(field: NumericField, value: number) {
    const patch: Partial<WorkoutSetRow> =
      field === 'kg' ? { weight_kg: value } :
      field === 'reps' ? { reps: Math.round(value) } :
      { rir: value };
    await onUpdate(set.id, patch);
    setKbField(null);
    setSaved(true);
  }

  function handleConfirm() {
    haptic('success');
    onConfirm?.(set.id);
  }

  const fmt = (v: number | null) => (v == null ? '—' : v.toString());

  return (
    <>
      <div className="set-row-wrap">
        {swipeX < 0 && (
          <button className="set-delete-panel" onClick={handleDelete}>× BORRAR</button>
        )}
        <div
          className={`set-row-grid${done ? ' done' : ''}${isPR ? ' pr' : ''}${saved ? ' saved' : ''}`}
          style={{
            transform: `translateX(${swipeX}px)`,
            transition: startX.current == null ? 'transform 0.2s' : 'none',
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="set-num">{set.set_number}</div>
          <button className="set-cell-btn" onClick={() => setKbField('kg')}>{fmt(set.weight_kg)}</button>
          <button className="set-cell-btn" onClick={() => setKbField('reps')}>{fmt(set.reps)}</button>
          <button className="set-cell-btn" onClick={() => setKbField('rir')}>{fmt(set.rir)}</button>
          <div className="set-status">
            {isPR ? (
              <span className="set-pr-badge">PR</span>
            ) : done ? (
              <span className="set-done-tick">✓</span>
            ) : onConfirm ? (
              <button className="set-confirm" onClick={handleConfirm} aria-label="Confirmar serie">✓</button>
            ) : null}
          </div>
        </div>
      </div>
      <NumericKeyboard
        open={kbField != null}
        field={kbField ?? 'kg'}
        initial={
          kbField === 'kg' ? set.weight_kg :
          kbField === 'reps' ? set.reps :
          set.rir
        }
        onClose={() => setKbField(null)}
        onSave={(v) => kbField && handleSave(kbField, v)}
      />
    </>
  );
}
