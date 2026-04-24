import { useState } from 'react';
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

  function commit(patch: Partial<SetRowDB>) {
    onUpdate(set.id, patch);
  }

  return (
    <tr>
      <td className="set-num">{set.set_number}</td>
      <td>
        <input
          type="number"
          step="0.5"
          inputMode="decimal"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          onBlur={() => commit({ weight_kg: weight === '' ? null : Number(weight) })}
        />
      </td>
      <td>
        <input
          type="number"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          onBlur={() => commit({ reps: reps === '' ? null : parseInt(reps, 10) })}
        />
      </td>
      <td>
        <input
          type="number"
          step="0.5"
          inputMode="decimal"
          value={rir}
          onChange={(e) => setRir(e.target.value)}
          onBlur={() => commit({ rir: rir === '' ? null : Number(rir) })}
        />
      </td>
      <td>
        <button className="icon-btn" onClick={() => onDelete(set.id)} aria-label="Eliminar">✕</button>
      </td>
    </tr>
  );
}
