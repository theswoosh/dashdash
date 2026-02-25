import { useLayoutEffect, useEffect } from 'react';
import './themes/liquid-glass.css';
import './themes/classic.css';
import './themes/ascii.css';
import './themes/base.css';
import { useUIStore } from './store/uiStore';
import { usePreferences } from './hooks/use-preferences.hook';
import { useBoard } from './hooks/use-board.hook';
import { ThemeProvider } from './themes/registry';
import { Topbar } from './components/topbar.component';
import { DashGrid } from './components/dash-grid.component';
import { ConfigPanel } from './components/config-panel.component';
import { WidgetConfigModal } from './components/widget-config-modal.component';

export function App() {
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const setBoardName = useUIStore(s => s.setBoardName);
  const configTarget = useUIStore(s => s.configTarget);

  const { preferences } = usePreferences();
  const { backgroundUrl } = useBoard();

  // Prevent browser navigation when an image/URL is dragged onto the page.
  // Skip for widget-template drags — those are handled by RGL on the grid.
  useEffect(() => {
    const isExternal = (e: DragEvent) =>
      !Array.from(e.dataTransfer?.types ?? []).includes('widget-template');
    const handleDragOver = (e: DragEvent) => { if (isExternal(e)) e.preventDefault(); };
    const handleDrop    = (e: DragEvent) => { if (isExternal(e)) e.preventDefault(); };
    document.addEventListener('dragover', handleDragOver);
    document.addEventListener('drop',     handleDrop);
    return () => {
      document.removeEventListener('dragover', handleDragOver);
      document.removeEventListener('drop',     handleDrop);
    };
  }, []);

  // Apply persisted preferences once they load
  useEffect(() => {
    if (preferences?.theme) setTheme(preferences.theme);
    if (preferences?.boardName) setBoardName(preferences.boardName);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.theme, preferences?.boardName]);

  // Apply theme to <html> before first paint — no flash
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <ThemeProvider themeId={theme}>
      {/* Background layers — styled via CSS vars set by data-theme */}
      {backgroundUrl && (
        <div className="bg-image" style={{ backgroundImage: `url(${backgroundUrl})` }} />
      )}
      <div
        className="bg-layer"
        style={backgroundUrl ? { '--bg-base': 'transparent' } as React.CSSProperties : undefined}
      />
      <div className="bg-overlay" />

      {/* App shell */}
      <Topbar />
      <DashGrid />

      <ConfigPanel />
      {configTarget && <WidgetConfigModal />}
    </ThemeProvider>
  );
}
