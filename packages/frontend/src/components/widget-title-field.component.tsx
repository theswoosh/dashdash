import { useT } from '../i18n';

interface WidgetTitleFieldProps {
  readonly title: string;
  readonly hideHeader: boolean;
  readonly isTinyLayout: boolean;
  readonly onTitleChange: (title: string) => void;
  readonly onHideHeaderChange: (hide: boolean) => void;
}

export function WidgetTitleField({ title, hideHeader, isTinyLayout, onTitleChange, onHideHeaderChange }: WidgetTitleFieldProps) {
  const t = useT();

  return (
    <div className="config-field">
      <label className="config-label">{t('widgetConfig.widgetTitle')}</label>
      <input
        className="config-input"
        type="text"
        value={title}
        onChange={e => onTitleChange(e.target.value)}
      />
      {!isTinyLayout && (
        <label className="config-field--checkbox" style={{ marginTop: 4 }}>
          <input
            type="checkbox"
            checked={hideHeader}
            onChange={e => onHideHeaderChange(e.target.checked)}
          />
          <span style={{ fontSize: 13 }}>{t('widgetConfig.hideHeader')}</span>
        </label>
      )}
    </div>
  );
}
