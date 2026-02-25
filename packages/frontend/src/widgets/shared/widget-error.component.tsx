import { AlertTriangle } from 'lucide-react';
import './WidgetError.css';

interface Props {
  message: string;
}

export function WidgetError({ message }: Props) {
  return (
    <div className="widget-error">
      <AlertTriangle size={20} className="widget-error__icon" />
      <span className="widget-error__message">{message}</span>
    </div>
  );
}
