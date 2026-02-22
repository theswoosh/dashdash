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

  // Synced every render so the layout effect can read the current editMode
  // without adding it as a dep (which would re-run the effect on toggle).
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  useEffect(() => {
    if (allServices.length > 0) {
      setLayout(prev => {
        const fromYaml = servicesAsLayout(allServices);

        // Outside edit mode (initial load, WS reload, post-save): always use
        // YAML positions so the layout is correct after a refresh.
        if (!editModeRef.current || prev.length === 0) return fromYaml;

        // Inside edit mode: preserve local drag positions for items already
        // in the layout; only new items (e.g., just dropped) fall back to
        // their YAML (i.e., drop) position.
        const prevMap = new Map(prev.map(l => [l.i, l]));
        const merged = fromYaml.map(item => prevMap.get(item.i) ?? item);
        const mergedIds = new Set(merged.map(l => l.i));
        const extras = prev.filter(l => !mergedIds.has(l.i) && l.i !== '__dropping-elem__');
        return extras.length > 0 ? [...merged, ...extras] : merged;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allServices.length, services, dropQueue]);

  const lastGhostRef = useRef<Layout | null>(null);
  // Always holds the latest layout so the save-on-close effect can read it
  // without needing layout in its dependency array (which would re-bind on
  // every drag move and cause stale closure issues).
  const layoutRef = useRef<Layout[]>(layout);
  useEffect(() => { layoutRef.current = layout; });

  // Save all layouts to YAML when edit mode is closed ("Save" button).
  const prevEditMode = useRef(editMode);
  useEffect(() => {
    const wasEditing = prevEditMode.current;
    prevEditMode.current = editMode;
    if (wasEditing && !editMode) {
      const items = layoutRef.current
        .filter(l => l.i !== '__dropping-elem__')
        .map(l => ({ id: l.i, layout: { x: l.x, y: l.y, w: l.w, h: l.h } }));
      void fetch('/api/services/layouts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      }).then(async r => {
        if (!r.ok) console.error('Layout save failed:', r.status, await r.text());
        else void reloadServices();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode]);

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

      const existingIds = allServices.map(s => s.id);
      const base = template.type;
      let id = base;
      let n = 2;
      while (existingIds.includes(id)) { id = `${base}-${n++}`; }

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
        draggableHandle=".widget-drag-handle"
      >
        {allServices.map(s => (
          <div key={s.id}>
            <WidgetCard
              service={s}
              editMode={editMode}
              onDelete={handleDeleteService}
            />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}
