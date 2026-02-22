import { useLayoutEffect } from 'react';
import './themes/liquid-glass.css';
import './themes/classic.css';
import './themes/ascii.css';
import './themes/base.css';
import { useUIStore } from './store/uiStore';
import { ThemeProvider } from './themes/registry';
import { Topbar } from './components/Topbar';
import { DashGrid } from './components/DashGrid';
import { SettingsPanel } from './components/SettingsPanel';

export function App() {
  const theme = useUIStore(s => s.theme);
  const settingsPanelOpen = useUIStore(s => s.settingsPanelOpen);

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
    </ThemeProvider>
  );
}
