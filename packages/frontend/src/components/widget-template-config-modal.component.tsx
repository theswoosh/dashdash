import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSWRConfig } from 'swr';
import { X, Copy, ClipboardPaste } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { getTemplate } from '../widgets/catalog';
import { useWidgetTemplates } from '../hooks/use-widget-templates.hook';
import {
  BgColorPicker,
  parseRgba,
  buildRgba,
} from './bg-color-picker.component';
import { getThemeColorDefaults } from '../utils/theme-color-defaults';
import { useT } from '../i18n';
import './WidgetConfigModal.css';

// Mirrors backend MAX_LAYOUT_SIZE_UNITS (config/schemas.ts) — keep in sync.
const MAX_TEMPLATE_SIZE_UNITS = 500;

// Stats widget colour thresholds — template-level so every instance shares them.
const DEFAULT_THRESHOLD_WARN = 65;
const DEFAULT_THRESHOLD_CRIT = 85;

interface ThresholdPair { warn: number; crit: number }

const METRIC_LABEL_KEY: Record<'cpu' | 'mem' | 'disk', string> = {
  cpu: 'widgetTemplateConfig.thresholdCpu',
  mem: 'widgetTemplateConfig.thresholdMem',
  disk: 'widgetTemplateConfig.thresholdDisk',
};
interface StatsThresholds { cpu: ThresholdPair; mem: ThresholdPair; disk: ThresholdPair }

function readThresholds(defaultOptions: Record<string, unknown> | undefined): StatsThresholds {
  const fallback: ThresholdPair = { warn: DEFAULT_THRESHOLD_WARN, crit: DEFAULT_THRESHOLD_CRIT };
  const root = defaultOptions?.['thresholds'];
  const readPair = (key: string): ThresholdPair => {
    if (typeof root !== 'object' || root === null) return fallback;
    const entry = (root as Record<string, unknown>)[key];
    if (typeof entry !== 'object' || entry === null) return fallback;
    const { warn, crit } = entry as Record<string, unknown>;
    return {
      warn: typeof warn === 'number' ? warn : fallback.warn,
      crit: typeof crit === 'number' ? crit : fallback.crit,
    };
  };
  return { cpu: readPair('cpu'), mem: readPair('mem'), disk: readPair('disk') };
}

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
  const initialFg = typeof current?.defaultOptions?.['font_color'] === 'string'
    ? parseRgba(current.defaultOptions['font_color'] as string)
    : null;
  const themeDefaults = getThemeColorDefaults();
  const initialLayoutSize = String(
    current?.defaultOptions?.['layoutSize'] ?? layoutSizeField?.default ?? '',
  );

  const isStats = type === 'stats';

  const [width, setWidth] = useState(initialSize.w);
  const [height, setHeight] = useState(initialSize.h);
  const [hasBg, setHasBg] = useState(initialBg != null);
  const [bgHex, setBgHex] = useState(initialBg?.hex ?? themeDefaults.bg.hex);
  const [bgAlpha, setBgAlpha] = useState(initialBg?.alpha ?? themeDefaults.bg.alpha);
  const [hasFg, setHasFg] = useState(initialFg != null);
  const [fgHex, setFgHex] = useState(initialFg?.hex ?? themeDefaults.fg.hex);
  const [fgAlpha, setFgAlpha] = useState(initialFg?.alpha ?? themeDefaults.fg.alpha);
  const [layoutSize, setLayoutSize] = useState(initialLayoutSize);
  const [thresholds, setThresholds] = useState<StatsThresholds>(() => readThresholds(current?.defaultOptions));
  const [thresholdError, setThresholdError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const clampPct = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  const updateThreshold = (metric: 'cpu' | 'mem' | 'disk', bound: 'warn' | 'crit', raw: number) => {
    setThresholdError(false);
    setThresholds(prev => ({ ...prev, [metric]: { ...prev[metric], [bound]: clampPct(raw) } }));
  };

  const clampSize = (n: number) =>
    Math.min(MAX_TEMPLATE_SIZE_UNITS, Math.max(1, Math.round(n)));

  const updateBgColor = (hex: string, alpha: number) => {
    setHasBg(true);
    setBgHex(hex);
    setBgAlpha(alpha);
  };

  const updateFontColor = (hex: string, alpha: number) => {
    setHasFg(true);
    setFgHex(hex);
    setFgAlpha(alpha);
  };

  // Escape closes the popup (dashtest #25) — it renders in a portal, so a
  // document-level listener is the reliable path.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const colorClipboard = useUIStore(s => s.colorClipboard);
  const setColorClipboard = useUIStore(s => s.setColorClipboard);
  const applyColorClipboard = () => {
    if (colorClipboard === null) return;
    if (colorClipboard.bg != null) {
      const parsed = parseRgba(colorClipboard.bg);
      if (parsed) {
        setHasBg(true);
        setBgHex(parsed.hex);
        setBgAlpha(parsed.alpha);
      }
    }
    if (colorClipboard.fg != null) {
      const parsed = parseRgba(colorClipboard.fg);
      if (parsed) {
        setHasFg(true);
        setFgHex(parsed.hex);
        setFgAlpha(parsed.alpha);
      }
    }
  };

  const resetBgColor = () => {
    setHasBg(false);
    const defaults = getThemeColorDefaults();
    setBgHex(defaults.bg.hex);
    setBgAlpha(defaults.bg.alpha);
  };

  const resetFontColor = () => {
    setHasFg(false);
    const defaults = getThemeColorDefaults();
    setFgHex(defaults.fg.hex);
    setFgAlpha(defaults.fg.alpha);
  };

  const saveTemplateDefaults = async () => {
    if (isStats && (thresholds.cpu.warn >= thresholds.cpu.crit || thresholds.mem.warn >= thresholds.mem.crit || thresholds.disk.warn >= thresholds.disk.crit)) {
      setThresholdError(true);
      return;
    }
    setIsSaving(true);
    const defaultOptions: Record<string, unknown> = { ...(current?.defaultOptions ?? {}) };
    if (hasBg) defaultOptions['bg_color'] = buildRgba(bgHex, bgAlpha);
    else delete defaultOptions['bg_color'];
    if (hasFg) defaultOptions['font_color'] = buildRgba(fgHex, fgAlpha);
    else delete defaultOptions['font_color'];
    if (layoutSizeField) defaultOptions['layoutSize'] = layoutSize;
    if (isStats) defaultOptions['thresholds'] = thresholds;

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

  // Portal to <body>: the config panel's transform/backdrop-filter creates a
  // containing block that would re-anchor this fixed-position modal to the panel.
  return createPortal(
    <div className="chrome modal-backdrop" onClick={onClose}>
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
              <label className="wtc-size-field">
                <span className="wtc-size-label">{t('widgetTemplateConfig.width')}</span>
                <input
                  className="config-input"
                  type="number"
                  min={1}
                  max={MAX_TEMPLATE_SIZE_UNITS}
                  value={width}
                  onChange={e => setWidth(Number(e.target.value))}
                />
              </label>
              <span className="wtc-size-x">×</span>
              <label className="wtc-size-field">
                <span className="wtc-size-label">{t('widgetTemplateConfig.height')}</span>
                <input
                  className="config-input"
                  type="number"
                  min={1}
                  max={MAX_TEMPLATE_SIZE_UNITS}
                  value={height}
                  onChange={e => setHeight(Number(e.target.value))}
                />
              </label>
            </div>
          </div>

          <div className="config-field">
            <label className="config-label">
              {t('widgetConfig.widgetBackground')}
              <span className="color-clipboard-actions">
                <button
                  type="button"
                  className="color-clipboard-btn"
                  onClick={() => setColorClipboard({
                    bg: buildRgba(bgHex, bgAlpha),
                    fg: hasFg ? buildRgba(fgHex, fgAlpha) : null,
                  })}
                  title={t('widgetConfig.copyColor')}
                  aria-label={t('widgetConfig.copyColor')}
                >
                  <Copy size={13} />
                </button>
                {colorClipboard !== null && (
                  <button
                    type="button"
                    className="color-clipboard-btn"
                    onClick={applyColorClipboard}
                    title={t('widgetConfig.pasteColor')}
                    aria-label={t('widgetConfig.pasteColor')}
                  >
                    <ClipboardPaste size={13} />
                  </button>
                )}
              </span>
            </label>
            <BgColorPicker
              hex={bgHex}
              alpha={bgAlpha}
              hasValue={hasBg}
              onChange={updateBgColor}
              onReset={resetBgColor}
            />
          </div>

          <div className="config-field">
            <label className="config-label">{t('widgetConfig.fontColor')}</label>
            <BgColorPicker
              hex={fgHex}
              alpha={fgAlpha}
              hasValue={hasFg}
              onChange={updateFontColor}
              onReset={resetFontColor}
            />
          </div>

          {isStats && (
            <div className="config-field">
              <label className="config-label">{t('widgetTemplateConfig.thresholds')}</label>
              {(['cpu', 'mem', 'disk'] as const).map(metric => (
                <div className="wtc-size-row wtc-threshold-row" key={metric}>
                  <span className="wtc-threshold-metric">
                    {t(METRIC_LABEL_KEY[metric])}
                  </span>
                  <label className="wtc-size-field">
                    <span className="wtc-size-label">{t('widgetTemplateConfig.thresholdWarn')}</span>
                    <input
                      className="config-input"
                      type="number"
                      min={0}
                      max={100}
                      value={thresholds[metric].warn}
                      onChange={e => updateThreshold(metric, 'warn', Number(e.target.value))}
                    />
                  </label>
                  <label className="wtc-size-field">
                    <span className="wtc-size-label">{t('widgetTemplateConfig.thresholdCrit')}</span>
                    <input
                      className="config-input"
                      type="number"
                      min={0}
                      max={100}
                      value={thresholds[metric].crit}
                      onChange={e => updateThreshold(metric, 'crit', Number(e.target.value))}
                    />
                  </label>
                </div>
              ))}
              {thresholdError && (
                <span className="field-error">{t('widgetTemplateConfig.thresholdOrderError')}</span>
              )}
            </div>
          )}

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
    </div>,
    document.body,
  );
}
