import { useState } from 'react';
import { useSWRConfig } from 'swr';
import { X } from 'lucide-react';
import { getTemplate } from '../widgets/catalog';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import {
  BgColorPicker,
  parseRgba,
  buildRgba,
  DEFAULT_BG_HEX,
  DEFAULT_BG_ALPHA,
} from './bg-color-picker.component';
import { useT } from '../i18n';
import './WidgetConfigModal.css';

// Mirrors backend MAX_LAYOUT_SIZE_UNITS (config/schemas.ts) — keep in sync.
const MAX_TEMPLATE_SIZE_UNITS = 500;

interface WidgetTemplateConfigModalProps {
  readonly type: string;
  readonly onClose: () => void;
}

export function WidgetTemplateConfigModal({ type, onClose }: WidgetTemplateConfigModalProps) {
  const t = useT();
  const { mutate } = useSWRConfig();
  const widgetTemplates = useWidgetTemplates();
  const current = widgetTemplates.find(tmpl => tmpl.type === type);
  const catalog = getTemplate(type);
  const layoutSizeField = catalog?.configFields.find(f => f.key === 'layoutSize');

  const label = catalog
    ? (catalog.labelKey ? (t(catalog.labelKey) || catalog.label) : catalog.label)
    : type;

  const initialSize = current?.defaultSize ?? catalog?.defaultSize ?? { w: 5, h: 5 };
  const initialBg = typeof current?.defaultOptions?.['bg_color'] === 'string'
    ? parseRgba(current.defaultOptions['bg_color'] as string)
    : null;
  const initialLayoutSize = String(
    current?.defaultOptions?.['layoutSize'] ?? layoutSizeField?.default ?? '',
  );

  const [width, setWidth] = useState(initialSize.w);
  const [height, setHeight] = useState(initialSize.h);
  const [hasBg, setHasBg] = useState(initialBg != null);
  const [bgHex, setBgHex] = useState(initialBg?.hex ?? DEFAULT_BG_HEX);
  const [bgAlpha, setBgAlpha] = useState(initialBg?.alpha ?? DEFAULT_BG_ALPHA);
  const [layoutSize, setLayoutSize] = useState(initialLayoutSize);
  const [isSaving, setIsSaving] = useState(false);

  const clampSize = (n: number) =>
    Math.min(MAX_TEMPLATE_SIZE_UNITS, Math.max(1, Math.round(n)));

  const updateBgColor = (hex: string, alpha: number) => {
    setHasBg(true);
    setBgHex(hex);
    setBgAlpha(alpha);
  };

  const resetBgColor = () => {
    setHasBg(false);
    setBgHex(DEFAULT_BG_HEX);
    setBgAlpha(DEFAULT_BG_ALPHA);
  };

  const saveTemplateDefaults = async () => {
    setIsSaving(true);
    const defaultOptions: Record<string, unknown> = { ...(current?.defaultOptions ?? {}) };
    if (hasBg) defaultOptions['bg_color'] = buildRgba(bgHex, bgAlpha);
    else delete defaultOptions['bg_color'];
    if (layoutSizeField) defaultOptions['layoutSize'] = layoutSize;

    try {
      await fetch(`/api/widget-templates/${encodeURIComponent(type)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultSize: { w: clampSize(width), h: clampSize(height) },
          defaultOptions,
        }),
      });
      await mutate('/api/widget-templates');
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--sm"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t('widgetTemplateConfig.title', { label })}
      >
        <div className="modal-header">
          <span className="modal-title">{t('widgetTemplateConfig.title', { label })}</span>
          <button className="modal-close" onClick={onClose} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="config-field">
            <label className="config-label">{t('widgetTemplateConfig.defaultSize')}</label>
            <div className="wtc-size-row">
              <input
                className="config-input"
                type="number"
                min={1}
                max={MAX_TEMPLATE_SIZE_UNITS}
                value={width}
                aria-label={t('widgetTemplateConfig.width')}
                onChange={e => setWidth(Number(e.target.value))}
              />
              <span className="wtc-size-x">×</span>
              <input
                className="config-input"
                type="number"
                min={1}
                max={MAX_TEMPLATE_SIZE_UNITS}
                value={height}
                aria-label={t('widgetTemplateConfig.height')}
                onChange={e => setHeight(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="config-field">
            <label className="config-label">{t('widgetConfig.widgetBackground')}</label>
            <BgColorPicker
              hex={bgHex}
              alpha={bgAlpha}
              hasValue={hasBg}
              onChange={updateBgColor}
              onReset={resetBgColor}
            />
          </div>

          {layoutSizeField && layoutSizeField.options && (
            <div className="config-field">
              <label className="config-label">{t('widgetTemplateConfig.layoutSize')}</label>
              <select
                className="config-input config-select"
                value={layoutSize}
                onChange={e => setLayoutSize(e.target.value)}
              >
                {layoutSizeField.options.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <div className="modal-footer-actions">
            <button className="modal-btn modal-btn--secondary" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button
              className="modal-btn modal-btn--primary"
              onClick={() => { void saveTemplateDefaults(); }}
              disabled={isSaving}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
