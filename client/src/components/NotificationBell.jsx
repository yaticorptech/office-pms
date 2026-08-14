import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, UserMinus, UserPlus } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.jsx';
import { cx } from '../utils/format.js';

const ICONS = {
  task_assigned: { icon: UserPlus, tone: 'bg-brand-50 text-brand-600' },
  task_reassigned: { icon: UserPlus, tone: 'bg-blue-50 text-blue-600' },
  task_unassigned: { icon: UserMinus, tone: 'bg-slate-100 text-slate-500' },
};

/** "just now", "5m ago", "3h ago", "2d ago" — short enough for a narrow panel. */
const timeAgo = (value) => {
  const seconds = Math.floor((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

/**
 * `align` follows where the bell sits: right-aligned under a top-bar button, but
 * left-aligned in the sidebar, where a right-aligned panel would run off-screen.
 */
export const NotificationBell = ({ className, align = 'right' }) => {
  const { items, unreadCount, markRead, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return undefined;
    // Opening is an explicit "show me what's new", so fetch the freshest list.
    refresh();

    const onClickOutside = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, refresh]);

  const openNotification = (notification) => {
    if (!notification.read) markRead(notification._id);
    setOpen(false);
    if (notification.task?._id) navigate(`/tasks/${notification.task._id}`);
  };

  return (
    <div ref={containerRef} className={cx('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'
        }
        aria-expanded={open}
        className={cx(
          'relative grid h-10 w-10 place-items-center rounded-lg transition',
          open ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
        )}
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cx(
            'absolute z-40 mt-2 w-[20rem] max-w-[calc(100vw-2rem)] animate-slide-up overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop',
            align === 'left' ? 'left-0' : 'right-0',
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 transition hover:text-brand-800"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell size={20} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium text-slate-700">You're all caught up</p>
              <p className="mt-0.5 text-xs text-slate-500">
                New tasks assigned to you will show up here.
              </p>
            </div>
          ) : (
            <ul className="scroll-slim max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
              {items.map((notification) => {
                const meta = ICONS[notification.type] || ICONS.task_assigned;
                const Icon = meta.icon;

                return (
                  <li key={notification._id}>
                    <button
                      type="button"
                      onClick={() => openNotification(notification)}
                      className={cx(
                        'flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50',
                        !notification.read && 'bg-brand-50/40',
                      )}
                    >
                      <span
                        className={cx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full', meta.tone)}
                      >
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-slate-900">
                          {notification.title}
                        </span>
                        {notification.message && (
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {notification.message}
                          </span>
                        )}
                        <span className="mt-1 block text-xs text-slate-400">
                          {notification.actor?.name ? `${notification.actor.name} · ` : ''}
                          {timeAgo(notification.createdAt)}
                        </span>
                      </span>
                      {!notification.read && (
                        <span
                          className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500"
                          aria-label="Unread"
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
