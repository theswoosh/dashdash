import { useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useServices } from '../hooks/use-services.hook';
import { getTemplate } from '../widgets/catalog';
import type { ConfigField } from '../widgets/catalog';
import './WidgetConfigModal.css';

const DEFAULT_BG_HEX = '#4488ff';
const DEFAULT_BG_ALPHA = 0.2;

function parseRgba(rgba: string): { hex: string; alpha: number } | null {
  const m = rgba.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
  if (!m) return null;
  const r = parseInt(m[1]!, 10);
  const g = parseInt(m[2]!, 10);
  const b = parseInt(m[3]!, 10);
  const alpha = m[4] !== undefined ? parseFloat(m[4]) : 1;
  const hex = '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
  return { hex, alpha };
}

function buildRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}) {
  if (field.type === 'separator') {
    return <hr className="config-separator" />;
  }

  const strVal = value === undefined || value === null ? '' : String(value);

  if (field.type === 'boolean') {
    return (
      <label className="config-field config-field--checkbox">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={e => onChange(field.key, e.target.checked)}
        />
        <span>{field.label}</span>
      </label>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className="config-field">
        <label className="config-label">
          {field.label}{field.required && ' *'}
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

  if (field.type === 'select' && field.options) {
    return (
      <div className="config-field">
        <label className="config-label">{field.label}</label>
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

  return (
    <div className="config-field">
      <label className="config-label">{field.label}{field.required && ' *'}</label>
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
    </div>
  );
}

export function WidgetConfigModal() {
  const configTarget = useUIStore(s => s.configTarget);
  const setConfigTarget = useUIStore(s => s.setConfigTarget);
  const { services, reload: reloadServices } = useServices();

  const service = services.find(s => s.id === configTarget);
  const template = service ? getTemplate(service.widget) : undefined;

  const [title, setTitle] = useState('');
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [testResult, setTestResult] = useState<'idle' | 'loading' | 'ok' | 'fail'>('idle');
  const [bgHex, setBgHex] = useState(DEFAULT_BG_HEX);
  const [bgAlpha, setBgAlpha] = useState(DEFAULT_BG_ALPHA);

  // Sync state when target changes
  useEffect(() => {
    if (service) {
      setTitle(service.title);
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
  }, [service]);

  if (!configTarget || !service) return null;

  const handleOptionChange = useCallback((key: string, val: unknown) => {
    setOptions(prev => ({ ...prev, [key]: val }));
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

  const saveWidgetConfiguration = async () => {
    await fetch(`/api/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, options }),
    });
    await reloadServices();
    setConfigTarget(null);
  };

  const configFields = template?.configFields ?? [];
  const isHealthcheck = service.widget === 'healthcheck';

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
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Configure widget">
        <div className="modal-header">
          <span className="modal-title">Configure: {service.title}</span>
          <button className="modal-close" onClick={() => setConfigTarget(null)} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">
          <div className="config-field">
            <label className="config-label">Widget title</label>
            <input
              className="config-input"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
          </div>

          {configFields.length > 0 ? (
            configFields.map(field => (
              <FieldInput
                key={field.key}
                field={field}
                value={options[field.key] ?? field.default}
                onChange={handleOptionChange}
              />
            ))
          ) : (
            configFields.length === 0 && template && (
              <p className="modal-no-fields">This widget has no configurable options.</p>
            )
          )}

          <hr className="config-separator" />
          <div className="config-field">
            <label className="config-label">
              Widget background
              {options['bg_color'] != null && (
                <button className="config-reset-link" onClick={resetBgColor} type="button">
                  Reset
                </button>
              )}
            </label>
            <div className="config-bg-picker">
              <input
                type="color"
                className="config-color-input"
                value={bgHex}
                onChange={e => updateBgColor(e.target.value, bgAlpha)}
                title="Background color"
              />
              <input
                type="range"
                className="config-alpha-slider"
                min="0"
                max="100"
                value={Math.round(bgAlpha * 100)}
                onChange={e => updateBgColor(bgHex, parseInt(e.target.value, 10) / 100)}
                title="Opacity"
              />
              <span className="config-alpha-value">{Math.round(bgAlpha * 100)}%</span>
              {options['bg_color'] != null && (
                <div
                  className="config-bg-preview"
                  style={{ background: typeof options['bg_color'] === 'string' ? options['bg_color'] : undefined }}
                />
              )}
            </div>
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
                Test
              </button>
              {testResult === 'ok' && (
                <span className="modal-test-result modal-test-result--ok" title="Reachable">
                  <CheckCircle size={16} />
                </span>
              )}
              {testResult === 'fail' && (
                <span className="modal-test-result modal-test-result--fail" title="Unreachable">
                  <XCircle size={16} />
                </span>
              )}
            </div>
          )}
          <div className="modal-footer-actions">
            <button className="modal-btn modal-btn--secondary" onClick={() => setConfigTarget(null)}>
              Cancel
            </button>
            <button
              className="modal-btn modal-btn--primary"
              onClick={() => { void saveWidgetConfiguration(); }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
