import { useState, type FormEvent } from 'react';
import { Search } from 'lucide-react';
import type { SearchEngine } from '../hooks/use-settings.hook';

interface Props {
  engine?: string | undefined;
  engines: readonly SearchEngine[];
}

export function TopbarSearch({ engine, engines }: Props) {
  const [query, setQuery] = useState('');

  const selectedEngine = engine
    ? (engines.find(e => e.id === engine) ?? engines[0])
    : engines[0];
  const resolvedPlaceholder = selectedEngine?.placeholder || 'Search…';

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedEngine || !query.trim()) return;
    const url = selectedEngine.url.replace('{query}', encodeURIComponent(query.trim()));
    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
  };

  return (
    <form className="topbar-search" onSubmit={submitSearch}>
      <Search size={13} className="topbar-search__icon" />
      <input
        className="topbar-search__input"
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={resolvedPlaceholder}
        aria-label={resolvedPlaceholder}
      />
    </form>
  );
}
