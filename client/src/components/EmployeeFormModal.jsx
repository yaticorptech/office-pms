import { useEffect, useState } from 'react';
import { Button } from './ui/Button.jsx';
import { Field, Input, Select } from './ui/Field.jsx';
import { Modal } from './ui/Modal.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useOptions } from '../hooks/useOptions.js';
import { employeesApi } from '../services/resources.js';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  department: 'technology',
  role: 'employee',
  profilePhoto: '',
  status: 'active',
};

const validate = (form, isEdit) => {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  else if (form.name.trim().length < 2) errors.name = 'Name is too short';

  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
    errors.email = 'Enter a valid email address';

  // On edit the password field is optional and only sent when filled in.
  if (!isEdit && !form.password) errors.password = 'Password is required';
  else if (form.password && form.password.length < 8)
    errors.password = 'Password must be at least 8 characters';

  if (!form.department) errors.department = 'Select a department';
  return errors;
};

export const EmployeeFormModal = ({ open, onClose, employee = null, onSaved }) => {
  const isEdit = Boolean(employee);
  const options = useOptions();
  const toast = useToast();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFormError('');
    setForm(
      employee
        ? {
            name: employee.name || '',
            email: employee.email || '',
            password: '',
            department: employee.department || 'other',
            role: employee.role || 'employee',
            profilePhoto: employee.profilePhoto || '',
            status: employee.status || 'active',
          }
        : emptyForm,
    );
  }, [open, employee]);

  const setValue = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
    setFormError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();

    const validationErrors = validate(form, isEdit);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      department: form.department,
      role: form.role,
      profilePhoto: form.profilePhoto.trim(),
      status: form.status,
      ...(form.password ? { password: form.password } : {}),
    };

    setSubmitting(true);
    try {
      const response = isEdit
        ? await employeesApi.update(employee._id, payload)
        : await employeesApi.create(payload);
      toast.success(response.message || 'Employee saved successfully.');
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
      title={isEdit ? 'Edit employee' : 'Add employee'}
      description={
        isEdit
          ? 'Update this employee’s details or reset their password.'
          : 'New employees can sign in immediately with the password you set here.'
      }
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" form="employee-form" loading={submitting}>
            {isEdit ? 'Save changes' : 'Add employee'}
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={onSubmit} noValidate className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" error={errors.name} required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                data-autofocus
                placeholder="e.g. Priya Sharma"
                value={form.name}
                onChange={(event) => setValue('name', event.target.value)}
              />
            )}
          </Field>

          <Field label="Email" error={errors.email} required>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="email"
                autoComplete="off"
                placeholder="name@company.com"
                value={form.email}
                onChange={(event) => setValue('email', event.target.value)}
              />
            )}
          </Field>
        </div>

        <Field
          label={isEdit ? 'New password' : 'Password'}
          error={errors.password}
          required={!isEdit}
          hint={isEdit ? 'Leave blank to keep the current password.' : 'At least 8 characters.'}
        >
          {({ id, describedBy, invalid }) => (
            <Input
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              value={form.password}
              onChange={(event) => setValue('password', event.target.value)}
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Department"
            error={errors.department}
            required
            hint="Does not restrict which projects they can work on."
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                value={form.department}
                onChange={(event) => setValue('department', event.target.value)}
              >
                {options.departments.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Role" hint="Admins can manage projects, tasks and employees.">
            {({ id }) => (
              <Select
                id={id}
                value={form.role}
                onChange={(event) => setValue('role', event.target.value)}
              >
                {options.roles.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Profile photo URL" error={errors.profilePhoto}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                aria-describedby={describedBy}
                invalid={invalid}
                type="url"
                placeholder="https://…"
                value={form.profilePhoto}
                onChange={(event) => setValue('profilePhoto', event.target.value)}
              />
            )}
          </Field>

          <Field label="Status" hint="Inactive employees cannot sign in or be assigned tasks.">
            {({ id }) => (
              <Select
                id={id}
                value={form.status}
                onChange={(event) => setValue('status', event.target.value)}
              >
                {options.userStatuses.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
      </form>
    </Modal>
  );
};
