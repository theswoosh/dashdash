import type { ReactNode } from 'react';
import './ascii-card.css';

interface Props {
  children: ReactNode;
  className?: string | undefined;
}

export function AsciiCard({ children, className = '' }: Props) {
  return (
    <div className={`ascii-card ${className}`}>
      <div className="ascii-card__top">
        <div className="ascii-card__top-fill" />
      </div>
      <div className="ascii-card__middle">
        <div className="ascii-card__side" />
        <div className="ascii-card__content">{children}</div>
        <div className="ascii-card__side" />
      </div>
      <div className="ascii-card__bottom">
        <div className="ascii-card__bottom-fill" />
      </div>
    </div>
  );
}
