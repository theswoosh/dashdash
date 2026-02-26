import { useLayoutEffect, useEffect, type CSSProperties } from 'react';
import './themes/liquid-glass.css';
import './themes/classic.css';
import './themes/ascii.css';
import './themes/atom.css';
import './themes/base.css';
import { useUIStore } from './store/uiStore';
import { usePreferences } from './hooks/use-preferences.hook';
import { useBoard } from './hooks/use-board.hook';
import { useAuth } from './hooks/use-auth.hook';
import { ThemeProvider } from './themes/registry';
import { Topbar } from './components/topbar.component';
import { DashGrid } from './components/dash-grid.component';
import { ConfigPanel } from './components/config-panel.component';
import { WidgetConfigModal } from './components/widget-config-modal.component';
import { AdminPanel } from './components/admin-panel.component';
import { ProfilePopup } from './components/profile-popup.component';
import { LoginPage } from './pages/login.page';
import { ResetPasswordPage } from './pages/reset-password.page';

function hasResetToken(): boolean {
  return new URLSearchParams(window.location.search).has('token');
}

export function App() {
  const theme = useUIStore(s => s.theme);
  const setTheme = useUIStore(s => s.setTheme);
  const setBoardName = useUIStore(s => s.setBoardName);
  const configTarget = useUIStore(s => s.configTarget);

  const { user, isLoading: isAuthLoading } = useAuth();
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

  // Apply borderless mode to <html> so CSS selectors can respond
  useLayoutEffect(() => {
    if (preferences?.borderless) {
      document.documentElement.setAttribute('data-borderless', 'true');
    } else {
      document.documentElement.removeAttribute('data-borderless');
    }
  }, [preferences?.borderless]);

  // Apply theme to <html> before first paint — no flash
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  if (isAuthLoading) return null;
  if (!user) return hasResetToken() ? <ResetPasswordPage /> : <LoginPage />;

  return (
    <ThemeProvider themeId={theme}>
      {/* Background layers — styled via CSS vars set by data-theme */}
      {backgroundUrl && (
        <div className="bg-image" style={{ backgroundImage: `url(${backgroundUrl})` }} />
      )}
      <div
        className="bg-layer"
        style={backgroundUrl ? { '--bg-base': 'transparent', backgroundImage: 'none' } as CSSProperties : undefined}
      />
      <div className="bg-overlay" />

      {/* App shell */}
      <Topbar />
      <DashGrid />

      <ConfigPanel />
      {configTarget && <WidgetConfigModal />}
      <AdminPanel />
      <ProfilePopup />
    </ThemeProvider>
  );
}
