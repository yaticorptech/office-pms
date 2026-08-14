import { useId } from 'react';
import { cx } from '../../utils/format.js';

/** Label + control + inline error, wired together for screen readers. */
export const Field = ({ label, error, hint, required, children, className }) => {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="field-label">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1.5 text-sm text-slate-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
};

export const Input = ({ invalid, className, ...props }) => (
  <input className={cx('field-control', invalid && 'field-control-error', className)} {...props} />
);

export const Textarea = ({ invalid, className, rows = 4, ...props }) => (
  <textarea
    rows={rows}
    className={cx('field-control resize-y', invalid && 'field-control-error', className)}
    {...props}
  />
);

export const Select = ({ invalid, className, children, ...props }) => (
  <select
    className={cx(
      'field-control appearance-none bg-[length:16px] bg-[right_0.6rem_center] bg-no-repeat pr-9',
      invalid && 'field-control-error',
      className,
    )}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
    }}
    {...props}
  >
    {children}
  </select>
);
