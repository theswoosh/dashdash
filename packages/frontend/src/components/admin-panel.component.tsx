import { useState } from 'react';
import useSWR, { mutate } from 'swr';
import { X, Plus, Trash2, ShieldCheck, ShieldOff, UserX, RefreshCw } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import './admin-panel.css';

interface UserSummary {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
  createdAt: string;
}

const USERS_KEY = '/api/users';

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

  async function handleSubmit(e: React.FormEvent) {
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
    <form className="admin-add-form" onSubmit={e => void handleSubmit(e)}>
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

export function AdminPanel() {
  const t = useT();
  const isAdminPanelOpen = useUIStore(s => s.isAdminPanelOpen);
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: users } = useSWR<UserSummary[]>(isAdminPanelOpen ? USERS_KEY : null, jsonFetcher);

  if (!isAdminPanelOpen) return null;

  async function performAction(fn: () => Promise<{ ok?: boolean; error?: string }>) {
    setActionError('');
    const result = await fn();
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

        <div className="admin-body">
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
                  >
                    {user.role === 'admin' ? <ShieldOff size={14} /> : <ShieldCheck size={14} />}
                  </button>
                  <button
                    className="admin-icon-btn"
                    title={user.isActive ? t('admin.disableUser') : t('admin.enableUser')}
                    onClick={() => toggleActive(user)}
                  >
                    <UserX size={14} />
                  </button>
                  <button
                    className="admin-icon-btn"
                    title={t('admin.sendResetEmail')}
                    onClick={() => resetPassword(user)}
                  >
                    <RefreshCw size={14} />
                  </button>
                  {user.role !== 'admin' && (
                    <button
                      className="admin-icon-btn admin-icon-btn--danger"
                      title={t('admin.deleteUser')}
                      onClick={() => deleteUser(user)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
