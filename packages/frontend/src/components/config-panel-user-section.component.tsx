import { LogOut, User, Shield, Info } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../hooks/use-auth.hook';
import { useUpdateCheck } from '../hooks/use-update-check.hook';
import { useT } from '../i18n';

export function UserSection() {
  const t = useT();
  const { user, logout } = useAuth();
  const { updateAvailable } = useUpdateCheck();
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const setProfileOpen = useUIStore(s => s.setProfileOpen);
  const setInfoOpen = useUIStore(s => s.setInfoOpen);

  if (!user) return null;

  return (
    <div className="cp-user-section">
      <span className="cp-user-name">{user.name}</span>
      <div className="cp-user-actions">
        <button className="cp-user-btn" onClick={() => setProfileOpen(true)}>
          <User size={12} /> {t('common.profile')}
        </button>
        {/* Admin slot is always rendered to keep layout stable */}
        <button
          className="cp-user-btn"
          onClick={() => setAdminPanelOpen(true)}
          style={user.role !== 'admin' ? { visibility: 'hidden' } : undefined}
          tabIndex={user.role !== 'admin' ? -1 : undefined}
          aria-hidden={user.role !== 'admin'}
        >
          <Shield size={12} /> {t('common.admin')}
        </button>
        <button
          className="cp-user-btn cp-user-btn--info"
          onClick={() => setInfoOpen(true)}
          title={updateAvailable ? t('info.updateTooltip') : undefined}
        >
          <Info size={12} /> {t('common.info')}
          {updateAvailable && <span className="cp-user-btn__update-dot" />}
        </button>
        <button className="cp-user-btn cp-user-btn--danger" onClick={() => { void logout(); }}>
          <LogOut size={12} /> {t('common.logout')}
        </button>
      </div>
    </div>
  );
}
