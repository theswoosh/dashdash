import type { WidgetProps } from '@dashdash/types';
import { LayoutDashboard } from 'lucide-react';
import './FallbackWidget.css';

export function FallbackWidget({ serviceId, options }: WidgetProps) {
  const widgetType = options['_widgetId'] as string | undefined;

  return (
    <div className="fallback-widget">
      <LayoutDashboard size={24} className="fallback-widget__icon" />
      <div className="fallback-widget__type">{widgetType ?? 'Unknown widget'}</div>
      <div className="fallback-widget__id">{serviceId}</div>
    </div>
  );
}
