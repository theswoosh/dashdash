import { X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import './profile-popup.css';

export function ProfilePopup() {
  const isProfileOpen = useUIStore(s => s.isProfileOpen);
  const setProfileOpen = useUIStore(s => s.setProfileOpen);

  if (!isProfileOpen) return null;

  return (
    <div className="profile-overlay" onClick={() => setProfileOpen(false)}>
      <div className="profile-panel" onClick={e => e.stopPropagation()}>
        <div className="profile-header">
          <span className="profile-title">Profile</span>
          <button className="profile-close" onClick={() => setProfileOpen(false)} aria-label="Close">
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
