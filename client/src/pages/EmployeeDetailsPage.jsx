import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { Briefcase, CheckCircle2, ListChecks, Mail, Pencil, Timer } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmployeeFormModal } from '../components/EmployeeFormModal.jsx';
import { TaskTable } from '../components/TaskTable.jsx';
import { StatCard } from '../components/StatCard.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { MetaBadge } from '../components/ui/Badge.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { employeesApi } from '../services/resources.js';
import { PROJECT_STATUS_META, ROLE_META, USER_STATUS_META } from '../utils/constants.js';
import { formatDate, typeLabel } from '../utils/format.js';

export const EmployeeDetailsPage = () => {
  const { id } = useParams();
  const fetcher = useCallback((options) => employeesApi.get(id, options), [id]);
  const { data: employee, loading, error, refetch } = useApiResource(fetcher);
  const [editOpen, setEditOpen] = useState(false);

  if (loading && !employee) {
    return (
      <Card>
        <LoadingState label="Loading employee…" />
      </Card>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Employee" backTo="/employees" backLabel="Back to employees" />
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={employee.name}
        backTo="/employees"
        backLabel="Back to employees"
        action={
          <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>
            Edit employee
          </Button>
        }
      />

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar name={employee.name} src={employee.profilePhoto} size="lg" />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold text-slate-900">{employee.name}</h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
                <Mail size={14} className="shrink-0" />
                <span className="truncate">{employee.email}</span>
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                  {typeLabel(employee.department)}
                </span>
                <MetaBadge map={ROLE_META} value={employee.role} />
                <MetaBadge map={USER_STATUS_META} value={employee.status} />
              </div>
            </div>
            <div className="text-sm text-slate-500 sm:text-right">
              <p className="text-xs text-slate-400">Joined</p>
              <p className="font-medium text-slate-700">{formatDate(employee.createdAt)}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <section aria-label="Task summary" className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <StatCard label="Total Tasks" value={employee.totalTasks} icon={ListChecks} />
        <StatCard label="Active" value={employee.activeTasks} icon={Timer} tone="blue" />
        <StatCard
          label="Completed"
          value={employee.completedTasks}
          icon={CheckCircle2}
          tone="green"
        />
      </section>

      <div className="space-y-6">
        <Card>
          <CardHeader
            title="Recent tasks"
            description="The ten tasks with the nearest due dates."
            action={
              employee.totalTasks > 0 && (
                <Button
                  as={Link}
                  to={`/tasks?assignedTo=${employee._id}`}
                  variant="secondary"
                  size="sm"
                >
                  View all
                </Button>
              )
            }
          />
          {employee.recentTasks.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No tasks assigned yet"
              description={`${employee.name} has not been assigned any work so far.`}
            />
          ) : (
            <TaskTable
              tasks={employee.recentTasks}
              columns={{ project: true, assignee: false }}
            />
          )}
        </Card>

        {employee.ownedProjects.length > 0 && (
          <Card>
            <CardHeader
              title="Projects owned"
              description={`${employee.name} is the owner of these projects.`}
            />
            <ul className="divide-y divide-slate-100">
              {employee.ownedProjects.map((project) => (
                <li key={project._id}>
                  <Link
                    to={`/projects/${project._id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Briefcase size={16} className="shrink-0 text-slate-400" />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-slate-900">
                          {project.name}
                        </span>
                        {project.type && (
                          <span className="block text-xs text-slate-500">
                            {typeLabel(project.type)}
                          </span>
                        )}
                      </span>
                    </span>
                    <MetaBadge map={PROJECT_STATUS_META} value={project.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <EmployeeFormModal
        open={editOpen}
        employee={employee}
        onClose={() => setEditOpen(false)}
        onSaved={refetch}
      />
    </>
  );
};
