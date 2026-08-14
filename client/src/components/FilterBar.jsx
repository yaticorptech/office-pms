import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/Button.jsx';
import { Select } from './ui/Field.jsx';
import { cx } from '../utils/format.js';

/**
 * Search box plus a row of dropdown filters. On mobile the dropdowns collapse behind
 * a "Filters" toggle so the list stays the focus of the screen.
 */
export const FilterBar = ({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  filters = [],
  extra,
  onReset,
}) => {
  const [expanded, setExpanded] = useState(false);
  const activeCount =
    filters.filter((filter) => filter.value && filter.value !== 'all').length +
    (search ? 1 : 0) +
    (extra?.active ? 1 : 0);

  return (
    <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="field-control pl-9"
          />
        </div>

        {filters.length > 0 && (
          <Button
            variant="secondary"
            icon={SlidersHorizontal}
            onClick={() => setExpanded((current) => !current)}
            className="sm:hidden"
            aria-expanded={expanded}
          >
            Filters
            {activeCount > 0 && (
              <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-xs font-semibold text-white">
                {activeCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {filters.length > 0 && (
        <div
          className={cx(
            'mt-3 gap-2 sm:mt-3 sm:flex sm:flex-wrap sm:items-center',
            expanded ? 'grid grid-cols-1 sm:grid-cols-none' : 'hidden sm:flex',
          )}
        >
          {filters.map((filter) => (
            <Select
              key={filter.name}
              value={filter.value ?? 'all'}
              onChange={(event) => filter.onChange(event.target.value)}
              aria-label={filter.label}
              className="sm:w-auto sm:min-w-[9.5rem]"
            >
              <option value="all">{filter.label}: All</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ))}

          {extra?.node}

          {activeCount > 0 && onReset && (
            <Button variant="ghost" size="sm" icon={X} onClick={onReset}>
              Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
