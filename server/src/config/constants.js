/**
 * Single source of truth for every enum in the system.
 *
 * Values are stored as stable slugs and rendered through `label`, so new options
 * (e.g. another project type or department) can be added here without touching
 * queries, indexes or existing documents.
 */

export const ROLES = {
  ADMIN: 'admin',
  EMPLOYEE: 'employee',
};

export const ROLE_OPTIONS = [
  { value: ROLES.ADMIN, label: 'Admin' },
  { value: ROLES.EMPLOYEE, label: 'Employee' },
];

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
};

export const USER_STATUS_OPTIONS = [
  { value: USER_STATUS.ACTIVE, label: 'Active' },
  { value: USER_STATUS.INACTIVE, label: 'Inactive' },
];

/**
 * Departments are descriptive only. They never restrict which project or task an
 * employee may be assigned to (business rule #5).
 */
export const DEPARTMENT_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'hr', label: 'HR' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'administration', label: 'Administration' },
  { value: 'other', label: 'Other' },
];

/** Deliberately mirrors departments today, but kept separate so the two can diverge. */
export const PROJECT_TYPE_OPTIONS = [
  { value: 'technology', label: 'Technology' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'hr', label: 'HR' },
  { value: 'operations', label: 'Operations' },
  { value: 'finance', label: 'Finance' },
  { value: 'administration', label: 'Administration' },
  { value: 'other', label: 'Other' },
];

export const PROJECT_STATUS = {
  PLANNING: 'planning',
  ACTIVE: 'active',
  ON_HOLD: 'on_hold',
  COMPLETED: 'completed',
  ARCHIVED: 'archived',
};

export const PROJECT_STATUS_OPTIONS = [
  { value: PROJECT_STATUS.PLANNING, label: 'Planning' },
  { value: PROJECT_STATUS.ACTIVE, label: 'Active' },
  { value: PROJECT_STATUS.ON_HOLD, label: 'On Hold' },
  { value: PROJECT_STATUS.COMPLETED, label: 'Completed' },
  { value: PROJECT_STATUS.ARCHIVED, label: 'Archived' },
];

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

export const TASK_PRIORITY_OPTIONS = [
  { value: TASK_PRIORITY.LOW, label: 'Low' },
  { value: TASK_PRIORITY.MEDIUM, label: 'Medium' },
  { value: TASK_PRIORITY.HIGH, label: 'High' },
  { value: TASK_PRIORITY.URGENT, label: 'Urgent' },
];

export const TASK_STATUS = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
};

export const TASK_STATUS_OPTIONS = [
  { value: TASK_STATUS.TODO, label: 'To Do' },
  { value: TASK_STATUS.IN_PROGRESS, label: 'In Progress' },
  { value: TASK_STATUS.COMPLETED, label: 'Completed' },
];

/**
 * Status changes an employee may apply to their own task.
 * Admins are not bound by this map.
 */
/**
 * In-app notification kinds. Phase 1 only raises these on task assignment —
 * email/WhatsApp delivery remains out of scope.
 */
export const NOTIFICATION_TYPE = {
  TASK_ASSIGNED: 'task_assigned',
  TASK_REASSIGNED: 'task_reassigned',
  TASK_UNASSIGNED: 'task_unassigned',
};

export const NOTIFICATION_TYPES = Object.values(NOTIFICATION_TYPE);

export const EMPLOYEE_STATUS_TRANSITIONS = {
  [TASK_STATUS.TODO]: [TASK_STATUS.IN_PROGRESS],
  [TASK_STATUS.IN_PROGRESS]: [TASK_STATUS.COMPLETED, TASK_STATUS.TODO],
  [TASK_STATUS.COMPLETED]: [TASK_STATUS.IN_PROGRESS],
};

export const values = (options) => options.map((option) => option.value);

export const DEPARTMENTS = values(DEPARTMENT_OPTIONS);
export const PROJECT_TYPES = values(PROJECT_TYPE_OPTIONS);
export const PROJECT_STATUSES = values(PROJECT_STATUS_OPTIONS);
export const TASK_PRIORITIES = values(TASK_PRIORITY_OPTIONS);
export const TASK_STATUSES = values(TASK_STATUS_OPTIONS);
export const USER_ROLES = values(ROLE_OPTIONS);
export const USER_STATUSES = values(USER_STATUS_OPTIONS);
