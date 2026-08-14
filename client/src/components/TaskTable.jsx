import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2 } from 'lucide-react';
import { MetaBadge } from './ui/Badge.jsx';
import { UserCell } from './ui/Avatar.jsx';
import { Button } from './ui/Button.jsx';
import { TBody, TD, TH, THead, TR, TableWrap } from './ui/Table.jsx';
import {
  EMPLOYEE_PRIMARY_ACTION,
  TASK_PRIORITY_META,
  TASK_STATUS_META,
} from '../utils/constants.js';
import { cx, describeDueDate, typeLabel } from '../utils/format.js';

const DUE_TONES = {
  danger: 'text-red-600 font-medium',
  warning: 'text-amber-700 font-medium',
  muted: 'text-slate-600',
};

export const DueDate = ({ task }) => {
  const { text, tone } = describeDueDate(task);
  return <span className={cx('whitespace-nowrap text-sm', DUE_TONES[tone])}>{text}</span>;
};

/** Header cell that toggles asc/desc for `field` and shows the current direction. */
const SortableTH = ({ field, sort, onSortChange, className, children }) => {
  if (!onSortChange) return <TH className={className}>{children}</TH>;

  const active = sort === field || sort === `-${field}`;
  const descending = sort === `-${field}`;
  const Icon = !active ? ChevronsUpDown : descending ? ArrowDown : ArrowUp;

  return (
    <TH className={cx('p-0', className)} aria-sort={!active ? 'none' : descending ? 'descending' : 'ascending'}>
      <button
        type="button"
        // First click on a column sorts ascending; clicking the active column flips it.
        onClick={() => onSortChange(active && !descending ? `-${field}` : field)}
        className={cx(
          'flex w-full items-center gap-1.5 px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide transition',
          active ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800',
        )}
      >
        {children}
        <Icon size={13} className={active ? 'text-brand-600' : 'text-slate-400'} aria-hidden="true" />
      </button>
    </TH>
  );
};

/** Admin control: change a task's status without leaving the list. */
const StatusSelect = ({ task, onChange, busy }) => (
  <div className="relative inline-flex items-center">
    <select
      value={task.status}
      disabled={busy}
      onChange={(event) => onChange(task, event.target.value)}
      aria-label={`Status for ${task.title}`}
      className={cx(
        'appearance-none rounded-full border py-1 pl-2.5 pr-7 text-xs font-medium transition',
        'focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:opacity-60',
        task.status === 'completed'
          ? 'border-green-200 bg-green-50 text-green-700'
          : task.status === 'in_progress'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-100 text-slate-700',
      )}
    >
      {Object.entries(TASK_STATUS_META).map(([value, meta]) => (
        <option key={value} value={value}>
          {meta.label}
        </option>
      ))}
    </select>
    <span className="pointer-events-none absolute right-2 text-slate-500">
      {busy ? <Loader2 size={11} className="animate-spin" /> : <ChevronsUpDown size={11} />}
    </span>
  </div>
);

/** Employee control: one click for the obvious next step on their own task. */
export const QuickStatusButton = ({ task, onChange, busy, size = 'sm' }) => {
  const action = EMPLOYEE_PRIMARY_ACTION[task.status];
  if (!action) return null;

  return (
    <Button
      variant={action.value === 'completed' ? 'primary' : 'secondary'}
      size={size}
      loading={busy}
      onClick={() => onChange(task, action.value)}
      aria-label={`${action.label} ${task.title}`}
    >
      {action.label}
    </Button>
  );
};

/**
 * Task list: a table on `md`+ and stacked cards below, so every column stays
 * readable on a phone.
 *
 * `onStatusChange` turns the Status column into an inline control (admin), while
 * `quickStatus` renders the employee's one-click action instead.
 */
export const TaskTable = ({
  tasks,
  columns = { project: true, assignee: true },
  actions,
  emptyMessage,
  sort,
  onSortChange,
  onStatusChange,
  // Guards the inline control per row: an employee browsing a project sees other
  // people's tasks, and must not be offered a control that would be refused.
  canChangeStatus = () => true,
  quickStatus = false,
  busyTaskId,
}) => {
  if (tasks.length === 0 && emptyMessage) {
    return <p className="px-4 py-10 text-center text-sm text-slate-500">{emptyMessage}</p>;
  }

  const editable = (task) => Boolean(onStatusChange) && canChangeStatus(task);
  const showActions = Boolean(actions) || (quickStatus && tasks.some(editable));

  const renderStatus = (task) =>
    editable(task) && !quickStatus ? (
      <StatusSelect task={task} onChange={onStatusChange} busy={busyTaskId === task._id} />
    ) : (
      <MetaBadge map={TASK_STATUS_META} value={task.status} />
    );

  const renderActions = (task) => (
    <div className="flex items-center justify-end gap-1">
      {quickStatus && editable(task) && (
        <QuickStatusButton task={task} onChange={onStatusChange} busy={busyTaskId === task._id} />
      )}
      {actions?.(task)}
    </div>
  );

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden md:block">
        <TableWrap>
          <THead>
            <SortableTH field="title" sort={sort} onSortChange={onSortChange}>
              Task
            </SortableTH>
            {columns.project && <TH>Project</TH>}
            {columns.assignee && <TH>Assigned To</TH>}
            <SortableTH field="priority" sort={sort} onSortChange={onSortChange}>
              Priority
            </SortableTH>
            <TH>Status</TH>
            <SortableTH field="dueDate" sort={sort} onSortChange={onSortChange}>
              Due Date
            </SortableTH>
            {showActions && <TH className="text-right">Actions</TH>}
          </THead>
          <TBody>
            {tasks.map((task) => (
              <TR key={task._id}>
                <TD className="max-w-xs">
                  <Link
                    to={`/tasks/${task._id}`}
                    className="font-medium text-slate-900 transition hover:text-brand-700"
                  >
                    <span className="line-clamp-2">{task.title}</span>
                  </Link>
                </TD>
                {columns.project && (
                  <TD>
                    {task.project ? (
                      <Link
                        to={`/projects/${task.project._id}`}
                        className="transition hover:text-brand-700"
                      >
                        <span className="block max-w-[12rem] truncate">{task.project.name}</span>
                        {task.project.type && (
                          <span className="block text-xs text-slate-400">
                            {typeLabel(task.project.type)}
                          </span>
                        )}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </TD>
                )}
                {columns.assignee && (
                  <TD>
                    <UserCell user={task.assignedTo} />
                  </TD>
                )}
                <TD>
                  <MetaBadge map={TASK_PRIORITY_META} value={task.priority} />
                </TD>
                <TD>{renderStatus(task)}</TD>
                <TD>
                  <DueDate task={task} />
                </TD>
                {showActions && <TD className="text-right">{renderActions(task)}</TD>}
              </TR>
            ))}
          </TBody>
        </TableWrap>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {tasks.map((task) => (
          <li key={task._id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/tasks/${task._id}`} className="min-w-0 flex-1">
                <p className="font-medium text-slate-900">{task.title}</p>
                {columns.project && task.project && (
                  <p className="mt-0.5 truncate text-xs text-slate-500">{task.project.name}</p>
                )}
              </Link>
              {actions && <div className="shrink-0">{actions(task)}</div>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {renderStatus(task)}
              <MetaBadge map={TASK_PRIORITY_META} value={task.priority} />
              <DueDate task={task} />
            </div>

            {columns.assignee && task.assignedTo && (
              <div className="mt-3">
                <UserCell user={task.assignedTo} subtitle={typeLabel(task.assignedTo.department, '')} />
              </div>
            )}

            {quickStatus && editable(task) && (
              <div className="mt-3">
                <QuickStatusButton
                  task={task}
                  onChange={onStatusChange}
                  busy={busyTaskId === task._id}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
};
