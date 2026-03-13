import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import ReactGridLayout, { noCompactor } from 'react-grid-layout';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { GripVertical, Settings, X } from 'lucide-react';
import type { ServiceConfig } from '@dashdash/types';
import type { WidgetTemplateDef } from '../hooks/use-widget-templates.hook';
import { useUIStore } from '../store/uiStore';
import { useThemeCard } from '../themes/registry';
import { useBehavior } from '../hooks/use-behavior.hook';
import { useT } from '../i18n';
import { WidgetCard } from './widget-card.component';
import './FrameCard.css';

const CONTAINER_PADDING: [number, number] = [0, 0];

function servicesAsLayout(services: ServiceConfig[], templates: WidgetTemplateDef[]): LayoutItem[] {
  return services.map(s => {
    const tmpl = templates.find(t => t.type === s.widget);
    return {
      i: s.id,
      x: s.layout.x ?? 0,
      y: s.layout.y ?? 0,
      w: s.layout.w,
      h: s.layout.h,
      minW: tmpl?.minSize?.w ?? 1,
      minH: tmpl?.minSize?.h ?? 1,
    };
  });
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
  widgetTemplates: WidgetTemplateDef[];
  gridConfig: { columns: number; rowHeight: number; gap: number };
  frameLayout?: LayoutItem | undefined;
  onDelete?: ((id: string) => void) | undefined;
  reloadServices: () => unknown;
}

export function FrameCard({ service, editMode, widgetTemplates, gridConfig, frameLayout, onDelete, reloadServices }: Props) {
  const t = useT();
  const Card = useThemeCard();
  const { holdToDeleteMs } = useBehavior();
  const setConfigTarget = useUIStore(s => s.setConfigTarget);
  const children = useMemo(() => service.children ?? [], [service.children]);

  const baseLayout = useMemo(
    () => (children.length > 0 ? servicesAsLayout(children, widgetTemplates) : []),
    [children, widgetTemplates],
  );

  const [layout, setLayout] = useState<LayoutItem[]>([]);

  useEffect(() => {
    if (baseLayout.length === 0) {
      setLayout([]);
      return;
    }
    setLayout(prev => {
      if (!editMode || prev.length === 0) return baseLayout;
      const prevMap = new Map(prev.map(l => [l.i, l]));
      return baseLayout.map(item => prevMap.get(item.i) ?? item);
    });
  }, [baseLayout, editMode]);

  const dragLayoutRef = useRef<LayoutItem[]>([]);
  const prevEditMode = useRef(editMode);
  useEffect(() => {
    const wasEditing = prevEditMode.current;
    prevEditMode.current = editMode;

    if (!wasEditing && editMode) {
      dragLayoutRef.current = layout.filter(l => l.i !== '__dropping-elem__');
    }

    if (wasEditing && !editMode) {
      const source = dragLayoutRef.current.length > 0 ? dragLayoutRef.current : layout;
      const items = source
        .filter(l => l.i !== '__dropping-elem__')
        .map(l => ({ id: l.i, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }));
      void fetch('/api/services/layouts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, parentId: service.id }),
      }).then(async r => {
        if (!r.ok) console.error('Layout save failed:', r.status, await r.text());
        else void reloadServices();
      }).catch((err: unknown) => {
        console.error('Layout save network error:', err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  const recordDragPositions = useCallback((newLayout: Layout) => {
    if (!editMode) return;
    const withoutGhost = newLayout.filter(l => l.i !== '__dropping-elem__');
    if (withoutGhost.length > 0) dragLayoutRef.current = [...withoutGhost];
  }, [editMode]);

  const syncLayoutAfterDrag = useCallback((newLayout: Layout) => {
    if (!editMode) return;
    const items = [...newLayout];
    dragLayoutRef.current = items;
    setLayout(items);
  }, [editMode]);

  const deleteChild = useCallback(async (id: string) => {
    setLayout(prev => prev.filter(l => l.i !== id));
    await onDelete?.(id);
  }, [onDelete]);

  const roRef = useRef<ResizeObserver | null>(null);
  const [width, setWidth] = useState(200);
  const bodyRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);

  const { rowHeight, gap } = gridConfig;
  const frameCols = frameLayout?.w ?? service.layout.w;
  const margin = useMemo<[number, number]>(() => [gap, gap], [gap]);
  const childDragHandle = '.frame-widget-drag-handle';
  const isHeaderHidden = service.options?.['hideHeader'] === true && !editMode;
  const bgColor = typeof service.options?.['bg_color'] === 'string' ? service.options['bg_color'] : undefined;
  const cardStyle = bgColor ? { '--card-bg': bgColor } as React.CSSProperties : undefined;

  const cardClassName = ['frame-card', editMode ? 'widget-card--edit' : ''].filter(Boolean).join(' ');

  return (
    <Card className={cardClassName} style={cardStyle} data-frame-id={service.id}>
      {!isHeaderHidden && (
        <div className="widget-header frame-card__header">
          {editMode && (
            <span className="grid-drag-handle" title={t('widgetCard.dragToMove')}>
              <GripVertical size={16} />
            </span>
          )}
          <span className="widget-title">{service.title}</span>
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
      )}
      <div className="frame-card__body" ref={bodyRef}>
        <ReactGridLayout
          className="frame-grid"
          layout={layout.length > 0 ? layout : baseLayout}
          width={width}
          gridConfig={{ cols: frameCols, rowHeight, margin, containerPadding: CONTAINER_PADDING }}
          dragConfig={{ enabled: editMode, handle: childDragHandle }}
          resizeConfig={{ enabled: editMode }}
          dropConfig={{ enabled: false }}
          compactor={{ ...noCompactor, allowOverlap: true }}
          onDragStop={syncLayoutAfterDrag}
          onLayoutChange={recordDragPositions}
        >
          {children.map(child => (
            <div key={child.id}>
              <WidgetCard
                service={child}
                editMode={editMode}
                dragHandleClassName="frame-widget-drag-handle"
                onDelete={deleteChild}
              />
            </div>
          ))}
        </ReactGridLayout>
      </div>
    </Card>
  );
}
