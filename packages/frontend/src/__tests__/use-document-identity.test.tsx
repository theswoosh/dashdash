import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDocumentIdentity, emojiFaviconHref } from '../hooks/use-document-identity.hook';

function iconHref(): string {
  return document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute('href') ?? '';
}

function isEmojiIcon(): boolean {
  return iconHref().startsWith('data:image/svg+xml,');
}

const signedIn = { isAuthenticated: true };

beforeEach(() => {
  document.title = 'dashdash';
});

describe('useDocumentIdentity', () => {
  it('falls back to the default title when no board name is set', () => {
    renderHook(() => useDocumentIdentity({ ...signedIn }));
    expect(document.title).toBe('dashdash');
  });

  it('uses the board name as the tab title and trims it', () => {
    renderHook(() => useDocumentIdentity({ ...signedIn, boardName: '  Homelab  ' }));
    expect(document.title).toBe('Homelab');
  });

  it('renders the board icon as an inline SVG favicon', () => {
    renderHook(() => useDocumentIdentity({ ...signedIn, boardName: 'Homelab', headerIcon: '🚀' }));
    expect(isEmojiIcon()).toBe(true);
    expect(decodeURIComponent(iconHref())).toContain('🚀');
  });

  it('restores the default favicon when the icon is cleared', () => {
    const { rerender } = renderHook(
      ({ icon }: { icon: string }) => useDocumentIdentity({ ...signedIn, boardName: 'Homelab', headerIcon: icon }),
      { initialProps: { icon: '🚀' } }
    );
    expect(isEmojiIcon()).toBe(true);
    rerender({ icon: '' });
    expect(isEmojiIcon()).toBe(false);
  });

  it('restores the default title on unmount', () => {
    const { unmount } = renderHook(() => useDocumentIdentity({ ...signedIn, boardName: 'Homelab' }));
    expect(document.title).toBe('Homelab');
    unmount();
    expect(document.title).toBe('dashdash');
  });

  it('escapes XML-significant characters in the icon', () => {
    expect(decodeURIComponent(emojiFaviconHref('<&>'))).toContain('&lt;&amp;&gt;');
  });
});

describe('useDocumentIdentity — showBoardName toggle', () => {
  it('drops the board name from the title when the toggle is off', () => {
    renderHook(() => useDocumentIdentity({ ...signedIn, boardName: 'Homelab', showBoardName: false }));
    expect(document.title).toBe('dashdash');
  });

  it('keeps the favicon when the toggle is off — the topbar keeps the icon too', () => {
    renderHook(() => useDocumentIdentity({ ...signedIn, boardName: 'Homelab', headerIcon: '🚀', showBoardName: false }));
    expect(isEmojiIcon()).toBe(true);
  });

  it('restores the board name when the toggle is switched back on', () => {
    const { rerender } = renderHook(
      ({ show }: { show: boolean }) => useDocumentIdentity({ ...signedIn, boardName: 'Homelab', showBoardName: show }),
      { initialProps: { show: false } }
    );
    expect(document.title).toBe('dashdash');
    rerender({ show: true });
    expect(document.title).toBe('Homelab');
  });

  it('shows the board name when the toggle is undefined — default is on', () => {
    renderHook(() => useDocumentIdentity({ ...signedIn, boardName: 'Homelab' }));
    expect(document.title).toBe('Homelab');
  });
});

describe('useDocumentIdentity — logged out', () => {
  it('ignores board preferences until the user is authenticated', () => {
    renderHook(() =>
      useDocumentIdentity({ isAuthenticated: false, boardName: 'Homelab', headerIcon: '🚀', showBoardName: true })
    );
    expect(document.title).toBe('dashdash');
    expect(isEmojiIcon()).toBe(false);
  });

  it('picks the identity up once the user logs in', () => {
    const { rerender } = renderHook(
      ({ auth }: { auth: boolean }) =>
        useDocumentIdentity({ isAuthenticated: auth, boardName: 'Homelab', headerIcon: '🚀' }),
      { initialProps: { auth: false } }
    );
    expect(document.title).toBe('dashdash');
    rerender({ auth: true });
    expect(document.title).toBe('Homelab');
    expect(isEmojiIcon()).toBe(true);
  });
});
