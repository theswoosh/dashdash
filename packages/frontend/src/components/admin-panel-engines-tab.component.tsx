import { useState } from 'react';
import { mutate } from 'swr';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { useSettings } from '../hooks/use-settings.hook';
import { useT } from '../i18n';

const SETTINGS_KEY = '/api/settings';

interface SearchEngine {
  id: string;
  label: string;
  url: string;
  placeholder?: string | undefined;
}

async function apiCall(url: string, method: string, body?: unknown): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : null,
  });
  return res.json() as Promise<{ ok?: boolean; error?: string }>;
}

function AddEngineForm({ onDone }: { onDone: () => void }) {
  const t = useT();
  const [id, setId] = useState('');
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAddEngine(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!url.includes('{query}')) {
      setError('URL must contain {query}');
      return;
    }
    setIsSubmitting(true);
    const body: Record<string, string> = { id, label, url };
    if (placeholder) body['placeholder'] = placeholder;
    const result = await apiCall('/api/settings/search-engines', 'POST', body);
    setIsSubmitting(false);
    if (result.error) { setError(result.error); return; }
    await mutate(SETTINGS_KEY);
    onDone();
  }

  return (
    <form className="admin-add-form" onSubmit={e => void submitAddEngine(e)}>
      <h3 className="admin-add-title">{t('admin.engineDetails')}</h3>
      {error && <p className="admin-error">{error}</p>}

      <div className="admin-add-row">
        <div className="admin-field">
          <label className="admin-label" htmlFor="engine-label">{t('admin.engineLabel')}</label>
          <input id="engine-label" className="admin-input" value={label} onChange={e => setLabel(e.target.value)} required maxLength={64} />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="engine-id">{t('admin.engineId')}</label>
          <input id="engine-id" className="admin-input" value={id} onChange={e => setId(e.target.value)} required maxLength={64} pattern="[a-z0-9\-]+" title="lowercase letters, digits, hyphens" />
        </div>
      </div>
      <div className="admin-add-row">
        <div className="admin-field">
          <label className="admin-label" htmlFor="engine-url">{t('admin.engineUrl')}</label>
          <input id="engine-url" className="admin-input" value={url} onChange={e => setUrl(e.target.value)} required placeholder="https://example.com/search?q={query}" />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="engine-placeholder">{t('admin.enginePlaceholder')}</label>
          <input id="engine-placeholder" className="admin-input" value={placeholder} onChange={e => setPlaceholder(e.target.value)} maxLength={64} />
        </div>
      </div>

      <div className="admin-add-actions">
        <button type="button" className="admin-btn admin-btn--ghost" onClick={onDone}>{t('common.cancel')}</button>
        <button type="submit" className="admin-btn" disabled={isSubmitting}>
          {isSubmitting ? t('admin.creating') : t('admin.saveEngine')}
        </button>
      </div>
    </form>
  );
}

function EditEngineForm({ engine, onDone }: { engine: SearchEngine; onDone: () => void }) {
  const t = useT();
  const [id, setId] = useState(engine.id);
  const [label, setLabel] = useState(engine.label);
  const [url, setUrl] = useState(engine.url);
  const [placeholder, setPlaceholder] = useState(engine.placeholder ?? '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitEditEngine(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!url.includes('{query}')) {
      setError('URL must contain {query}');
      return;
    }
    setIsSubmitting(true);
    const body: Record<string, string> = { id, label, url };
    if (placeholder) body['placeholder'] = placeholder;
    const result = await apiCall(`/api/settings/search-engines/${engine.id}`, 'PUT', body);
    setIsSubmitting(false);
    if (result.error) { setError(result.error); return; }
    await mutate(SETTINGS_KEY);
    onDone();
  }

  return (
    <form className="admin-add-form admin-add-form--inline" onSubmit={e => void submitEditEngine(e)}>
      {error && <p className="admin-error">{error}</p>}
      <div className="admin-add-row">
        <div className="admin-field">
          <label className="admin-label" htmlFor={`edit-label-${engine.id}`}>{t('admin.engineLabel')}</label>
          <input id={`edit-label-${engine.id}`} className="admin-input" value={label} onChange={e => setLabel(e.target.value)} required maxLength={64} />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor={`edit-id-${engine.id}`}>{t('admin.engineId')}</label>
          <input id={`edit-id-${engine.id}`} className="admin-input" value={id} onChange={e => setId(e.target.value)} required maxLength={64} pattern="[a-z0-9\-]+" title="lowercase letters, digits, hyphens" />
        </div>
      </div>
      <div className="admin-add-row">
        <div className="admin-field">
          <label className="admin-label" htmlFor={`edit-url-${engine.id}`}>{t('admin.engineUrl')}</label>
          <input id={`edit-url-${engine.id}`} className="admin-input" value={url} onChange={e => setUrl(e.target.value)} required />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor={`edit-ph-${engine.id}`}>{t('admin.enginePlaceholder')}</label>
          <input id={`edit-ph-${engine.id}`} className="admin-input" value={placeholder} onChange={e => setPlaceholder(e.target.value)} maxLength={64} />
        </div>
      </div>
      <div className="admin-add-actions">
        <button type="button" className="admin-btn admin-btn--ghost" onClick={onDone}>{t('common.cancel')}</button>
        <button type="submit" className="admin-btn" disabled={isSubmitting}>
          {isSubmitting ? t('admin.creating') : t('admin.saveEngine')}
        </button>
      </div>
    </form>
  );
}

export function SearchEnginesTab() {
  const t = useT();
  const settings = useSettings();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [isActionInFlight, setIsActionInFlight] = useState(false);

  const engines = settings.searchEngines ?? [];

  async function deleteEngine(id: string) {
    if (isActionInFlight) return;
    setActionError('');
    setIsActionInFlight(true);
    const result = await apiCall(`/api/settings/search-engines/${id}`, 'DELETE');
    setIsActionInFlight(false);
    if (result.error) { setActionError(result.error); return; }
    await mutate(SETTINGS_KEY);
  }

  return (
    <>
      <div className="admin-section-header">
        <span className="admin-section-label">{t('admin.searchEngines')}</span>
        <button className="admin-btn admin-btn--sm" onClick={() => { setIsAdding(p => !p); setEditingId(null); }}>
          <Plus size={13} /> {t('admin.addEngine')}
        </button>
      </div>

      {actionError && <p className="admin-error">{actionError}</p>}

      {isAdding && <AddEngineForm onDone={() => setIsAdding(false)} />}

      <div className="admin-engine-list">
        {engines.length === 0 && !isAdding && (
          <p className="admin-loading">{t('admin.noEngines')}</p>
        )}
        {engines.map(engine => (
          <div key={engine.id} className="admin-engine-row">
            {editingId === engine.id ? (
              <EditEngineForm engine={engine} onDone={() => setEditingId(null)} />
            ) : (
              <>
                <div className="admin-engine-info">
                  <span className="admin-engine-label">{engine.label}</span>
                  <span className="admin-engine-meta">{engine.id} — {engine.url}</span>
                </div>
                <div className="admin-user-actions">
                  <button
                    className="admin-icon-btn"
                    title={t('admin.editEngine')}
                    onClick={() => { setEditingId(engine.id); setIsAdding(false); }}
                    disabled={isActionInFlight}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="admin-icon-btn admin-icon-btn--danger"
                    title={t('admin.deleteEngine')}
                    onClick={() => void deleteEngine(engine.id)}
                    disabled={isActionInFlight}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
