import { LayoutGrid, Settings2, Save } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import './Topbar.css';

export function Topbar() {
  const { editMode, toggleEditMode, boardName } = useUIStore();

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <LayoutGrid size={20} className="topbar-logo" />
        <span className="topbar-title">{boardName || 'dashdash'}</span>
      </div>
      <nav className="topbar-actions">
        <button
          className={`topbar-btn ${editMode ? 'topbar-btn--active' : ''}`}
          onClick={toggleEditMode}
          title={editMode ? 'Save & exit' : 'Open config'}
        >
          {editMode ? <Save size={16} /> : <Settings2 size={16} />}
          <span>{editMode ? 'Save' : 'Config'}</span>
        </button>
      </nav>
    </header>
  );
}
