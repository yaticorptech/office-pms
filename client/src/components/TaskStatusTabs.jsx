import { cx } from '../utils/format.js';

/**
 * One-click status filtering with live counts, replacing a Status dropdown plus a
 * separate "Overdue only" toggle. Scrolls horizontally on narrow screens.
 *
 * `counts` comes from the tasks API and reflects the other active filters.
 */
const TABS = [
  { id: 'all', label: 'All', countKey: 'all' },
  { id: 'todo', label: 'To Do', countKey: 'todo' },
  { id: 'in_progress', label: 'In Progress', countKey: 'in_progress' },
  { id: 'completed', label: 'Completed', countKey: 'completed' },
  { id: 'overdue', label: 'Overdue', countKey: 'overdue', tone: 'danger' },
];

export const TaskStatusTabs = ({ active = 'all', counts, onChange, loading = false }) => (
  <div className="scroll-slim overflow-x-auto border-b border-slate-200">
    <div className="flex min-w-max gap-1 px-2 pt-2" role="tablist" aria-label="Filter tasks by status">
      {TABS.map((tab) => {
        const isActive = active === tab.id;
        const count = counts?.[tab.countKey];
        const isDanger = tab.tone === 'danger' && count > 0;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cx(
              'flex items-center gap-2 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-2.5 text-sm font-medium transition',
              isActive
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
            )}
          >
            {tab.label}
            {/* Counts stay in place while refetching so the row does not jump. */}
            {count !== undefined && (
              <span
                className={cx(
                  'rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums transition',
                  loading && 'opacity-50',
                  isDanger
                    ? 'bg-red-50 text-red-700'
                    : isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'bg-slate-100 text-slate-600',
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);
