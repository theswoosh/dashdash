import { useState, useEffect, useCallback, useRef } from 'react';
import { mutate as swrMutate } from 'swr';
import { X, CheckCircle, XCircle, Loader, Copy, ClipboardPaste, Settings } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useServices } from '../hooks/use-services.hook';
import { findServiceById } from '../utils/service-tree';
import { isValidHealthcheckTarget, sanitizeHealthcheckTarget } from '../utils/healthcheck-target';
import { useSettings, type SearchEngine } from '../hooks/use-settings.hook';
import { getTemplate } from '../widgets/catalog';
import type { ConfigField } from '../widgets/catalog';
import { ServiceIconPicker } from './service-icon-picker.component';
import { BgColorPicker, parseRgba, buildRgba, DEFAULT_BG_HEX, DEFAULT_BG_ALPHA, DEFAULT_FG_HEX, DEFAULT_FG_ALPHA } from './bg-color-picker.component';
import { WidgetTitleField } from './widget-title-field.component';
import { toAbsoluteUrl } from '../widgets/shared/app-icon.component';
import { TimezonePicker } from './timezone-picker.component';
import { ChannelsEditor } from './channels-editor.component';
import { useT } from '../i18n';
import './WidgetConfigModal.css';

interface LinkRow {
  label: string;
  url: string;
  bg?: string | undefined;
  fg?: string | undefined;
}

function isLinkRow(x: unknown): x is LinkRow {
  return typeof x === 'object' && x !== null
    && typeof (x as Record<string, unknown>)['label'] === 'string'
    && typeof (x as Record<string, unknown>)['url'] === 'string';
}

/** Per-bookmark color scheme editor — expands under the row via the gear
 *  button. Own bg/font pickers + copy/paste against the global clipboard,
 *  independent of the widget-level colors (live-issues follow-up). */
function LinkColorPanel({
  row,
  onPatch,
  onClear,
}: {
  readonly row: LinkRow;
  readonly onPatch: (patch: Partial<LinkRow>) => void;
  readonly onClear: () => void;
}) {
  const t = useT();
  const colorClipboard = useUIStore(s => s.colorClipboard);
  const setColorClipboard = useUIStore(s => s.setColorClipboard);
  const bg = row.bg ? parseRgba(row.bg) : null;
  const fg = row.fg ? parseRgba(row.fg) : null;

  return (
    <div className="links-editor__color-panel">
      <div className="links-editor__color-panel-head">
        <span className="wtc-size-label">{t('widgetConfig.bookmarkColors')}</span>
        <span className="color-clipboard-actions">
          <button
            type="button"
            className="color-clipboard-btn"
            onClick={() => setColorClipboard({ bg: row.bg ?? null, fg: row.fg ?? null })}
            title={t('widgetConfig.copyColor')}
            aria-label={t('widgetConfig.copyColor')}
          >
            <Copy size={13} />
          </button>
          {colorClipboard !== null && (
            <button
              type="button"
              className="color-clipboard-btn"
              onClick={() => onPatch({
                ...(colorClipboard.bg ? { bg: colorClipboard.bg } : {}),
                ...(colorClipboard.fg ? { fg: colorClipboard.fg } : {}),
              })}
              title={t('widgetConfig.pasteColor')}
              aria-label={t('widgetConfig.pasteColor')}
            >
              <ClipboardPaste size={13} />
            </button>
          )}
        </span>
      </div>
      <label className="wtc-size-label">{t('widgetConfig.widgetBackground')}</label>
      <BgColorPicker
        hex={bg?.hex ?? DEFAULT_BG_HEX}
        alpha={bg?.alpha ?? DEFAULT_BG_ALPHA}
        hasValue={row.bg != null}
        onChange={(hex, alpha) => onPatch({ bg: buildRgba(hex, alpha) })}
        onReset={() => onClear()}
      />
      <label className="wtc-size-label">{t('widgetConfig.fontColor')}</label>
      <BgColorPicker
        hex={fg?.hex ?? DEFAULT_FG_HEX}
        alpha={fg?.alpha ?? DEFAULT_FG_ALPHA}
        hasValue={row.fg != null}
        onChange={(hex, alpha) => onPatch({ fg: buildRgba(hex, alpha) })}
        onReset={() => onClear()}
      />
    </div>
  );
}

function LinksEditor({
  value,
  onChange,
}: {
  readonly value: unknown;
  readonly onChange: (links: LinkRow[]) => void;
}) {
  const t = useT();
  const [colorRowIndex, setColorRowIndex] = useState<number | null>(null);
  const rows: LinkRow[] = Array.isArray(value) ? value.filter(isLinkRow) : [];

  const updateRow = (i: number, patch: Partial<LinkRow>) => {
    onChange(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  };

  return (
    <div className="links-editor">
      {rows.map((row, i) => (
        <div key={i} className="links-editor__entry">
          <div className="links-editor__row">
            <input
              className="config-input links-editor__label"
              type="text"
              placeholder="Label"
              value={row.label}
              style={{ ...(row.bg ? { background: row.bg } : {}), ...(row.fg ? { color: row.fg } : {}) }}
              onChange={e => updateRow(i, { label: e.target.value })}
            />
            <input
              className="config-input links-editor__url"
              type="url"
              placeholder="https://example.com"
              value={row.url}
              onChange={e => updateRow(i, { url: e.target.value })}
              onBlur={e => {
                // Fallback to https:// so "domain.com" works (live issue #2.1)
                const trimmed = e.target.value.trim();
                const normalized = trimmed === '' ? '' : toAbsoluteUrl(trimmed);
                if (normalized !== row.url) updateRow(i, { url: normalized });
              }}
            />
            <button
              type="button"
              className={`links-editor__color-btn${colorRowIndex === i ? ' links-editor__color-btn--active' : ''}`}
              onClick={() => setColorRowIndex(colorRowIndex === i ? null : i)}
              title={t('widgetConfig.bookmarkColors')}
              aria-label={t('widgetConfig.bookmarkColors')}
              aria-expanded={colorRowIndex === i}
            >
              <Settings size={12} />
            </button>
            <button
              type="button"
              className="links-editor__remove"
              onClick={() => {
                setColorRowIndex(null);
                onChange(rows.filter((_, idx) => idx !== i));
              }}
              aria-label="Remove bookmark"
            >
              ×
            </button>
          </div>
          {colorRowIndex === i && (
            <LinkColorPanel
              row={row}
              onPatch={patch => updateRow(i, patch)}
              onClear={() => onChange(rows.map((r, idx) =>
                idx === i ? { label: r.label, url: r.url } : r,
              ))}
            />
          )}
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
          value={engines.length > 0 && strVal === engines[0]!.id ? '' : strVal}
          onChange={e => onChange(field.key, e.target.value || undefined)}
          disabled={noEngines}
        >
          {noEngines ? (
            <option value="" disabled>{t('widgetConfig.noEnginesConfigured')}</option>
          ) : (
            <>
              {/* Empty value = "use the first configured engine" — shows that
                  engine's real name; the engine is skipped in the explicit
                  list below so it doesn't appear twice (dashtest #17). */}
              <option value="">{engines[0]!.label}</option>
              {engines.slice(1).map(e => (
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

  if (field.type === 'channels-editor') {
    return (
      <div className="config-field">
        <label className="config-label">{label}</label>
        <ChannelsEditor
          value={value}
          onChange={channelIds => onChange(field.key, channelIds)}
        />
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
  const [testDetail, setTestDetail] = useState('');
  const [bgHex, setBgHex] = useState(DEFAULT_BG_HEX);
  const [bgAlpha, setBgAlpha] = useState(DEFAULT_BG_ALPHA);
  const [fgHex, setFgHex] = useState(DEFAULT_FG_HEX);
  const [fgAlpha, setFgAlpha] = useState(DEFAULT_FG_ALPHA);
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

      const rawFg = service.options?.['font_color'];
      const parsedFg = typeof rawFg === 'string' ? parseRgba(rawFg) : null;
      setFgHex(parsedFg?.hex ?? DEFAULT_FG_HEX);
      setFgAlpha(parsedFg?.alpha ?? DEFAULT_FG_ALPHA);
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
    // Editing the check target invalidates a previous Test outcome — a stale
    // green checkmark next to a new target reads as a fake success.
    if (key === 'url' || key === 'port') setTestResult('idle');
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

  const updateFontColor = useCallback((hex: string, alpha: number) => {
    setFgHex(hex);
    setFgAlpha(alpha);
    handleOptionChange('font_color', buildRgba(hex, alpha));
  }, [handleOptionChange]);

  const resetFontColor = useCallback(() => {
    setFgHex(DEFAULT_FG_HEX);
    setFgAlpha(DEFAULT_FG_ALPHA);
    handleOptionChange('font_color', null);
  }, [handleOptionChange]);

  const colorClipboard = useUIStore(s => s.colorClipboard);
  const setColorClipboard = useUIStore(s => s.setColorClipboard);
  const copyColorsToClipboard = useCallback(() => {
    setColorClipboard({
      bg: typeof options['bg_color'] === 'string' ? options['bg_color'] : buildRgba(bgHex, bgAlpha),
      fg: typeof options['font_color'] === 'string' ? options['font_color'] : null,
    });
  }, [setColorClipboard, options, bgHex, bgAlpha]);
  const applyColorClipboard = useCallback(() => {
    if (colorClipboard === null) return;
    if (colorClipboard.bg) {
      const parsed = parseRgba(colorClipboard.bg);
      if (parsed) {
        setBgHex(parsed.hex);
        setBgAlpha(parsed.alpha);
        handleOptionChange('bg_color', colorClipboard.bg);
      }
    }
    if (colorClipboard.fg) {
      const parsed = parseRgba(colorClipboard.fg);
      if (parsed) {
        setFgHex(parsed.hex);
        setFgAlpha(parsed.alpha);
        handleOptionChange('font_color', colorClipboard.fg);
      }
    }
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
    if (isHealthcheck) {
      // Revalidate the shared batch result immediately — otherwise the ping
      // dot shows the pre-save status until the next 30 s poll (dashtest T14).
      void swrMutate(key => Array.isArray(key) && key[0] === '/api/healthcheck/batch');
    }
    setConfigTarget(null);
  };

  const isHealthcheck = service.widget === 'healthcheck';
  const isTinyLayout = options['layoutSize'] === 'tiny';
  const configFields = (template?.configFields ?? []).filter(
    f => !(isTinyLayout && f.key === 'pingIndicator'),
  );

  const runHealthcheckTest = async () => {
    setTestResult('loading');
    setTestDetail('');
    try {
      const res = await fetch('/api/healthcheck/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: options['url'],
          port: options['port'],
        }),
      });
      const healthcheckResult = await res.json() as { status: string; latencyMs?: number; error?: string; resolvedIp?: string };
      if (healthcheckResult.status === 'up') {
        setTestResult('ok');
        // Show latency and the resolved IP so a surprising success (e.g. a
        // router answering DNS for a garbage name) is visible, not hidden.
        const parts = [
          typeof healthcheckResult.latencyMs === 'number' ? `${healthcheckResult.latencyMs} ms` : null,
          healthcheckResult.resolvedIp ?? null,
        ].filter(Boolean);
        setTestDetail(parts.join(' · '));
      } else {
        setTestResult('fail');
        setTestDetail(healthcheckResult.error ?? '');
      }
    } catch {
      setTestResult('fail'); // network error during healthcheck test
      setTestDetail('');
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
                  onClick={copyColorsToClipboard}
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
          <div className="config-field">
            <label className="config-label">{t('widgetConfig.fontColor')}</label>
            <BgColorPicker
              hex={fgHex}
              alpha={fgAlpha}
              hasValue={options['font_color'] != null}
              onChange={updateFontColor}
              onReset={resetFontColor}
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
              {testResult !== 'idle' && testResult !== 'loading' && testDetail && (
                <span className="modal-test-detail">{testDetail}</span>
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
