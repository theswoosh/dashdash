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
import { SettingsPanel } from './components/SettingsPanel';
import { WidgetSidebar } from './components/WidgetSidebar';
import { WidgetConfigModal } from './components/WidgetConfigModal';

export function App() {
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const settingsPanelOpen = useUIStore(s => s.settingsPanelOpen);
  const configTarget = useUIStore(s => s.configTarget);

  const { preferences } = usePreferences();

  // Apply persisted theme once preferences load
  useEffect(() => {
    if (preferences?.theme) setTheme(preferences.theme);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preferences?.theme]);

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

      {settingsPanelOpen && <SettingsPanel />}
      <WidgetSidebar />
      {configTarget && <WidgetConfigModal />}
    </ThemeProvider>
  );
}
