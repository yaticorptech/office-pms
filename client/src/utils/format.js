import { TASK_STATUS, TYPE_LABELS } from './constants.js';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

export const formatDate = (value, fallback = '—') => {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : dateFormatter.format(date);
};

/** `yyyy-mm-dd` for <input type="date">, using local time so the day never shifts. */
export const toDateInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

/** Mirrors the server rule: past due date and not completed. */
export const isOverdue = (task) => {
  if (!task?.dueDate || task.status === TASK_STATUS.COMPLETED) return false;
  return new Date(task.dueDate).getTime() < Date.now();
};

/** "Due today", "Overdue by 3 days", "In 5 days" — plain language for the due column. */
export const describeDueDate = (task) => {
  if (!task?.dueDate) return { text: 'No due date', tone: 'muted' };

  const due = new Date(task.dueDate);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due - startOfToday()) / 86400000);
  const completed = task.status === TASK_STATUS.COMPLETED;

  if (days < 0) {
    if (completed) return { text: formatDate(task.dueDate), tone: 'muted' };
    const overdueBy = Math.abs(days);
    return {
      text: overdueBy === 1 ? 'Overdue by 1 day' : `Overdue by ${overdueBy} days`,
      tone: 'danger',
    };
  }
  if (days === 0) return { text: 'Due today', tone: completed ? 'muted' : 'warning' };
  if (days === 1) return { text: 'Due tomorrow', tone: completed ? 'muted' : 'warning' };
  if (days <= 7) return { text: `Due in ${days} days`, tone: 'muted' };
  return { text: formatDate(task.dueDate), tone: 'muted' };
};

export const labelFor = (map, value, fallback = '—') => map[value]?.label ?? fallback;

/** Project types are optional, so an unset value renders as a dash, not an empty gap. */
export const typeLabel = (value, fallback = '—') => {
  if (!value) return fallback;
  return TYPE_LABELS[value] ?? value;
};

export const initialsOf = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '?';

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

/** Joins conditional class names — `cx('a', cond && 'b')`. */
export const cx = (...classes) => classes.filter(Boolean).join(' ');
