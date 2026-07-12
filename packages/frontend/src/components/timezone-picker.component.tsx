import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import './timezone-picker.css';

const MAX_VISIBLE_RESULTS = 200;

function supportedTimezones(): string[] {
  return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone');
}

/** Current DST-aware GMT offset for a zone, e.g. "GMT+2" (dashtest #26 —
 *  offsets are shown in the picker's list, not on the clock widget). */
function gmtOffset(zone: string, at: Date): string {
  try {
    const raw = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(at).find(p => p.type === 'timeZoneName')?.value ?? '';
    return raw.replace(/^GMT([+-])0?(\d+):00$/, 'GMT$1$2').replace(/^GMT$/, 'GMT+0');
  } catch {
    return '';
  }
}

interface TimezonePickerProps {
  readonly value: string;
  readonly placeholder?: string | undefined;
  /** Fired with a valid IANA zone (picked) or '' (cleared). */
  readonly onChange: (tz: string) => void;
}

/** Searchable IANA timezone combobox: type to filter, arrows + Enter to pick.
 *  Only a listed zone (or empty = host default) can be committed — free text
 *  that matches nothing snaps back on blur, so an invalid zone can't be saved. */
export function TimezonePicker({ value, placeholder, onChange }: TimezonePickerProps) {
  const zones = useMemo(() => supportedTimezones(), []);
  const [query, setQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/\s+/g, '_');
    const filtered = q === '' ? zones : zones.filter(z => z.toLowerCase().includes(q));
    return filtered.slice(0, MAX_VISIBLE_RESULTS);
  }, [zones, query]);

  // Offsets computed once, lazily on first open — ~400 Intl constructions
  // are too heavy for mount or per keystroke. DST granularity of "while the
  // picker is open" is plenty.
  const [offsets, setOffsets] = useState<Map<string, string> | null>(null);
  useEffect(() => {
    if (!isOpen || offsets) return;
    const at = new Date();
    setOffsets(new Map(zones.map(z => [z, gmtOffset(z, at)])));
  }, [isOpen, offsets, zones]);

  const close = useCallback(() => { setIsOpen(false); setActiveIndex(0); }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) {
        setQuery(value);
        close();
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen, close, value]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const el = listRef.current.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  const pick = (tz: string) => {
    onChange(tz);
    setQuery(tz);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) { setIsOpen(true); return; }
    if (!isOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[activeIndex]) pick(matches[activeIndex]); }
    else if (e.key === 'Escape') { e.stopPropagation(); setQuery(value); close(); }
  };

  const commitOnBlur = () => {
    const trimmed = query.trim();
    if (trimmed === '') { if (value !== '') onChange(''); return; }
    const exact = zones.find(z => z.toLowerCase() === trimmed.toLowerCase().replace(/\s+/g, '_'));
    if (exact) { if (exact !== value) onChange(exact); setQuery(exact); }
    else setQuery(value);
  };

  return (
    <div className="tz-picker" ref={rootRef}>
      <input
        className="config-input"
        type="text"
        role="combobox"
        aria-expanded={isOpen}
        aria-autocomplete="list"
        value={query}
        placeholder={placeholder ?? 'e.g. Europe/Berlin'}
        onFocus={() => setIsOpen(true)}
        onChange={e => { setQuery(e.target.value); setIsOpen(true); setActiveIndex(0); }}
        onKeyDown={onKeyDown}
        onBlur={() => { if (!isOpen) commitOnBlur(); }}
      />
      {isOpen && matches.length > 0 && (
        <ul className="tz-picker__list" role="listbox" ref={listRef}>
          {matches.map((tz, i) => (
            <li
              key={tz}
              role="option"
              aria-selected={tz === value}
              className={`tz-picker__option${i === activeIndex ? ' tz-picker__option--active' : ''}${tz === value ? ' tz-picker__option--selected' : ''}`}
              onMouseDown={e => { e.preventDefault(); pick(tz); }}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <span>{tz}</span>
              <span className="tz-picker__offset">{offsets?.get(tz) ?? ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
