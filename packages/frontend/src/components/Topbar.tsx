import { LayoutGrid, Pencil, Save, Palette } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import './Topbar.css';

export function Topbar() {
  const { editMode, toggleEditMode, toggleSettingsPanel } = useUIStore();

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <LayoutGrid size={20} className="topbar-logo" />
        <span className="topbar-title">dashdash</span>
      </div>
      <nav className="topbar-actions">
        <button
          className="topbar-btn topbar-btn--icon"
          onClick={toggleSettingsPanel}
          title="Appearance settings"
          aria-label="Open appearance settings"
        >
          <Palette size={16} />
        </button>
        <button
          className={`topbar-btn ${editMode ? 'topbar-btn--active' : ''}`}
          onClick={toggleEditMode}
          title={editMode ? 'Save & exit edit mode' : 'Edit layout'}
        >
          {editMode ? <Save size={16} /> : <Pencil size={16} />}
          <span>{editMode ? 'Save' : 'Edit'}</span>
        </button>
      </nav>
    </header>
  );
}
