import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, Clock, FolderKanban, Pencil, Trash2, User } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { TaskFormModal } from '../components/TaskFormModal.jsx';
import { DueDate } from '../components/TaskTable.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { MetaBadge } from '../components/ui/Badge.jsx';
import { Avatar } from '../components/ui/Avatar.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { tasksApi } from '../services/resources.js';
import {
  EMPLOYEE_NEXT_STATUS,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from '../utils/constants.js';
import { formatDate, typeLabel } from '../utils/format.js';

const DetailRow = ({ icon: Icon, label, children }) => (
  <div className="flex items-start gap-3 py-3">
    <Icon size={16} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="text-xs text-slate-500">{label}</p>
      <div className="mt-0.5 text-sm text-slate-900">{children}</div>
    </div>
  </div>
);

export const TaskDetailsPage = () => {
  const { id } = useParams();
  const { isAdmin, user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const fetcher = useCallback((options) => tasksApi.get(id, options), [id]);
  const { data: task, loading, error, refetch, setData } = useApiResource(fetcher);

  const [updating, setUpdating] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const changeStatus = async (status) => {
    setUpdating(true);
    try {
      const response = await tasksApi.setStatus(id, status);
      setData(response.data);
      toast.success(response.message || 'Task status updated.');
    } catch (caught) {
      toast.error(caught.message);
    } finally {
      setUpdating(false);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    try {
      await tasksApi.remove(id);
      toast.success('Task deleted successfully.');
      navigate('/tasks', { replace: true });
    } catch (caught) {
      toast.error(caught.message);
      setDeleting(false);
    }
  };

  if (loading && !task) {
    return (
      <Card>
        <LoadingState label="Loading task…" />
      </Card>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Task" backTo="/tasks" backLabel="Back to tasks" />
        <Card>
          <ErrorState error={error} onRetry={refetch} />
        </Card>
      </>
    );
  }

  const isMine = task.assignedTo?._id === user?._id;
  // Admins get every status; the assignee gets only the allowed next steps.
  const employeeActions = isMine ? EMPLOYEE_NEXT_STATUS[task.status] || [] : [];

  return (
    <>
      <PageHeader
        title={task.title}
        backTo="/tasks"
        backLabel={isAdmin ? 'Back to tasks' : 'Back to my tasks'}
        action={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="secondary" icon={Pencil} onClick={() => setEditOpen(true)}>
                Edit
              </Button>
              <Button
                variant="secondary"
                icon={Trash2}
                className="text-red-600 hover:bg-red-50"
                onClick={() => setDeleteOpen(true)}
              >
                Delete
              </Button>
            </div>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="flex flex-wrap items-center gap-2">
              <MetaBadge map={TASK_STATUS_META} value={task.status} />
              <MetaBadge map={TASK_PRIORITY_META} value={task.priority} />
            </div>

            <h2 className="mt-4 text-sm font-semibold text-slate-900">Description</h2>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600">
              {task.description || 'No description was added for this task.'}
            </p>

            <div className="mt-6 divide-y divide-slate-100 border-t border-slate-100">
              <DetailRow icon={FolderKanban} label="Project">
                {task.project ? (
                  <Link
                    to={`/projects/${task.project._id}`}
                    className="font-medium text-brand-700 transition hover:text-brand-800"
                  >
                    {task.project.name}
                    {task.project.type && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        ({typeLabel(task.project.type)})
                      </span>
                    )}
                  </Link>
                ) : (
                  '—'
                )}
              </DetailRow>

              <DetailRow icon={User} label="Assigned to">
                <span className="flex items-center gap-2">
                  <Avatar
                    name={task.assignedTo?.name}
                    src={task.assignedTo?.profilePhoto}
                    size="xs"
                  />
                  <span className="font-medium">{task.assignedTo?.name || 'Unassigned'}</span>
                  {isMine && (
                    <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                      You
                    </span>
                  )}
                </span>
              </DetailRow>

              <DetailRow icon={CalendarDays} label="Due date">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{formatDate(task.dueDate, 'No due date')}</span>
                  {task.dueDate && <DueDate task={task} />}
                </div>
              </DetailRow>

              <DetailRow icon={Clock} label="Created">
                {formatDate(task.createdAt)}
                {task.createdBy?.name && (
                  <span className="text-slate-500"> by {task.createdBy.name}</span>
                )}
              </DetailRow>

              {task.updatedAt !== task.createdAt && (
                <DetailRow icon={Clock} label="Last updated">
                  {formatDate(task.updatedAt)}
                </DetailRow>
              )}
            </div>
          </CardBody>
        </Card>

        <Card className="h-fit">
          <CardBody>
            <h2 className="text-sm font-semibold text-slate-900">Update status</h2>

            {isAdmin ? (
              <>
                <p className="mt-1 text-sm text-slate-500">
                  As an admin you can set any status for this task.
                </p>
                <div className="mt-4 space-y-2">
                  {Object.entries(TASK_STATUS_META).map(([value, meta]) => (
                    <Button
                      key={value}
                      variant={value === task.status ? 'primary' : 'secondary'}
                      className="w-full justify-start"
                      disabled={updating || value === task.status}
                      onClick={() => changeStatus(value)}
                    >
                      {value === task.status ? `Currently: ${meta.label}` : `Move to ${meta.label}`}
                    </Button>
                  ))}
                </div>
              </>
            ) : isMine ? (
              <>
                <p className="mt-1 text-sm text-slate-500">
                  Keep your project owner informed by updating the status as you work.
                </p>
                <div className="mt-4 space-y-2">
                  {employeeActions.map((action) => (
                    <Button
                      key={action.value}
                      variant={action.value === 'completed' ? 'primary' : 'secondary'}
                      className="w-full"
                      loading={updating}
                      onClick={() => changeStatus(action.value)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
                <p className="mt-4 text-xs text-slate-400">
                  Only an admin can change the project or reassign this task.
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">
                This task is assigned to someone else, so its status is read-only for you.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <TaskFormModal
        open={editOpen}
        task={task}
        onClose={() => setEditOpen(false)}
        onSaved={(updated) => setData(updated)}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this task?"
        message={`"${task.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete task"
      />
    </>
  );
};
