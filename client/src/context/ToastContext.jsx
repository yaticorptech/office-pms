import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { cx } from '../utils/format.js';

const ToastContext = createContext(null);

const TONES = {
  success: { icon: CheckCircle2, ring: 'ring-green-200', iconClass: 'text-green-600' },
  error: { icon: XCircle, ring: 'ring-red-200', iconClass: 'text-red-600' },
  warning: { icon: AlertTriangle, ring: 'ring-amber-200', iconClass: 'text-amber-600' },
  info: { icon: Info, ring: 'ring-slate-200', iconClass: 'text-slate-600' },
};

const DURATION = 4000;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (message, type = 'info') => {
      if (!message) return;
      nextId.current += 1;
      const id = nextId.current;
      setToasts((current) => [...current, { id, message, type }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), DURATION),
      );
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      toast: {
        success: (message) => push(message, 'success'),
        error: (message) => push(message, 'error'),
        warning: (message) => push(message, 'warning'),
        info: (message) => push(message, 'info'),
      },
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Anchored bottom-right: top-right would sit over each page's primary action. */}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
        role="status"
        aria-live="polite"
      >
        {toasts.map(({ id, message, type }) => {
          const tone = TONES[type] || TONES.info;
          const Icon = tone.icon;
          return (
            <div
              key={id}
              className={cx(
                'pointer-events-auto flex w-full max-w-sm animate-slide-up items-start gap-3 rounded-xl bg-white p-3.5 shadow-pop ring-1',
                tone.ring,
              )}
            >
              <Icon size={18} className={cx('mt-0.5 shrink-0', tone.iconClass)} />
              <p className="flex-1 text-sm text-slate-700">{message}</p>
              <button
                type="button"
                onClick={() => dismiss(id)}
                className="shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside a ToastProvider');
  return context.toast;
};
