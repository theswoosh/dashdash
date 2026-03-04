import { useState, useRef, useEffect } from 'react';
import { X, KeyRound, Trash2, ChevronLeft } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../hooks/use-auth.hook';
import { useBehavior } from '../hooks/use-behavior.hook';
import { useT } from '../i18n';
import { LanguageSelector } from './language-selector.component';
import './profile-popup.css';
import './user-menu.css';

type ProfileTab = 'profile' | 'danger';
type ProfileView = 'edit' | 'password';

export function ProfilePopup() {
  const t = useT();
  const isProfileOpen = useUIStore(s => s.isProfileOpen);
  const setProfileOpen = useUIStore(s => s.setProfileOpen);
  const { user, updateProfile, deleteAccount } = useAuth();
  const { holdToDeleteMs } = useBehavior();

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [profileView, setProfileView] = useState<ProfileView>('edit');

  // Profile edit state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileInfo, setProfileInfo] = useState('');
  const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwInfo, setPwInfo] = useState('');
  const [isPwSubmitting, setIsPwSubmitting] = useState(false);

  // Danger zone state
  const [confirmDeleteEmail, setConfirmDeleteEmail] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [holdingDelete, setHoldingDelete] = useState(false);
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (deleteTimer.current) clearTimeout(deleteTimer.current); }, []);

  // Sync form fields when the popup opens or the user data changes.
  useEffect(() => {
    if (isProfileOpen && user) {
      setName(user.name);
      setEmail(user.email);
      setProfileError('');
      setProfileInfo('');
      setActiveTab('profile');
      setProfileView('edit');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwError('');
      setPwInfo('');
      setConfirmDeleteEmail('');
      setDeleteError('');
    }
  }, [isProfileOpen, user]);

  if (!isProfileOpen) return null;

  function close() {
    setProfileOpen(false);
  }

  function openPasswordView() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
    setPwInfo('');
    setProfileView('password');
  }

  function closePasswordView() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwError('');
    setPwInfo('');
    setProfileView('edit');
  }

  function switchTab(tab: ProfileTab) {
    setActiveTab(tab);
    setProfileView('edit');
  }

  async function submitProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setProfileError('');
    setProfileInfo('');
    setIsProfileSubmitting(true);

    const updates: { name?: string; email?: string } = {};
    if (name !== user?.name) updates.name = name;
    if (email !== user?.email) updates.email = email;

    if (Object.keys(updates).length === 0) {
      close();
      return;
    }

    try {
      await updateProfile(updates);
      setProfileInfo(t('userMenu.profileUpdated'));
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : t('userMenu.updateFailed'));
    } finally {
      setIsProfileSubmitting(false);
    }
  }

  async function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwInfo('');

    if (newPassword !== confirmPassword) {
      setPwError(t('login.passwordMismatch'));
      return;
    }

    setIsPwSubmitting(true);
    try {
      await updateProfile({ password: newPassword, currentPassword });
      setPwInfo(t('userMenu.profileUpdated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwError(err instanceof Error ? err.message : t('userMenu.updateFailed'));
    } finally {
      setIsPwSubmitting(false);
    }
  }

  function startDeleteHold(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    setHoldingDelete(true);
    deleteTimer.current = setTimeout(() => {
      void triggerDelete();
    }, holdToDeleteMs);
  }

  function cancelDeleteHold() {
    if (deleteTimer.current) { clearTimeout(deleteTimer.current); deleteTimer.current = null; }
    setHoldingDelete(false);
  }

  async function triggerDelete() {
    setHoldingDelete(false);
    setDeleteError('');
    try {
      await deleteAccount(confirmDeleteEmail);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t('userMenu.updateFailed'));
    }
  }

  const deleteReady = confirmDeleteEmail === user?.email;
  const pwMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const pwMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <div className="profile-overlay" onClick={close}>
      <div className="profile-panel" onClick={e => e.stopPropagation()}>
        <div className="profile-header">
          <span className="profile-title">{t('userMenu.editProfile')}</span>
          <button className="profile-close" onClick={close} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="profile-tabs">
          <button
            className={`profile-tab${activeTab === 'profile' ? ' profile-tab--active' : ''}`}
            onClick={() => switchTab('profile')}
          >
            {t('common.profile')}
          </button>
          <button
            className={`profile-tab${activeTab === 'danger' ? ' profile-tab--active' : ''}`}
            onClick={() => switchTab('danger')}
          >
            {t('userMenu.dangerZone')}
          </button>
        </div>

        <div className="profile-body">
          {activeTab === 'profile' && profileView === 'edit' && (
            <>
              {profileError && <p className="user-modal-error" role="alert">{profileError}</p>}
              {profileInfo && <p className="user-modal-info" role="status">{profileInfo}</p>}

              <form onSubmit={e => void submitProfileUpdate(e)}>
                <label className="user-modal-label" htmlFor="profile-name">{t('login.displayName')}</label>
                <input
                  id="profile-name"
                  className="user-modal-input"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={100}
                  required
                />

                <label className="user-modal-label" htmlFor="profile-email">{t('login.email')}</label>
                <input
                  id="profile-email"
                  className="user-modal-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />

                <div className="profile-language profile-language--form">
                  <label className="user-modal-label">{t('userMenu.language')}</label>
                  <LanguageSelector />
                </div>

                <div className="user-modal-actions">
                  <button type="button" className="user-modal-btn user-modal-btn--ghost" onClick={close}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="user-modal-btn" disabled={isProfileSubmitting}>
                    {isProfileSubmitting ? t('userMenu.saving') : t('common.save')}
                  </button>
                </div>
              </form>

              <button type="button" className="user-modal-toggle" onClick={openPasswordView}>
                <KeyRound size={13} />
                {t('userMenu.changePassword')}
              </button>
            </>
          )}

          {activeTab === 'profile' && profileView === 'password' && (
            <>
              <button type="button" className="profile-back-btn" onClick={closePasswordView}>
                <ChevronLeft size={14} />
                {t('userMenu.changePassword')}
              </button>

              {pwError && <p className="user-modal-error" role="alert">{pwError}</p>}
              {pwInfo && <p className="user-modal-info" role="status">{pwInfo}</p>}

              <form onSubmit={e => void submitPasswordChange(e)}>
                <label className="user-modal-label" htmlFor="profile-cur-pw">{t('userMenu.currentPassword')}</label>
                <input
                  id="profile-cur-pw"
                  className="user-modal-input"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                />

                <label className="user-modal-label" htmlFor="profile-new-pw">{t('login.newPassword')}</label>
                <input
                  id="profile-new-pw"
                  className="user-modal-input"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  minLength={8}
                  required
                />

                <label className="user-modal-label" htmlFor="profile-confirm-pw">{t('login.confirmPassword')}</label>
                <input
                  id="profile-confirm-pw"
                  className={`user-modal-input${pwMatch ? ' user-modal-input--valid' : pwMismatch ? ' user-modal-input--invalid' : ''}`}
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                />

                <div className="user-modal-actions">
                  <button type="button" className="user-modal-btn user-modal-btn--ghost" onClick={closePasswordView}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="user-modal-btn" disabled={isPwSubmitting || pwMismatch}>
                    {isPwSubmitting ? t('userMenu.saving') : t('common.save')}
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === 'danger' && (
            <div className="user-modal-danger user-modal-danger--tab">
              {deleteError && <p className="user-modal-error" role="alert">{deleteError}</p>}
              <label className="user-modal-label" htmlFor="profile-delete-email">
                {t('userMenu.deleteAccountConfirm')}
              </label>
              <input
                id="profile-delete-email"
                className="user-modal-input"
                type="email"
                value={confirmDeleteEmail}
                onChange={e => setConfirmDeleteEmail(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                className={`user-modal-delete-btn${holdingDelete ? ' user-modal-delete-btn--holding' : ''}`}
                style={{ '--hold-delete-duration': `${holdToDeleteMs}ms` } as React.CSSProperties}
                disabled={!deleteReady}
                onMouseDown={deleteReady ? startDeleteHold : undefined}
                onMouseUp={cancelDeleteHold}
                onMouseLeave={cancelDeleteHold}
                onTouchStart={deleteReady ? startDeleteHold : undefined}
                onTouchEnd={cancelDeleteHold}
                title={t('userMenu.deleteAccountHold')}
              >
                <span className="user-modal-delete-btn__fill" />
                <span className="user-modal-delete-btn__content">
                  <Trash2 size={13} />
                  {t('userMenu.deleteAccount')}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
