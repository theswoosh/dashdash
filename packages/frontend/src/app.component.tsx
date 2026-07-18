import { useLayoutEffect, useEffect, type CSSProperties } from 'react';
import './themes/liquid-glass.css';
import './themes/classic.css';
import './themes/ascii.css';
import './themes/atom.css';
import './themes/base.css';
import './themes/chrome.css';
import { useUIStore } from './store/uiStore';
import { usePreferences, DEFAULT_THEME } from './hooks/use-preferences.hook';
import { useBoard } from './hooks/use-board.hook';
import { useAuth } from './hooks/use-auth.hook';
import { useSettings } from './hooks/use-settings.hook';
import { useLocales } from './hooks/use-locales.hook';
import { I18nProvider } from './i18n';
import { ThemeProvider } from './themes/registry';
import { Topbar } from './components/topbar.component';
import { DashGrid } from './components/dash-grid.component';
import { ConfigPanel } from './components/config-panel.component';
import { WidgetConfigModal } from './components/widget-config-modal.component';
import { AdminPanel } from './components/admin-panel.component';
import { ProfilePopup } from './components/profile-popup.component';
import { InfoPopup } from './components/info-popup.component';
import { LoginPage } from './pages/login.page';
import { ResetPasswordPage } from './pages/reset-password.page';

function hasResetToken(): boolean {
  return new URLSearchParams(window.location.search).has('token');
}

function getOidcError(): string {
  return new URLSearchParams(window.location.search).get('error') ?? '';
}

export function App() {
  const configTarget = useUIStore(s => s.configTarget);

  const { user, isLoading: isAuthLoading } = useAuth();
  const { preferences } = usePreferences();
  const theme = preferences?.theme ?? DEFAULT_THEME;
  const { backgroundUrl } = useBoard();
  const settings = useSettings();
  const { languages, translations } = useLocales();

  // Fallback chain: user preference > settings.yml language > 'en'
  const activeLanguage = preferences?.language || settings.language || 'en';

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
  if (!user) {
    return (
      <I18nProvider language={activeLanguage} translations={translations} availableLanguages={languages}>
        {hasResetToken() ? <ResetPasswordPage /> : <LoginPage initialError={getOidcError()} />}
      </I18nProvider>
    );
  }

  return (
    <I18nProvider language={activeLanguage} translations={translations} availableLanguages={languages}>
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
      <InfoPopup />
    </ThemeProvider>
    </I18nProvider>
  );
}
