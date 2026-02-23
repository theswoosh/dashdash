import { useLayoutEffect, useEffect } from 'react';
import './themes/liquid-glass.css';
import './themes/classic.css';
import './themes/ascii.css';
import './themes/base.css';
import { useUIStore } from './store/uiStore';
import { usePreferences } from './hooks/usePreferences';
import { ThemeProvider } from './themes/registry';
import { Topbar } from './components/Topbar';
import { DashGrid } from './components/DashGrid';
import { ConfigPanel } from './components/ConfigPanel';
import { WidgetConfigModal } from './components/WidgetConfigModal';

export function App() {
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const setBoardName = useUIStore(s => s.setBoardName);
  const configTarget = useUIStore(s => s.configTarget);

  const { preferences } = usePreferences();

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
      <div className="bg-layer" />
      <div className="bg-overlay" />

      {/* App shell */}
      <Topbar />
      <DashGrid />

      <ConfigPanel />
      {configTarget && <WidgetConfigModal />}
    </ThemeProvider>
  );
}
