import { useLayoutEffect } from 'react';
import './themes/glass.css';
import './themes/base.css';
import { useUIStore } from './store/uiStore';
import { Topbar } from './components/Topbar';
import { DashGrid } from './components/DashGrid';

export function App() {
  const theme = useUIStore(s => s.theme);

  // Apply theme to <html> before first paint — no flash
  useLayoutEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      {/* Background layers — styled via CSS vars set by data-theme */}
      <div className="bg-layer" />
      <div className="bg-overlay" />

      {/* App shell */}
      <Topbar />
      <DashGrid />
    </>
  );
}
