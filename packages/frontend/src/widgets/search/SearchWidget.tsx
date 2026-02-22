import { useState, type FormEvent } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { Search } from 'lucide-react';
import './SearchWidget.css';

const ENGINES: Record<string, string> = {
  duckduckgo: 'https://duckduckgo.com/?q={query}',
  google: 'https://www.google.com/search?q={query}',
  brave: 'https://search.brave.com/search?q={query}',
  bing: 'https://www.bing.com/search?q={query}',
};

export function SearchWidget({ options }: WidgetProps) {
  const [query, setQuery] = useState('');

  const engine = (options['engine'] as string | undefined) ?? 'duckduckgo';
  const customUrl = options['customUrl'] as string | undefined;
  const urlTemplate = customUrl ?? ENGINES[engine] ?? ENGINES['duckduckgo']!;
  const placeholder = (options['placeholder'] as string | undefined) ?? 'Search…';

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    const url = urlTemplate.replace('{query}', encodeURIComponent(query.trim()));
    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
  };

  return (
    <form className="search-widget" onSubmit={handleSubmit}>
      <div className="search-widget__inner">
        <Search size={14} className="search-widget__icon" />
        <input
          className="search-widget__input"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label={placeholder}
        />
      </div>
    </form>
  );
}
