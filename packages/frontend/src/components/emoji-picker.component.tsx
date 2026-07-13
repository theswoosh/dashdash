import { useState, useRef, useCallback, Fragment } from 'react';
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

function useRecentEmojis(): [string[], (emoji: string) => void] {
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('dashdash:emoji-recents');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const addRecent = useCallback((emoji: string) => {
    setRecents(prev => {
      const next = [emoji, ...prev.filter(e => e !== emoji)].slice(0, RECENTS_MAX);
      try { localStorage.setItem('dashdash:emoji-recents', JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
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

// ── Main component ────────────────────────────────────────────────────────

export function BoardIconPicker({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (icon: string) => void;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(RECENT_KEY);
  const [recents, addRecent] = useRecentEmojis();
  const { groups, isLoading, load } = useEmojiData();

  const closePanel = useCallback(() => { setIsOpen(false); setSearch(''); }, []);

  const openPanel = () => {
    setIsOpen(o => !o);
    load();
  };

  const selectEmoji = (emoji: string) => {
    addRecent(emoji);
    onChange(emoji);
    closePanel();
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

  return (
    <div className="icon-picker">
      <div className="icon-picker__row">
        <button
          type="button"
          className="icon-picker__trigger"
          onClick={openPanel}
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

      {isOpen && createPortal(
        <>
          <div className="icon-picker__overlay" onClick={closePanel} aria-hidden="true" />
          <div
            className="icon-picker__panel"
            role="dialog"
            aria-label="Emoji picker"
            aria-modal="true"
            onKeyDown={e => { if (e.key === 'Escape') closePanel(); }}
          >
          <input
            className="config-option-input icon-picker__search"
            type="text"
            placeholder="Search emoji…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
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
                selectEmoji(custom);
                e.target.value = '';
              }}
            />
          </div>
        </div>
        </>,
        document.body,
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
