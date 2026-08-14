import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  FolderKanban,
  ListChecks,
  Plus,
  Timer,
  Zap,
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader.jsx';
import { StatCard } from '../../components/StatCard.jsx';
import { TaskTable } from '../../components/TaskTable.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card, CardHeader } from '../../components/ui/Card.jsx';
import { MetaBadge } from '../../components/ui/Badge.jsx';
import { ProgressBar } from '../../components/ui/ProgressBar.jsx';
import { UserCell } from '../../components/ui/Avatar.jsx';
import { TBody, TD, TH, THead, TR, TableWrap } from '../../components/ui/Table.jsx';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States.jsx';
import { useApiResource } from '../../hooks/useApiResource.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { dashboardApi } from '../../services/resources.js';
import { PROJECT_STATUS_META } from '../../utils/constants.js';
import { formatDate, typeLabel } from '../../utils/format.js';

const ProjectRows = ({ projects }) => (
  <>
    <div className="hidden md:block">
      <TableWrap>
        <THead>
          <TH>Project</TH>
          <TH>Owner</TH>
          <TH className="w-44">Progress</TH>
          <TH>Status</TH>
          <TH>Due Date</TH>
        </THead>
        <TBody>
          {projects.map((project) => (
            <TR key={project._id}>
              <TD>
                <Link
                  to={`/projects/${project._id}`}
                  className="font-medium text-slate-900 transition hover:text-brand-700"
                >
                  {project.name}
                </Link>
                {project.type && (
                  <p className="text-xs text-slate-400">{typeLabel(project.type)}</p>
                )}
              </TD>
              <TD>
                <UserCell user={project.owner} />
              </TD>
              <TD>
                <div className="flex items-center gap-2">
                  <ProgressBar value={project.stats?.progress ?? 0} size="sm" className="w-24" />
                  <span className="text-xs font-medium text-slate-600">
                    {project.stats?.progress ?? 0}%
                  </span>
                </div>
              </TD>
              <TD>
                <MetaBadge map={PROJECT_STATUS_META} value={project.status} />
              </TD>
              <TD className="whitespace-nowrap">{formatDate(project.endDate)}</TD>
            </TR>
          ))}
        </TBody>
      </TableWrap>
    </div>

    <ul className="divide-y divide-slate-100 md:hidden">
      {projects.map((project) => (
        <li key={project._id} className="px-4 py-4">
          <Link to={`/projects/${project._id}`} className="block">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900">{project.name}</p>
                {project.type && (
                  <p className="text-xs text-slate-500">{typeLabel(project.type)}</p>
                )}
              </div>
              <MetaBadge map={PROJECT_STATUS_META} value={project.status} />
            </div>
            <ProgressBar
              value={project.stats?.progress ?? 0}
              className="mt-3"
              showLabel
              label={`${project.stats?.completed ?? 0}/${project.stats?.totalTasks ?? 0} tasks`}
            />
          </Link>
        </li>
      ))}
    </ul>
  </>
);

export const AdminDashboard = () => {
  const { user } = useAuth();
  const fetcher = useCallback((options) => dashboardApi.admin(options), []);
  const { data, loading, error, refetch } = useApiResource(fetcher);

  if (loading && !data) {
    return (
      <>
        <PageHeader title="Dashboard" />
        <Card>
          <LoadingState label="Loading dashboard…" />
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

  const { summary, recentProjects, recentTasks, overdueTasks } = data;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user?.name?.split(' ')[0] || 'there'}.`}
        description="Here's what's happening across the company right now."
        action={
          <Button as={Link} to="/projects/new" icon={Plus}>
            New project
          </Button>
        }
      />

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total Projects"
          value={summary.totalProjects}
          icon={FolderKanban}
          tone="brand"
          to="/projects"
        />
        <StatCard
          label="Active Projects"
          value={summary.activeProjects}
          icon={Zap}
          tone="green"
          to="/projects?status=active"
        />
        <StatCard label="Total Tasks" value={summary.totalTasks} icon={ListChecks} to="/tasks" />
        <StatCard
          label="Overdue"
          value={summary.overdue}
          icon={AlertTriangle}
          tone="red"
          to="/tasks?overdue=true"
          hint={summary.overdue > 0 ? 'Needs attention' : 'Nothing overdue'}
        />
      </section>

      <section aria-label="Task breakdown" className="mt-3 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          label="To Do"
          value={summary.todo}
          icon={CircleDashed}
          to="/tasks?status=todo"
        />
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
      </section>

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader
            title="Recent projects"
            description="The five most recently created projects."
            action={
              <Button as={Link} to="/projects" variant="secondary" size="sm">
                View all
              </Button>
            }
          />
          {recentProjects.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create your first project to start managing your team's work."
              action={
                <Button as={Link} to="/projects/new" icon={Plus}>
                  Create project
                </Button>
              }
            />
          ) : (
            <ProjectRows projects={recentProjects} />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent tasks"
            description="The latest work assigned across all projects."
            action={
              <Button as={Link} to="/tasks" variant="secondary" size="sm">
                View all
              </Button>
            }
          />
          {recentTasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks assigned yet"
              description="Open a project and add its first task to get started."
            />
          ) : (
            <TaskTable tasks={recentTasks} />
          )}
        </Card>

        <Card>
          <CardHeader
            title="Overdue tasks"
            description="Past their due date and not yet completed."
            action={
              summary.overdue > 0 && (
                <Button as={Link} to="/tasks?overdue=true" variant="secondary" size="sm">
                  View all {summary.overdue}
                </Button>
              )
            }
          />
          {overdueTasks.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing is overdue"
              description="Every task is either on schedule or already completed."
            />
          ) : (
            <TaskTable tasks={overdueTasks} />
          )}
        </Card>
      </div>
    </>
  );
};
