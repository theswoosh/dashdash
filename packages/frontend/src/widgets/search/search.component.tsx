import { useState, type FormEvent } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { Search } from 'lucide-react';
import { useSettings } from '../../hooks/use-settings.hook';
import './SearchWidget.css';

export function SearchWidget({ options }: WidgetProps) {
  const [query, setQuery] = useState('');
  const settings = useSettings();

  const engineId = options['engine'] as string | undefined;
  const engine = engineId
    ? settings.searchEngines?.find(e => e.id === engineId)
    : settings.searchEngines?.[0];

  const placeholder = (options['placeholder'] as string | undefined) ?? engine?.placeholder ?? '';

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!engine || !query.trim()) return;
    if (!/^https?:\/\//i.test(engine.url)) return;
    const url = engine.url.replace('{query}', encodeURIComponent(query.trim()));
    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
  };

  return (
    <form className="search-widget" onSubmit={submitSearch}>
      <div className="search-widget__inner">
        <Search size={14} className="search-widget__icon" />
        <input
          className="search-widget__input"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label={placeholder || 'Search'}
          disabled={!engine}
        />
      </div>
    </form>
  );
}
