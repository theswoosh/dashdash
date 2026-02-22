import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useServices } from '../hooks/useServices';
import { getTemplate } from '../widgets/catalog';
import type { ConfigField } from '../widgets/catalog';
import './WidgetConfigModal.css';

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
}) {
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
        <label className="config-label">{field.label}{field.required && ' *'}</label>
        <textarea
          className="config-input config-textarea"
          value={strVal}
          placeholder={field.placeholder}
          onChange={e => onChange(field.key, e.target.value)}
          rows={3}
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
          const val = field.type === 'number' ? Number(e.target.value) : e.target.value;
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

  // Sync state when target changes
  useEffect(() => {
    if (service) {
      setTitle(service.title);
      setOptions({ ...(service.options ?? {}) });
    }
  }, [service]);

  if (!configTarget || !service) return null;

  const handleOptionChange = (key: string, val: unknown) => {
    setOptions(prev => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    await fetch(`/api/services/${service.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, options }),
    });
    await reloadServices();
    setConfigTarget(null);
  };

  const configFields = template?.configFields ?? [];

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
        </div>
        <div className="modal-footer">
          <button className="modal-btn modal-btn--secondary" onClick={() => setConfigTarget(null)}>
            Cancel
          </button>
          <button
            className="modal-btn modal-btn--primary"
            onClick={() => { void handleSave(); }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
