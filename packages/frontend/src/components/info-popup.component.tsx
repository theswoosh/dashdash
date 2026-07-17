import { X } from 'lucide-react';
import useSWR from 'swr';
import { useUIStore } from '../store/uiStore';
import { useT } from '../i18n';
import { useUpdateCheck } from '../hooks/use-update-check.hook';
import './info-popup.css';

const healthFetcher = (url: string) =>
  fetch(url).then(res => res.json()) as Promise<{ version?: string }>;

export function InfoPopup() {
  const t = useT();
  const isInfoOpen = useUIStore(s => s.isInfoOpen);
  const setInfoOpen = useUIStore(s => s.setInfoOpen);

  // Fetched only while the popup is open (conditional key) — no polling,
  // no cost on dashboard load.
  const { data: health } = useSWR(isInfoOpen ? '/api/health' : null, healthFetcher, {
    revalidateOnFocus: false,
  });

  const { updateAvailable, latestVersion, releaseUrl } = useUpdateCheck();

  if (!isInfoOpen) return null;

  return (
    <div className="chrome info-overlay" onClick={() => setInfoOpen(false)}>
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
            <a
              className={`info-link${updateAvailable ? ' info-version-update' : ''}`}
              href={releaseUrl ?? 'https://github.com/theswoosh/dashdash/releases'}
              target="_blank"
              rel="noopener noreferrer"
            >
              {health?.version ?? '—'}
              {updateAvailable && ` → ${latestVersion}`}
            </a>
          </div>

          {updateAvailable && (
            <div className="info-row">
              <span className="info-row-label">{t('info.updateAvailable')}</span>
              <a
                className="info-link"
                href={releaseUrl ?? 'https://github.com/theswoosh/dashdash/releases'}
                target="_blank"
                rel="noopener noreferrer"
              >
                {latestVersion}
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
