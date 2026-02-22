import { GripVertical } from 'lucide-react';
import type { ServiceConfig } from '@dashdash/types';
import { useThemeCard } from '../themes/registry';
import { getWidget } from '../widgets/registry';
import { useWidgetData } from '../hooks/useWidgetData';
import { WidgetSkeleton } from '../widgets/shared/WidgetSkeleton';
import { WidgetError } from '../widgets/shared/WidgetError';
import './WidgetCard.css';

interface Props {
  service: ServiceConfig;
  editMode: boolean;
}

export function WidgetCard({ service, editMode }: Props) {
  const Card = useThemeCard();
  const { Component, clientOnly } = getWidget(service.widget);
  const { data, error, loading } = useWidgetData(service.id, !!clientOnly);

  const body = (() => {
    if (!clientOnly && loading) return <WidgetSkeleton />;
    if (!clientOnly && error) return <WidgetError message={error} />;
    return (
      <Component
        serviceId={service.id}
        options={{ ...service.options, _widgetId: service.widget }}
        data={data}
        error={error}
        loading={loading}
      />
    );
  })();

  return (
    <Card className={editMode ? 'widget-card--edit' : ''}>
      <div className="widget-header">
        {editMode && (
          <span className="widget-drag-handle" title="Drag to move">
            <GripVertical size={16} />
          </span>
        )}
        <span className="widget-title">{service.title}</span>
      </div>
      <div className="widget-body">
        {body}
      </div>
    </Card>
  );
}
