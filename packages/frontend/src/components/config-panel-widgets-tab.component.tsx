import { useUIStore } from '../store/uiStore';
import { WIDGET_CATALOG } from '../widgets/catalog';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import { useT } from '../i18n';
import type { WidgetTemplate } from '../widgets/catalog';

function SidebarItem({ template }: { template: WidgetTemplate }) {
  const t = useT();
  const setDroppingItem = useUIStore(s => s.setDroppingItem);
  const widgetTemplates = useWidgetTemplates();
  const Icon = template.icon;

  const displayLabel = template.labelKey ? (t(template.labelKey) || template.label) : template.label;
  const displayDesc = template.descriptionKey ? (t(template.descriptionKey) || template.description) : template.description;

  const prepareWidgetTemplateDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('widget-template', JSON.stringify(template));
    const tmpl = widgetTemplates.find(t => t.type === template.type);
    const templateWidth = tmpl?.defaultSize.w ?? template.defaultSize.w;
    const templateHeight = tmpl?.defaultSize.h ?? template.defaultSize.h;
    setDroppingItem({ i: '__dropping-elem__', w: templateWidth, h: templateHeight });
  };

  const clearDroppingItem = () => setDroppingItem(null);

  return (
    <div
      className="config-panel-item"
      draggable
      onDragStart={prepareWidgetTemplateDrag}
      onDragEnd={clearDroppingItem}
      title={displayDesc}
    >
      <span className="config-panel-item__icon">
        <Icon size={18} />
      </span>
      <div className="config-panel-item__info">
        <span className="config-panel-item__label">{displayLabel}</span>
        <span className="config-panel-item__desc">{displayDesc}</span>
      </div>
    </div>
  );
}

export function WidgetsTab() {
  const t = useT();
  return (
    <>
      <div className="config-tab-hint">{t('config.dragOntoGrid')}</div>
      <div className="config-item-list">
        {WIDGET_CATALOG.map(template => (
          <SidebarItem key={template.type} template={template} />
        ))}
      </div>
    </>
  );
}
