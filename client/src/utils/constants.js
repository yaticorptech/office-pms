/**
 * Display metadata for the enums the API returns. The API remains the source of
 * truth for which values exist (GET /api/meta/options); this file only decides how
 * each value is coloured and labelled.
 */

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

export const PROJECT_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

export const ROLES = { ADMIN: 'admin', EMPLOYEE: 'employee' };

export const TASK_STATUS_META = {
  todo: { label: 'To Do', tone: 'slate' },
  in_progress: { label: 'In Progress', tone: 'blue' },
  completed: { label: 'Completed', tone: 'green' },
};

export const TASK_PRIORITY_META = {
  low: { label: 'Low', tone: 'slate' },
  medium: { label: 'Medium', tone: 'blue' },
  high: { label: 'High', tone: 'amber' },
  urgent: { label: 'Urgent', tone: 'red' },
};

export const PROJECT_STATUS_META = {
  planning: { label: 'Planning', tone: 'slate' },
  active: { label: 'Active', tone: 'green' },
  on_hold: { label: 'On Hold', tone: 'amber' },
  completed: { label: 'Completed', tone: 'blue' },
  archived: { label: 'Archived', tone: 'slate' },
};

export const USER_STATUS_META = {
  active: { label: 'Active', tone: 'green' },
  inactive: { label: 'Inactive', tone: 'slate' },
};

export const ROLE_META = {
  admin: { label: 'Admin', tone: 'purple' },
  employee: { label: 'Employee', tone: 'slate' },
};

export const TYPE_LABELS = {
  technology: 'Technology',
  marketing: 'Marketing',
  sales: 'Sales',
  hr: 'HR',
  operations: 'Operations',
  finance: 'Finance',
  administration: 'Administration',
  other: 'Other',
};

/** Fallback option lists, replaced at runtime by GET /api/meta/options. */
export const FALLBACK_OPTIONS = {
  projectTypes: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
  projectStatuses: Object.entries(PROJECT_STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
  departments: Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label })),
  taskPriorities: Object.entries(TASK_PRIORITY_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
  taskStatuses: Object.entries(TASK_STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
  roles: Object.entries(ROLE_META).map(([value, meta]) => ({ value, label: meta.label })),
  userStatuses: Object.entries(USER_STATUS_META).map(([value, meta]) => ({
    value,
    label: meta.label,
  })),
};

/**
 * The single most likely next step for an employee's own task — used for the
 * one-click action in task lists, where a dropdown would be overkill.
 */
export const EMPLOYEE_PRIMARY_ACTION = {
  todo: { value: 'in_progress', label: 'Start' },
  in_progress: { value: 'completed', label: 'Complete' },
  completed: { value: 'in_progress', label: 'Reopen' },
};

/** Status changes an employee is allowed to make on their own task. */
export const EMPLOYEE_NEXT_STATUS = {
  todo: [{ value: 'in_progress', label: 'Start task' }],
  in_progress: [
    { value: 'completed', label: 'Mark as completed' },
    { value: 'todo', label: 'Move back to To Do' },
  ],
  completed: [{ value: 'in_progress', label: 'Reopen task' }],
};
