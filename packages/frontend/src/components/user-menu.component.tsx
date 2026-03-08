import { useState, useRef, useEffect } from 'react';
import { User, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../hooks/use-auth.hook';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import './user-menu.css';

export function UserMenu() {
  const t = useT();
  const { user, logout } = useAuth();
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const setProfileOpen = useUIStore(s => s.setProfileOpen);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function closeOnOutsideClick(e: MouseEvent) {
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, [isOpen]);

  if (!user) return null;

  const initials = user.name.charAt(0).toUpperCase();

  return (
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
            onClick={() => { setProfileOpen(true); setIsOpen(false); }}
          >
            <User size={14} />
            {t('userMenu.editProfile')}
          </button>

          {user.role === 'admin' && (
            <button
              className="user-dropdown-item"
              onClick={() => { setAdminPanelOpen(true); setIsOpen(false); }}
            >
              <Shield size={14} />
              {t('common.admin')}
            </button>
          )}

          <div className="user-dropdown-divider" />

          <button
            className="user-dropdown-item user-dropdown-item--danger"
            onClick={() => { void logout(); setIsOpen(false); }}
          >
            <LogOut size={14} />
            {t('common.logout')}
          </button>
        </div>
      )}
    </div>
  );
}
