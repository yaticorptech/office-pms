import { NavLink } from 'react-router-dom';
import { CheckSquare, FolderKanban, LayoutDashboard, LogOut, User, Users } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar.jsx';
import { NotificationBell } from '../components/NotificationBell.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { cx, typeLabel } from '../utils/format.js';

const ADMIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/employees', label: 'Employees', icon: Users },
];

const EMPLOYEE_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'My Tasks', icon: CheckSquare },
];

export const Logo = () => (
  <div className="flex items-center gap-2.5">
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">
      <CheckSquare size={17} aria-hidden="true" />
    </span>
    <span className="text-base font-semibold tracking-tight text-slate-900">Workly</span>
  </div>
);

export const SidebarContent = ({ onNavigate, showBell = false }) => {
  const { user, isAdmin, signOut } = useAuth();
  const items = isAdmin ? ADMIN_NAV : EMPLOYEE_NAV;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between gap-2 pl-5 pr-3">
        <Logo />
        {/* Desktop only: on mobile the bell lives in the top bar, always reachable. */}
        {showBell && <NotificationBell align="left" />}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Main navigation">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
                isActive
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )
            }
          >
            <Icon size={18} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3">
        {/* Identity is display-only; the two labelled rows below are the actions,
            so "Profile" is never hidden behind an avatar that looks decorative. */}
        <div className="flex items-center gap-3 px-2 pb-1 pt-1.5">
          <Avatar name={user?.name} src={user?.profilePhoto} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">
              {isAdmin ? 'Admin' : typeLabel(user?.department)}
            </p>
          </div>
        </div>

        <NavLink
          to="/profile"
          onClick={onNavigate}
          className={({ isActive }) =>
            cx(
              'mt-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition',
              isActive
                ? 'bg-brand-50 text-brand-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
            )
          }
        >
          <User size={18} aria-hidden="true" />
          My Profile
        </NavLink>

        <button
          type="button"
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          <LogOut size={18} aria-hidden="true" />
          Logout
        </button>
      </div>
    </div>
  );
};
