import { cx } from '../../utils/format.js';

export const Card = ({ className, children, ...props }) => (
  <div
    className={cx('rounded-xl border border-slate-200 bg-white shadow-card', className)}
    {...props}
  >
    {children}
  </div>
);

export const CardHeader = ({ title, description, action, className }) => (
  <div
    className={cx(
      'flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5',
      className,
    )}
  >
    <div className="min-w-0">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

export const CardBody = ({ className, children }) => (
  <div className={cx('p-4 sm:p-5', className)}>{children}</div>
);
