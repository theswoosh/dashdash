import { X } from 'lucide-react';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import './info-popup.css';

export function InfoPopup() {
  const t = useT();
  const isInfoOpen = useUIStore(s => s.isInfoOpen);
  const setInfoOpen = useUIStore(s => s.setInfoOpen);

  if (!isInfoOpen) return null;

  return (
    <div className="info-overlay" onClick={() => setInfoOpen(false)}>
      <div className="info-panel" onClick={e => e.stopPropagation()}>
        <div className="info-header">
          <span className="info-title">{t('info.title')}</span>
          <button className="info-close" onClick={() => setInfoOpen(false)} aria-label={t('common.close')}>
            <X size={16} />
          </button>
        </div>

        <div className="info-body">
          <div className="info-row">
            <span className="info-row-label">{t('info.developedBy')}</span>
            <a
              className="info-link"
              href="https://github.com/theswoosh/dashdash"
              target="_blank"
              rel="noopener noreferrer"
            >
              Alex — github.com/theswoosh/dashdash
            </a>
          </div>

          <div className="info-row">
            <span className="info-row-label">{t('info.license')}</span>
            <span className="info-row-value">Apache 2.0</span>
          </div>

          <div className="info-row">
            <span className="info-row-label">{t('info.support')}</span>
            <a
              className="info-kofi-btn"
              href="https://ko-fi.com/welikecoffee"
              target="_blank"
              rel="noopener noreferrer"
            >
              ☕ {t('info.kofi')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
