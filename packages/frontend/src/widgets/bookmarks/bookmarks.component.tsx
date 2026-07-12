import type { WidgetProps } from '@dashdash/types';
import { toAbsoluteUrl } from '../shared/app-icon.component';
import './BookmarksWidget.css';

interface Bookmark {
  label: string;
  url: string;
  icon?: string | undefined;
  bg?: string | undefined;
  fg?: string | undefined;
}

function isBookmark(x: unknown): x is Bookmark {
  return typeof x === 'object' && x !== null
    && typeof (x as Record<string, unknown>)['label'] === 'string'
    && typeof (x as Record<string, unknown>)['url'] === 'string';
}

export function BookmarksWidget({ options }: WidgetProps) {
  const raw = options['links'];
  const links: Bookmark[] = Array.isArray(raw) ? raw.filter(isBookmark) : [];
  // Scheme-less entries render via the https:// fallback instead of being
  // silently dropped (live issue #2.1).
  const validLinks = links.filter(link => link.url.trim() !== '');
  const isList = options['linksLayout'] === 'list';

  if (validLinks.length === 0) {
    return (
      <div className="bookmarks-widget bookmarks-widget--empty">
        <span>No bookmarks configured</span>
      </div>
    );
  }

  return (
    <div className={`bookmarks-widget${isList ? ' bookmarks-widget--list' : ''}`}>
      {validLinks.map((link, i) => (
        <a
          key={`${link.url}#${i}`}
          href={toAbsoluteUrl(link.url.trim())}
          className="bookmarks-widget__link"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            ...(typeof link.bg === 'string' && link.bg ? { background: link.bg } : {}),
            ...(typeof link.fg === 'string' && link.fg ? { color: link.fg } : {}),
          }}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
