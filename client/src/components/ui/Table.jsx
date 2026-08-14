import { cx } from '../../utils/format.js';

/**
 * Table wrapper that scrolls horizontally rather than squashing columns on narrow
 * screens. Pages that need a different mobile shape render cards below `md` instead.
 */
export const TableWrap = ({ className, children }) => (
  <div className={cx('scroll-slim w-full overflow-x-auto', className)}>
    <table className="w-full min-w-[42rem] border-collapse">{children}</table>
  </div>
);

export const THead = ({ children }) => (
  <thead className="border-b border-slate-200 bg-slate-50/70">
    <tr>{children}</tr>
  </thead>
);

export const TH = ({ className, children, ...props }) => (
  <th scope="col" className={cx('table-head', className)} {...props}>
    {children}
  </th>
);

export const TBody = ({ children }) => (
  <tbody className="divide-y divide-slate-100">{children}</tbody>
);

export const TR = ({ className, interactive = false, children, ...props }) => (
  <tr
    className={cx(interactive && 'cursor-pointer transition hover:bg-slate-50', className)}
    {...props}
  >
    {children}
  </tr>
);

export const TD = ({ className, children, ...props }) => (
  <td className={cx('table-cell', className)} {...props}>
    {children}
  </td>
);
