import { X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import './profile-popup.css';

export function ProfilePopup() {
  const t = useT();
  const isProfileOpen = useUIStore(s => s.isProfileOpen);
  const setProfileOpen = useUIStore(s => s.setProfileOpen);

  if (!isProfileOpen) return null;

  return (
    <div className="profile-overlay" onClick={() => setProfileOpen(false)}>
      <div className="profile-panel" onClick={e => e.stopPropagation()}>
        <div className="profile-header">
          <span className="profile-title">{t('common.profile')}</span>
          <button className="profile-close" onClick={() => setProfileOpen(false)} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>
        <div className="profile-body">
          {/* Profile editing — coming soon */}
        </div>
      </div>
    </div>
  );
}
