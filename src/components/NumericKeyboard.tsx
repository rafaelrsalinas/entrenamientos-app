import { useEffect, useState } from 'react';
import { haptic } from '../lib/haptics';

export type NumericField = 'kg' | 'reps' | 'rir';

type Props = {
  open: boolean;
  field: NumericField;
  initial: number | null;
  onClose: () => void;
  onSave: (value: number) => void;
};

const LABELS: Record<NumericField, string> = {
  kg: 'PESO · KG',
  reps: 'REPETICIONES',
  rir: 'RIR',
};

const KEYS: string[] = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'del'];

export default function NumericKeyboard({ open, field, initial, onClose, onSave }: Props) {
  const [val, setVal] = useState('');

  useEffect(() => {
    if (open) setVal(initial != null ? String(initial) : '');
  }, [open, initial]);

  if (!open) return null;

  const tap = (k: string) => {
    haptic('light');
    if (k === 'del') setVal((v) => v.slice(0, -1));
    else if (k === '.') setVal((v) => (v.includes('.') ? v : (v || '0') + '.'));
    else setVal((v) => v + k);
  };

  const save = () => {
    const num = parseFloat(val);
    if (Number.isNaN(num)) {
      onClose();
      return;
    }
    haptic('success');
    onSave(num);
  };

  return (
    <div className="kb-backdrop" onClick={onClose}>
      <div className="kb-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="kb-head">
          <div className="kb-label">&gt; {LABELS[field]}</div>
          <button className="kb-cancel" onClick={onClose}>CANCELAR</button>
        </div>
        <div className={`kb-display${val ? ' has-value' : ''}`}>{val || '—'}</div>
        <div className="kb-grid">
          {KEYS.map((k, i) => {
            const positionStyle: React.CSSProperties =
              k === 'del'
                ? { gridColumn: 4, gridRow: 1 }
                : i >= 9
                ? { gridRow: 4 }
                : {};
            return (
              <button
                key={i}
                className={`kb-key${k === 'del' ? ' kb-del' : ''}`}
                onClick={() => tap(k)}
                style={positionStyle}
              >
                {k === 'del' ? '⌫' : k}
              </button>
            );
          })}
          <button className="kb-save" onClick={save}>GUARDAR →</button>
        </div>
      </div>
    </div>
  );
}
