import { cx } from '../../utils/format.js';

const TONES = {
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
  blue: 'bg-blue-50 text-blue-700 ring-blue-200',
  green: 'bg-green-50 text-green-700 ring-green-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  purple: 'bg-purple-50 text-purple-700 ring-purple-200',
};

export const Badge = ({ tone = 'slate', className, children }) => (
  <span
    className={cx(
      'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
      TONES[tone] || TONES.slate,
      className,
    )}
  >
    {children}
  </span>
);

/** Reads its label and colour from one of the `*_META` maps. */
export const MetaBadge = ({ map, value, className }) => {
  const meta = map[value];
  if (!meta) return <span className="text-sm text-slate-400">—</span>;
  return (
    <Badge tone={meta.tone} className={className}>
      {meta.label}
    </Badge>
  );
};
