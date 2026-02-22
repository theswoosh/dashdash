import { GripVertical, Settings, X } from 'lucide-react';
import type { ServiceConfig } from '@dashdash/types';
import { useThemeCard } from '../themes/registry';
import { getWidget } from '../widgets/registry';
import { useWidgetData } from '../hooks/useWidgetData';
import { useUIStore } from '../store/uiStore';
import { WidgetSkeleton } from '../widgets/shared/WidgetSkeleton';
import { WidgetError } from '../widgets/shared/WidgetError';
import './WidgetCard.css';

interface Props {
  service: ServiceConfig;
  editMode: boolean;
  onDelete?: ((id: string) => void) | undefined;
}

export function WidgetCard({ service, editMode, onDelete }: Props) {
  const Card = useThemeCard();
  const setConfigTarget = useUIStore(s => s.setConfigTarget);
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
        {editMode && (
          <div className="widget-edit-actions">
            <button
              className="widget-edit-btn"
              title="Configure widget"
              onClick={() => setConfigTarget(service.id)}
              aria-label="Configure widget"
            >
              <Settings size={13} />
            </button>
            {onDelete && (
              <button
                className="widget-edit-btn widget-edit-btn--danger"
                title="Remove widget"
                onClick={() => onDelete(service.id)}
                aria-label="Remove widget"
              >
                <X size={13} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="widget-body">
        {body}
      </div>
    </Card>
  );
}
