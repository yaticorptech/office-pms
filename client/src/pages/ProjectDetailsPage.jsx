import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Archive, CalendarDays, ListChecks, Pencil, Plus, Trash2, User } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { TaskFormModal } from '../components/TaskFormModal.jsx';
import { TaskTable } from '../components/TaskTable.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { MetaBadge } from '../components/ui/Badge.jsx';
import { ProgressBar } from '../components/ui/ProgressBar.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { useTaskStatus } from '../hooks/useTaskStatus.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { projectsApi, tasksApi } from '../services/resources.js';
import { PROJECT_STATUS, PROJECT_STATUS_META } from '../utils/constants.js';
import { formatDate, typeLabel } from '../utils/format.js';

const MetaItem = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-2.5">
    <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
    <div className="min-w-0">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="text-sm font-medium text-slate-900">{children}</div>
    </div>
  </div>
);

export const ProjectDetailsPage = () => {
  const { id } = useParams();
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const projectFetcher = useCallback((options) => projectsApi.get(id, options), [id]);
  const { data: project, loading, error, refetch } = useApiResource(projectFetcher);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(null);

  const [taskModal, setTaskModal] = useState({ open: false, task: null });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const response = await projectsApi.tasks(id);
      setTasks(response.data);
      setTasksError(null);
    } catch (caught) {
      setTasksError(caught);
    } finally {
      setTasksLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Progress and counts are derived from tasks, so both queries refresh together.
  const refreshAll = useCallback(() => {
    refetch();
    loadTasks();
  }, [refetch, loadTasks]);

  const { changeStatus, busyId } = useTaskStatus(refreshAll);

  const onArchive = async () => {
    setArchiving(true);
    try {
      const response = await projectsApi.archive(id);
      toast.success(response.message || 'Project archived.');
      setArchiveOpen(false);
      refetch();
    } catch (caught) {
      toast.error(caught.message);
    } finally {
      setArchiving(false);
    }
  };

  const onDeleteTask = async () => {
    setDeleting(true);
    try {
      await tasksApi.remove(deleteTarget._id);
      toast.success('Task deleted successfully.');
      setDeleteTarget(null);
      refreshAll();
    } catch (caught) {
      toast.error(caught.message);
    } finally {
      setDeleting(false);
    }
  };

  if (loading && !project) {
    return (
      <Card>
        <LoadingState label="Loading project…" />
      </Card>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Project" backTo={isAdmin ? '/projects' : '/dashboard'} />
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      </>
    );
  }

  const stats = project.stats || { totalTasks: 0, completed: 0, todo: 0, inProgress: 0, overdue: 0 };
  const isArchived = project.status === PROJECT_STATUS.ARCHIVED;

  return (
    <>
      <PageHeader
        title={project.name}
        backTo={isAdmin ? '/projects' : '/dashboard'}
        backLabel={isAdmin ? 'Back to projects' : 'Back to dashboard'}
        action={
          isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button as={Link} to={`/projects/${id}/edit`} variant="secondary" icon={Pencil}>
                Edit
              </Button>
              {!isArchived && (
                <Button variant="secondary" icon={Archive} onClick={() => setArchiveOpen(true)}>
                  Archive
                </Button>
              )}
              <Button
                icon={Plus}
                onClick={() => setTaskModal({ open: true, task: null })}
                disabled={isArchived}
              >
                Add task
              </Button>
            </div>
          )
        }
      />

      {isArchived && (
        <div className="mb-5 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Archive size={16} className="mt-0.5 shrink-0" />
          <p>This project is archived. Existing tasks stay visible, but new tasks cannot be added.</p>
        </div>
      )}

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-center gap-2">
            <MetaBadge map={PROJECT_STATUS_META} value={project.status} />
            {project.type && (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {typeLabel(project.type)}
              </span>
            )}
          </div>

          {project.description && (
            <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
              {project.description}
            </p>
          )}

          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <MetaItem icon={User} label="Project owner">
              <span className="flex items-center gap-2">
                <Avatar name={project.owner?.name} src={project.owner?.profilePhoto} size="xs" />
                {project.owner?.name || '—'}
              </span>
            </MetaItem>
            <MetaItem icon={CalendarDays} label="Start date">
              {formatDate(project.startDate)}
            </MetaItem>
            <MetaItem icon={CalendarDays} label="End date">
              {formatDate(project.endDate)}
            </MetaItem>
            <MetaItem icon={ListChecks} label="Tasks">
              {stats.completed} of {stats.totalTasks} completed
            </MetaItem>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-5">
            <ProgressBar value={stats.progress ?? 0} showLabel label="Project progress" />
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span>To Do: {stats.todo}</span>
              <span>In Progress: {stats.inProgress}</span>
              <span>Completed: {stats.completed}</span>
              {stats.overdue > 0 && (
                <span className="font-medium text-red-600">Overdue: {stats.overdue}</span>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Project tasks"
          description={
            stats.totalTasks === 0
              ? 'No tasks in this project yet.'
              : `${stats.totalTasks} task${stats.totalTasks === 1 ? '' : 's'} in this project.`
          }
          action={
            isAdmin &&
            !isArchived &&
            tasks.length > 0 && (
              <Button
                size="sm"
                icon={Plus}
                onClick={() => setTaskModal({ open: true, task: null })}
              >
                Add task
              </Button>
            )
          }
        />

        {tasksLoading ? (
          <LoadingState label="Loading tasks…" />
        ) : tasksError ? (
          <ErrorState error={tasksError} onRetry={loadTasks} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No tasks yet"
            description={
              isArchived
                ? 'This project was archived without any tasks.'
                : 'Add the first task and assign it to an employee.'
            }
            action={
              isAdmin &&
              !isArchived && (
                <Button icon={Plus} onClick={() => setTaskModal({ open: true, task: null })}>
                  Add task
                </Button>
              )
            }
          />
        ) : (
          <TaskTable
            tasks={tasks}
            columns={{ project: false, assignee: true }}
            onStatusChange={changeStatus}
            busyTaskId={busyId}
            // Employees viewing a project get the one-click action on their own tasks.
            quickStatus={!isAdmin}
            canChangeStatus={(task) => isAdmin || task.assignedTo?._id === user?._id}
            actions={
              isAdmin
                ? (task) => (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit ${task.title}`}
                        onClick={() => setTaskModal({ open: true, task })}
                      >
                        <Pencil size={15} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${task.title}`}
                        className="text-slate-400 hover:text-red-600"
                        onClick={() => setDeleteTarget(task)}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </>
                  )
                : undefined
            }
          />
        )}
      </Card>

      <TaskFormModal
        open={taskModal.open}
        task={taskModal.task}
        lockedProject={taskModal.task ? null : project}
        onClose={() => setTaskModal({ open: false, task: null })}
        onSaved={refreshAll}
      />

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={onArchive}
        loading={archiving}
        title="Archive this project?"
        message={`"${project.name}" will be moved to archived. Its tasks stay visible, but no new tasks can be added. You can change the status back at any time.`}
        confirmLabel="Archive project"
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDeleteTask}
        loading={deleting}
        title="Delete this task?"
        message={`"${deleteTarget?.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete task"
      />
    </>
  );
};
