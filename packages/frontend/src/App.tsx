import './themes/glass.css';
import './themes/base.css';
import { Topbar } from './components/Topbar';
import { DashGrid } from './components/DashGrid';

export function App() {
  return (
    <>
      {/* Background layers */}
      <div
        className="bg-layer"
        style={{
          background: 'linear-gradient(135deg, #0f0f1a 0%, #1a0f2e 50%, #0a1a2e 100%)',
        }}
      />
      <div className="bg-overlay" />

      {/* App shell */}
      <Topbar />
      <DashGrid />
    </>
  );
}
