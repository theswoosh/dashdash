import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import { WidgetsTab } from './config-panel-widgets-tab.component';
import { OptionsTab } from './config-panel-options-tab.component';
import { ThemesTab } from './config-panel-themes-tab.component';
import { UserSection } from './config-panel-user-section.component';
import './ConfigPanel.css';

type Tab = 'widgets' | 'options' | 'themes';

export function ConfigPanel() {
  const t = useT();
  const editMode = useUIStore(s => s.editMode);
  const [activeTab, setActiveTab] = useState<Tab>('widgets');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [prevEditMode, setPrevEditMode] = useState(editMode);

  if (editMode !== prevEditMode) {
    setPrevEditMode(editMode);
    if (editMode) setIsCollapsed(false);
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: 'widgets', label: t('config.tabs.addWidgets') },
    { id: 'options', label: t('config.tabs.options') },
    { id: 'themes', label: t('config.tabs.themes') },
  ];

  return (
    <>
      {editMode && (
        <button
          className="chrome config-panel-collapse-btn"
          style={{ right: isCollapsed ? '0' : '300px' }}
          onClick={() => setIsCollapsed(v => !v)}
          aria-label={isCollapsed ? t('config.expandPanel') : t('config.collapsePanel')}
          title={isCollapsed ? t('config.expandPanel') : t('config.collapsePanel')}
        >
          {isCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      )}
      <aside
        className={`chrome config-panel${editMode ? ' config-panel--open' : ''}${isCollapsed ? ' config-panel--collapsed' : ''}`}
        aria-label="Configuration"
      >
        <nav className="config-panel-tabs" aria-label="Config sections">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`config-tab-btn${activeTab === tab.id ? ' config-tab-btn--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
        <div className="config-panel-body">
          {activeTab === 'widgets' && <WidgetsTab />}
          {activeTab === 'options' && <OptionsTab />}
          {activeTab === 'themes' && <ThemesTab />}
        </div>
        <UserSection />
      </aside>
    </>
  );
}
