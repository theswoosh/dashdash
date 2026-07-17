import { useState } from 'react';
import { X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import { UsersTab } from './admin-panel-users-tab.component';
import { SearchEnginesTab } from './admin-panel-engines-tab.component';
import { ConfigValidationTab } from './admin-panel-validation-tab.component';
import './admin-panel.css';

type AdminTab = 'users' | 'search-engines' | 'validation';

export function AdminPanel() {
  const t = useT();
  const isAdminPanelOpen = useUIStore(s => s.isAdminPanelOpen);
  const setAdminPanelOpen = useUIStore(s => s.setAdminPanelOpen);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  if (!isAdminPanelOpen) return null;

  return (
    <div className="chrome admin-overlay" onClick={() => setAdminPanelOpen(false)}>
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
          <button
            className={`admin-tab${activeTab === 'validation' ? ' admin-tab--active' : ''}`}
            onClick={() => setActiveTab('validation')}
          >
            {t('admin.validation')}
          </button>
        </div>

        <div className="admin-body">
          {activeTab === 'users' && <UsersTab isOpen={isAdminPanelOpen} />}
          {activeTab === 'search-engines' && <SearchEnginesTab />}
          {activeTab === 'validation' && <ConfigValidationTab />}
        </div>
      </div>
    </div>
  );
}
