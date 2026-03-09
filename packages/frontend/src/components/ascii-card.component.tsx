import { memo, type CSSProperties, type ReactNode } from 'react';
import './ascii-card.css';

interface Props {
  children: ReactNode;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}

export const AsciiCard = memo(function AsciiCard({ children, className = '', style }: Props) {
  return (
    <div className={`ascii-card ${className}`} style={style}>
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
});
