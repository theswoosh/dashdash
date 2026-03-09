import { memo, type CSSProperties, type ReactNode } from 'react';
import './atom-card.css';

interface Props {
  children: ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

export const AtomCard = memo(function AtomCard({ children, className = '', style }: Props) {
  return (
    <div className={`atom-card ${className}`} style={style}>
      {children}
    </div>
  );
});
