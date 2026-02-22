import type { WidgetProps } from '@dashdash/types';
import './BookmarksWidget.css';

interface Bookmark {
  label: string;
  url: string;
  icon?: string | undefined;
}

export function BookmarksWidget({ options }: WidgetProps) {
  const links = (options['links'] as Bookmark[] | undefined) ?? [];

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
