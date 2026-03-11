import { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import './ServiceIconPicker.css';
import type { ServiceIcon } from './service-icons.data';

// ── Constants ─────────────────────────────────────────────────────────────

const RECENTS_KEY = 'dashdash:icon-recents';
const RECENTS_MAX = 12;

/** Value prefix used in YAML: "si:plex" */
export const SI_PREFIX = 'si:';

export function slugFromValue(value: string): string | null {
  if (!value.startsWith(SI_PREFIX)) return null;
  return value.slice(SI_PREFIX.length);
}

// ── Category definitions ──────────────────────────────────────────────────

interface CategoryDef {
  key: string;
  label: string;
}

const RECENT_KEY = 'recent';
const ALL_KEY = 'all';

const FIXED_CATEGORIES: CategoryDef[] = [
  { key: RECENT_KEY, label: 'Recent' },
  { key: ALL_KEY,    label: 'All' },
];

const DATA_CATEGORIES: CategoryDef[] = [
  { key: 'media',       label: 'Media' },
  { key: 'storage',     label: 'Storage' },
  { key: 'network',     label: 'Network' },
  { key: 'security',    label: 'Security' },
  { key: 'monitoring',  label: 'Monitor' },
  { key: 'infra',       label: 'Infra' },
  { key: 'databases',   label: 'Databases' },
  { key: 'dev',         label: 'Dev' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'download',    label: 'Download' },
  { key: 'home',        label: 'Home' },
];

// ── Recent slugs hook ─────────────────────────────────────────────────────

function useRecentIconSlugs(): [string[], (slug: string) => void] {
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(RECENTS_KEY);
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      return [];
    }
  });

  const addRecent = useCallback((slug: string) => {
    setRecents(prev => {
      const next = [slug, ...prev.filter(s => s !== slug)].slice(0, RECENTS_MAX);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* quota */ }
      return next;
    });
  }, []);

  return [recents, addRecent];
}

// ── Icon data hook ────────────────────────────────────────────────────────

interface IconDataHook {
  icons: ServiceIcon[];
  isLoading: boolean;
  load: () => void;
}

function useIconData(): IconDataHook {
  const [icons, setIcons] = useState<ServiceIcon[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loaded = useRef(false);

  const load = useCallback(() => {
    if (loaded.current) return;
    loaded.current = true;
    setIsLoading(true);
    void import('./service-icons.data').then(mod => {
      setIcons(mod.SERVICE_ICONS);
      setIsLoading(false);
    });
  }, []);

  return { icons, isLoading, load };
}

// ── Score-based fuzzy search ──────────────────────────────────────────────

function scoreIcon(icon: ServiceIcon, query: string): number {
  const q = query.toLowerCase();
  const title = icon.title.toLowerCase();
  if (title === q) return 4;
  if (title.startsWith(q)) return 3;
  if (title.includes(q)) return 2;
  if (icon.slug.includes(q)) return 2;
  if (icon.keywords.some(k => k.includes(q))) return 1;
  return 0;
}

// ── SVG rendering helper ──────────────────────────────────────────────────

function IconSvg({ icon, size = 20 }: { icon: ServiceIcon; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={`#${icon.hex}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d={icon.path} />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export function ServiceIconPicker({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (icon: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState(RECENT_KEY);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [recentSlugs, addRecentSlug] = useRecentIconSlugs();
  const { icons, isLoading, load } = useIconData();

  const closePanel = useCallback(() => { setIsOpen(false); setSearch(''); }, []);

  // Click-outside to close
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (pickerRef.current && e.target instanceof Node && !pickerRef.current.contains(e.target)) {
        closePanel();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen, closePanel]);

  const openPanel = () => {
    setIsOpen(o => !o);
    load();
  };

  const selectIcon = (icon: ServiceIcon) => {
    addRecentSlug(icon.slug);
    onChange(`${SI_PREFIX}${icon.slug}`);
    closePanel();
  };

  // Resolve current icon for the trigger preview
  const currentSlug = slugFromValue(value);
  const currentIcon = currentSlug ? icons.find(i => i.slug === currentSlug) : undefined;

  // Compute visible icons
  const visibleIcons: ServiceIcon[] = (() => {
    if (search.trim()) {
      const q = search.trim();
      return icons
        .map(i => ({ icon: i, score: scoreIcon(i, q) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.icon.title.localeCompare(b.icon.title))
        .map(({ icon }) => icon);
    }
    if (activeCategory === RECENT_KEY) {
      return recentSlugs.map(s => icons.find(i => i.slug === s)).filter(Boolean) as ServiceIcon[];
    }
    if (activeCategory === ALL_KEY) {
      return [...icons].sort((a, b) => a.title.localeCompare(b.title));
    }
    return icons.filter(i => i.category === activeCategory).sort((a, b) => a.title.localeCompare(b.title));
  })();

  return (
    <div className="sip" ref={pickerRef}>
      <div className="sip__row">
        <button
          type="button"
          className="sip__trigger"
          onClick={openPanel}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          title="Pick app icon"
        >
          {currentIcon
            ? <IconSvg icon={currentIcon} size={24} />
            : <LayoutGrid size={18} strokeWidth={1.5} className="sip__trigger-placeholder" />
          }
        </button>
        {value && (
          <button
            type="button"
            className="sip__clear"
            onClick={() => { onChange(''); closePanel(); }}
            aria-label="Remove icon"
          >
            ×
          </button>
        )}
      </div>

      {isOpen && (
        <div
          className="sip__panel"
          role="dialog"
          aria-label="Service icon picker"
          onKeyDown={e => { if (e.key === 'Escape') closePanel(); }}
        >
          <input
            className="config-input sip__search"
            type="text"
            placeholder="Search apps…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />

          {!search && (
            <div className="sip__tabs" role="tablist">
              {[...FIXED_CATEGORIES, ...DATA_CATEGORIES].map(cat => (
                <button
                  key={cat.key}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === cat.key}
                  title={cat.label}
                  className={`sip__tab${activeCategory === cat.key ? ' sip__tab--active' : ''}`}
                  onClick={() => setActiveCategory(cat.key)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          )}

          {isLoading ? (
            <div className="sip__loading">Loading…</div>
          ) : visibleIcons.length === 0 ? (
            <div className="sip__empty">
              {activeCategory === RECENT_KEY && !search ? 'No recently used icons' : 'No results'}
            </div>
          ) : (
            <div className="sip__grid-viewport">
              <div className="sip__grid">
                {visibleIcons.map(icon => (
                  <button
                    key={icon.slug}
                    type="button"
                    className={`sip__icon-btn${value === `${SI_PREFIX}${icon.slug}` ? ' sip__icon-btn--active' : ''}`}
                    onClick={() => selectIcon(icon)}
                    title={icon.title}
                    aria-pressed={value === `${SI_PREFIX}${icon.slug}`}
                  >
                    <IconSvg icon={icon} size={22} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
