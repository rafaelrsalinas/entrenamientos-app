import type { ReactNode } from 'react';

type Variant = 'orange' | 'yellow' | 'green' | 'ghost';
type Props = { children: ReactNode; variant?: Variant; className?: string };

export default function Badge({ children, variant = 'orange', className }: Props) {
  return (
    <span className={`badge${variant !== 'orange' ? ' ' + variant : ''}${className ? ' ' + className : ''}`}>
      {children}
    </span>
  );
}
