import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { X, Plus, Trash2, ShieldCheck, ShieldOff, UserX, RefreshCw, Pencil } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import { useSettings } from '../hooks/use-settings.hook';
import './admin-panel.css';

interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
}

type AdminTab = 'users' | 'search-engines';

const USERS_KEY = '/api/users';
const SETTINGS_KEY = '/api/settings';

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function apiCall(url: string, method: string, body?: unknown): Promise<{ ok?: boolean; error?: string }> {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : null,
  });
  return res.json() as Promise<{ ok?: boolean; error?: string }>;
}

interface AddUserFormProps {
  onDone: () => void;
}

function AddUserForm({ onDone }: AddUserFormProps) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submitAddUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    const result = await apiCall('/api/users', 'POST', { email, name, password, role });
    setIsSubmitting(false);
    if (result.error) { setError(result.error); return; }
    await mutate(USERS_KEY);
    onDone();
  }

  return (
    <form className="admin-add-form" onSubmit={e => void submitAddUser(e)}>
      <h3 className="admin-add-title">{t('admin.addUser')}</h3>
      {error && <p className="admin-error">{error}</p>}

      <div className="admin-add-row">
        <div className="admin-field">
          <label className="admin-label" htmlFor="add-name">{t('admin.name')}</label>
          <input id="add-name" className="admin-input" value={name} onChange={e => setName(e.target.value)} required maxLength={100} />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="add-email">{t('login.email')}</label>
          <input id="add-email" className="admin-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
      </div>
      <div className="admin-add-row">
        <div className="admin-field">
          <label className="admin-label" htmlFor="add-pw">{t('admin.password')}</label>
          <input id="add-pw" className="admin-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="add-role">{t('admin.role')}</label>
          <select id="add-role" className="admin-input admin-select" value={role} onChange={e => setRole(e.target.value as 'user' | 'admin')}>
            <option value="user">{t('admin.roleUser')}</option>
            <option value="admin">{t('admin.roleAdmin')}</option>
          </select>
        </div>
      </div>

      <div className="admin-add-actions">
        <button type="button" className="admin-btn admin-btn--ghost" onClick={onDone}>{t('common.cancel')}</button>
        <button type="submit" className="admin-btn" disabled={isSubmitting}>
          {isSubmitting ? t('admin.creating') : t('admin.addUser')}
        </button>
      </div>
    </form>
  );
}

interface AddEngineFormProps {
  onDone: () => void;
}

function AddEngineForm({ onDone }: AddEngineFormProps) {
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
      <h3 className="admin-add-title">{t('admin.addEngine')}</h3>
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
          {isSubmitting ? t('admin.creating') : t('admin.addEngine')}
        </button>
      </div>
    </form>
  );
}

interface SearchEngine {
  id: string;
  label: string;
  url: string;
  placeholder?: string | undefined;
}

interface EditEngineFormProps {
  engine: SearchEngine;
  onDone: () => void;
}

function EditEngineForm({ engine, onDone }: EditEngineFormProps) {
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

function SearchEnginesTab() {
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

      {isAdding && (
        <AddEngineForm onDone={() => setIsAdding(false)} />
      )}

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

export function AdminPanel() {
  const t = useT();
  const isAdminPanelOpen = useUIStore(s => s.isAdminPanelOpen);
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isActionInFlight, setIsActionInFlight] = useState(false);

  const { data: users } = useSWR<UserSummary[]>(isAdminPanelOpen ? USERS_KEY : null, jsonFetcher);

  if (!isAdminPanelOpen) return null;

  async function performAction(fn: () => Promise<{ ok?: boolean; error?: string }>) {
    if (isActionInFlight) return;
    setActionError('');
    setIsActionInFlight(true);
    const result = await fn();
    setIsActionInFlight(false);
    if (result.error) { setActionError(result.error); return; }
    await mutate(USERS_KEY);
  }

  function deleteUser(user: UserSummary) {
    void performAction(() => apiCall(`/api/users/${user.id}`, 'DELETE'));
  }

  function toggleRole(user: UserSummary) {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    void performAction(() => apiCall(`/api/users/${user.id}`, 'PATCH', { role: newRole }));
  }

  function toggleActive(user: UserSummary) {
    void performAction(() => apiCall(`/api/users/${user.id}`, 'PATCH', { isActive: !user.isActive }));
  }

  function resetPassword(user: UserSummary) {
    void performAction(() => apiCall(`/api/users/${user.id}/reset-password`, 'POST'));
  }

  return (
    <div className="admin-overlay" onClick={() => setAdminPanelOpen(false)}>
      <div className="admin-panel" onClick={e => e.stopPropagation()}>
        <div className="admin-header">
          <h2 className="admin-title">{t('admin.adminPanel')}</h2>
          <button className="admin-close" onClick={() => setAdminPanelOpen(false)} aria-label={t('common.close')}>
            <X size={18} />
          </button>
        </div>

        <div className="admin-tabs">
          <button
            className={`admin-tab${activeTab === 'users' ? ' admin-tab--active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            {t('admin.users')}
          </button>
          <button
            className={`admin-tab${activeTab === 'search-engines' ? ' admin-tab--active' : ''}`}
            onClick={() => setActiveTab('search-engines')}
          >
            {t('admin.searchEngines')}
          </button>
        </div>

        <div className="admin-body">
          {activeTab === 'users' && (
            <>
              <div className="admin-section-header">
                <span className="admin-section-label">{t('admin.users')}</span>
                <button className="admin-btn admin-btn--sm" onClick={() => setIsAddingUser(p => !p)}>
                  <Plus size={13} /> {t('admin.addUser')}
                </button>
              </div>

              {actionError && <p className="admin-error">{actionError}</p>}

              {isAddingUser && (
                <AddUserForm onDone={() => setIsAddingUser(false)} />
              )}

              <div className="admin-user-list">
                {!users && <p className="admin-loading">{t('common.loading')}</p>}
                {users?.map(user => (
                  <div key={user.id} className={`admin-user-row${!user.isActive ? ' admin-user-row--inactive' : ''}`}>
                    <div className="admin-user-info">
                      <span className="admin-user-name">{user.name}</span>
                      <span className="admin-user-email">{user.email}</span>
                    </div>
                    <div className="admin-user-meta">
                      <span className={`admin-role-badge${user.role === 'admin' ? ' admin-role-badge--admin' : ''}`}>
                        {user.role}
                      </span>
                      {!user.isActive && <span className="admin-disabled-badge">{t('admin.disabled')}</span>}
                    </div>
                    <div className="admin-user-actions">
                      <button
                        className="admin-icon-btn"
                        title={user.role === 'admin' ? t('admin.demoteToUser') : t('admin.promoteToAdmin')}
                        onClick={() => toggleRole(user)}
                        disabled={isActionInFlight}
                      >
                        {user.role === 'admin' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                      </button>
                      <button
                        className="admin-icon-btn"
                        title={user.isActive ? t('admin.disableUser') : t('admin.enableUser')}
                        onClick={() => toggleActive(user)}
                        disabled={isActionInFlight}
                      >
                        <UserX size={14} />
                      </button>
                      <button
                        className="admin-icon-btn"
                        title={t('admin.sendResetEmail')}
                        onClick={() => resetPassword(user)}
                        disabled={isActionInFlight}
                      >
                        <RefreshCw size={14} />
                      </button>
                      {user.role !== 'admin' && (
                        <button
                          className="admin-icon-btn admin-icon-btn--danger"
                          title={t('admin.deleteUser')}
                          onClick={() => deleteUser(user)}
                          disabled={isActionInFlight}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {activeTab === 'search-engines' && <SearchEnginesTab />}
        </div>
      </div>
    </div>
  );
}
