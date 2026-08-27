import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { Avatar } from './Avatar.jsx';
import { cx } from '../../utils/format.js';

/**
 * Type-to-filter picker used for choosing an employee or a project.
 * Keyboard: ↑/↓ to move, Enter to pick, Escape to close.
 *
 * With `multiple`, `value` is an array of ids: picking toggles membership, the
 * panel stays open, and each selection is shown as a removable chip.
 */
export const SearchSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'No matches found',
  showAvatar = false,
  clearable = false,
  disabled = false,
  invalid = false,
  multiple = false,
  id,
  describedBy,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const values = useMemo(
    () => (multiple ? (Array.isArray(value) ? value : []) : []),
    [multiple, value],
  );

  const selected = useMemo(
    () => (multiple ? null : options.find((option) => option.value === value) || null),
    [multiple, options, value],
  );

  const selectedOptions = useMemo(
    () => (multiple ? options.filter((option) => values.includes(option.value)) : []),
    [multiple, options, values],
  );

  const isSelected = (optionValue) =>
    multiple ? values.includes(optionValue) : optionValue === value;

  const hasSelection = multiple ? selectedOptions.length > 0 : Boolean(selected);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(term) ||
        (option.description || '').toLowerCase().includes(term),
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus after the panel paints, otherwise the caret lands nowhere.
      const timer = setTimeout(() => inputRef.current?.focus(), 20);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [open]);

  // Keeps the highlighted row inside the scroll viewport during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const select = (option) => {
    if (multiple) {
      // Toggle membership and keep the panel open so several people can be picked.
      onChange(
        values.includes(option.value)
          ? values.filter((entry) => entry !== option.value)
          : [...values, option.value],
      );
      return;
    }
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[activeIndex]) select(filtered[activeIndex]);
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        aria-describedby={describedBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cx(
          'field-control flex items-center justify-between gap-2 text-left',
          invalid && 'field-control-error',
          !hasSelection && 'text-slate-400',
        )}
      >
        {multiple ? (
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            {selectedOptions.length === 0 ? (
              <span className="truncate">{placeholder}</span>
            ) : (
              selectedOptions.map((option) => (
                <span
                  key={option.value}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2 pr-1 text-xs font-medium text-slate-700"
                >
                  <span className="truncate">{option.label}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${option.label}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onChange(values.filter((entry) => entry !== option.value));
                    }}
                    className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                  >
                    <X size={11} />
                  </span>
                </span>
              ))
            )}
          </span>
        ) : (
          <span className="flex min-w-0 items-center gap-2">
            {showAvatar && selected && <Avatar name={selected.label} size="xs" />}
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1">
          {clearable && selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear selection"
              onClick={(event) => {
                event.stopPropagation();
                onChange('');
              }}
              className="rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown size={16} className="text-slate-400" />
        </span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full animate-fade-in overflow-hidden rounded-lg border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search size={15} className="shrink-0 text-slate-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full border-0 p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-0"
            />
          </div>

          <ul ref={listRef} role="listbox" className="scroll-slim max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-slate-500">{emptyMessage}</li>
            ) : (
              filtered.map((option, index) => (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected(option.value)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => select(option)}
                  className={cx(
                    'flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm',
                    index === activeIndex ? 'bg-slate-50' : 'bg-white',
                  )}
                >
                  {showAvatar && <Avatar name={option.label} size="xs" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-slate-900">{option.label}</span>
                    {option.description && (
                      <span className="block truncate text-xs text-slate-500">
                        {option.description}
                      </span>
                    )}
                  </span>
                  {isSelected(option.value) && (
                    <Check size={16} className="shrink-0 text-brand-600" aria-hidden="true" />
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
};
