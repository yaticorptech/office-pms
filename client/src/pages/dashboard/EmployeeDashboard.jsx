import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  ListChecks,
  Timer,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader.jsx';
import { StatCard } from '../../components/StatCard.jsx';
import { TaskTable } from '../../components/TaskTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { MetaBadge } from '../../components/ui/Badge.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { useApiResource } from '../../hooks/useApiResource.js';
import { useTaskStatus } from '../../hooks/useTaskStatus.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardApi } from '../../services/resources.js';
import { PROJECT_STATUS_META } from '../../utils/constants.js';
import { typeLabel } from '../../utils/format.js';

export const EmployeeDashboard = () => {
  const { user } = useAuth();
  const fetcher = useCallback((options) => dashboardApi.employee(options), []);
  const { data, loading, error, refetch } = useApiResource(fetcher);
  // Completing a task changes the summary counts, so refetch the whole dashboard.
  const { changeStatus, busyId } = useTaskStatus(refetch);

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <LoadingState label="Loading your tasks…" />
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      </>
    );
  }

  const { summary, activeTasks, myProjects } = data;

  return (
    <>
      <PageHeader
        title={`Hello, ${user?.name?.split(' ')[0] || 'there'}.`}
        description={
          summary.totalTasks === 0
            ? 'You have no tasks assigned right now.'
            : `You have ${summary.todo + summary.inProgress} task${
                summary.todo + summary.inProgress === 1 ? '' : 's'
              } still open.`
        }
      />

      <section aria-label="My tasks summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="My Tasks" value={summary.totalTasks} icon={ListChecks} to="/tasks" />
        <StatCard label="To Do" value={summary.todo} icon={CircleDashed} to="/tasks?status=todo" />
        <StatCard
          label="In Progress"
          value={summary.inProgress}
          icon={Timer}
          tone="blue"
          to="/tasks?status=in_progress"
        />
        <StatCard
          label="Completed"
          value={summary.completed}
          icon={CheckCircle2}
          tone="green"
          to="/tasks?status=completed"
        />
        <StatCard
          label="Overdue"
          value={summary.overdue}
          icon={AlertTriangle}
          tone="red"
          to="/tasks?overdue=true"
          hint={summary.overdue > 0 ? 'Needs attention' : undefined}
        />
      </section>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            title="My active tasks"
            description="Everything assigned to you that isn't completed yet."
            action={
              <Button as={Link} to="/tasks" variant="secondary" size="sm">
                View all
              </Button>
            }
          />
          {activeTasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title={summary.totalTasks === 0 ? 'No tasks assigned yet' : 'You are all caught up'}
              description={
                summary.totalTasks === 0
                  ? 'When an admin assigns you work, it will appear here.'
                  : 'Every task assigned to you has been completed.'
              }
            />
          ) : (
            <TaskTable
              tasks={activeTasks}
              columns={{ project: true, assignee: false }}
              onStatusChange={changeStatus}
              busyTaskId={busyId}
              quickStatus
            />
          )}
        </Card>

        {myProjects.length > 0 && (
          <Card>
            <CardHeader
              title="Projects I'm working on"
              description="Projects that currently have tasks assigned to you."
            />
            <ul className="divide-y divide-slate-100">
              {myProjects.map((project) => (
                <li key={project._id}>
                  <Link
                    to={`/projects/${project._id}`}
                    className="flex flex-col gap-3 px-4 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium text-slate-900">
                        <FolderKanban size={16} className="shrink-0 text-slate-400" />
                        <span className="truncate">{project.name}</span>
                      </p>
                      <p className="mt-0.5 pl-6 text-xs text-slate-500">
                        {[project.type && typeLabel(project.type), `Owner ${project.owner?.name || '—'}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 pl-6 sm:pl-0">
                      <ProgressBar value={project.stats?.progress ?? 0} size="sm" className="w-28" />
                      <span className="w-9 text-right text-xs font-medium text-slate-600">
                        {project.stats?.progress ?? 0}%
                      </span>
                      <MetaBadge map={PROJECT_STATUS_META} value={project.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
};
