import { useAuth } from '../context/AuthContext.jsx';
import { AdminDashboard } from './dashboard/AdminDashboard.jsx';
import { EmployeeDashboard } from './dashboard/EmployeeDashboard.jsx';

/** One route, two dashboards — chosen by the signed-in user's role. */
export const DashboardPage = () => {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminDashboard /> : <EmployeeDashboard />;
};
