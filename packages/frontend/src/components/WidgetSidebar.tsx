import { useUIStore } from '../store/uiStore';
import { WIDGET_CATALOG } from '../widgets/catalog';
import type { WidgetTemplate } from '../widgets/catalog';
import './WidgetSidebar.css';

function SidebarItem({ template }: { template: WidgetTemplate }) {
  const setDroppingItem = useUIStore(s => s.setDroppingItem);
  const Icon = template.icon;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('widget-template', JSON.stringify(template));
    setDroppingItem({ i: '__dropping__', w: template.defaultSize.w, h: template.defaultSize.h });
  };

  const handleDragEnd = () => {
    // If the drop didn't land on the grid, clear the dropping item
    // The onDrop handler in DashGrid will also clear it on success
  };

  return (
    <div
      className="sidebar-item"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      title={template.description}
    >
      <span className="sidebar-item__icon">
        <Icon size={18} />
      </span>
      <div className="sidebar-item__info">
        <span className="sidebar-item__label">{template.label}</span>
        <span className="sidebar-item__desc">{template.description}</span>
      </div>
    </div>
  );
}

export function WidgetSidebar() {
  const editMode = useUIStore(s => s.editMode);

  return (
    <aside className={`widget-sidebar${editMode ? ' widget-sidebar--open' : ''}`} aria-label="Widget catalog">
      <div className="sidebar-header">
        <span className="sidebar-title">Add Widgets</span>
        <span className="sidebar-hint">Drag onto grid</span>
      </div>
      <div className="sidebar-list">
        {WIDGET_CATALOG.map(template => (
          <SidebarItem key={template.type} template={template} />
        ))}
      </div>
    </aside>
  );
}
