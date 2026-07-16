import { useState, useRef, useEffect, useMemo, memo, Suspense } from 'react';
import { GripVertical, Settings, X, RefreshCw, Trash2 } from 'lucide-react';
import { mutate as swrMutate } from 'swr';
import type { ServiceConfig } from '@dashdash/types';
import { useThemeCard } from '../themes/registry';
import { getWidget } from '../widgets/registry';
import { useWidgetData } from '../hooks/use-widget-data.hook';
import { useHealthcheckBatch } from '../hooks/use-healthcheck-batch.hook';
import { useUIStore } from '../store/uiStore';
import { AppIcon, hasServiceIcon, toAbsoluteUrl } from '../widgets/shared/app-icon.component';
import { useBehavior } from '../hooks/use-behavior.hook';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import { useT } from '../i18n';
import { WidgetSkeleton } from '../widgets/shared/widget-skeleton.component';
import { WidgetError } from '../widgets/shared/widget-error.component';
import { WidgetErrorBoundary } from '../widgets/shared/widget-error-boundary.component';
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
  dragHandleClassName?: string | undefined;
}

interface PingStatus {
  status: 'up' | 'down' | 'unknown' | 'pending';
  latencyMs?: number | undefined;
  error?: string | undefined;
}

function isPingStatus(x: unknown): x is PingStatus {
  if (typeof x !== 'object' || x === null || !('status' in x)) return false;
  const status = (x as Record<string, unknown>)['status'];
  return status === 'up' || status === 'down' || status === 'unknown' || status === 'pending';
}

function buildPingTooltip(ping: PingStatus): string {
  if (ping.status === 'up') return ping.latencyMs !== undefined ? `${ping.latencyMs}ms` : 'Up';
  return ping.error ?? 'Offline';
}

export const WidgetCard = memo(function WidgetCard({ service, editMode, onDelete, dragHandleClassName }: Props) {
  const t = useT();
  const Card = useThemeCard();
  const setConfigTarget = useUIStore(s => s.setConfigTarget);
  const { holdToDeleteMs } = useBehavior();
  const { Component, clientOnly, rendersWhileLoading } = getWidget(service.widget);
  const isHealthcheck = service.widget === 'healthcheck';
  // Individual fetch — disabled for healthcheck widgets (those use the batch hook below).
  const { data: singleData, error: singleError, loading: singleLoading } = useWidgetData(
    service.id,
    !!clientOnly || isHealthcheck,
  );
  // Batch fetch — only active for healthcheck widgets; null disables it for others.
  const { data: batchData, error: batchError, loading: batchLoading } = useHealthcheckBatch(
    isHealthcheck ? service.id : null,
  );
  const data = isHealthcheck ? batchData : singleData;
  const error = isHealthcheck ? batchError : singleError;
  const loading = isHealthcheck ? batchLoading : singleLoading;

  const isTinyLayout = service.options?.['layoutSize'] === 'tiny';
  const isPingEnabled = service.widget === 'healthcheck' && service.options?.['ping'] !== false;
  const hasConfiguredUrl = isPingEnabled && Boolean(service.options?.['url']);
  const pingData = isPingEnabled && !loading && isPingStatus(data) ? data : null;
  const pingIndicator = service.options?.['pingIndicator'] ?? 'header-bar';
  const showHeaderDot = isPingEnabled && (isTinyLayout || pingIndicator === 'header-bar');
  type PingDotState = 'up' | 'down' | 'unknown' | 'pending';
  const pingDotState: PingDotState | null = !showHeaderDot
    ? null
    : !hasConfiguredUrl
    ? 'unknown'
    : loading || (isPingStatus(data) && data.status === 'pending')
    ? 'pending'
    : pingData === null
    ? 'unknown'
    : pingData.status;
  const isHeaderHidden = service.options?.['hideHeader'] === true && !editMode && !isTinyLayout;
  const bgColor = typeof service.options?.['bg_color'] === 'string' ? service.options['bg_color'] : undefined;
  const fontColor = typeof service.options?.['font_color'] === 'string' ? service.options['font_color'] : undefined;
  const tinyIconValue = isTinyLayout && service.icon && hasServiceIcon(service.icon) ? service.icon : null;
  const tinyInternalUrl = isTinyLayout && typeof service.options?.['internalUrl'] === 'string' ? service.options['internalUrl'] : null;
  const tinyDescription = isTinyLayout && typeof service.options?.['description'] === 'string' ? service.options['description'] : undefined;
  const cardStyle = bgColor || fontColor
    ? {
        ...(bgColor ? { '--card-bg': bgColor } : {}),
        ...(fontColor ? { '--card-fg': fontColor } : {}),
      } as React.CSSProperties
    : undefined;

  // Thresholds are template-level (widgets.yml defaultOptions) and apply to
  // every instance at render time — merged under so per-instance options win.
  const widgetTemplates = useWidgetTemplates();
  const templateThresholds = widgetTemplates.find(tmpl => tmpl.type === service.widget)?.defaultOptions?.['thresholds'];
  const widgetOptions = useMemo(
    () => ({
      ...(templateThresholds !== undefined ? { thresholds: templateThresholds } : {}),
      ...service.options,
      _widgetId: service.widget,
      _title: service.title,
      _icon: service.icon,
    }),
    [templateThresholds, service.options, service.widget, service.title, service.icon],
  );

  const widgetContent = (
    <WidgetErrorBoundary
      widgetType={service.widget}
      crashedLabel={t('widgetCard.crashed')}
      retryLabel={t('widgetCard.retry')}
    >
      <Suspense fallback={<WidgetSkeleton />}>
        <Component
          serviceId={service.id}
          options={widgetOptions}
          data={data}
          error={error}
          loading={loading}
        />
      </Suspense>
    </WidgetErrorBoundary>
  );

  const body = (() => {
    // rendersWhileLoading widgets paint their static shell (icon/name from
    // config) immediately instead of blanking behind a skeleton.
    if (!clientOnly && !rendersWhileLoading && loading) return <WidgetSkeleton />;
    if (!clientOnly && error) return <WidgetError message={error} />;
    return widgetContent;
  })();

  const cardClassName = [
    editMode ? 'widget-card--edit' : '',
    isTinyLayout ? 'widget-card--tiny-layout' : '',
  ].filter(Boolean).join(' ');

  // Rendered twice: inline in the header, and in a flyout pill attached above
  // the card that takes over when the widget is too narrow for header buttons
  // (container query in WidgetCard.css — live issue #5.1).
  const editActionButtons = (
    <>
      <button
        className="widget-edit-btn"
        title={t('widgetCard.configureWidget')}
        onClick={() => setConfigTarget(service.id)}
        aria-label={t('widgetCard.configureWidget')}
      >
        <Settings size={13} />
      </button>
      {onDelete && <HoldDeleteButton id={service.id} holdToDeleteMs={holdToDeleteMs} onDelete={onDelete} />}
    </>
  );

  return (
    <>
    {editMode && !isHeaderHidden && (
      <div className="widget-edit-flyout">
        {editActionButtons}
      </div>
    )}
    <Card className={cardClassName} style={cardStyle}>
      {!isHeaderHidden && <div className="widget-header">
        {editMode && (
          <span className={dragHandleClassName ?? 'grid-drag-handle'} title={t('widgetCard.dragToMove')}>
            <GripVertical size={16} />
          </span>
        )}
        {pingDotState !== null && (
          <span
            className={`widget-ping-dot widget-ping-dot--${pingDotState}`}
            title={pingDotState === 'pending'
              ? t('widgetCard.checking')
              : pingData
              ? buildPingTooltip(pingData)
              : (hasConfiguredUrl ? t('widgetCard.checking') : t('widgetCard.noHostConfigured'))}
            aria-label={pingDotState === 'up'
              ? t('widgetCard.up')
              : pingDotState === 'down'
              ? t('widgetCard.down')
              : pingDotState === 'pending'
              ? t('widgetCard.checking')
              : t('widgetCard.unknown')}
          />
        )}
        {tinyIconValue && (
          tinyInternalUrl
            ? <a href={toAbsoluteUrl(tinyInternalUrl)} target="_blank" rel="noopener noreferrer" className="widget-header-icon-link" title={tinyDescription}>
                <AppIcon iconValue={tinyIconValue} size={12} />
              </a>
            : <AppIcon iconValue={tinyIconValue} size={12} title={tinyDescription} />
        )}
        {isTinyLayout && tinyInternalUrl ? (
          // Tiny mode: the title itself links to the app (visually unchanged) —
          // without an icon there would otherwise be no way to open it (#1.3).
          <a
            href={toAbsoluteUrl(tinyInternalUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="widget-title widget-title--link"
            title={tinyDescription}
          >
            {service.title}
          </a>
        ) : (
          <span className="widget-title" title={isTinyLayout ? tinyDescription : undefined}>{service.title}</span>
        )}
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
            {editActionButtons}
          </div>
        )}
      </div>}
      {!isTinyLayout && (
        <div className="widget-body">
          {body}
        </div>
      )}
    </Card>
    </>
  );
});
