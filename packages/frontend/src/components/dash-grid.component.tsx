import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactGridLayout, { noCompactor } from 'react-grid-layout';
import type { Layout, LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { mutate } from 'swr';
import { useUIStore } from '../store/uiStore';
import { useShallow } from 'zustand/shallow';
import { useServices } from '../hooks/use-services.hook';
import { useConfigReload } from '../hooks/use-config-reload.hook';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import { useGridConfig } from '../hooks/use-grid-config.hook';
import { WidgetCard } from './widget-card.component';
import { FrameCard } from './frame-card.component';
import { useT } from '../i18n';
import type { ServiceConfig } from '@dashdash/types';
import type { WidgetTemplate } from '../widgets/catalog';
import type { WidgetTemplateDef } from '../hooks/use-widget-templates.hook';
import { flattenServices, findServiceWithParent } from '../utils/service-tree';
import './DashGrid.css';

const CONTAINER_PADDING: [number, number] = [0, 0];

/** Build RGL layout items directly from services (YAML is source of truth).
 *  Templates supply optional minW/minH constraints per widget type. */
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

function isFrameService(service: ServiceConfig): boolean {
  return service.widget === 'frame';
}

function layoutsOverlap(a: LayoutItem, b: LayoutItem): boolean {
  const ax2 = a.x + a.w;
  const ay2 = a.y + a.h;
  const bx2 = b.x + b.w;
  const by2 = b.y + b.h;
  return a.x < bx2 && ax2 > b.x && a.y < by2 && ay2 > b.y;
}

export function DashGrid() {
  const t = useT();
  const { editMode, droppingItem, setDroppingItem } = useUIStore(
    useShallow(s => ({
      editMode: s.editMode,
      droppingItem: s.droppingItem,
      setDroppingItem: s.setDroppingItem,
    }))
  );

  const { services, hasConfigErrors, reload: reloadServices } = useServices();
  const widgetTemplates = useWidgetTemplates();
  const gridConfig = useGridConfig();

  // Optimistic queue: new widgets dropped but not yet confirmed by the server
  const [dropQueue, setDropQueue] = useState<ServiceConfig[]>([]);
  const [reparentingIds, setReparentingIds] = useState<string[]>([]);

  const rootServices = useMemo<ServiceConfig[]>(
    () => {
      const pending = new Set(reparentingIds);
      const merged = [...services, ...dropQueue.filter(s => !services.find(x => x.id === s.id))];
      return merged.filter(s => !pending.has(s.id));
    },
    [services, dropQueue, reparentingIds],
  );

  const flatServices = useMemo(() => flattenServices(rootServices), [rootServices]);

  // Always-current ref so handleDrop can read allServices without a stale closure.
  const allServicesRef = useRef(flatServices);
  allServicesRef.current = flatServices;

  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [availableWidth, setAvailableWidth] = useState(() => window.innerWidth);

  // Synced every render so callbacks can read the current editMode
  // without adding it as a dep (which would re-run effects on toggle).
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  const baseLayout = useMemo(
    () => (rootServices.length > 0 ? servicesAsLayout(rootServices, widgetTemplates) : []),
    [rootServices, widgetTemplates],
  );
  const layoutById = useMemo(() => {
    const source = layout.length > 0 ? layout : baseLayout;
    return new Map(source.map(item => [item.i, item]));
  }, [layout, baseLayout]);

  const findParentFrame = useCallback(
    (item: LayoutItem, e: Event): { frameId: string; frameLayout: LayoutItem } | null => {
      const evt = e as DragEvent;
      if (typeof document !== 'undefined' && typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
        const el = document.elementFromPoint(evt.clientX, evt.clientY);
        const frameEl = el?.closest('[data-frame-id]') as HTMLElement | null;
        if (frameEl) {
          const frameId = frameEl.getAttribute('data-frame-id');
          if (frameId) {
            const svc = rootServices.find(s => s.id === frameId);
            if (svc) {
              const frameLayout = layoutById.get(svc.id) ?? {
                i: svc.id,
                x: svc.layout.x ?? 0,
                y: svc.layout.y ?? 0,
                w: svc.layout.w,
                h: svc.layout.h,
              };
              return { frameId, frameLayout };
            }
          }
        }
      }
      for (const svc of rootServices) {
        if (!isFrameService(svc)) continue;
        const frameLayout = layoutById.get(svc.id) ?? {
          i: svc.id,
          x: svc.layout.x ?? 0,
          y: svc.layout.y ?? 0,
          w: svc.layout.w,
          h: svc.layout.h,
        };
        const withinX = item.x >= frameLayout.x && item.x < frameLayout.x + frameLayout.w;
        const withinY = item.y >= frameLayout.y && item.y < frameLayout.y + frameLayout.h;
        if (withinX && withinY) return { frameId: svc.id, frameLayout };
      }
      return null;
    },
    [layoutById, rootServices]
  );

  const findParentFrameByLayout = useCallback(
    (item: LayoutItem, layoutItems: Layout): { frameId: string; frameLayout: LayoutItem } | null => {
      const layoutMap = new Map(layoutItems.map(l => [l.i, l]));
      for (const svc of rootServices) {
        if (!isFrameService(svc)) continue;
        const frameLayout = layoutMap.get(svc.id) ?? {
          i: svc.id,
          x: svc.layout.x ?? 0,
          y: svc.layout.y ?? 0,
          w: svc.layout.w,
          h: svc.layout.h,
        };
        const withinX = item.x >= frameLayout.x && item.x < frameLayout.x + frameLayout.w;
        const withinY = item.y >= frameLayout.y && item.y < frameLayout.y + frameLayout.h;
        if (withinX && withinY) return { frameId: svc.id, frameLayout };
      }
      return null;
    },
    [rootServices]
  );

  useEffect(() => {
    if (baseLayout.length === 0) {
      setLayout([]);
      return;
    }
    setLayout(prev => {
      const fromYaml = baseLayout;

      // Outside edit mode (initial load, WS reload, post-save): always use
      // YAML positions so the layout is correct after a refresh.
      if (!editModeRef.current || prev.length === 0) return fromYaml;

      // Inside edit mode: preserve local drag positions for items already
      // in the layout; only new items (e.g., just dropped) fall back to
      // their YAML (i.e., drop) position.
      const prevMap = new Map(prev.map(l => [l.i, l]));
      return fromYaml.map(item => prevMap.get(item.i) ?? item);
    });
  }, [baseLayout]);

  useEffect(() => {
    const frameIds = new Set(rootServices.filter(isFrameService).map(s => s.id));
    const next = new Map<string, LayoutItem>();
    for (const item of baseLayout) {
      if (frameIds.has(item.i)) next.set(item.i, item);
    }
    lastValidFrameLayoutRef.current = next;
  }, [baseLayout, rootServices]);

  // Tracks the latest drag positions for save-on-close.
  // Updated by handleLayoutChange (never by React state) so it never triggers
  // re-renders that would interfere with RGL's internal drop state.
  const dragLayoutRef = useRef<LayoutItem[]>([]);
  const lastValidFrameLayoutRef = useRef<Map<string, LayoutItem>>(new Map());

  // Save all layouts to YAML when edit mode is closed ("Save" button).
  const prevEditMode = useRef(editMode);
  useEffect(() => {
    const wasEditing = prevEditMode.current;
    prevEditMode.current = editMode;

    if (!wasEditing && editMode) {
      // Entering edit mode — seed dragLayoutRef with current layout so a
      // save without any dragging still writes the correct positions.
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
        body: JSON.stringify({ items }),
      }).then(async r => {
        if (!r.ok) console.error('Layout save failed:', r.status, await r.text());
        else void reloadServices();
      }).catch((err: unknown) => {
        console.error('Layout save network error:', err);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

  useConfigReload(useCallback(() => {
    void reloadServices();
    void mutate('/api/locales');
    void mutate('/api/settings');
  }, [reloadServices]));

  const recordDragPositions = useCallback((newLayout: Layout) => {
    if (!editModeRef.current) return;
    const withoutGhost = newLayout.filter(l => l.i !== '__dropping-elem__');
    if (withoutGhost.length > 0) dragLayoutRef.current = [...withoutGhost];
  }, []);

  const lockFramesDuringDrag = useCallback((newLayout: Layout, oldItem?: LayoutItem | null) => {
    if (!editModeRef.current || !oldItem) return;
    const frameIds = new Set(rootServices.filter(isFrameService).map(s => s.id));
    if (frameIds.has(oldItem.i)) return;
    const locked = newLayout.map(item => frameIds.has(item.i) ? { ...item, static: true } : item);
    dragLayoutRef.current = locked.filter(l => l.i !== '__dropping-elem__');
    setLayout(locked);
  }, [rootServices]);

  // onDragStop fires before RGL calls setState({ activeDrag: null }).
  // Both this setLayout and RGL's setState land in the same React batch, so
  // getDerivedStateFromProps sees nextProps.layout = finalLayout (with pushed
  // items at their new positions) instead of the stale original layout —
  // preventing the snap-back that would otherwise override RGL's pushed state.
  const syncLayoutAfterDrag = useCallback((newLayout: Layout, _oldItem?: LayoutItem | null, newItem?: LayoutItem | null) => {
    if (!editModeRef.current) return;
    const frameIds = new Set(rootServices.filter(isFrameService).map(s => s.id));
    const items = newLayout.map(item => (frameIds.has(item.i) && item.static) ? { ...item, static: false } : item);
    const frames = items.filter(l => frameIds.has(l.i));

    let hasOverlap = false;
    for (let i = 0; i < frames.length; i++) {
      for (let j = i + 1; j < frames.length; j++) {
        if (layoutsOverlap(frames[i]!, frames[j]!)) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }

    if (hasOverlap) {
      const lastValid = lastValidFrameLayoutRef.current;
      const reverted = items.map(item => lastValid.get(item.i) ?? item);
      dragLayoutRef.current = reverted;
      setLayout(reverted);
      return;
    }

    for (const frame of frames) {
      lastValidFrameLayoutRef.current.set(frame.i, frame);
    }

    if (newItem && newItem.i !== '__dropping-elem__' && !frameIds.has(newItem.i)) {
      const found = findServiceWithParent(rootServices, newItem.i);
      if (found) {
        const target = findParentFrameByLayout(newItem, items);
        const currentParentId = found.parent?.id ?? null;
        const nextParentId = target?.frameId ?? null;
        if (target && nextParentId && nextParentId !== currentParentId) {
          const relLayout = {
            x: newItem.x - target.frameLayout.x,
            y: newItem.y - target.frameLayout.y,
            w: newItem.w,
            h: newItem.h,
          };
          const filtered = items.filter(i => i.i !== newItem.i);
          dragLayoutRef.current = filtered;
          setLayout(filtered);
          setReparentingIds(prev => (prev.includes(newItem.i) ? prev : [...prev, newItem.i]));
          void fetch(`/api/services/${newItem.i}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: nextParentId, layout: relLayout }),
          }).then(async r => {
            if (!r.ok) console.error('Reparent failed:', r.status, await r.text());
            await reloadServices();
            setReparentingIds(prev => prev.filter(id => id !== newItem.i));
          }).catch((err: unknown) => {
            console.error('Reparent network error:', err);
            setReparentingIds(prev => prev.filter(id => id !== newItem.i));
          });
          return;
        }
      }
    }

    dragLayoutRef.current = items;
    setLayout(items);
  }, [findParentFrameByLayout, reloadServices, rootServices, setReparentingIds]);

  const createWidgetFromDrop = useCallback(
    (rglLayout: Layout, item: LayoutItem | undefined, e: Event) => {
      // RGL passes a React SyntheticDragEvent; access dataTransfer via nativeEvent
      const dataTransfer = (e as unknown as React.DragEvent).nativeEvent?.dataTransfer
        ?? (e as unknown as DragEvent).dataTransfer;
      const raw = dataTransfer?.getData('widget-template');
      if (!raw) return;

      let template: WidgetTemplate;
      try {
        template = JSON.parse(raw) as WidgetTemplate;
      } catch {
        return; // malformed widget-template JSON from drag event — skip drop
      }

      // Use allServicesRef to avoid stale closure.
      const existingIds = allServicesRef.current.map(s => s.id);
      const base = template.type;
      let id = base;
      let suffix = 2;
      while (existingIds.includes(id)) { id = `${base}-${suffix++}`; }

      if (!item) return;

      // Use widgets.yml sizes if available, fall back to catalog defaults.
      const tmpl = widgetTemplates.find(t => t.type === template.type);
      const dropWidth = tmpl?.defaultSize.w ?? template.defaultSize?.w ?? 2;
      const dropHeight = tmpl?.defaultSize.h ?? template.defaultSize?.h ?? 2;

      const parent = findParentFrame(item, e);
      const parentId = parent?.frameId;

      const newService: ServiceConfig = {
        id,
        title: template.label,
        widget: template.type,
        layout: parent
          ? { x: item.x - parent.frameLayout.x, y: item.y - parent.frameLayout.y, w: dropWidth, h: dropHeight }
          : { x: item.x, y: item.y, w: dropWidth, h: dropHeight },
        options: template.defaultOptions ?? {},
      };

      if (!parentId) {
        // Use rglLayout (RGL's internal state at drop time) as the base — it has the
        // correct pushed positions for all existing widgets. Using React layout state
        // here would snap pushed widgets back to their pre-drag YAML positions.
        const pushedLayout = [...rglLayout.filter(l => l.i !== '__dropping-elem__')];
        setLayout(() => [...pushedLayout, { i: id, x: item.x, y: item.y, w: dropWidth, h: dropHeight }]);
        setDropQueue(prev => [...prev, newService]);
      }
      setDroppingItem(null);

      void fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newService, ...(parentId ? { parentId } : {}) }),
      }).then(async () => {
        // Reload first so services contains the new item, THEN clear queue.
        // If we clear the queue first, allServices momentarily loses the item,
        // which causes getDerivedStateFromProps to generate a wrong default
        // layout (x:0, y:bottom, w:1, h:1) because it's in the layout prop
        // but no longer in the children list.
        await reloadServices();
        if (!parentId) {
          setDropQueue(prev => prev.filter(s => s.id !== id));
        }
      }).catch((err: unknown) => {
        console.error('Failed to add service:', err);
        if (!parentId) {
          setDropQueue(prev => prev.filter(s => s.id !== id));
        }
      });
    },
    // widgetTemplates intentionally omitted — it's slow-changing and the
    // fallback to catalog defaults is acceptable for the rare stale case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [findParentFrame, reloadServices, setDroppingItem]
  );

  const deleteService = useCallback(
    async (id: string) => {
      await fetch(`/api/services/${id}`, { method: 'DELETE' });
      setLayout(prev => prev.filter((l: LayoutItem) => l.i !== id));
      await reloadServices();
    },
    [reloadServices]
  );

  // Measure the available width so the column count can fill the viewport.
  const roRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setAvailableWidth(entry.contentRect.width);
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);

  const { rowHeight, gap } = gridConfig;
  const margin = useMemo<[number, number]>(() => [gap, gap], [gap]);
  // Fixed-size square cells (cell size = rowHeight). The column COUNT is derived
  // purely from the cell size so the grid always fills the viewport width — a
  // wider window yields more columns, never wider cells.
  const cellPitch = rowHeight + gap;
  const cols = Math.max(1, Math.floor((availableWidth + gap) / cellPitch));
  const gridWidth = cols * cellPitch - gap;
  const rglDropItem = useMemo<LayoutItem | undefined>(
    () => editMode ? { i: '__dropping-elem__', x: 0, y: 0, w: droppingItem?.w ?? 2, h: droppingItem?.h ?? 2 } : undefined,
    [editMode, droppingItem?.w, droppingItem?.h],
  );
  // Stable RGL config objects — recreating them inline would re-render the whole
  // grid subtree (incl. memoized FrameCard/WidgetCard children) on every render.
  const rglGridConfig = useMemo(
    () => ({ cols, rowHeight, margin, containerPadding: CONTAINER_PADDING }),
    [cols, rowHeight, margin],
  );
  const rglDragConfig = useMemo(() => ({ enabled: editMode, handle: '.grid-drag-handle' }), [editMode]);
  const rglResizeConfig = useMemo(() => ({ enabled: editMode }), [editMode]);
  const rglDropConfig = useMemo(
    () => ({ enabled: editMode, defaultItem: { w: droppingItem?.w ?? 2, h: droppingItem?.h ?? 2 } }),
    [editMode, droppingItem?.w, droppingItem?.h],
  );

  if (rootServices.length === 0 && !editMode) {
    return (
      <div className="dash-grid-container dash-grid-empty">
        <p>{t('dashGrid.noServices')}</p>
      </div>
    );
  }

  return (
    <div className="dash-grid-container" ref={containerRef}>
      {hasConfigErrors && (
        <div className="config-error-banner" role="alert">
          {t('dashGrid.configErrorBanner')}
        </div>
      )}
      <div className="dash-grid-canvas" style={{ width: gridWidth }}>
        {editMode && (
          <div
            className="grid-overlay"
            aria-hidden="true"
            style={{ backgroundSize: `${cellPitch}px 8px, 8px ${cellPitch}px` }}
          />
        )}
        <ReactGridLayout
          className="dash-grid"
          style={{ minHeight: '100%' }}
          layout={layout.length > 0 ? layout : baseLayout}
          width={gridWidth}
          gridConfig={rglGridConfig}
          dragConfig={rglDragConfig}
          resizeConfig={rglResizeConfig}
          dropConfig={rglDropConfig}
          compactor={noCompactor}
          {...(rglDropItem !== undefined && { droppingItem: rglDropItem })}
          onDrop={createWidgetFromDrop}
          onDragStart={lockFramesDuringDrag}
          onDragStop={syncLayoutAfterDrag}
          onLayoutChange={recordDragPositions}
        >
        {rootServices.map(s => (
          <div key={s.id} {...(isFrameService(s) ? { 'data-frame-id': s.id } : {})}>
            {isFrameService(s) ? (
              <FrameCard
                service={s}
                editMode={editMode}
                onDelete={deleteService}
                widgetTemplates={widgetTemplates}
                gridConfig={gridConfig}
                frameLayout={layoutById.get(s.id)}
                reloadServices={reloadServices}
              />
            ) : (
              <WidgetCard
                service={s}
                editMode={editMode}
                onDelete={deleteService}
              />
            )}
          </div>
        ))}
      </ReactGridLayout>
      </div>
    </div>
  );
}
