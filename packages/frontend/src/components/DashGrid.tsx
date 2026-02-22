import { useState, useCallback, useEffect } from 'react';
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

  const { services, reload: reloadServices, addServiceOptimistic } = useServices();
  const { savedLayout, saveLayout, reload: reloadLayout } = useLayout();

  const [layout, setLayout] = useState<Layout[]>([]);
  const [width, setWidth] = useState(window.innerWidth - 32);

  // Initialise / re-merge layout whenever services or savedLayout change
  useEffect(() => {
    if (services.length > 0) {
      setLayout(mergeLayout(services, savedLayout));
    }
  }, [services, savedLayout]);

  // Live reload when any config file changes
  useConfigReload(useCallback(() => {
    void reloadServices();
    void reloadLayout();
  }, [reloadServices, reloadLayout]));

  const handleLayoutChange = useCallback(
    (newLayout: Layout[]) => {
      setLayout(newLayout);
      saveLayout(newLayout);
    },
    [saveLayout]
  );

  const handleDrop = useCallback(
    (rglLayout: Layout[], item: Layout, e: Event) => {
      const dragEvent = e as DragEvent;
      const raw = dragEvent.dataTransfer?.getData('widget-template');
      if (!raw) return;

      let template: WidgetTemplate;
      try {
        template = JSON.parse(raw) as WidgetTemplate;
      } catch {
        return;
      }

      const id = crypto.randomUUID();
      const newService: ServiceConfig = {
        id,
        title: template.label,
        widget: template.type,
        layout: { x: item.x, y: item.y, w: item.w, h: item.h },
        options: template.defaultOptions,
        _userCreated: true,
      };

      // Replace the __dropping__ placeholder with the real ID in the layout RGL provides
      const newLayoutItem: Layout = { i: id, x: item.x, y: item.y, w: item.w, h: item.h };
      const updatedLayout = [
        ...rglLayout.filter(l => l.i !== '__dropping__'),
        newLayoutItem,
      ];
      setLayout(updatedLayout);
      saveLayout(updatedLayout);

      // Add to SWR cache immediately — widget renders without waiting for the network
      addServiceOptimistic(newService);
      setDroppingItem(null);

      // Persist in background; revert optimistic state on failure
      void fetch('/api/user-services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService),
      }).then(res => {
        if (!res.ok) {
          console.error('Failed to persist widget, reverting');
          void reloadServices();
        }
      });
    },
    [saveLayout, reloadServices, addServiceOptimistic, setDroppingItem]
  );

  const handleDeleteService = useCallback(
    async (id: string) => {
      await fetch(`/api/user-services/${id}`, { method: 'DELETE' });
      await reloadServices();
      // Also remove from layout
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

  if (services.length === 0 && !editMode) {
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
        droppingItem={droppingItem ?? undefined}
        onDrop={handleDrop}
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
      >
        {services.map(s => (
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
