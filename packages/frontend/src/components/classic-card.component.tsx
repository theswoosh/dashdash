import type { CSSProperties, ReactNode } from 'react';
import './ClassicCard.css';

interface Props {
  children: ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

export function ClassicCard({ children, className = '', style }: Props) {
  return (
    <div className={`classic-card ${className}`} style={style}>
      {children}
    </div>
  );
}
