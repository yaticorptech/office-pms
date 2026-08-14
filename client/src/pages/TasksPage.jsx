import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ListChecks, Pencil, Plus, Trash2, UserCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { FilterBar } from '../components/FilterBar.jsx';
import { TaskFormModal } from '../components/TaskFormModal.jsx';
import { TaskStatusTabs } from '../components/TaskStatusTabs.jsx';
import { TaskTable } from '../components/TaskTable.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { EmptyState, ErrorState, TableSkeleton } from '../components/ui/States.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useOptions } from '../hooks/useOptions.js';
import { useTaskStatus } from '../hooks/useTaskStatus.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { employeesApi, projectsApi, tasksApi } from '../services/resources.js';
import { cx, typeLabel } from '../utils/format.js';

/** The status tabs encode two different query shapes: a status value, or `overdue`. */
const tabToQuery = (tab) => {
  if (tab === 'overdue') return { status: null, overdue: 'true' };
  if (tab === 'all') return { status: null, overdue: null };
  return { status: tab, overdue: null };
};

export const TasksPage = () => {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const options = useOptions();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(search);

  const project = searchParams.get('project') || 'all';
  const assignedTo = searchParams.get('assignedTo') || 'all';
  const priority = searchParams.get('priority') || 'all';
  const status = searchParams.get('status') || '';
  const overdue = searchParams.get('overdue') === 'true';
  const mine = searchParams.get('mine') === 'true';
  const sort = searchParams.get('sort') || 'dueDate';
  const page = Number(searchParams.get('page')) || 1;

  const activeTab = overdue ? 'overdue' : status || 'all';

  const [projectList, setProjectList] = useState([]);
  const [employeeList, setEmployeeList] = useState([]);
  const [taskModal, setTaskModal] = useState({ open: false, task: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const setParams = useCallback(
    (updates) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        Object.entries(updates).forEach(([key, value]) => {
          if (!value || value === 'all') next.delete(key);
          else next.set(key, String(value));
        });
        // Any filter change returns to the first page.
        if (!('page' in updates)) next.delete('page');
        return next;
      });
    },
    [setSearchParams],
  );

  useEffect(() => {
    projectsApi
      .options()
      .then((response) => setProjectList(response.data))
      .catch(() => setProjectList([]));
    // The employee filter is only meaningful for admins; employees see only their own tasks.
    if (isAdmin) {
      employeesApi
        .assignable()
        .then((response) => setEmployeeList(response.data))
        .catch(() => setEmployeeList([]));
    }
  }, [isAdmin]);

  const fetcher = useCallback(
    (fetchOptions) =>
      tasksApi.list(
        {
          search: debouncedSearch,
          project,
          assignedTo: isAdmin && !mine ? assignedTo : undefined,
          mine: isAdmin && mine ? 'true' : undefined,
          priority,
          status: status || undefined,
          overdue: overdue ? 'true' : undefined,
          sort,
          page,
          limit: 20,
        },
        fetchOptions,
      ),
    [debouncedSearch, project, assignedTo, mine, priority, status, overdue, sort, page, isAdmin],
  );

  const { data: tasks, meta, loading, error, refetch } = useApiResource(fetcher);
  const { changeStatus, busyId } = useTaskStatus(refetch);

  const filters = useMemo(() => {
    const list = [
      {
        name: 'project',
        label: 'Project',
        value: project,
        options: projectList.map((item) => ({ value: item._id, label: item.name })),
        onChange: (value) => setParams({ project: value }),
      },
      {
        name: 'priority',
        label: 'Priority',
        value: priority,
        options: options.taskPriorities,
        onChange: (value) => setParams({ priority: value }),
      },
    ];

    if (isAdmin && !mine) {
      list.splice(1, 0, {
        name: 'assignedTo',
        label: 'Employee',
        value: assignedTo,
        options: employeeList.map((item) => ({
          value: item._id,
          label: `${item.name} · ${typeLabel(item.department, 'No department')}`,
        })),
        onChange: (value) => setParams({ assignedTo: value }),
      });
    }
    return list;
  }, [project, priority, assignedTo, mine, projectList, employeeList, options, isAdmin, setParams]);

  const resetFilters = () => {
    setSearch('');
    setSearchParams(new URLSearchParams());
  };

  const hasFilters =
    Boolean(debouncedSearch) || project !== 'all' || assignedTo !== 'all' || priority !== 'all' || mine;

  const onDelete = async () => {
    setDeleting(true);
    try {
      await tasksApi.remove(deleteTarget._id);
      toast.success('Task deleted successfully.');
      setDeleteTarget(null);
      refetch();
    } catch (caught) {
      toast.error(caught.message);
    } finally {
      setDeleting(false);
    }
  };

  const emptyDescription = () => {
    if (hasFilters || activeTab !== 'all') return 'Try a different search term or clear the filters.';
    return isAdmin
      ? 'Create a task and assign it to an employee to get started.'
      : 'When an admin assigns you work, it will appear here.';
  };

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Tasks' : 'My Tasks'}
        description={
          isAdmin
            ? 'Every task across all projects, and who is working on it.'
            : 'Every task assigned to you.'
        }
        action={
          isAdmin && (
            <Button icon={Plus} onClick={() => setTaskModal({ open: true, task: null })}>
              New task
            </Button>
          )
        }
      />

      <Card>
        <TaskStatusTabs
          active={activeTab}
          counts={meta?.counts}
          loading={loading}
          onChange={(tab) => setParams(tabToQuery(tab))}
        />

        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by task name…"
          filters={filters}
          onReset={resetFilters}
          extra={
            isAdmin
              ? {
                  active: mine,
                  node: (
                    <button
                      type="button"
                      onClick={() => setParams({ mine: mine ? '' : 'true', assignedTo: '' })}
                      aria-pressed={mine}
                      className={cx(
                        'inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition',
                        mine
                          ? 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200'
                          : 'text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50',
                      )}
                    >
                      <UserCheck size={15} />
                      Assigned to me
                    </button>
                  ),
                }
              : undefined
          }
        />

        {loading && !tasks ? (
          <TableSkeleton rows={8} columns={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title={
              hasFilters || activeTab !== 'all'
                ? 'No tasks match your filters'
                : 'No tasks assigned yet'
            }
            description={emptyDescription()}
            action={
              hasFilters || activeTab !== 'all' ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                isAdmin && (
                  <Button icon={Plus} onClick={() => setTaskModal({ open: true, task: null })}>
                    Create task
                  </Button>
                )
              )
            }
          />
        ) : (
          <>
            <TaskTable
              tasks={tasks}
              columns={{ project: true, assignee: isAdmin }}
              sort={sort}
              onSortChange={(value) => setParams({ sort: value })}
              onStatusChange={changeStatus}
              busyTaskId={busyId}
              // Admins pick any status inline; employees get a one-click next step.
              quickStatus={!isAdmin}
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
            <Pagination meta={meta} onChange={(next) => setParams({ page: String(next) })} />
          </>
        )}
      </Card>

      <TaskFormModal
        open={taskModal.open}
        task={taskModal.task}
        onClose={() => setTaskModal({ open: false, task: null })}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        loading={deleting}
        title="Delete this task?"
        message={`"${deleteTarget?.title}" will be permanently removed. This cannot be undone.`}
        confirmLabel="Delete task"
      />
    </>
  );
};
