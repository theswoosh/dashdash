import { useState, useRef, useEffect } from 'react';
import { GripVertical, Settings, X, RefreshCw } from 'lucide-react';
import { mutate as swrMutate } from 'swr';
import type { ServiceConfig } from '@dashdash/types';
import { useThemeCard } from '../themes/registry';
import { getWidget } from '../widgets/registry';
import { useWidgetData } from '../hooks/use-widget-data.hook';
import { useUIStore } from '../store/uiStore';
import { useBehavior } from '../hooks/use-behavior.hook';
import { WidgetSkeleton } from '../widgets/shared/widget-skeleton.component';
import { WidgetError } from '../widgets/shared/widget-error.component';
import './WidgetCard.css';

function HoldDeleteButton({ id, holdToDeleteMs, onDelete }: { id: string; holdToDeleteMs: number; onDelete: (id: string) => void }) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setHolding(true);
    timer.current = setTimeout(() => { onDelete(id); }, holdToDeleteMs);
  };

  const cancel = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setHolding(false);
  };

  return (
    <button
      className={`widget-delete-btn${holding ? ' widget-delete-btn--holding' : ''}`}
      style={{ '--hold-delete-duration': `${holdToDeleteMs}ms` } as React.CSSProperties}
      onMouseDown={start}
      onMouseUp={cancel}
      onMouseLeave={cancel}
      onTouchStart={start}
      onTouchEnd={cancel}
      title="Hold to delete"
      aria-label="Hold to delete widget"
    >
      <span className="widget-delete-btn__fill" />
      <span className="widget-delete-btn__icon"><X size={13} /></span>
    </button>
  );
}

interface Props {
  service: ServiceConfig;
  editMode: boolean;
  onDelete?: ((id: string) => void) | undefined;
}

interface PingStatus {
  status: 'up' | 'down';
  latencyMs?: number | undefined;
  error?: string | undefined;
}

function buildPingTooltip(ping: PingStatus): string {
  if (ping.status === 'up') return ping.latencyMs !== undefined ? `${ping.latencyMs}ms` : 'Up';
  return ping.error ?? 'Offline';
}

export function WidgetCard({ service, editMode, onDelete }: Props) {
  const Card = useThemeCard();
  const setConfigTarget = useUIStore(s => s.setConfigTarget);
  const { holdToDeleteMs } = useBehavior();
  const { Component, clientOnly } = getWidget(service.widget);
  const { data, error, loading } = useWidgetData(service.id, !!clientOnly);

  const isHealthcheckWithPing = service.widget === 'healthcheck' && service.options?.['ping'] !== false;
  const pingData = isHealthcheckWithPing && !loading && data ? data as PingStatus : null;

  const body = (() => {
    if (!clientOnly && loading) return <WidgetSkeleton />;
    if (!clientOnly && error) return <WidgetError message={error} />;
    return (
      <Component
        serviceId={service.id}
        options={{ ...service.options, _widgetId: service.widget, _title: service.title }}
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
        {pingData && (
          <span
            className={`widget-ping-dot widget-ping-dot--${pingData.status}`}
            title={buildPingTooltip(pingData)}
            aria-label={pingData.status === 'up' ? 'Up' : 'Down'}
          />
        )}
        <span className="widget-title">{service.title}</span>
        {service.widget === 'notepad' && (
          <button
            className="widget-edit-btn"
            title="Refresh"
            aria-label="Refresh notepad"
            onClick={() => void swrMutate(`/api/notepad/${service.id}`)}
          >
            <RefreshCw size={13} />
          </button>
        )}
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
            {onDelete && <HoldDeleteButton id={service.id} holdToDeleteMs={holdToDeleteMs} onDelete={onDelete} />}
          </div>
        )}
      </div>
      <div className="widget-body">
        {body}
      </div>
    </Card>
  );
}
