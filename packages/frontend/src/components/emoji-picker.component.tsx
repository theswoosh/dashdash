import { useState, useRef, useCallback, useEffect, Fragment, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n';
import './EmojiPicker.css';

// ── Types ─────────────────────────────────────────────────────────────────

interface EmojiEntry {
  emoji: string;
  name: string;
}

interface EmojiGroup {
  name: string;
  slug: string;
  emojis: EmojiEntry[];
}

// ── Category definitions ──────────────────────────────────────────────────

const BOARD_ICON_MAX_LENGTH = 20;

/** Free-text board icons render as plain text (React escapes them), but the
 *  value lands in preferences and the topbar — strip control and zero-width
 *  characters and hard-cap the length as defense-in-depth (live issue #6.1). */
function sanitizeBoardIcon(raw: string): string {
  return raw
     
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028\u2029\ufeff]/g, '')
    .trim()
    .slice(0, BOARD_ICON_MAX_LENGTH);
}

const RECENT_KEY = 'recent';
const RECENTS_MAX = 30;

interface CategoryDef {
  key: string;
  icon: string;
  label: string;
}

const CATEGORIES: CategoryDef[] = [
  { key: RECENT_KEY,           icon: '🕐', label: 'Recent' },
  { key: 'Smileys & Emotion',  icon: '😀', label: 'Smileys' },
  { key: 'People & Body',      icon: '🧑', label: 'People' },
  { key: 'Animals & Nature',   icon: '🐾', label: 'Animals' },
  { key: 'Food & Drink',       icon: '🍕', label: 'Food' },
  { key: 'Travel & Places',    icon: '✈️', label: 'Travel' },
  { key: 'Activities',         icon: '⚽', label: 'Activities' },
  { key: 'Objects',            icon: '💡', label: 'Objects' },
  { key: 'Symbols',            icon: '♾️', label: 'Symbols' },
  { key: 'Flags',              icon: '🏳️', label: 'Flags' },
];

// ── Recent emojis hook ────────────────────────────────────────────────────

function readRecentEmojis(): string[] {
  try {
    const raw = localStorage.getItem('dashdash:emoji-recents');
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Prepends an emoji to the persisted recents list (also used for custom text icons). */
export function addRecentEmojiToStorage(emoji: string, previous: string[] = readRecentEmojis()): string[] {
  const next = [emoji, ...previous.filter(e => e !== emoji)].slice(0, RECENTS_MAX);
  try { localStorage.setItem('dashdash:emoji-recents', JSON.stringify(next)); } catch { /* quota */ }
  return next;
}

function useRecentEmojis(): [string[], (emoji: string) => void] {
  const [recents, setRecents] = useState<string[]>(readRecentEmojis);

  const addRecent = useCallback((emoji: string) => {
    setRecents(prev => addRecentEmojiToStorage(emoji, prev));
  }, []);

  return [recents, addRecent];
}

// ── Emoji data hook ───────────────────────────────────────────────────────

interface EmojiDataHook {
  groups: EmojiGroup[];
  isLoading: boolean;
  load: () => void;
}

function useEmojiData(): EmojiDataHook {
  const [groups, setGroups] = useState<EmojiGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(() => {
    if (loaded.current) return;
    loaded.current = true;
    setIsLoading(true);
    void import('unicode-emoji-json/data-by-group.json').then(mod => {
      setGroups(mod.default as EmojiGroup[]);
      setIsLoading(false);
    });
  }, []);

  return { groups, isLoading, load };
}

// ── Reusable emoji popup (portal panel: search, categories, recents) ──────

const ANCHOR_GAP_PX = 4;
const ANCHOR_VIEWPORT_MARGIN_PX = 8;
const ANCHOR_MIN_HEIGHT_PX = 120;

export function EmojiPopup({
  value = '',
  onSelect,
  onClose,
  footer,
  anchorRect,
}: {
  readonly value?: string;
  readonly onSelect: (emoji: string) => void;
  readonly onClose: () => void;
  readonly footer?: ReactNode;
  /** Anchor the panel below this rect (no overlay backdrop) instead of a centered dialog. */
  readonly anchorRect?: DOMRect | undefined;
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(RECENT_KEY);
  const [recents, addRecent] = useRecentEmojis();
  const { groups, isLoading, load } = useEmojiData();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isAnchored = anchorRect !== undefined;

  useEffect(() => { load(); }, [load]);

  // Anchored mode has no backdrop: close on outside click and when the anchor
  // may have moved (window resize, any scroll outside the panel).
  useEffect(() => {
    if (!isAnchored) return;
    const closeOnOutsidePress = (e: PointerEvent) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      onClose();
    };
    const closeOnOutsideScroll = (e: Event) => {
      if (panelRef.current && e.target instanceof Node && panelRef.current.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', closeOnOutsidePress);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', closeOnOutsideScroll, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', closeOnOutsideScroll, true);
    };
  }, [isAnchored, onClose]);

  const selectEmoji = (emoji: string) => {
    addRecent(emoji);
    onSelect(emoji);
  };

  // Compute visible emojis
  const visibleEmojis: { emoji: string; name: string; groupName: string }[] = (() => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const results: { emoji: string; name: string; groupName: string }[] = [];
      for (const group of groups) {
        for (const entry of group.emojis) {
          if (entry.name.toLowerCase().includes(q) || entry.emoji.includes(q)) {
            results.push({ emoji: entry.emoji, name: entry.name, groupName: group.name });
          }
        }
      }
      return results;
    }
    if (activeCategory === RECENT_KEY) {
      return recents.map(e => ({ emoji: e, name: e, groupName: '' }));
    }
    const group = groups.find(g => g.name === activeCategory);
    return (group?.emojis ?? []).map(e => ({ emoji: e.emoji, name: e.name, groupName: '' }));
  })();

  // For search results: group by groupName for section labels
  const showSectionLabels = search.trim().length > 0 && groups.length > 0;

  // Below the anchor, clamped into the viewport: when space is short, cap the
  // panel height instead of flipping above.
  const anchoredStyle = anchorRect
    ? {
        top: anchorRect.bottom + ANCHOR_GAP_PX,
        left: anchorRect.left,
        width: anchorRect.width,
        maxHeight: Math.max(
          ANCHOR_MIN_HEIGHT_PX,
          window.innerHeight - (anchorRect.bottom + ANCHOR_GAP_PX) - ANCHOR_VIEWPORT_MARGIN_PX,
        ),
      }
    : undefined;

  const panel = (
      <div
        ref={panelRef}
        className={`icon-picker__panel${isAnchored ? ' icon-picker__panel--anchored' : ''}`}
        style={anchoredStyle}
        role="dialog"
        aria-label="Emoji picker"
        aria-modal={isAnchored ? undefined : 'true'}
        onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      >
        <input
          className="config-option-input icon-picker__search"
          type="text"
          placeholder="Search emoji…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus={!isAnchored}
        />

        {!search && (
          <div className="ep-category-tabs" role="tablist">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                type="button"
                role="tab"
                aria-selected={activeCategory === cat.key}
                aria-label={cat.label}
                title={cat.label}
                className={`ep-category-tab${activeCategory === cat.key ? ' ep-category-tab--active' : ''}`}
                onClick={() => setActiveCategory(cat.key)}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="ep-loading">Loading…</div>
        ) : (
          <div className="ep-grid-viewport">
            {activeCategory === RECENT_KEY && !search && recents.length === 0 ? (
              <div className="ep-recents-empty">No recently used emoji</div>
            ) : visibleEmojis.length === 0 ? (
              <div className="ep-empty">No results</div>
            ) : showSectionLabels ? (
              <SearchResults items={visibleEmojis} value={value} onSelect={selectEmoji} />
            ) : (
              <div className="ep-grid">
                {visibleEmojis.map(item => (
                  <button
                    key={item.emoji}
                    type="button"
                    className={`ep-emoji-btn${value === item.emoji ? ' ep-emoji-btn--active' : ''}`}
                    onClick={() => selectEmoji(item.emoji)}
                    title={item.name}
                    aria-pressed={value === item.emoji}
                  >
                    {item.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {footer}
      </div>
  );

  if (isAnchored) return createPortal(panel, document.body);

  return createPortal(
    <>
      <div className="icon-picker__overlay" onClick={onClose} aria-hidden="true" />
      {panel}
    </>,
    document.body,
  );
}

// ── Board icon picker (trigger + EmojiPopup with free-text footer) ────────

export function BoardIconPicker({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (icon: string) => void;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);

  const closePanel = useCallback(() => setIsOpen(false), []);

  const selectEmoji = (emoji: string) => {
    onChange(emoji);
    closePanel();
  };

  return (
    <div className="icon-picker">
      <div className="icon-picker__row">
        <button
          type="button"
          className="icon-picker__trigger"
          onClick={() => setIsOpen(o => !o)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          title="Board icon"
        >
          {value
            ? <span className="icon-picker__preview" aria-hidden="true">{value}</span>
            : <span className="icon-picker__empty">＋</span>
          }
        </button>
        {value && (
          <button
            type="button"
            className="icon-picker__clear"
            onClick={() => { onChange(''); closePanel(); }}
            aria-label="Remove icon"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <EmojiPopup
          value={value}
          onSelect={selectEmoji}
          onClose={closePanel}
          footer={
            <div className="icon-picker__custom">
              <input
                className="config-option-input"
                type="text"
                placeholder={t('config.boardIconInputPlaceholder')}
                maxLength={BOARD_ICON_MAX_LENGTH}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  if (!(e.target instanceof HTMLInputElement)) return;
                  const custom = sanitizeBoardIcon(e.target.value);
                  if (!custom) return;
                  addRecentEmojiToStorage(custom);
                  selectEmoji(custom);
                  e.target.value = '';
                }}
              />
            </div>
          }
        />
      )}
    </div>
  );
}

// ── Search results with section labels ────────────────────────────────────

function SearchResults({
  items,
  value,
  onSelect,
}: {
  items: { emoji: string; name: string; groupName: string }[];
  value: string;
  onSelect: (emoji: string) => void;
}) {
  // Group items by groupName preserving order of first occurrence
  const sections: { groupName: string; emojis: { emoji: string; name: string }[] }[] = [];
  const seen = new Map<string, number>();

  for (const item of items) {
    const idx = seen.get(item.groupName);
    if (idx === undefined) {
      seen.set(item.groupName, sections.length);
      sections.push({ groupName: item.groupName, emojis: [{ emoji: item.emoji, name: item.name }] });
    } else {
      sections[idx]!.emojis.push({ emoji: item.emoji, name: item.name });
    }
  }

  return (
    <div className="ep-grid">
      {sections.map(section => (
        <Fragment key={section.groupName}>
          <div className="ep-section-label">{section.groupName}</div>
          {section.emojis.map(e => (
            <button
              key={e.emoji}
              type="button"
              className={`ep-emoji-btn${value === e.emoji ? ' ep-emoji-btn--active' : ''}`}
              onClick={() => onSelect(e.emoji)}
              title={e.name}
              aria-pressed={value === e.emoji}
            >
              {e.emoji}
            </button>
          ))}
        </Fragment>
      ))}
    </div>
  );
}
