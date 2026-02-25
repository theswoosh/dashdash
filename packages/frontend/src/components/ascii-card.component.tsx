import type { ReactNode } from 'react';
import './AsciiCard.css';

interface Props {
  children: ReactNode;
  className?: string | undefined;
}

export function AsciiCard({ children, className = '' }: Props) {
  return (
    <div className={`ascii-card ${className}`}>
      {children}
    </div>
  );
}
