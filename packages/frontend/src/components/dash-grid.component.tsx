import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import ReactGridLayout from 'react-grid-layout';
import type { Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { mutate } from 'swr';
import { useUIStore } from '../store/uiStore';
import { useServices } from '../hooks/use-services.hook';
import { useConfigReload } from '../hooks/use-config-reload.hook';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import { useGridConfig } from '../hooks/use-grid-config.hook';
import { WidgetCard } from './widget-card.component';
import { useT } from '../i18n';
import type { ServiceConfig } from '@dashdash/types';
import type { WidgetTemplate } from '../widgets/catalog';
import type { WidgetTemplateDef } from '../hooks/use-widget-templates.hook';
import './DashGrid.css';

const CONTAINER_PADDING: [number, number] = [0, 0];

/** Build RGL layout items directly from services (YAML is source of truth).
 *  Templates supply optional minW/minH constraints per widget type. */
function servicesAsLayout(services: ServiceConfig[], templates: WidgetTemplateDef[]): Layout[] {
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

export function DashGrid() {
  const t = useT();
  const editMode = useUIStore(s => s.editMode);
  const droppingItem = useUIStore(s => s.droppingItem);
  const setDroppingItem = useUIStore(s => s.setDroppingItem);

  const { services, reload: reloadServices } = useServices();
  const widgetTemplates = useWidgetTemplates();
  const gridConfig = useGridConfig();

  // Optimistic queue: new widgets dropped but not yet confirmed by the server
  const [dropQueue, setDropQueue] = useState<ServiceConfig[]>([]);

  const allServices = useMemo<ServiceConfig[]>(
    () => [...services, ...dropQueue.filter(s => !services.find(x => x.id === s.id))],
    [services, dropQueue],
  );

  // Always-current ref so handleDrop can read allServices without a stale closure.
  const allServicesRef = useRef(allServices);
  allServicesRef.current = allServices;

  const [layout, setLayout] = useState<Layout[]>([]);
  const [width, setWidth] = useState(window.innerWidth - 32);

  // Synced every render so callbacks can read the current editMode
  // without adding it as a dep (which would re-run effects on toggle).
  const editModeRef = useRef(editMode);
  editModeRef.current = editMode;

  useEffect(() => {
    if (allServices.length > 0) {
      setLayout(prev => {
        const fromYaml = servicesAsLayout(allServices, widgetTemplates);

        // Outside edit mode (initial load, WS reload, post-save): always use
        // YAML positions so the layout is correct after a refresh.
        if (!editModeRef.current || prev.length === 0) return fromYaml;

        // Inside edit mode: preserve local drag positions for items already
        // in the layout; only new items (e.g., just dropped) fall back to
        // their YAML (i.e., drop) position.
        const prevMap = new Map(prev.map(l => [l.i, l]));
        return fromYaml.map(item => prevMap.get(item.i) ?? item);
      });
    }
  }, [allServices, widgetTemplates]);

  // Tracks the latest drag positions for save-on-close.
  // Updated by handleLayoutChange (never by React state) so it never triggers
  // re-renders that would interfere with RGL's internal drop state.
  const dragLayoutRef = useRef<Layout[]>([]);

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

  const recordDragPositions = useCallback((newLayout: Layout[]) => {
    if (!editModeRef.current) return;
    const withoutGhost = newLayout.filter(l => l.i !== '__dropping-elem__');
    if (withoutGhost.length > 0) dragLayoutRef.current = withoutGhost;
  }, []);

  // onDragStop fires before RGL calls setState({ activeDrag: null }).
  // Both this setLayout and RGL's setState land in the same React batch, so
  // getDerivedStateFromProps sees nextProps.layout = finalLayout (with pushed
  // items at their new positions) instead of the stale original layout —
  // preventing the snap-back that would otherwise override RGL's pushed state.
  const syncLayoutAfterDrag = useCallback((newLayout: Layout[]) => {
    if (!editModeRef.current) return;
    dragLayoutRef.current = newLayout;
    setLayout(newLayout);
  }, []);

  const createWidgetFromDrop = useCallback(
    (_rglLayout: Layout[], item: Layout, e: Event) => {
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

      // With preventCollision=true, item.x/y is always the actual ghost cell —
      // the ghost can only occupy non-colliding positions, so it matches exactly
      // what the user saw visually. onLayoutChange only fires once (on ghost
      // entry before activeDrag is set), so lastGhostRef tracking is unreliable.
      if (!item) return;

      // Use widgets.yml sizes if available, fall back to catalog defaults.
      const tmpl = widgetTemplates.find(t => t.type === template.type);
      const dropWidth = tmpl?.defaultSize.w ?? template.defaultSize?.w ?? 2;
      const dropHeight = tmpl?.defaultSize.h ?? template.defaultSize?.h ?? 2;

      const newService: ServiceConfig = {
        id,
        title: template.label,
        widget: template.type,
        layout: { x: item.x, y: item.y, w: dropWidth, h: dropHeight },
        options: template.defaultOptions ?? {},
      };

      setLayout(prev => [...prev, { i: id, x: item.x, y: item.y, w: dropWidth, h: dropHeight }]);
      setDropQueue(prev => [...prev, newService]);
      setDroppingItem(null);

      void fetch('/api/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newService),
      }).then(async () => {
        // Reload first so services contains the new item, THEN clear queue.
        // If we clear the queue first, allServices momentarily loses the item,
        // which causes getDerivedStateFromProps to generate a wrong default
        // layout (x:0, y:bottom, w:1, h:1) because it's in the layout prop
        // but no longer in the children list.
        await reloadServices();
        setDropQueue(prev => prev.filter(s => s.id !== id));
      }).catch((err: unknown) => {
        console.error('Failed to add service:', err);
        setDropQueue(prev => prev.filter(s => s.id !== id));
      });
    },
    // widgetTemplates intentionally omitted — it's slow-changing and the
    // fallback to catalog defaults is acceptable for the rare stale case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reloadServices, setDroppingItem]
  );

  const deleteService = useCallback(
    async (id: string) => {
      await fetch(`/api/services/${id}`, { method: 'DELETE' });
      await reloadServices();
      setLayout(prev => prev.filter(l => l.i !== id));
    },
    [reloadServices]
  );

  const roRef = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    if (roRef.current) { roRef.current.disconnect(); roRef.current = null; }
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    ro.observe(node);
    roRef.current = ro;
  }, []);

  const { columns: cols, rowHeight, gap } = gridConfig;
  const margin = useMemo<[number, number]>(() => [gap, gap], [gap]);
  const rglDropItem = useMemo(
    () => editMode ? { i: '__dropping-elem__', w: droppingItem?.w ?? 2, h: droppingItem?.h ?? 2 } : undefined,
    [editMode, droppingItem?.w, droppingItem?.h],
  );

  if (allServices.length === 0 && !editMode) {
    return (
      <div className="dash-grid-container dash-grid-empty">
        <p>{t('dashGrid.noServices')}</p>
      </div>
    );
  }

  return (
    <div className="dash-grid-container" ref={containerRef}>
      {editMode && (
        <div className="grid-overlay" aria-hidden="true">
          {Array.from({ length: cols }, (_, i) => (
            <div key={i} className="grid-overlay__col" />
          ))}
        </div>
      )}
      <ReactGridLayout
        className="dash-grid"
        style={{ minHeight: '100%' }}
        layout={layout.length > 0 ? layout : servicesAsLayout(allServices, widgetTemplates)}
        cols={cols}
        rowHeight={rowHeight}
        width={width}
        margin={margin}
        containerPadding={CONTAINER_PADDING}
        isDraggable={editMode}
        isResizable={editMode}
        isDroppable={editMode}
        compactType={null}
        droppingItem={rglDropItem}
        onDrop={createWidgetFromDrop}
        onDragStop={syncLayoutAfterDrag}
        onLayoutChange={recordDragPositions}
        draggableHandle=".widget-drag-handle"
      >
        {allServices.map(s => (
          <div key={s.id}>
            <WidgetCard
              service={s}
              editMode={editMode}
              onDelete={deleteService}
            />
          </div>
        ))}
      </ReactGridLayout>
    </div>
  );
}
