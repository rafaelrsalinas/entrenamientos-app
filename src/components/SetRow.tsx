import { useEffect, useState } from 'react';
import type { WorkoutSetRow as SetRowDB } from '../lib/database.types';

type Props = {
  set: SetRowDB;
  onUpdate: (id: string, patch: Partial<SetRowDB>) => void;
  onDelete: (id: string) => void;
};

export default function SetRow({ set, onUpdate, onDelete }: Props) {
  const [weight, setWeight] = useState(set.weight_kg?.toString() ?? '');
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [rir, setRir] = useState(set.rir?.toString() ?? '');
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => setWeight(set.weight_kg?.toString() ?? ''), [set.weight_kg]);
  useEffect(() => setReps(set.reps?.toString() ?? ''), [set.reps]);
  useEffect(() => setRir(set.rir?.toString() ?? ''), [set.rir]);

  function commit(patch: Partial<SetRowDB>) {
    onUpdate(set.id, patch);
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 900);
  }

  function parseNum(s: string): number | null {
    if (s === '' || s === '-') return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  return (
    <tr className={justSaved ? 'set-row saved' : 'set-row'}>
      <td className="set-num">{set.set_number}</td>
      <td>
        <input
          type="number"
          min="0"
          step="0.5"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => {
            const n = parseNum(weight);
            if (n !== (set.weight_kg ?? null)) commit({ weight_kg: n });
          }}
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={() => {
            const n = parseNum(reps);
            const rounded = n != null ? Math.round(n) : null;
            if (rounded !== (set.reps ?? null)) commit({ reps: rounded });
          }}
        />
      </td>
      <td>
        <input
          type="number"
          min="0"
          step="0.5"
          inputMode="decimal"
          value={rir}
          onChange={(e) => setRir(e.target.value)}
          onBlur={() => {
            const n = parseNum(rir);
            if (n !== (set.rir ?? null)) commit({ rir: n });
          }}
        />
      </td>
      <td>
        <button className="icon-btn" onClick={() => onDelete(set.id)} aria-label="Eliminar serie">✕</button>
      </td>
    </tr>
  );
}
