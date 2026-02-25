import type { ReactNode } from 'react';
import './ClassicCard.css';

interface Props {
  children: ReactNode;
  className?: string | undefined;
}

export function ClassicCard({ children, className = '' }: Props) {
  return (
    <div className={`classic-card ${className}`}>
      {children}
    </div>
  );
}
