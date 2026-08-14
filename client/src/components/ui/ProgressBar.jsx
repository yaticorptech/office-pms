import { cx } from '../../utils/format.js';

const toneFor = (value) => {
  if (value >= 100) return 'bg-green-500';
  if (value >= 50) return 'bg-brand-500';
  if (value > 0) return 'bg-amber-500';
  return 'bg-slate-300';
};

export const ProgressBar = ({ value = 0, showLabel = false, size = 'md', className, label }) => {
  const safeValue = Math.min(Math.max(Math.round(value) || 0, 0), 100);

  return (
    <div className={cx('w-full', className)}>
      {(showLabel || label) && (
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-slate-600">{label || 'Progress'}</span>
          <span className="font-medium text-slate-900">{safeValue}%</span>
        </div>
      )}
      <div
        className={cx('w-full overflow-hidden rounded-full bg-slate-100', size === 'sm' ? 'h-1.5' : 'h-2')}
        role="progressbar"
        aria-valuenow={safeValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div
          className={cx('h-full rounded-full transition-all duration-300', toneFor(safeValue))}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
};
