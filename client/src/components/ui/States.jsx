import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';
import { cx } from '../../utils/format.js';

export const Spinner = ({ className, size = 20 }) => (
  <Loader2 size={size} className={cx('animate-spin text-slate-400', className)} aria-hidden="true" />
);

export const LoadingState = ({ label = 'Loading…', className }) => (
  <div className={cx('flex flex-col items-center justify-center gap-3 px-6 py-14', className)}>
    <Spinner size={24} />
    <p className="text-sm text-slate-500">{label}</p>
  </div>
);

/** Grey placeholder rows that match the shape of the table being loaded. */
export const TableSkeleton = ({ rows = 5, columns = 5 }) => (
  <div className="divide-y divide-slate-100" aria-hidden="true">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
        {Array.from({ length: columns }).map((__, columnIndex) => (
          <div
            key={columnIndex}
            className="h-3.5 animate-pulse rounded bg-slate-100"
            style={{ width: columnIndex === 0 ? '28%' : `${Math.max(48 / columns, 10)}%` }}
          />
        ))}
      </div>
    ))}
  </div>
);

export const EmptyState = ({ icon: Icon, title, description, action, className }) => (
  <div className={cx('flex flex-col items-center px-6 py-14 text-center', className)}>
    {Icon && (
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon size={22} aria-hidden="true" />
      </div>
    )}
    <p className="text-base font-medium text-slate-900">{title}</p>
    {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const ErrorState = ({ error, onRetry, className }) => (
  <div className={cx('flex flex-col items-center px-6 py-14 text-center', className)}>
    <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500">
      <AlertCircle size={22} aria-hidden="true" />
    </div>
    <p className="text-base font-medium text-slate-900">Something went wrong</p>
    <p className="mt-1 max-w-md text-sm text-slate-500">
      {error?.message || 'The data could not be loaded.'}
    </p>
    {onRetry && (
      <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry} className="mt-5">
        Try again
      </Button>
    )}
  </div>
);
