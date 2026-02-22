import { useState, useCallback, useEffect, useRef } from 'react';
import ReactGridLayout from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUIStore } from '../store/uiStore';
import { useServices } from '../hooks/useServices';
import { useLayout } from '../hooks/useLayout';
import { useConfigReload } from '../hooks/useConfigReload';
import { WidgetCard } from './WidgetCard';
import type { ServiceConfig } from '@dashdash/types';
import type { WidgetTemplate } from '../widgets/catalog';
import './DashGrid.css';

/** Merge saved layout positions with YAML service defaults. */
function mergeLayout(services: ServiceConfig[], saved: Layout[] | null): Layout[] {
  const savedMap = new Map(saved?.map(l => [l.i, l]) ?? []);
  return services.map(s => {
    const override = savedMap.get(s.id);
    return override ?? {
      i: s.id,
      x: s.layout.x ?? 0,
      y: s.layout.y ?? 0,
      w: s.layout.w,
      h: s.layout.h,
    };
  });
}

export function DashGrid() {
  const editMode = useUIStore(s => s.editMode);
  const droppingItem = useUIStore(s => s.droppingItem);
  const setDroppingItem = useUIStore(s => s.setDroppingItem);

  const { services, reload: reloadServices } = useServices();
  const { savedLayout, saveLayout, reload: reloadLayout } = useLayout();

  // Locally-managed optimistic services (dropped but not yet confirmed by server).
  // Avoids relying on SWR's mutate for synchronous UI updates.
  const [dropQueue, setDropQueue] = useState<ServiceConfig[]>([]);

  // Merge server services with any pending dropped services not yet in server data.
  const allServices: ServiceConfig[] = [
    ...services,
    ...dropQueue.filter(s => !services.find(x => x.id === s.id)),
  ];

  const [layout, setLayout] = useState<Layout[]>([]);
  const [width, setWidth] = useState(window.innerWidth - 32);

  // Initialise / re-merge layout whenever services change.
  // Use a ref for savedLayout so changes to it (from saveLayout) don't re-trigger
  // the effect and create a feedback loop.
  const savedLayoutRef = useRef(savedLayout);
  savedLayoutRef.current = savedLayout;

  useEffect(() => {
    if (allServices.length > 0) {
      setLayout(prev => {
        const merged = mergeLayout(allServices, savedLayoutRef.current);
        // Preserve any layout entries for items already in prev but not yet in
        // allServices (e.g., brand-new drops still settling through the render cycle).
        const mergedIds = new Set(merged.map(l => l.i));
        const extras = prev.filter(l => !mergedIds.has(l.i));
        return extras.length > 0 ? [...merged, ...extras] : merged;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allServices.length, services, dropQueue]);

  // Track the last known ghost position so we can recover it when RGL's dragleave
  // counter bug fires removeDroppingPlaceholder() prematurely (cursor moves over
  // child widget → dragleave fires → counter=0 → ghost removed before drop).
  const lastGhostRef = useRef<Layout | null>(null);

  // Live reload when any config file changes
  useConfigReload(useCallback(() => {
    void reloadServices();
    void reloadLayout();
  }, [reloadServices, reloadLayout]));

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      // Track ghost position — RGL removes the ghost prematurely when cursor
      // moves over child widgets (dragleave counter bug), so we keep the last
      // known position for handleDrop fallback.
      const ghost = newLayout.find(l => l.i === '__dropping-elem__');
      if (ghost) lastGhostRef.current = ghost;

      // Preserve layout entries for services that are in our local dropQueue
      // but that RGL doesn't know about yet (RGL's removeDroppingPlaceholder
      // fires onLayoutChange before the new child has had its first render cycle).
      setLayout(prev => {
        const newIds = new Set(newLayout.map(l => l.i));
        const extras = prev.filter(l => !newIds.has(l.i) && l.i !== '__dropping-elem__');
        console.log('[handleLayoutChange] newLayout:', newLayout.length, 'extras preserved:', extras.length);
        return extras.length > 0 ? [...newLayout, ...extras] : newLayout;
      });
      saveLayout(newLayout);
    },
    [saveLayout]
  );

  const handleDrop = useCallback(
    (_rglLayout: Layout[], item: Layout, e: Event) => {
      console.log('[D1] item:', item ? `x${item.x}y${item.y}` : 'undef', 'ghost:', lastGhostRef.current ? `x${lastGhostRef.current.x}y${lastGhostRef.current.y}` : 'null');

      const dragEvent = e as DragEvent;
      const raw = dragEvent.dataTransfer?.getData('widget-template');
      if (!raw) { console.warn('[D1] no raw'); return; }

      let template: WidgetTemplate;
      try {
        template = JSON.parse(raw) as WidgetTemplate;
      } catch (err) {
        console.error('[D1] parse error:', err, 'raw:', raw);
        return;
      }
      console.log('[D2] type:', template.type, 'size:', JSON.stringify(template.defaultSize));

      // crypto.randomUUID() requires a secure context (HTTPS/localhost).
      // Fall back to a timestamp+random ID so this works over IP too.
      const id = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `uc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      console.log('[D2.5] id:', id.slice(-6));

      const w = template.defaultSize?.w ?? 2;
      const h = template.defaultSize?.h ?? 2;
      const pos = item ?? lastGhostRef.current;
      console.log('[D3] pos:', pos ? `x${pos.x}y${pos.y}` : 'NONE', 'w:', w, 'h:', h);
      if (!pos) { console.warn('[D3] no pos'); return; }
      lastGhostRef.current = null;

      const newService: ServiceConfig = {
        id,
        title: template.label,
        widget: template.type,
        layout: { x: pos.x, y: pos.y, w, h },
        options: template.defaultOptions ?? {},
        _userCreated: true,
      };

      console.log('[D4] calling setLayout + setDropQueue');
      setLayout(prev => { console.log('[D5] setLayout prev:', prev.length, '→', prev.length + 1); return [...prev, { i: id, x: pos.x, y: pos.y, w, h }]; });
      setDropQueue(prev => [...prev, newService]);
      setDroppingItem(null);
      console.log('[D6] done');

      void fetch('/api/user-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService),
      }).then(res => {
        console.log('[D7] POST status:', res.status);
        void reloadServices();
      });
    },
    [reloadServices, setDroppingItem]
  );

  const handleDeleteService = useCallback(
    async (id: string) => {
      await fetch(`/api/user-services/${id}`, { method: 'DELETE' });
      await reloadServices();
      const updatedLayout = layout.filter(l => l.i !== id);
      setLayout(updatedLayout);
      saveLayout(updatedLayout);
    },
    [layout, saveLayout, reloadServices]
  );

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(node);
  }, []);

  console.log('[RENDER] services:', services.length, 'queue:', dropQueue.length, 'all:', allServices.length, 'layout:', layout.length);

  if (allServices.length === 0 && !editMode) {
    return (
      <div className="dash-grid-container dash-grid-empty">
        <p>No services configured. Add widgets to <code>config/services.yml</code> or use Edit mode to drag widgets onto the grid.</p>
      </div>
    );
  }

  return (
    <div className="dash-grid-container" ref={containerRef}>
      {editMode && (
        <div className="grid-overlay" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className="grid-overlay__col" />
          ))}
        </div>
      )}
      <ReactGridLayout
        className="dash-grid"
        layout={layout}
        cols={12}
        rowHeight={80}
        width={width}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        isDraggable={editMode}
        isResizable={editMode}
        isDroppable={editMode}
        compactType={null}
        preventCollision={true}
        droppingItem={editMode ? { i: '__dropping-elem__', w: droppingItem?.w ?? 2, h: droppingItem?.h ?? 2 } : undefined}
        onDrop={handleDrop}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
      >
        {allServices.map(s => (
          <div key={s.id}>
            <WidgetCard
              service={s}
              editMode={editMode}
              onDelete={s._userCreated ? handleDeleteService : undefined}
            />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}
