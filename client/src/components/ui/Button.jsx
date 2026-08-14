import { Loader2 } from 'lucide-react';
import { cx } from '../../utils/format.js';

const VARIANTS = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
  secondary:
    'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  subtle: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
};

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-11 px-5 text-base gap-2',
  icon: 'h-9 w-9',
};

export const Button = ({
  as: Component = 'button',
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className,
  children,
  ...props
}) => (
  <Component
    className={cx(
      'inline-flex items-center justify-center rounded-lg font-medium transition',
      'disabled:cursor-not-allowed',
      VARIANTS[variant],
      SIZES[size],
      className,
    )}
    disabled={Component === 'button' ? disabled || loading : undefined}
    aria-busy={loading || undefined}
    {...props}
  >
    {loading ? (
      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
    ) : (
      Icon && <Icon size={16} aria-hidden="true" />
    )}
    {children}
  </Component>
);
