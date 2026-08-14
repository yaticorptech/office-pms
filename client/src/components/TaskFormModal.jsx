import { useEffect, useMemo, useState } from 'react';
import { Button } from './ui/Button.jsx';
import { Field, Input, Select, Textarea } from './ui/Field.jsx';
import { SearchSelect } from './ui/SearchSelect.jsx';
import { Modal } from './ui/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useOptions } from '../hooks/useOptions.js';
import { employeesApi, projectsApi, tasksApi } from '../services/resources.js';
import { PROJECT_STATUS } from '../utils/constants.js';
import { toDateInput, typeLabel } from '../utils/format.js';

const emptyForm = {
  title: '',
  description: '',
  project: '',
  assignedTo: '',
  priority: 'medium',
  status: 'todo',
  dueDate: '',
};

const validate = (form) => {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Task title is required';
  else if (form.title.trim().length < 2) errors.title = 'Task title is too short';
  if (!form.project) errors.project = 'Select the project this task belongs to';
  if (!form.assignedTo) errors.assignedTo = 'Every task must be assigned to an employee';
  return errors;
};

/**
 * Create / edit task dialog. `lockedProject` pre-selects and freezes the project when
 * the dialog is opened from a project page.
 */
export const TaskFormModal = ({ open, onClose, task = null, lockedProject = null, onSaved }) => {
  const isEdit = Boolean(task);
  const options = useOptions();
  const toast = useToast();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Reset whenever the dialog opens so a stale draft never leaks into a new task.
  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError('');
    setForm(
      task
        ? {
            title: task.title || '',
            description: task.description || '',
            project: task.project?._id || task.project || '',
            assignedTo: task.assignedTo?._id || task.assignedTo || '',
            priority: task.priority || 'medium',
            status: task.status || 'todo',
            dueDate: toDateInput(task.dueDate),
          }
        : { ...emptyForm, project: lockedProject?._id || '' },
    );
  }, [open, task, lockedProject]);

  useEffect(() => {
    if (!open) return;
    Promise.all([projectsApi.options(), employeesApi.assignable()])
      .then(([projectsResponse, employeesResponse]) => {
        setProjects(projectsResponse.data);
        setEmployees(employeesResponse.data);
      })
      .catch(() => setFormError('Could not load projects and employees. Close and try again.'));
  }, [open]);

  const projectOptions = useMemo(
    () =>
      projects
        // Archived projects cannot take new tasks, so they are not offered.
        .filter((project) => project.status !== PROJECT_STATUS.ARCHIVED)
        .map((project) => ({
          value: project._id,
          label: project.name,
          // Empty rather than a dash: SearchSelect omits the second line entirely.
          description: typeLabel(project.type, ''),
        })),
    [projects],
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        value: employee._id,
        label: employee.name,
        description: `${typeLabel(employee.department)} · ${employee.email}`,
      })),
    [employees],
  );

  const setValue = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFormError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      project: form.project,
      assignedTo: form.assignedTo,
      priority: form.priority,
      status: form.status,
      dueDate: form.dueDate || null,
    };

    setSubmitting(true);
    try {
      const response = isEdit
        ? await tasksApi.update(task._id, payload)
        : await tasksApi.create(payload);
      toast.success(response.message || 'Task saved successfully.');
      onSaved?.(response.data);
      onClose();
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit task' : 'Create task'}
      description={
        lockedProject
          ? `This task will be added to ${lockedProject.name}.`
          : 'Tasks always belong to a project and are assigned to one employee.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Create task'}
          </Button>
        </>
      }
    >
      <form id="task-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        <Field label="Task title" error={errors.title} required>
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              data-autofocus
              placeholder="e.g. Create Instagram creatives"
              value={form.title}
              onChange={(event) => setValue('title', event.target.value)}
            />
          )}
        </Field>

        <Field label="Description" error={errors.description}>
          {({ id, describedBy, invalid }) => (
            <Textarea
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              rows={3}
              placeholder="What needs to be done?"
              value={form.description}
              onChange={(event) => setValue('description', event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Project"
            error={errors.project}
            required
            hint={lockedProject ? 'Set automatically from the project page.' : undefined}
          >
            {({ id, describedBy, invalid }) =>
              lockedProject ? (
                <Input id={id} value={lockedProject.name} disabled readOnly />
              ) : (
                <SearchSelect
                  id={id}
                  describedBy={describedBy}
                  invalid={invalid}
                  options={projectOptions}
                  value={form.project}
                  onChange={(value) => setValue('project', value)}
                  placeholder="Select a project"
                  searchPlaceholder="Search projects…"
                  emptyMessage="No active projects found"
                />
              )
            }
          </Field>

          <Field
            label="Assign to"
            error={errors.assignedTo}
            required
            hint="Any employee can be assigned, regardless of department."
          >
            {({ id, describedBy, invalid }) => (
              <SearchSelect
                id={id}
                describedBy={describedBy}
                invalid={invalid}
                options={employeeOptions}
                value={form.assignedTo}
                onChange={(value) => setValue('assignedTo', value)}
                placeholder="Select an employee"
                searchPlaceholder="Search employees…"
                emptyMessage="No active employees found"
                showAvatar
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Priority">
            {({ id }) => (
              <Select
                id={id}
                value={form.priority}
                onChange={(event) => setValue('priority', event.target.value)}
              >
                {options.taskPriorities.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Status">
            {({ id }) => (
              <Select
                id={id}
                value={form.status}
                onChange={(event) => setValue('status', event.target.value)}
              >
                {options.taskStatuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Due date" error={errors.dueDate}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="date"
                value={form.dueDate}
                onChange={(event) => setValue('dueDate', event.target.value)}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
};
