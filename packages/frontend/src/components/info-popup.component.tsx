import { X } from 'lucide-react';
import useSWR from 'swr';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import './info-popup.css';

const healthFetcher = (url: string) =>
  fetch(url).then(res => res.json()) as Promise<{ version?: string }>;

interface UpdateCheck {
  updateAvailable: boolean;
  latestVersion: string | null;
  releaseUrl: string | null;
}
const updateFetcher = (url: string) => fetch(url).then(res => res.json()) as Promise<UpdateCheck>;

export function InfoPopup() {
  const t = useT();
  const isInfoOpen = useUIStore(s => s.isInfoOpen);
  const setInfoOpen = useUIStore(s => s.setInfoOpen);

  // Fetched only while the popup is open (conditional key) — no polling,
  // no cost on dashboard load.
  const { data: health } = useSWR(isInfoOpen ? '/api/health' : null, healthFetcher, {
    revalidateOnFocus: false,
  });

  const { data: updateCheck } = useSWR(isInfoOpen ? '/api/update-check' : null, updateFetcher, {
    revalidateOnFocus: false,
  });

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
            <span className="info-row-label">{t('info.version')}</span>
            <span className="info-row-value">{health?.version ?? '—'}</span>
          </div>

          {updateCheck?.updateAvailable && (
            <div className="info-row">
              <span className="info-row-label">{t('info.updateAvailable')}</span>
              <a
                className="info-link"
                href={updateCheck.releaseUrl ?? 'https://github.com/theswoosh/dashdash/releases'}
                target="_blank"
                rel="noopener noreferrer"
              >
                {updateCheck.latestVersion}
              </a>
            </div>
          )}

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
