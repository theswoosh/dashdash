import { useState, useCallback, useEffect, useRef } from 'react';
import ReactGridLayout from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUIStore } from '../store/uiStore';
import { useServices } from '../hooks/useServices';
import { useConfigReload } from '../hooks/useConfigReload';
import { WidgetCard } from './WidgetCard';
import type { ServiceConfig } from '@dashdash/types';
import type { WidgetTemplate } from '../widgets/catalog';
import './DashGrid.css';

/** Build RGL layout items directly from services (YAML is source of truth). */
function servicesAsLayout(services: ServiceConfig[]): Layout[] {
  return services.map(s => ({
    i: s.id,
    x: s.layout.x ?? 0,
    y: s.layout.y ?? 0,
    w: s.layout.w,
    h: s.layout.h,
  }));
}

export function DashGrid() {
  const editMode = useUIStore(s => s.editMode);
  const droppingItem = useUIStore(s => s.droppingItem);
  const setDroppingItem = useUIStore(s => s.setDroppingItem);

  const { services, reload: reloadServices } = useServices();

  // Optimistic queue: new widgets dropped but not yet confirmed by the server
  const [dropQueue, setDropQueue] = useState<ServiceConfig[]>([]);

  const allServices: ServiceConfig[] = [
    ...services,
    ...dropQueue.filter(s => !services.find(x => x.id === s.id)),
  ];

  const [layout, setLayout] = useState<Layout[]>([]);
  const [width, setWidth] = useState(window.innerWidth - 32);

  // Rebuild layout from services whenever the list changes.
  // Use a ref guard so dropQueue updates don't re-merge and discard fresh
  // positions before the server write completes.
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  useEffect(() => {
    if (allServices.length > 0) {
      setLayout(prev => {
        const fromYaml = servicesAsLayout(allServices);
        // Preserve layout entries already managed locally (e.g., dropped widgets
        // in the queue whose YAML hasn't been written yet).
        const yamlIds = new Set(fromYaml.map(l => l.i));
        const extras = prev.filter(l => !yamlIds.has(l.i) && l.i !== '__dropping-elem__');
        return extras.length > 0 ? [...fromYaml, ...extras] : fromYaml;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allServices.length, services, dropQueue]);

  const lastGhostRef = useRef<Layout | null>(null);

  useConfigReload(useCallback(() => {
    void reloadServices();
  }, [reloadServices]));

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    const ghost = newLayout.find(l => l.i === '__dropping-elem__');
    if (ghost) lastGhostRef.current = ghost;

    setLayout(prev => {
      const newIds = new Set(newLayout.map(l => l.i));
      const extras = prev.filter(l => !newIds.has(l.i) && l.i !== '__dropping-elem__');
      return extras.length > 0 ? [...newLayout, ...extras] : newLayout;
    });
  }, []);

  const persistLayout = useCallback((item: Layout) => {
    void fetch(`/api/services/${item.i}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout: { x: item.x, y: item.y, w: item.w, h: item.h } }),
    });
  }, []);

  const handleDragStop = useCallback(
    (_layout: Layout[], _old: Layout, newItem: Layout) => {
      persistLayout(newItem);
    },
    [persistLayout]
  );

  const handleResizeStop = useCallback(
    (_layout: Layout[], _old: Layout, newItem: Layout) => {
      persistLayout(newItem);
    },
    [persistLayout]
  );

  const handleDrop = useCallback(
    (_rglLayout: Layout[], item: Layout, e: Event) => {
      const dragEvent = e as DragEvent;
      const raw = dragEvent.dataTransfer?.getData('widget-template');
      if (!raw) return;

      let template: WidgetTemplate;
      try {
        template = JSON.parse(raw) as WidgetTemplate;
      } catch {
        return;
      }

      const id = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `uc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

      const w = template.defaultSize?.w ?? 2;
      const h = template.defaultSize?.h ?? 2;
      const pos = item ?? lastGhostRef.current;
      if (!pos) return;
      lastGhostRef.current = null;

      const newService: ServiceConfig = {
        id,
        title: template.label,
        widget: template.type,
        layout: { x: pos.x, y: pos.y, w, h },
        options: template.defaultOptions ?? {},
        _userCreated: true,
      };

      setLayout(prev => [...prev, { i: id, x: pos.x, y: pos.y, w, h }]);
      setDropQueue(prev => [...prev, newService]);
      setDroppingItem(null);

      void fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService),
      }).then(() => {
        setDropQueue(prev => prev.filter(s => s.id !== id));
        void reloadServices();
      });
    },
    [reloadServices, setDroppingItem]
  );

  const handleDeleteService = useCallback(
    async (id: string) => {
      await fetch(`/api/services/${id}`, { method: 'DELETE' });
      await reloadServices();
      setLayout(prev => prev.filter(l => l.i !== id));
    },
    [reloadServices]
  );

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(node);
  }, []);

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
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
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
