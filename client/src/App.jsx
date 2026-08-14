import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout.jsx';
import { ProtectedRoute, PublicOnlyRoute } from './routes/ProtectedRoute.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { ProjectsPage } from './pages/ProjectsPage.jsx';
import { ProjectFormPage } from './pages/ProjectFormPage.jsx';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage.jsx';
import { TasksPage } from './pages/TasksPage.jsx';
import { TaskDetailsPage } from './pages/TaskDetailsPage.jsx';
import { EmployeesPage } from './pages/EmployeesPage.jsx';
import { EmployeeDetailsPage } from './pages/EmployeeDetailsPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';

const App = () => (
  <Routes>
    <Route element={<PublicOnlyRoute />}>
      <Route path="/login" element={<LoginPage />} />
    </Route>

    <Route element={<ProtectedRoute />}>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* Employees may read project context for their own tasks. */}
        <Route path="/projects/:id" element={<ProjectDetailsPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailsPage />} />
        <Route path="/profile" element={<ProfilePage />} />

        <Route element={<ProtectedRoute adminOnly />}>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/new" element={<ProjectFormPage />} />
          <Route path="/projects/:id/edit" element={<ProjectFormPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/employees/:id" element={<EmployeeDetailsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Route>
  </Routes>
);

export default App;
