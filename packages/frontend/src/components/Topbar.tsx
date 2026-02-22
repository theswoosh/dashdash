import { LayoutGrid, Pencil, Check, Sun, Moon } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import './Topbar.css';

export function Topbar() {
  const { editMode, toggleEditMode, theme, toggleTheme } = useUIStore();

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <LayoutGrid size={20} className="topbar-logo" />
        <span className="topbar-title">dashdash</span>
      </div>
      <nav className="topbar-actions">
        <button
          className="topbar-btn topbar-btn--icon"
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          className={`topbar-btn ${editMode ? 'topbar-btn--active' : ''}`}
          onClick={toggleEditMode}
          title={editMode ? 'Save layout' : 'Edit layout'}
        >
          {editMode ? <Check size={16} /> : <Pencil size={16} />}
          <span>{editMode ? 'Done' : 'Edit'}</span>
        </button>
      </nav>
    </header>
  );
}
