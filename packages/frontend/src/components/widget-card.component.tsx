import { useState, useRef, useEffect, useMemo, memo } from 'react';
import { GripVertical, Settings, X, RefreshCw, Trash2 } from 'lucide-react';
import { mutate as swrMutate } from 'swr';
import type { ServiceConfig } from '@dashdash/types';
import { useThemeCard } from '../themes/registry';
import { getWidget } from '../widgets/registry';
import { useWidgetData } from '../hooks/use-widget-data.hook';
import { useUIStore } from '../store/uiStore';
import { useBehavior } from '../hooks/use-behavior.hook';
import { useT } from '../i18n';
import { WidgetSkeleton } from '../widgets/shared/widget-skeleton.component';
import { WidgetError } from '../widgets/shared/widget-error.component';
import './WidgetCard.css';

function HoldClearNotepadButton({ serviceId, holdToDeleteMs }: { serviceId: string; holdToDeleteMs: number }) {
  const t = useT();
  const [holding, setHolding] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setHolding(true);
    timer.current = setTimeout(() => {
      void fetch(`/api/notepad/${serviceId}`, { method: 'DELETE' })
        .then(() => swrMutate(`/api/notepad/${serviceId}`, { content: '' }, { revalidate: false }))
        .catch(() => { /* best-effort */ });
    }, holdToDeleteMs);
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
      title={t('widgetCard.clearNotepad')}
      aria-label={t('widgetCard.clearNotepadAria')}
    >
      <span className="widget-delete-btn__fill" />
      <span className="widget-delete-btn__icon"><Trash2 size={13} /></span>
    </button>
  );
}

function HoldDeleteButton({ id, holdToDeleteMs, onDelete }: { id: string; holdToDeleteMs: number; onDelete: (id: string) => void }) {
  const t = useT();
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
      title={t('widgetCard.holdToDelete')}
      aria-label={t('widgetCard.holdToDeleteAria')}
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

export const WidgetCard = memo(function WidgetCard({ service, editMode, onDelete }: Props) {
  const t = useT();
  const Card = useThemeCard();
  const setConfigTarget = useUIStore(s => s.setConfigTarget);
  const { holdToDeleteMs } = useBehavior();
  const { Component, clientOnly } = getWidget(service.widget);
  const { data, error, loading } = useWidgetData(service.id, !!clientOnly);

  const isPingEnabled = service.widget === 'healthcheck' && service.options?.['ping'] !== false;
  const hasConfiguredUrl = isPingEnabled && Boolean(service.options?.['url']);
  const pingData = isPingEnabled && !loading && data ? data as PingStatus : null;
  type PingDotState = 'up' | 'down' | 'unknown';
  const pingDotState: PingDotState | null = !isPingEnabled
    ? null
    : !hasConfiguredUrl || pingData === null
    ? 'unknown'
    : pingData.status;

  const isTinyLayout = service.options?.['layoutSize'] === 'tiny';
  const bgColor = typeof service.options?.['bg_color'] === 'string' ? service.options['bg_color'] : undefined;
  const cardStyle = bgColor ? { '--card-bg': bgColor } as React.CSSProperties : undefined;

  const widgetOptions = useMemo(
    () => ({ ...service.options, _widgetId: service.widget, _title: service.title }),
    [service.options, service.widget, service.title],
  );

  const body = (() => {
    if (!clientOnly && loading) return <WidgetSkeleton />;
    if (!clientOnly && error) return <WidgetError message={error} />;
    return (
      <Component
        serviceId={service.id}
        options={widgetOptions}
        data={data}
        error={error}
        loading={loading}
      />
    );
  })();

  const cardClassName = [
    editMode ? 'widget-card--edit' : '',
    isTinyLayout ? 'widget-card--tiny-layout' : '',
  ].filter(Boolean).join(' ');

  return (
    <Card className={cardClassName} style={cardStyle}>
      <div className="widget-header">
        {editMode && (
          <span className="widget-drag-handle" title={t('widgetCard.dragToMove')}>
            <GripVertical size={16} />
          </span>
        )}
        {pingDotState !== null && (
          <span
            className={`widget-ping-dot widget-ping-dot--${pingDotState}`}
            title={pingData ? buildPingTooltip(pingData) : (hasConfiguredUrl ? t('widgetCard.checking') : t('widgetCard.noHostConfigured'))}
            aria-label={pingDotState === 'up' ? t('widgetCard.up') : pingDotState === 'down' ? t('widgetCard.down') : t('widgetCard.unknown')}
          />
        )}
        <span className="widget-title">{service.title}</span>
        {service.widget === 'notepad' && !editMode && (
          <>
            <button
              className="widget-edit-btn"
              title={t('widgetCard.refreshNotepad')}
              aria-label={t('widgetCard.refreshNotepad')}
              onClick={() => void swrMutate(`/api/notepad/${service.id}`)}
            >
              <RefreshCw size={13} />
            </button>
            <HoldClearNotepadButton serviceId={service.id} holdToDeleteMs={holdToDeleteMs} />
          </>
        )}
        {editMode && (
          <div className="widget-edit-actions">
            <button
              className="widget-edit-btn"
              title={t('widgetCard.configureWidget')}
              onClick={() => setConfigTarget(service.id)}
              aria-label={t('widgetCard.configureWidget')}
            >
              <Settings size={13} />
            </button>
            {onDelete && <HoldDeleteButton id={service.id} holdToDeleteMs={holdToDeleteMs} onDelete={onDelete} />}
          </div>
        )}
      </div>
      {!isTinyLayout && (
        <div className="widget-body">
          {body}
        </div>
      )}
    </Card>
  );
});
