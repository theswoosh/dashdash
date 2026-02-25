import type { ReactNode } from 'react';
import './atom-card.css';

interface Props {
  children: ReactNode;
  className?: string | undefined;
}

export function AtomCard({ children, className = '' }: Props) {
  return (
    <div className={`atom-card ${className}`}>
      {children}
    </div>
  );
}
