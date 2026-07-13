import { useState, useRef, useEffect, useCallback } from 'react';
import { LayoutGrid } from 'lucide-react';
import { DI_PREFIX, diIconUrl } from '../utils/icon-values';
import './ServiceIconPicker.css';
import type { ServiceIcon } from './service-icons.data';

// ── Constants ─────────────────────────────────────────────────────────────

const RECENTS_KEY = 'dashdash:icon-recents';
const RECENTS_MAX = 12;

// Re-exported from utils/icon-values for existing importers.
export { SI_PREFIX, slugFromValue } from '../utils/icon-values';
import { SI_PREFIX, slugFromValue } from '../utils/icon-values';

// ── Category definitions ──────────────────────────────────────────────────

interface CategoryDef {
  key: string;
  label: string;
}

const MAX_RENDERED_ICONS = 150;
const RECENT_KEY = 'recent';
const ALL_KEY = 'all';
const COLORFUL_KEY = 'colorful';

const FIXED_CATEGORIES: CategoryDef[] = [
  { key: RECENT_KEY,   label: 'Recent' },
  { key: COLORFUL_KEY, label: 'Colorful' },
  { key: ALL_KEY,      label: 'All' },
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

// ── Colorful icons (homarr-labs/dashboard-icons via jsDelivr CDN) ─────────

interface DiIcon {
  name: string;
  aliases: string[];
}

// Module-level cache — one metadata fetch per session regardless of how many
// pickers mount. Failure leaves the colorful set empty (monochrome still works).
let diIconsCache: DiIcon[] | null = null;
let diIconsPromise: Promise<DiIcon[]> | null = null;

function fetchDiIcons(): Promise<DiIcon[]> {
  if (diIconsCache) return Promise.resolve(diIconsCache);
  diIconsPromise ??= fetch('https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons@main/metadata.json')
    .then(res => res.json() as Promise<Record<string, { aliases?: string[] }>>)
    .then(meta => {
      diIconsCache = Object.entries(meta)
        .map(([name, entry]) => ({ name, aliases: entry.aliases ?? [] }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return diIconsCache;
    })
    .catch(() => {
      diIconsPromise = null; // allow retry on next open
      return [];
    });
  return diIconsPromise;
}

function useDiIconData(): { diIcons: DiIcon[]; loadDi: () => void } {
  const [diIcons, setDiIcons] = useState<DiIcon[]>(diIconsCache ?? []);
  const requested = useRef(false);
  const loadDi = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    void fetchDiIcons().then(setDiIcons);
  }, []);
  return { diIcons, loadDi };
}

function scoreDiIcon(icon: DiIcon, query: string): number {
  const q = query.toLowerCase().replace(/\s+/g, '-');
  if (icon.name === q) return 4;
  if (icon.name.startsWith(q)) return 3;
  if (icon.name.includes(q)) return 2;
  if (icon.aliases.some(a => a.toLowerCase().includes(q))) return 1;
  return 0;
}

/** One grid entry — monochrome (bundled) or colorful (CDN). */
type PickerEntry =
  | { kind: 'si'; value: string; title: string; icon: ServiceIcon }
  | { kind: 'di'; value: string; title: string; name: string };

const siEntry = (icon: ServiceIcon): PickerEntry =>
  ({ kind: 'si', value: `${SI_PREFIX}${icon.slug}`, title: icon.title, icon });
const diEntry = (icon: DiIcon): PickerEntry =>
  ({ kind: 'di', value: `${DI_PREFIX}${icon.name}`, title: icon.name, name: icon.name });

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
  const { diIcons, loadDi } = useDiIconData();

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
    loadDi();
  };

  const selectEntry = (entry: PickerEntry) => {
    // Recents store full prefixed values; legacy raw entries are si slugs.
    addRecentSlug(entry.value);
    onChange(entry.value);
    closePanel();
  };

  // Resolve current icon for the trigger preview
  const currentSlug = slugFromValue(value);
  const currentIcon = currentSlug ? icons.find(i => i.slug === currentSlug) : undefined;

  // The icon dataset normally loads on first panel open — but the trigger
  // preview needs it immediately when a value is already set (reopening the
  // config modal previously showed a blank placeholder instead of the icon).
  useEffect(() => {
    if (currentSlug) load();
  }, [currentSlug, load]);

  // Compute visible entries across BOTH sets (bundled Simple Icons + CDN
  // colorful icons). Rendering is capped so the grid never mounts thousands
  // of nodes; anything beyond the cap is reachable by refining the search.
  const { visibleEntries, hiddenCount } = (() => {
    const cap = (list: PickerEntry[]) => ({
      visibleEntries: list.slice(0, MAX_RENDERED_ICONS),
      hiddenCount: Math.max(0, list.length - MAX_RENDERED_ICONS),
    });
    if (search.trim()) {
      const q = search.trim();
      // Colorful results first on equal score — they're what users usually want.
      const di = diIcons
        .map(i => ({ entry: diEntry(i), score: scoreDiIcon(i, q) }))
        .filter(({ score }) => score > 0);
      const si = icons
        .map(i => ({ entry: siEntry(i), score: scoreIcon(i, q) }))
        .filter(({ score }) => score > 0);
      return cap([...di, ...si]
        .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title))
        .map(({ entry }) => entry));
    }
    if (activeCategory === RECENT_KEY) {
      return cap(recentSlugs.map(stored => {
        const value = stored.includes(':') ? stored : `${SI_PREFIX}${stored}`;
        if (value.startsWith(DI_PREFIX)) {
          const name = value.slice(DI_PREFIX.length);
          return { kind: 'di', value, title: name, name } as PickerEntry;
        }
        const slug = value.slice(SI_PREFIX.length);
        const icon = icons.find(i => i.slug === slug);
        return icon ? siEntry(icon) : null;
      }).filter((e): e is PickerEntry => e !== null));
    }
    if (activeCategory === COLORFUL_KEY) {
      return cap(diIcons.map(diEntry));
    }
    if (activeCategory === ALL_KEY) {
      // "All" shows the curated selection — the full sets are search-only.
      return cap(icons.filter(i => i.category !== 'other')
        .sort((a, b) => a.title.localeCompare(b.title)).map(siEntry));
    }
    return cap(icons.filter(i => i.category === activeCategory)
      .sort((a, b) => a.title.localeCompare(b.title)).map(siEntry));
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
          {value.startsWith(DI_PREFIX)
            ? <img src={diIconUrl(value.slice(DI_PREFIX.length))} width={24} height={24} alt="" loading="lazy"
                onError={e => { const img = e.currentTarget; if (!img.src.endsWith('.png')) img.src = diIconUrl(value.slice(DI_PREFIX.length), 'png'); }} />
            : currentIcon
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
          ) : visibleEntries.length === 0 ? (
            <div className="sip__empty">
              {activeCategory === RECENT_KEY && !search ? 'No recently used icons' : 'No results'}
            </div>
          ) : (
            <div className="sip__grid-viewport">
              <div className="sip__grid">
                {visibleEntries.map(entry => (
                  <button
                    key={entry.value}
                    type="button"
                    className={`sip__icon-btn${value === entry.value ? ' sip__icon-btn--active' : ''}`}
                    onClick={() => selectEntry(entry)}
                    title={entry.title}
                    aria-pressed={value === entry.value}
                  >
                    {entry.kind === 'si'
                      ? <IconSvg icon={entry.icon} size={22} />
                      : <img
                          src={diIconUrl(entry.name)}
                          width={22}
                          height={22}
                          alt=""
                          loading="lazy"
                          onError={e => { const img = e.currentTarget; if (!img.src.endsWith('.png')) img.src = diIconUrl(entry.name, 'png'); }}
                        />
                    }
                  </button>
                ))}
              </div>
              {hiddenCount > 0 && (
                <div className="sip__more-hint">
                  +{hiddenCount} more — refine your search
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
