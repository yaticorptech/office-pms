import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { LoadingState } from '../components/ui/States.jsx';
import { ROLES } from '../utils/constants.js';

/**
 * Frontend route guard. This is a UX convenience only — every endpoint enforces the
 * same rules independently on the server.
 */
export const ProtectedRoute = ({ adminOnly = false }) => {
  const { isAuthenticated, isAdmin, initialising } = useAuth();
  const location = useLocation();

  if (initialising) {
    return (
      <div className="grid min-h-screen place-items-center">
        <LoadingState label="Loading your workspace…" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;

  return <Outlet />;
};

export const PublicOnlyRoute = () => {
  const { isAuthenticated, initialising } = useAuth();

  if (initialising) {
    return (
      <div className="grid min-h-screen place-items-center">
        <LoadingState label="Loading…" />
      </div>
    );
  }

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
};

export { ROLES };
