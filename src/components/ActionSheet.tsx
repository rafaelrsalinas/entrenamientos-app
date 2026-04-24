import { useEffect, type ReactNode } from 'react';

type Action = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: ReactNode;
  actions: Action[];
  cancelLabel?: string;
};

export default function ActionSheet({ open, onClose, title, description, actions, cancelLabel = 'Cancelar' }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {(title || description) && (
          <div className="sheet-head">
            {title && <div className="sheet-title">{title}</div>}
            {description && <div className="sheet-desc">{description}</div>}
          </div>
        )}
        <div className="sheet-actions">
          {actions.map((a, i) => (
            <button
              key={i}
              className={`sheet-btn${a.destructive ? ' destructive' : ''}`}
              onClick={() => {
                a.onPress();
                onClose();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button className="sheet-cancel" onClick={onClose}>{cancelLabel}</button>
      </div>
    </div>
  );
}
