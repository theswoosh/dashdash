import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactGridLayout from 'react-grid-layout';
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
import { flattenServices, findServiceWithParent } from '../utils/service-tree';
import { serviceAsGridItem, persistedHeight, isTinyLayoutService } from '../utils/widget-layout';
import type { GridConfigLike } from '../utils/widget-layout';
import {
  OVERLAP_COMPACTOR,
  DROPPING_ELEMENT_ID,
  findOverlappingItems,
  evaluateRootDragTarget,
  resolveNonOverlappingPosition,
} from '../utils/grid-collision';
import './DashGrid.css';

const CONTAINER_PADDING: [number, number] = [0, 0];

/** Build RGL layout items directly from services (YAML is source of truth).
 *  Tiny-layout services get their height pinned to the visible bar height. */
function servicesAsLayout(services: ServiceConfig[], gridConfig: GridConfigLike): LayoutItem[] {
  return services.map(s => serviceAsGridItem(s, gridConfig));
}

function isFrameService(service: ServiceConfig): boolean {
  return service.widget === 'frame';
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

  // Same pattern for templates: SWR resolves after mount, but createWidgetFromDrop
  // is memoized without it — a plain closure would keep the initial empty list and
  // silently fall back to catalog default sizes, ignoring widgets.yml.
  const widgetTemplatesRef = useRef(widgetTemplates);
  widgetTemplatesRef.current = widgetTemplates;

  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [availableWidth, setAvailableWidth] = useState(() => window.innerWidth);

  // Synced every render so callbacks can read the current editMode
  // without adding it as a dep (which would re-run effects on toggle).
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  const frameIds = useMemo(
    () => new Set(rootServices.filter(isFrameService).map(s => s.id)),
    [rootServices],
  );

  // Red "invalid drop" tint: toggled as a DOM class on the canvas node so
  // per-tick drag/resize updates never trigger React re-renders.
  const canvasElRef = useRef<HTMLDivElement | null>(null);
  const isGhostInvalidRef = useRef(false);
  const setGhostInvalid = useCallback((isInvalid: boolean) => {
    if (isGhostInvalidRef.current === isInvalid) return;
    isGhostInvalidRef.current = isInvalid;
    canvasElRef.current?.classList.toggle('grid-drag-invalid', isInvalid);
  }, []);

  const baseLayout = useMemo(
    () => (rootServices.length > 0 ? servicesAsLayout(rootServices, gridConfig) : []),
    [rootServices, gridConfig],
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

  // Tracks the latest drag positions for save-on-close.
  // Updated by handleLayoutChange (never by React state) so it never triggers
  // re-renders that would interfere with RGL's internal drop state.
  const dragLayoutRef = useRef<LayoutItem[]>([]);

  // Save all layouts to YAML when edit mode is closed ("Save" button).
  const prevEditMode = useRef(editMode);
  useEffect(() => {
    const wasEditing = prevEditMode.current;
    prevEditMode.current = editMode;

    if (!wasEditing && editMode) {
      // Entering edit mode — seed dragLayoutRef with current layout so a
      // save without any dragging still writes the correct positions.
      dragLayoutRef.current = layout.filter(l => l.i !== DROPPING_ELEMENT_ID);
    }

    if (wasEditing && !editMode) {
      const source = dragLayoutRef.current.length > 0 ? dragLayoutRef.current : layout;
      const items = source
        .filter(l => l.i !== DROPPING_ELEMENT_ID)
        .map(l => ({ id: l.i, layout: { x: l.x, y: l.y, w: l.w, h: persistedHeight(l, allServicesRef.current) } }));
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
    void mutate('/api/widget-templates');
  }, [reloadServices]));

  const recordDragPositions = useCallback((newLayout: Layout) => {
    if (!editModeRef.current) return;
    const withoutGhost = newLayout.filter(l => l.i !== DROPPING_ELEMENT_ID);
    if (withoutGhost.length > 0) dragLayoutRef.current = [...withoutGhost];
  }, []);

  // Per-tick drag feedback: ghost turns red over occupied space (DOM class
  // only — no setState during drag). Also fires for the external drop ghost.
  const tintGhostDuringDrag = useCallback((newLayout: Layout, _oldItem?: LayoutItem | null, newItem?: LayoutItem | null) => {
    if (!editModeRef.current || !newItem) return;
    const target = evaluateRootDragTarget(newItem, newLayout, frameIds);
    setGhostInvalid(target.kind === 'invalid');
  }, [frameIds, setGhostInvalid]);

  const commitLayout = useCallback((items: LayoutItem[]) => {
    dragLayoutRef.current = items;
    setLayout(items);
  }, []);

  /** Revert the gestured item to its pre-gesture position; nothing else moved
   *  (overlap never pushes), so reverting just that item is complete. */
  const revertGesturedItem = useCallback((items: LayoutItem[], gestured: LayoutItem, before: LayoutItem) => {
    commitLayout(items.map(it =>
      it.i === gestured.i ? { ...it, x: before.x, y: before.y, w: before.w, h: before.h } : it,
    ));
  }, [commitLayout]);

  // onDragStop fires before RGL calls setState({ activeDrag: null }); this
  // setLayout and RGL's setState land in the same React batch, so a reverted
  // layout cleanly overrides RGL's internal drop position.
  const syncLayoutAfterDrag = useCallback((newLayout: Layout, oldItem?: LayoutItem | null, newItem?: LayoutItem | null) => {
    if (!editModeRef.current) return;
    setGhostInvalid(false);
    const items = [...newLayout];

    if (newItem && newItem.i !== DROPPING_ELEMENT_ID) {
      const target = evaluateRootDragTarget(newItem, items, frameIds);

      if (target.kind === 'invalid' && oldItem) {
        revertGesturedItem(items, newItem, oldItem);
        return;
      }

      if (target.kind === 'reparent') {
        const found = findServiceWithParent(rootServices, newItem.i);
        const currentParentId = found?.parent?.id ?? null;
        if (found && target.frameId !== currentParentId) {
          // Place at the drop spot if free, otherwise the next free spot in
          // the frame — a reparent must never land on an occupied child.
          const frameService = rootServices.find(s => s.id === target.frameId);
          const childItems = (frameService?.children ?? []).map(c => serviceAsGridItem(c, gridConfig));
          const desired = { ...newItem, x: newItem.x - target.frameLayout.x, y: newItem.y - target.frameLayout.y };
          const pos = resolveNonOverlappingPosition(desired, childItems, target.frameLayout.w);
          const relLayout = {
            x: pos.x,
            y: pos.y,
            w: newItem.w,
            h: isTinyLayoutService(found.service) ? found.service.layout.h : newItem.h,
          };
          const filtered = items.filter(i => i.i !== newItem.i);
          commitLayout(filtered);
          setReparentingIds(prev => (prev.includes(newItem.i) ? prev : [...prev, newItem.i]));
          void fetch(`/api/services/${newItem.i}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ parentId: target.frameId, layout: relLayout }),
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

    commitLayout(items);
  }, [commitLayout, frameIds, gridConfig, reloadServices, revertGesturedItem, rootServices, setGhostInvalid, setReparentingIds]);

  // Resize never reparents — any overlap (frames included) is invalid.
  const tintGhostDuringResize = useCallback((newLayout: Layout, _oldItem?: LayoutItem | null, newItem?: LayoutItem | null) => {
    if (!editModeRef.current || !newItem) return;
    setGhostInvalid(findOverlappingItems(newItem, newLayout).length > 0);
  }, [setGhostInvalid]);

  const syncLayoutAfterResize = useCallback((newLayout: Layout, oldItem?: LayoutItem | null, newItem?: LayoutItem | null) => {
    if (!editModeRef.current) return;
    setGhostInvalid(false);
    const items = [...newLayout];
    if (newItem && oldItem && findOverlappingItems(newItem, items).length > 0) {
      revertGesturedItem(items, newItem, oldItem);
      return;
    }
    commitLayout(items);
  }, [commitLayout, revertGesturedItem, setGhostInvalid]);

  // RGL removes the external drop ghost without firing a callback when the
  // drag leaves the grid — clear the tint here so it can't stick.
  const clearGhostTintOnDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setGhostInvalid(false);
  }, [setGhostInvalid]);

  const createWidgetFromDrop = useCallback(
    (rglLayout: Layout, item: LayoutItem | undefined, e: Event) => {
      setGhostInvalid(false);
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
      const tmpl = widgetTemplatesRef.current.find(t => t.type === template.type);
      const dropWidth = tmpl?.defaultSize.w ?? template.defaultSize?.w ?? 2;
      const dropHeight = tmpl?.defaultSize.h ?? template.defaultSize?.h ?? 2;

      const parent = findParentFrame(item, e);
      const parentId = parent?.frameId;

      let dropLayout: { x: number; y: number; w: number; h: number };
      if (parent) {
        // Dropping into a frame: place at the cursor spot if free, otherwise
        // the next free spot among the frame's children.
        const frameService = allServicesRef.current.find(s => s.id === parent.frameId);
        const childItems = (frameService?.children ?? []).map(c => serviceAsGridItem(c, gridConfig));
        const desired = { i: id, x: item.x - parent.frameLayout.x, y: item.y - parent.frameLayout.y, w: dropWidth, h: dropHeight };
        const pos = resolveNonOverlappingPosition(desired, childItems, parent.frameLayout.w);
        dropLayout = { x: pos.x, y: pos.y, w: dropWidth, h: dropHeight };
      } else {
        // Dropping on the root grid: occupied space rejects the drop entirely
        // (the drag-over ghost was already tinted red).
        const dropItem: LayoutItem = { i: id, x: item.x, y: item.y, w: dropWidth, h: dropHeight };
        if (findOverlappingItems(dropItem, rglLayout).length > 0) {
          setDroppingItem(null);
          return;
        }
        dropLayout = { x: item.x, y: item.y, w: dropWidth, h: dropHeight };
      }

      const newService: ServiceConfig = {
        id,
        title: template.label,
        widget: template.type,
        layout: dropLayout,
        options: template.defaultOptions ?? {},
      };

      if (!parentId) {
        const baseItems = [...rglLayout.filter(l => l.i !== DROPPING_ELEMENT_ID)];
        setLayout(() => [...baseItems, { i: id, ...dropLayout }]);
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
    [findParentFrame, gridConfig, reloadServices, setDroppingItem, setGhostInvalid]
  );

  const deleteService = useCallback(
    async (id: string) => {
      await fetch(`/api/services/${id}`, { method: 'DELETE' });
      setLayout(prev => prev.filter((l: LayoutItem) => l.i !== id));
      // Drop the stale entry so save-on-close never PUTs a deleted id.
      dragLayoutRef.current = dragLayoutRef.current.filter(l => l.i !== id);
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
    () => editMode ? { i: DROPPING_ELEMENT_ID, x: 0, y: 0, w: droppingItem?.w ?? 2, h: droppingItem?.h ?? 2 } : undefined,
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
      <div
        className="dash-grid-canvas"
        style={{ width: gridWidth }}
        ref={canvasElRef}
        onDragLeave={clearGhostTintOnDragLeave}
      >
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
          compactor={OVERLAP_COMPACTOR}
          {...(rglDropItem !== undefined && { droppingItem: rglDropItem })}
          onDrop={createWidgetFromDrop}
          onDrag={tintGhostDuringDrag}
          onDragStop={syncLayoutAfterDrag}
          onResize={tintGhostDuringResize}
          onResizeStop={syncLayoutAfterResize}
          onLayoutChange={recordDragPositions}
        >
        {rootServices.map(s => (
          <div key={s.id} {...(isFrameService(s) ? { 'data-frame-id': s.id } : {})}>
            {isFrameService(s) ? (
              <FrameCard
                service={s}
                editMode={editMode}
                onDelete={deleteService}
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
