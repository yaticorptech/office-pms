import { Link } from 'react-router-dom';
import { cx } from '../utils/format.js';

const TONES = {
  slate: 'bg-slate-100 text-slate-600',
  brand: 'bg-brand-50 text-brand-600',
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
};

export const StatCard = ({ label, value, icon: Icon, tone = 'slate', to, hint }) => {
  const content = (
    <>
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <p className="min-w-0 break-words text-sm font-medium text-slate-500">{label}</p>
        {/* Hidden on phones: three stat cards plus a 32px icon cannot fit a 390px row. */}
        {Icon && (
          <span
            className={cx(
              'hidden h-8 w-8 shrink-0 place-items-center rounded-lg sm:grid',
              TONES[tone],
            )}
          >
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );

  const className = cx(
    'rounded-xl border border-slate-200 bg-white p-3 shadow-card transition sm:p-4',
    to && 'hover:border-slate-300 hover:shadow-pop',
  );

  return to ? (
    <Link to={to} className={cx(className, 'block')}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
};
