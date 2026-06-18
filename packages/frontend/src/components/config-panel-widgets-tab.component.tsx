import { memo, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { WIDGET_CATALOG } from '../widgets/catalog';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import { WidgetTemplateConfigModal } from './widget-template-config-modal.component';
import { useT } from '../i18n';
import type { WidgetTemplate } from '../widgets/catalog';

const SidebarItem = memo(function SidebarItem({
  template,
  onConfigure,
}: {
  template: WidgetTemplate;
  onConfigure: (type: string) => void;
}) {
  const t = useT();
  const setDroppingItem = useUIStore(s => s.setDroppingItem);
  const widgetTemplates = useWidgetTemplates();
  const Icon = template.icon;

  const displayLabel = template.labelKey ? (t(template.labelKey) || template.label) : template.label;
  const displayDesc = template.descriptionKey ? (t(template.descriptionKey) || template.description) : template.description;

  const prepareWidgetTemplateDrag = (e: React.DragEvent<HTMLDivElement>) => {
    // Grabbing the config button must never start a drag.
    if ((e.target as HTMLElement).closest('.config-panel-item__config')) {
      e.preventDefault();
      return;
    }
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
      <button
        type="button"
        className="config-panel-item__config"
        aria-label={t('widgetTemplateConfig.configureAria', { label: displayLabel })}
        title={t('widgetTemplateConfig.configureAria', { label: displayLabel })}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onConfigure(template.type); }}
      >
        <Settings2 size={14} />
      </button>
    </div>
  );
});

export function WidgetsTab() {
  const t = useT();
  const [configType, setConfigType] = useState<string | null>(null);

  return (
    <>
      <div className="config-tab-hint">{t('config.dragOntoGrid')}</div>
      <div className="config-item-list">
        {WIDGET_CATALOG.map(template => (
          <SidebarItem key={template.type} template={template} onConfigure={setConfigType} />
        ))}
      </div>
      {configType && (
        <WidgetTemplateConfigModal type={configType} onClose={() => setConfigType(null)} />
      )}
    </>
  );
}
