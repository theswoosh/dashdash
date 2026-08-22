import { useEffect } from 'react';

const DEFAULT_TITLE = 'dashdash';

function getIconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (existing) return existing;
  const link = document.createElement('link');
  link.rel = 'icon';
  document.head.appendChild(link);
  return link;
}

// Captured once, before any override, so clearing the board icon restores whatever
// index.html shipped with instead of a hardcoded guess.
const defaultIconHref = typeof document === 'undefined' ? '' : getIconLink().getAttribute('href') ?? '';

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function emojiFaviconHref(icon: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
    `<text y=".9em" font-size="90">${escapeXml(icon)}</text>` +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

interface DocumentIdentity {
  isAuthenticated: boolean;
  boardName?: string | undefined;
  headerIcon?: string | undefined;
  showBoardName?: boolean | undefined;
}

/**
 * Mirrors the board name/icon shown in the topbar onto the browser tab.
 * Board identity is per-user, so logged-out screens keep the defaults; the name
 * follows the same showBoardName toggle as the topbar, the icon does not.
 */
export function useDocumentIdentity({ isAuthenticated, boardName, headerIcon, showBoardName }: DocumentIdentity): void {
  const isName = isAuthenticated && showBoardName !== false;
  const name = isName ? boardName?.trim() ?? '' : '';
  const boardIcon = isAuthenticated ? headerIcon?.trim() ?? '' : '';

  useEffect(() => {
    document.title = name || DEFAULT_TITLE;
    return () => { document.title = DEFAULT_TITLE; };
  }, [name]);

  useEffect(() => {
    const link = getIconLink();
    if (boardIcon) {
      link.type = 'image/svg+xml';
      link.href = emojiFaviconHref(boardIcon);
    } else {
      link.href = defaultIconHref;
    }
    return () => { getIconLink().href = defaultIconHref; };
  }, [boardIcon]);
}
