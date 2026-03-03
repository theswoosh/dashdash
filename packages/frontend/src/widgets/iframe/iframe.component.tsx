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

  if (!/^https?:\/\//i.test(url)) {
    return (
      <div className="iframe-widget iframe-widget--empty">
        <span>Invalid URL — only http:// and https:// are allowed</span>
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
