import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import ReactGridLayout from 'react-grid-layout';
import type { Layout, LayoutItem } from 'react-grid-layout';
import { GripVertical, Settings, X } from 'lucide-react';
import type { ServiceConfig } from '@dashdash/types';
import { useUIStore } from '../store/uiStore';
import { useThemeCard, useAllowsWidgetBg } from '../themes/registry';
import { useBehavior } from '../hooks/use-behavior.hook';
import { useT } from '../i18n';
import { WidgetCard } from './widget-card.component';
import { serviceAsGridItem, persistedHeight } from '../utils/widget-layout';
import type { GridConfigLike } from '../utils/widget-layout';
import { OVERLAP_COMPACTOR, DROPPING_ELEMENT_ID, findOverlappingItems, classifyChildDragTarget } from '../utils/grid-collision';
import { resolveColorOptionValue } from '../utils/color-tokens';
import './FrameCard.css';

const DRAG_GHOST_OFFSET_PX = 12;

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
  /** Reference (unscaled) values — used for grid-UNIT math (child layout, tiny pinning). */
  gridConfig: { rowHeight: number; gap: number };
  /** Viewport-scaled px values — used for RGL's rendering props (rowHeight/margin). */
  renderConfig: { rowHeight: number; gap: number };
  frameLayout?: LayoutItem | undefined;
  onDelete?: ((id: string) => void) | undefined;
  onChildReparent?: ((child: ServiceConfig, targetFrameId: string | null, clientX: number, clientY: number, liveSize: { w: number; h: number }) => void) | undefined;
  onChildLayoutSync?: ((frameId: string, items: LayoutItem[]) => void) | undefined;
  reloadServices: () => unknown;
}

export const FrameCard = memo(function FrameCard({ service, editMode, gridConfig, renderConfig, frameLayout, onDelete, onChildReparent, onChildLayoutSync, reloadServices }: Props) {
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
    if (withoutGhost.length > 0) {
      dragLayoutRef.current = [...withoutGhost];
      onChildLayoutSync?.(service.id, withoutGhost);
    }
  }, [editMode, onChildLayoutSync, service.id]);

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

  // Floating drag-ghost that follows the cursor once a child drag exits this
  // frame's own bounds — RGL's drag is confined to its own grid instance, so
  // without this the child appears to vanish while dragged outside. Position
  // and visibility are driven by direct DOM mutation every tick (no setState)
  // to match the perf discipline of setGhostInvalid above; only the one-time
  // gesture-start (which child is being dragged) goes through setState.
  const [draggingChild, setDraggingChild] = useState<ServiceConfig | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dragGhostElRef = useRef<HTMLDivElement | null>(null);
  const draggedElRef = useRef<HTMLElement | null>(null);

  // When a child drag is outside this frame's own bounds, RGL's inner
  // placeholder clamps to the grid's valid columns/rows instead of
  // disappearing — hiding it (and the dragged item's own node) avoids the
  // "stuck at the edge" illusion since dropping there isn't what happens
  // (reparent, not landing in the frame). visibility (not display) so RGL's
  // own layout measurements stay undisturbed.
  const setOutsideFrameHidden = useCallback((isOutside: boolean) => {
    const visibility = isOutside ? 'hidden' : '';
    if (draggedElRef.current) draggedElRef.current.style.visibility = visibility;
    const placeholderEl = bodyElRef.current?.querySelector<HTMLElement>('.react-grid-placeholder');
    if (placeholderEl) placeholderEl.style.visibility = visibility;
  }, []);

  const trackChildDrag = useCallback((newLayout: Layout, _oldItem?: LayoutItem | null, newItem?: LayoutItem | null, _placeholder?: LayoutItem | null, event?: Event, element?: HTMLElement | null) => {
    if (!editMode || !newItem) return;
    setGhostInvalid(findOverlappingItems(newItem, newLayout).length > 0);

    if (draggingIdRef.current !== newItem.i) {
      draggingIdRef.current = newItem.i;
      setDraggingChild(children.find(c => c.id === newItem.i) ?? null);
    }
    if (element) draggedElRef.current = element;

    const evt = event as unknown as { clientX?: number; clientY?: number } | undefined;
    if (typeof evt?.clientX !== 'number' || typeof evt?.clientY !== 'number') return;
    const { clientX, clientY } = evt;

    const ghostEl = dragGhostElRef.current;
    if (!ghostEl) return;

    ghostEl.style.left = `${clientX + DRAG_GHOST_OFFSET_PX}px`;
    ghostEl.style.top = `${clientY + DRAG_GHOST_OFFSET_PX}px`;

    const frameRect = bodyElRef.current?.getBoundingClientRect();
    const isInsideFrame = !!frameRect
      && clientX >= frameRect.left && clientX <= frameRect.right
      && clientY >= frameRect.top && clientY <= frameRect.bottom;
    ghostEl.style.opacity = isInsideFrame ? '0' : '1';
    ghostEl.style.visibility = isInsideFrame ? 'hidden' : 'visible';
    setOutsideFrameHidden(!isInsideFrame);

    if (isInsideFrame) return;

    const el = typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) : null;
    const hitFrameId = (el?.closest('[data-frame-id]') as HTMLElement | null)?.getAttribute('data-frame-id') ?? null;
    const isOverRootGrid = !!el?.closest('.dash-grid-canvas');
    const target = classifyChildDragTarget(service.id, hitFrameId, isOverRootGrid);
    ghostEl.classList.toggle('frame-child-drag-ghost--invalid', target.kind === 'invalid');
  }, [editMode, setGhostInvalid, children, service.id, setOutsideFrameHidden]);

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
    onChildLayoutSync?.(service.id, items);
    setLayout(items);
  }, [editMode, setGhostInvalid, onChildLayoutSync, service.id]);

  // Drag (not resize) can carry the dragged child out of this frame's own
  // inner grid entirely — into another frame, or onto the root grid. RGL's
  // drag is confined to its own grid instance, so the only way to detect a
  // cross-container drop is a DOM hit-test at the raw mouse position, same
  // technique as findParentFrame in dash-grid.component.tsx.
  const syncChildDragStop = useCallback((
    newLayout: Layout,
    oldItem?: LayoutItem | null,
    newItem?: LayoutItem | null,
    _placeholder?: LayoutItem | null,
    event?: Event,
  ) => {
    draggingIdRef.current = null;
    setDraggingChild(null);
    setOutsideFrameHidden(false);
    draggedElRef.current = null;
    if (!editMode) return;
    setGhostInvalid(false);
    if (newItem && oldItem) {
      const evt = event as unknown as { clientX?: number; clientY?: number } | undefined;
      if (typeof evt?.clientX === 'number' && typeof evt?.clientY === 'number') {
        const el = typeof document !== 'undefined' ? document.elementFromPoint(evt.clientX, evt.clientY) : null;
        const hitFrameId = (el?.closest('[data-frame-id]') as HTMLElement | null)?.getAttribute('data-frame-id') ?? null;
        const isOverRootGrid = !!el?.closest('.dash-grid-canvas');
        const target = classifyChildDragTarget(service.id, hitFrameId, isOverRootGrid);

        if (target.kind === 'invalid') {
          const reverted = newLayout.map(it =>
            it.i === newItem.i ? { ...it, x: oldItem.x, y: oldItem.y, w: oldItem.w, h: oldItem.h } : it,
          );
          dragLayoutRef.current = reverted;
          onChildLayoutSync?.(service.id, reverted);
          setLayout(reverted);
          return;
        }

        if (target.kind === 'reparent-frame' || target.kind === 'reparent-root') {
          const child = children.find(c => c.id === newItem.i);
          if (child && onChildReparent) {
            const remaining = newLayout.filter(it => it.i !== newItem.i);
            dragLayoutRef.current = remaining;
            onChildLayoutSync?.(service.id, remaining);
            setLayout(remaining);
            onChildReparent(
              child,
              target.kind === 'reparent-frame' ? target.frameId : null,
              evt.clientX,
              evt.clientY,
              { w: newItem.w, h: newItem.h },
            );
            return;
          }
        }
      }
    }

    let items = [...newLayout];
    if (newItem && oldItem && findOverlappingItems(newItem, items).length > 0) {
      items = items.map(it =>
        it.i === newItem.i ? { ...it, x: oldItem.x, y: oldItem.y, w: oldItem.w, h: oldItem.h } : it,
      );
    }
    dragLayoutRef.current = items;
    onChildLayoutSync?.(service.id, items);
    setLayout(items);
  }, [editMode, setGhostInvalid, setOutsideFrameHidden, service.id, children, onChildReparent, onChildLayoutSync]);

  const deleteChild = useCallback(async (id: string) => {
    setLayout(prev => prev.filter(l => l.i !== id));
    // Drop the stale entry so save-on-close never PUTs a deleted id.
    const remaining = dragLayoutRef.current.filter(l => l.i !== id);
    dragLayoutRef.current = remaining;
    onChildLayoutSync?.(service.id, remaining);
    await onDelete?.(id);
  }, [onDelete, onChildLayoutSync, service.id]);

  const bodyRef = useCallback((node: HTMLDivElement | null) => {
    bodyElRef.current = node;
  }, []);

  const { rowHeight, gap } = renderConfig;
  const frameCols = frameLayout?.w ?? service.layout.w;
  const margin = useMemo<[number, number]>(() => [gap, gap], [gap]);
  const innerGridConfig = useMemo(
    () => ({ cols: frameCols, rowHeight, margin, containerPadding: CONTAINER_PADDING }),
    [frameCols, rowHeight, margin],
  );
  const gridWidth = useMemo(() => frameCols * (rowHeight + gap) - gap, [frameCols, rowHeight, gap]);
  const dragConfig = useMemo(() => ({ enabled: editMode, handle: CHILD_DRAG_HANDLE }), [editMode]);
  const resizeConfig = useMemo(() => ({ enabled: editMode }), [editMode]);
  const isHeaderHidden = service.options?.['hideHeader'] === true && !editMode;
  const rawBgColor = typeof service.options?.['bg_color'] === 'string' ? service.options['bg_color'] : undefined;
  const fontColor = typeof service.options?.['font_color'] === 'string' ? service.options['font_color'] : undefined;
  // Liquid-glass/ascii/atom cards ARE their background (glass, terminal, CRT)
  // — a frame's custom backdrop never renders under those themes, same as
  // widget-card's per-widget bg override (see widget-card.component.tsx).
  const allowsWidgetBg = useAllowsWidgetBg();
  const bgColor = allowsWidgetBg ? resolveColorOptionValue(rawBgColor) : undefined;
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
          width={gridWidth}
          gridConfig={innerGridConfig}
          dragConfig={dragConfig}
          resizeConfig={resizeConfig}
          dropConfig={FRAME_DROP_CONFIG}
          compactor={OVERLAP_COMPACTOR}
          onDrag={trackChildDrag}
          onDragStop={syncChildDragStop}
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
      {draggingChild && (() => {
        const liveItem = (layout.length > 0 ? layout : baseLayout).find(l => l.i === draggingChild.id);
        const w = liveItem?.w ?? draggingChild.layout.w;
        const h = liveItem?.h ?? draggingChild.layout.h;
        return createPortal(
          <div
            ref={dragGhostElRef}
            className="frame-child-drag-ghost"
            style={{
              width: w * (rowHeight + gap) - gap,
              height: h * (rowHeight + gap) - gap,
            }}
          >
            <WidgetCard service={draggingChild} editMode={false} dragHandleClassName="frame-widget-drag-handle" />
          </div>,
          document.body,
        );
      })()}
    </Card>
  );
});
