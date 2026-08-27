import { cx, initialsOf } from '../../utils/format.js';

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-lg',
};

// Deterministic colour per person, so the same name always looks the same.
const PALETTE = [
  'bg-brand-100 text-brand-700',
  'bg-green-100 text-green-700',
  'bg-amber-100 text-amber-800',
  'bg-purple-100 text-purple-700',
  'bg-rose-100 text-rose-700',
  'bg-teal-100 text-teal-700',
];

const paletteFor = (name = '') => {
  const sum = [...name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return PALETTE[sum % PALETTE.length];
};

export const Avatar = ({ name = '', src, size = 'sm', className }) => {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cx('shrink-0 rounded-full object-cover', SIZES[size], className)}
      />
    );
  }

  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        SIZES[size],
        paletteFor(name),
        className,
      )}
      aria-hidden="true"
    >
      {initialsOf(name)}
    </span>
  );
};

/** Avatar + name (+ optional second line), used in tables and lists. */
export const UserCell = ({ user, subtitle, size = 'sm' }) => {
  if (!user) return <span className="text-sm text-slate-400">Unassigned</span>;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={user.name} src={user.profilePhoto} size={size} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
        {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
};

/**
 * Renders a task's assignees: one person looks like a UserCell, several become a
 * stack of overlapping avatars with first names. Accepts an array or (for data
 * written before multi-assignee support) a single user object.
 */
export const AssigneeCell = ({ users, subtitle, size = 'sm', max = 3 }) => {
  const list = [].concat(users ?? []).filter((user) => user && user.name);

  if (list.length === 0) return <span className="text-sm text-slate-400">Unassigned</span>;
  if (list.length === 1) return <UserCell user={list[0]} subtitle={subtitle} size={size} />;

  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  const firstNames = shown.map((user) => user.name.split(' ')[0]).join(', ');

  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex shrink-0 -space-x-2">
        {shown.map((user) => (
          <Avatar
            key={user._id || user.name}
            name={user.name}
            src={user.profilePhoto}
            size={size}
            className="ring-2 ring-white"
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">
          {firstNames}
          {extra > 0 && <span className="text-slate-500"> +{extra}</span>}
        </p>
        <p className="truncate text-xs text-slate-500">{subtitle || `${list.length} assignees`}</p>
      </div>
    </div>
  );
};
