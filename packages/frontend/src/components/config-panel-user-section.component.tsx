import { LogOut, User, Shield } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../hooks/use-auth.hook';
import { useT } from '../i18n';

export function UserSection() {
  const t = useT();
  const { user, logout } = useAuth();
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const setProfileOpen = useUIStore(s => s.setProfileOpen);

  if (!user) return null;

  return (
    <div className="cp-user-section">
      <span className="cp-user-name">{user.name}</span>
      <div className="cp-user-actions">
        <button className="cp-user-btn" onClick={() => setProfileOpen(true)}>
          <User size={12} /> {t('common.profile')}
        </button>
        {user.role === 'admin' && (
          <button className="cp-user-btn" onClick={() => setAdminPanelOpen(true)}>
            <Shield size={12} /> {t('common.admin')}
          </button>
        )}
        <button className="cp-user-btn cp-user-btn--danger" onClick={() => { void logout(); }}>
          <LogOut size={12} /> {t('common.logout')}
        </button>
      </div>
    </div>
  );
}
