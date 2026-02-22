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

  const { services, reload: reloadServices } = useServices();
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

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(node);
  }, []);

  if (services.length === 0) {
    return (
      <div className="dash-grid-container dash-grid-empty">
        <p>No services configured. Add widgets to <code>config/services.yml</code> to get started.</p>
      </div>
    );
  }

  return (
    <div className="dash-grid-container" ref={containerRef}>
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
        onLayoutChange={handleLayoutChange}
        draggableHandle=".widget-drag-handle"
      >
        {services.map(s => (
          <div key={s.id}>
            <WidgetCard id={s.id} title={s.title} icon={s.icon} editMode={editMode} />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}
