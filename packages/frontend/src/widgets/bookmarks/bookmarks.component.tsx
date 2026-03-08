import type { WidgetProps } from '@dashdash/types';
import './BookmarksWidget.css';

interface Bookmark {
  label: string;
  url: string;
  icon?: string | undefined;
}

function isBookmark(x: unknown): x is Bookmark {
  return typeof x === 'object' && x !== null
    && typeof (x as Record<string, unknown>)['label'] === 'string'
    && typeof (x as Record<string, unknown>)['url'] === 'string';
}

export function BookmarksWidget({ options }: WidgetProps) {
  const raw = options['links'];
  const links: Bookmark[] = Array.isArray(raw) ? raw.filter(isBookmark) : [];

  if (links.length === 0) {
    return (
      <div className="bookmarks-widget bookmarks-widget--empty">
        <span>No bookmarks configured</span>
      </div>
    );
  }

  return (
    <div className="bookmarks-widget">
      {links.map((link, i) => (
        <a
          key={i}
          href={link.url}
          className="bookmarks-widget__link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
