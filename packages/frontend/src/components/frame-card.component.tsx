import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import ReactGridLayout from 'react-grid-layout';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { GripVertical, Settings, X } from 'lucide-react';
import type { ServiceConfig } from '@dashdash/types';
import { useUIStore } from '../store/uiStore';
import { useThemeCard } from '../themes/registry';
import { useBehavior } from '../hooks/use-behavior.hook';
import { useT } from '../i18n';
import { WidgetCard } from './widget-card.component';
import { serviceAsGridItem, persistedHeight } from '../utils/widget-layout';
import type { GridConfigLike } from '../utils/widget-layout';
import { OVERLAP_COMPACTOR, DROPPING_ELEMENT_ID, findOverlappingItems } from '../utils/grid-collision';
import './FrameCard.css';

const CONTAINER_PADDING: [number, number] = [0, 0];
const FRAME_DROP_CONFIG = { enabled: false };
const CHILD_DRAG_HANDLE = '.frame-widget-drag-handle';

function servicesAsLayout(services: ServiceConfig[], gridConfig: GridConfigLike): LayoutItem[] {
  return services.map(s => serviceAsGridItem(s, gridConfig));
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
  gridConfig: { rowHeight: number; gap: number };
  frameLayout?: LayoutItem | undefined;
  onDelete?: ((id: string) => void) | undefined;
  reloadServices: () => unknown;
}

export const FrameCard = memo(function FrameCard({ service, editMode, gridConfig, frameLayout, onDelete, reloadServices }: Props) {
  const t = useT();
  const Card = useThemeCard();
  const { holdToDeleteMs } = useBehavior();
  const setConfigTarget = useUIStore(s => s.setConfigTarget);
  const children = useMemo(() => service.children ?? [], [service.children]);

  const baseLayout = useMemo(
    () => (children.length > 0 ? servicesAsLayout(children, gridConfig) : []),
    [children, gridConfig],
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
      dragLayoutRef.current = layout.filter(l => l.i !== DROPPING_ELEMENT_ID);
    }

    if (wasEditing && !editMode) {
      const source = dragLayoutRef.current.length > 0 ? dragLayoutRef.current : layout;
      const items = source
        .filter(l => l.i !== DROPPING_ELEMENT_ID)
        .map(l => ({ id: l.i, layout: { x: l.x, y: l.y, w: l.w, h: persistedHeight(l, children) } }));
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
    const withoutGhost = newLayout.filter(l => l.i !== DROPPING_ELEMENT_ID);
    if (withoutGhost.length > 0) dragLayoutRef.current = [...withoutGhost];
  }, [editMode]);

  // Red "invalid drop" tint on the frame body — DOM class toggle only, no
  // setState during drag/resize ticks (same pattern as the main grid).
  const bodyElRef = useRef<HTMLDivElement | null>(null);
  const isGhostInvalidRef = useRef(false);
  const setGhostInvalid = useCallback((isInvalid: boolean) => {
    if (isGhostInvalidRef.current === isInvalid) return;
    isGhostInvalidRef.current = isInvalid;
    bodyElRef.current?.classList.toggle('grid-drag-invalid', isInvalid);
  }, []);

  // No reparent exception inside frames (frames cannot nest) — any overlap
  // between children is invalid.
  const tintGhostDuringGesture = useCallback((newLayout: Layout, _oldItem?: LayoutItem | null, newItem?: LayoutItem | null) => {
    if (!editMode || !newItem) return;
    setGhostInvalid(findOverlappingItems(newItem, newLayout).length > 0);
  }, [editMode, setGhostInvalid]);

  const syncLayoutAfterGesture = useCallback((newLayout: Layout, oldItem?: LayoutItem | null, newItem?: LayoutItem | null) => {
    if (!editMode) return;
    setGhostInvalid(false);
    let items = [...newLayout];
    if (newItem && oldItem && findOverlappingItems(newItem, items).length > 0) {
      items = items.map(it =>
        it.i === newItem.i ? { ...it, x: oldItem.x, y: oldItem.y, w: oldItem.w, h: oldItem.h } : it,
      );
    }
    dragLayoutRef.current = items;
    setLayout(items);
  }, [editMode, setGhostInvalid]);

  const deleteChild = useCallback(async (id: string) => {
    setLayout(prev => prev.filter(l => l.i !== id));
    // Drop the stale entry so save-on-close never PUTs a deleted id.
    dragLayoutRef.current = dragLayoutRef.current.filter(l => l.i !== id);
    await onDelete?.(id);
  }, [onDelete]);

  const roRef = useRef<ResizeObserver | null>(null);
  const [width, setWidth] = useState(200);
  const bodyRef = useCallback((node: HTMLDivElement | null) => {
    bodyElRef.current = node;
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
  const innerGridConfig = useMemo(
    () => ({ cols: frameCols, rowHeight, margin, containerPadding: CONTAINER_PADDING }),
    [frameCols, rowHeight, margin],
  );
  const dragConfig = useMemo(() => ({ enabled: editMode, handle: CHILD_DRAG_HANDLE }), [editMode]);
  const resizeConfig = useMemo(() => ({ enabled: editMode }), [editMode]);
  const isHeaderHidden = service.options?.['hideHeader'] === true && !editMode;
  const bgColor = typeof service.options?.['bg_color'] === 'string' ? service.options['bg_color'] : undefined;
  const fontColor = typeof service.options?.['font_color'] === 'string' ? service.options['font_color'] : undefined;
  // A frame's colors are a backdrop for ITS OWN chrome only — never published
  // as the inheritable --card-bg/--card-fg vars, which would bleed into every
  // child widget that has no color of its own (live issue #4.1). Background
  // goes on as a direct inline style; font color is scoped to the header.
  const cardStyle = bgColor ? { background: bgColor } as React.CSSProperties : undefined;
  const headerStyle = fontColor ? { '--card-fg': fontColor } as React.CSSProperties : undefined;

  const cardClassName = ['frame-card', editMode ? 'widget-card--edit' : ''].filter(Boolean).join(' ');

  return (
    <Card className={cardClassName} style={cardStyle} data-frame-id={service.id}>
      {!isHeaderHidden && (
        <div className="widget-header frame-card__header" style={headerStyle}>
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
          gridConfig={innerGridConfig}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          dropConfig={FRAME_DROP_CONFIG}
          compactor={OVERLAP_COMPACTOR}
          onDrag={tintGhostDuringGesture}
          onDragStop={syncLayoutAfterGesture}
          onResize={tintGhostDuringGesture}
          onResizeStop={syncLayoutAfterGesture}
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
});
