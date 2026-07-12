import { useState, useEffect, useCallback, useRef } from 'react';
import { X, CheckCircle, XCircle, Loader, Copy, ClipboardPaste } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useServices } from '../hooks/use-services.hook';
import { findServiceById } from '../utils/service-tree';
import { isValidHealthcheckTarget, sanitizeHealthcheckTarget } from '../utils/healthcheck-target';
import { useSettings, type SearchEngine } from '../hooks/use-settings.hook';
import { getTemplate } from '../widgets/catalog';
import type { ConfigField } from '../widgets/catalog';
import { ServiceIconPicker } from './service-icon-picker.component';
import { BgColorPicker, parseRgba, buildRgba, DEFAULT_BG_HEX, DEFAULT_BG_ALPHA } from './bg-color-picker.component';
import { WidgetTitleField } from './widget-title-field.component';
import { TimezonePicker } from './timezone-picker.component';
import { useT } from '../i18n';
import './WidgetConfigModal.css';

interface LinkRow {
  label: string;
  url: string;
}

function isLinkRow(x: unknown): x is LinkRow {
  return typeof x === 'object' && x !== null
    && typeof (x as Record<string, unknown>)['label'] === 'string'
    && typeof (x as Record<string, unknown>)['url'] === 'string';
}

function LinksEditor({
  value,
  onChange,
}: {
  readonly value: unknown;
  readonly onChange: (links: LinkRow[]) => void;
}) {
  const rows: LinkRow[] = Array.isArray(value) ? value.filter(isLinkRow) : [];

  const updateRow = (i: number, field: keyof LinkRow, val: string) => {
    onChange(rows.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  return (
    <div className="links-editor">
      {rows.map((row, i) => (
        <div key={i} className="links-editor__row">
          <input
            className="config-input links-editor__label"
            type="text"
            placeholder="Label"
            value={row.label}
            onChange={e => updateRow(i, 'label', e.target.value)}
          />
          <input
            className="config-input links-editor__url"
            type="url"
            placeholder="https://example.com"
            value={row.url}
            onChange={e => updateRow(i, 'url', e.target.value)}
          />
          <button
            type="button"
            className="links-editor__remove"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
            aria-label="Remove bookmark"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="links-editor__add" onClick={() => onChange([...rows, { label: '', url: '' }])}>
        + Add bookmark
      </button>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  engines = [],
  fieldError,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
  engines?: readonly SearchEngine[] | undefined;
  fieldError?: string | undefined;
}) {
  const t = useT();

  if (field.type === 'separator') {
    return <hr className="config-separator" />;
  }

  if (field.type === 'info') {
    return <p className="config-field-info">{field.label}</p>;
  }

  const label = field.labelKey ? (t(field.labelKey) || field.label) : field.label;
  const strVal = value === undefined || value === null ? '' : String(value);

  if (field.type === 'boolean') {
    return (
      <label className="config-field config-field--checkbox">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(field.key, e.target.checked)}
        />
        <span>{label}</span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="config-field">
        <label className="config-label">
          {label}{field.required && ' *'}
          {field.maxLength !== undefined && (
            <span className="config-label__counter">{strVal.length} / {field.maxLength}</span>
          )}
        </label>
        <textarea
          className="config-input config-textarea"
          value={strVal}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          onChange={e => onChange(field.key, e.target.value)}
          rows={2}
        />
      </div>
    );
  }

  if (field.type === 'engines-select') {
    const noEngines = engines.length === 0;
    return (
      <div className="config-field">
        <label className="config-label">{label}</label>
        <select
          className="config-input config-select"
          value={strVal}
          onChange={e => onChange(field.key, e.target.value || undefined)}
          disabled={noEngines}
        >
          {noEngines ? (
            <option value="" disabled>{t('widgetConfig.noEnginesConfigured')}</option>
          ) : (
            <>
              <option value="">{t('widgetConfig.firstAvailableEngine')}</option>
              {engines.map(e => (
                <option key={e.id} value={e.id}>{e.label}</option>
              ))}
            </>
          )}
        </select>
        {noEngines && (
          <p className="config-field-info">{t('widgetConfig.noEnginesHint')}</p>
        )}
      </div>
    );
  }

  if (field.type === 'links-editor') {
    return (
      <div className="config-field">
        <label className="config-label">{label}</label>
        <LinksEditor
          value={value}
          onChange={links => onChange(field.key, links)}
        />
      </div>
    );
  }

  if (field.type === 'timezone-select') {
    return (
      <div className="config-field">
        <label className="config-label">{label}</label>
        <TimezonePicker
          value={strVal}
          placeholder={field.placeholder}
          onChange={tz => onChange(field.key, tz)}
        />
      </div>
    );
  }

  if (field.type === 'select' && field.options) {
    return (
      <div className="config-field">
        <label className="config-label">{label}</label>
        <select
          className="config-input config-select"
          value={strVal}
          onChange={e => onChange(field.key, e.target.value)}
        >
          {field.options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === 'icon-picker') {
    return (
      <div className="config-field">
        <label className="config-label">{label}</label>
        <ServiceIconPicker
          value={strVal}
          onChange={v => onChange(field.key, v)}
        />
      </div>
    );
  }

  return (
    <div className="config-field">
      <label className="config-label">{label}{field.required && ' *'}</label>
      <input
        className="config-input"
        type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        value={strVal}
        placeholder={field.placeholder}
        onChange={e => {
          const val = field.type === 'number'
            ? (e.target.value === '' ? undefined : Number(e.target.value))
            : e.target.value;
          onChange(field.key, val);
        }}
      />
      {fieldError && <p className="config-field-error">{fieldError}</p>}
    </div>
  );
}

export function WidgetConfigModal() {
  const t = useT();
  const configTarget = useUIStore(s => s.configTarget);
  const setConfigTarget = useUIStore(s => s.setConfigTarget);
  const { services, reload: reloadServices } = useServices();
  const allEngines = useSettings().searchEngines ?? [];

  const service = configTarget ? findServiceById(services, configTarget) : undefined;
  const template = service ? getTemplate(service.widget) : undefined;

  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState('');
  const [hideHeader, setHideHeader] = useState(false);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [testResult, setTestResult] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [bgHex, setBgHex] = useState(DEFAULT_BG_HEX);
  const [bgAlpha, setBgAlpha] = useState(DEFAULT_BG_ALPHA);
  const modalRef = useRef<HTMLDivElement>(null);

  const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  useEffect(() => {
    if (!configTarget) return;
    const modal = modalRef.current;
    if (!modal) return;

    const focusables = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
    focusables[0]?.focus();

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setConfigTarget(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const els = modal.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (els.length === 0) return;
      const first = els[0]!;
      const last = els[els.length - 1]!;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', trapFocus);
    return () => document.removeEventListener('keydown', trapFocus);
  }, [configTarget, setConfigTarget]);

  // Sync state when the target widget changes.
  // Dep on service?.id (not the whole object) so SWR revalidations don't
  // reset in-progress edits when the service reference changes.
  useEffect(() => {
    if (service) {
      setTitle(service.title);
      setIcon(service.icon ?? '');
      setHideHeader(service.options?.['hideHeader'] === true);
      setOptions({ ...(service.options ?? {}) });

      const rawBg = service.options?.['bg_color'];
      if (typeof rawBg === 'string') {
        const parsed = parseRgba(rawBg);
        if (parsed) {
          setBgHex(parsed.hex);
          setBgAlpha(parsed.alpha);
        }
      } else {
        setBgHex(DEFAULT_BG_HEX);
        setBgAlpha(DEFAULT_BG_ALPHA);
      }
    }
    setTestResult('idle');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service?.id]);

  const handleHideHeaderChange = useCallback((hide: boolean) => {
    setHideHeader(hide);
    setOptions(prev => ({ ...prev, hideHeader: hide }));
  }, []);

  const handleOptionChange = useCallback((key: string, val: unknown) => {
    // 'icon' is a service-level field, not stored in options
    if (key === 'icon') {
      setIcon(typeof val === 'string' ? val : '');
      return;
    }
    setOptions(prev => ({ ...prev, [key]: val }));
    setFieldErrors(prev => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const updateBgColor = useCallback((hex: string, alpha: number) => {
    setBgHex(hex);
    setBgAlpha(alpha);
    handleOptionChange('bg_color', buildRgba(hex, alpha));
  }, [handleOptionChange]);

  const resetBgColor = useCallback(() => {
    setBgHex(DEFAULT_BG_HEX);
    setBgAlpha(DEFAULT_BG_ALPHA);
    handleOptionChange('bg_color', null);
  }, [handleOptionChange]);

  const colorClipboard = useUIStore(s => s.colorClipboard);
  const setColorClipboard = useUIStore(s => s.setColorClipboard);
  const applyColorClipboard = useCallback(() => {
    if (colorClipboard === null) return;
    const parsed = parseRgba(colorClipboard);
    if (!parsed) return;
    setBgHex(parsed.hex);
    setBgAlpha(parsed.alpha);
    handleOptionChange('bg_color', colorClipboard);
  }, [colorClipboard, handleOptionChange]);

  if (!configTarget || !service) return null;

  const saveWidgetConfiguration = async () => {
    const errors: Record<string, string> = {};
    for (const field of configFields) {
      if (field.required && options[field.key] === '') {
        errors[field.key] = t('widgetConfig.fieldRequired');
      }
    }
    const cleanedOptions = { ...options };
    if (isHealthcheck && typeof cleanedOptions['url'] === 'string') {
      const target = sanitizeHealthcheckTarget(cleanedOptions['url']);
      cleanedOptions['url'] = target;
      if (!isValidHealthcheckTarget(target)) {
        errors['url'] = t('widgetConfig.invalidHost');
      }
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    await fetch(`/api/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, icon: icon || undefined, options: cleanedOptions }),
    });
    await reloadServices();
    setConfigTarget(null);
  };

  const isHealthcheck = service.widget === 'healthcheck';
  const isTinyLayout = options['layoutSize'] === 'tiny';
  const configFields = (template?.configFields ?? []).filter(
    f => !(isTinyLayout && f.key === 'pingIndicator'),
  );

  const runHealthcheckTest = async () => {
    setTestResult('loading');
    try {
      const res = await fetch('/api/healthcheck/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: options['url'],
          port: options['port'],
        }),
      });
      const healthcheckResult = await res.json() as { status: string };
      setTestResult(healthcheckResult.status === 'up' ? 'ok' : 'fail');
    } catch {
      setTestResult('fail'); // network error during healthcheck test
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => setConfigTarget(null)}>
      <div ref={modalRef} className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('widgetConfig.configure', { title: service.title })}>
        <div className="modal-header">
          <span className="modal-title">{t('widgetConfig.configure', { title: service.title })}</span>
          <button className="modal-close" onClick={() => setConfigTarget(null)} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <WidgetTitleField
            title={title}
            hideHeader={hideHeader}
            isTinyLayout={isTinyLayout}
            onTitleChange={setTitle}
            onHideHeaderChange={handleHideHeaderChange}
          />

          {configFields.length > 0 ? (
            configFields.map(field => (
              <FieldInput
                key={field.key}
                field={field}
                value={field.type === 'icon-picker' ? icon : (options[field.key] ?? field.default)}
                onChange={handleOptionChange}
                engines={allEngines}
                fieldError={fieldErrors[field.key]}
              />
            ))
          ) : (
            configFields.length === 0 && template && (
              <p className="modal-no-fields">{t('widgetConfig.noOptions')}</p>
            )
          )}

          <hr className="config-separator" />
          <div className="config-field">
            <label className="config-label">
              {t('widgetConfig.widgetBackground')}
              <span className="color-clipboard-actions">
                <button
                  type="button"
                  className="color-clipboard-btn"
                  onClick={() => setColorClipboard(buildRgba(bgHex, bgAlpha))}
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
              hasValue={options['bg_color'] != null}
              onChange={updateBgColor}
              onReset={resetBgColor}
            />
          </div>
        </div>
        <div className="modal-footer">
          {isHealthcheck && (
            <div className="modal-test-group">
              <button
                className="modal-btn modal-btn--secondary"
                onClick={() => { void runHealthcheckTest(); }}
                disabled={testResult === 'loading'}
              >
                {testResult === 'loading' ? <Loader size={13} className="modal-test-spinner" /> : null}
                {t('widgetConfig.test')}
              </button>
              {testResult === 'ok' && (
                <span className="modal-test-result modal-test-result--ok" title={t('widgetCard.up')}>
                  <CheckCircle size={16} />
                </span>
              )}
              {testResult === 'fail' && (
                <span className="modal-test-result modal-test-result--fail" title={t('widgetCard.down')}>
                  <XCircle size={16} />
                </span>
              )}
            </div>
          )}
          <div className="modal-footer-actions">
            <button className="modal-btn modal-btn--secondary" onClick={() => setConfigTarget(null)}>
              {t('common.cancel')}
            </button>
            <button
              className="modal-btn modal-btn--primary"
              onClick={() => { void saveWidgetConfiguration(); }}
            >
              {t('common.save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
