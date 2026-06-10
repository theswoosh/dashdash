import useSWR from 'swr';
import { RefreshCw, CheckCircle } from 'lucide-react';
import { useT } from '../i18n';

interface ConfigIssue {
  file: string;
  field: string;
  level: 'error' | 'warning';
  message: string;
}

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function ConfigValidationTab() {
  const t = useT();
  const { data, mutate: refresh } = useSWR<{ issues: ConfigIssue[] }>('/api/config/validate', jsonFetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const issues = data?.issues ?? [];
  const errorCount = issues.filter(i => i.level === 'error').length;
  const warnCount = issues.filter(i => i.level === 'warning').length;

  return (
    <>
      <div className="admin-section-header">
        <span className="admin-section-label">
          {t('admin.validation')}
          {data && issues.length > 0 && ` — ${errorCount} error(s), ${warnCount} warning(s)`}
        </span>
        <button className="admin-btn admin-btn--sm" onClick={() => void refresh()}>
          <RefreshCw size={13} /> {t('admin.refresh')}
        </button>
      </div>

      {!data && <p className="admin-loading">{t('common.loading')}</p>}

      {data && issues.length === 0 && (
        <p className="admin-issue-ok">
          <CheckCircle size={14} /> {t('admin.configOk')}
        </p>
      )}

      {issues.length > 0 && (
        <div className="admin-issue-list">
          {issues.map((issue, idx) => (
            <div key={idx} className="admin-issue-row">
              <span className={`admin-issue-badge admin-issue-badge--${issue.level}`}>{issue.level}</span>
              <span className="admin-issue-file">{issue.file}</span>
              <span className="admin-issue-field" title={issue.field}>{issue.field}</span>
              <span className="admin-issue-msg" title={issue.message}>{issue.message}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
