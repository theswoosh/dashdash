import { useState, useCallback } from 'react';
import ReactGridLayout, { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { useUIStore } from '../store/uiStore';
import { WidgetCard } from './WidgetCard';
import './DashGrid.css';

// Demo items until YAML config is wired up
const DEMO_LAYOUT: Layout[] = [
  { i: 'clock', x: 0, y: 0, w: 2, h: 2 },
  { i: 'health', x: 2, y: 0, w: 2, h: 2 },
  { i: 'bookmarks', x: 4, y: 0, w: 4, h: 2 },
  { i: 'stats', x: 0, y: 2, w: 4, h: 3 },
  { i: 'search', x: 4, y: 2, w: 4, h: 1 },
];

interface DemoWidget {
  id: string;
  title: string;
}

const DEMO_WIDGETS: DemoWidget[] = [
  { id: 'clock', title: 'Clock' },
  { id: 'health', title: 'Health' },
  { id: 'bookmarks', title: 'Bookmarks' },
  { id: 'stats', title: 'Stats' },
  { id: 'search', title: 'Search' },
];

export function DashGrid() {
  const editMode = useUIStore(s => s.editMode);
  const [layout, setLayout] = useState<Layout[]>(DEMO_LAYOUT);
  const [width, setWidth] = useState(window.innerWidth - 32);

  const handleLayoutChange = useCallback((newLayout: Layout[]) => {
    setLayout(newLayout);
    // TODO: persist to backend
  }, []);

  // Track container width for responsive layout
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(node);
  }, []);

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
        {DEMO_WIDGETS.map(w => (
          <div key={w.id}>
            <WidgetCard id={w.id} title={w.title} editMode={editMode} />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}
