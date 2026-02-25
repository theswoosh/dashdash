import type { WidgetProps } from '@dashdash/types';
import './IframeWidget.css';

export function IframeWidget({ options }: WidgetProps) {
  const url = options['url'] as string | undefined;

  if (!url) {
    return (
      <div className="iframe-widget iframe-widget--empty">
        <span>No URL configured</span>
      </div>
    );
  }

  return (
    <iframe
      className="iframe-widget"
      src={url}
      title="Embedded content"
      sandbox="allow-scripts allow-same-origin allow-forms"
      loading="lazy"
    />
  );
}
