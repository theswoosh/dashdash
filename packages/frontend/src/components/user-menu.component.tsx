import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Shield, KeyRound } from 'lucide-react';
import { useAuth } from '../hooks/use-auth.hook';
import { useUIStore } from '../store/uiStore';
import './user-menu.css';

interface ProfileModalProps {
  onClose: () => void;
}

function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setIsSubmitting(true);

    const updates: { name?: string; password?: string; currentPassword?: string } = {};
    if (name !== user?.name) updates.name = name;
    if (isChangingPassword && newPassword) {
      updates.password = newPassword;
      updates.currentPassword = currentPassword;
    }

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    try {
      await updateProfile(updates);
      setInfo('Profile updated.');
      setCurrentPassword('');
      setNewPassword('');
      setIsChangingPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="user-modal-overlay" onClick={onClose}>
      <div className="user-modal" onClick={e => e.stopPropagation()}>
        <h2 className="user-modal-title">Edit profile</h2>
        {error && <p className="user-modal-error" role="alert">{error}</p>}
        {info && <p className="user-modal-info" role="status">{info}</p>}

        <form onSubmit={e => void handleSubmit(e)}>
          <label className="user-modal-label" htmlFor="profile-name">Display name</label>
          <input
            id="profile-name"
            className="user-modal-input"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={100}
            required
          />

          <label className="user-modal-label">Email</label>
          <input className="user-modal-input user-modal-input--readonly" value={user?.email ?? ''} readOnly />

          <button
            type="button"
            className="user-modal-toggle"
            onClick={() => setIsChangingPassword(p => !p)}
          >
            <KeyRound size={13} />
            {isChangingPassword ? 'Cancel password change' : 'Change password'}
          </button>

          {isChangingPassword && (
            <>
              <label className="user-modal-label" htmlFor="current-pw">Current password</label>
              <input
                id="current-pw"
                className="user-modal-input"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required={isChangingPassword}
              />
              <label className="user-modal-label" htmlFor="new-pw">New password</label>
              <input
                id="new-pw"
                className="user-modal-input"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                minLength={8}
                required={isChangingPassword}
              />
            </>
          )}

          <div className="user-modal-actions">
            <button type="button" className="user-modal-btn user-modal-btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="user-modal-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const [isOpen, setIsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  if (!user) return null;

  const initials = user.name.charAt(0).toUpperCase();

  return (
    <>
      <div className="user-menu" ref={menuRef}>
        <button
          className="user-avatar-btn"
          onClick={() => setIsOpen(p => !p)}
          aria-label={`User menu for ${user.name}`}
          aria-expanded={isOpen}
        >
          <span className="user-avatar">{initials}</span>
        </button>

        {isOpen && (
          <div className="user-dropdown">
            <div className="user-dropdown-header">
              <span className="user-dropdown-name">{user.name}</span>
              <span className="user-dropdown-email">{user.email}</span>
            </div>

            <div className="user-dropdown-divider" />

            <button
              className="user-dropdown-item"
              onClick={() => { setIsProfileOpen(true); setIsOpen(false); }}
            >
              <User size={14} />
              Edit profile
            </button>

            {user.role === 'admin' && (
              <button
                className="user-dropdown-item"
                onClick={() => { setAdminPanelOpen(true); setIsOpen(false); }}
              >
                <Shield size={14} />
                Admin panel
              </button>
            )}

            <div className="user-dropdown-divider" />

            <button
              className="user-dropdown-item user-dropdown-item--danger"
              onClick={() => { void logout(); setIsOpen(false); }}
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>

      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
    </>
  );
}
