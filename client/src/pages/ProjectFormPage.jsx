import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card, CardBody } from '../components/ui/Card.jsx';
import { Field, Input, Select, Textarea } from '../components/ui/Field.jsx';
import { SearchSelect } from '../components/ui/SearchSelect.jsx';
import { ErrorState, LoadingState } from '../components/ui/States.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useOptions } from '../hooks/useOptions.js';
import { employeesApi, projectsApi } from '../services/resources.js';
import { toDateInput, typeLabel } from '../utils/format.js';

const emptyForm = {
  name: '',
  type: '',
  description: '',
  owner: '',
  startDate: toDateInput(new Date()),
  endDate: '',
  status: 'planning',
};

const validate = (form) => {
  const errors = {};
  if (!form.name.trim()) errors.name = 'Project name is required';
  else if (form.name.trim().length < 2) errors.name = 'Project name is too short';

  // Type is optional — a project can be created before it is categorised.
  if (!form.owner) errors.owner = 'Project owner is required';
  if (!form.startDate) errors.startDate = 'Start date is required';

  if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
    errors.endDate = 'End date cannot be before the start date';
  }
  return errors;
};

export const ProjectFormPage = () => {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const options = useOptions();

  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    employeesApi
      .assignable()
      .then((response) => setEmployees(response.data))
      .catch(() => setFormError('Could not load the employee list.'));
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    setLoading(true);
    projectsApi
      .get(id)
      .then((response) => {
        const project = response.data;
        setForm({
          name: project.name,
          // A project with no type is stored as null; the <select> needs ''.
          type: project.type || '',
          description: project.description || '',
          owner: project.owner?._id || '',
          startDate: toDateInput(project.startDate),
          endDate: toDateInput(project.endDate),
          status: project.status,
        });
        setLoadError(null);
      })
      .catch(setLoadError)
      .finally(() => setLoading(false));
  }, [id, isEdit]);

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
      name: form.name.trim(),
      type: form.type || null,
      description: form.description.trim(),
      owner: form.owner,
      startDate: form.startDate,
      endDate: form.endDate || null,
      status: form.status,
    };

    setSubmitting(true);
    try {
      const response = isEdit
        ? await projectsApi.update(id, payload)
        : await projectsApi.create(payload);
      toast.success(response.message || 'Project saved successfully.');
      // Both paths land on the project details page.
      navigate(`/projects/${response.data._id}`, { replace: true });
    } catch (error) {
      setErrors(error.fieldErrors || {});
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <PageHeader title="Edit project" backTo="/projects" backLabel="Back to projects" />
        <Card>
          <LoadingState label="Loading project…" />
        </Card>
      </>
    );
  }

  if (loadError) {
    return (
      <>
        <PageHeader title="Edit project" backTo="/projects" backLabel="Back to projects" />
        <Card>
          <ErrorState error={loadError} onRetry={() => navigate(0)} />
        </Card>
      </>
    );
  }

  const ownerOptions = employees.map((employee) => ({
    value: employee._id,
    label: employee.name,
    description: `${typeLabel(employee.department)} · ${employee.email}`,
  }));

  return (
    <>
      <PageHeader
        title={isEdit ? 'Edit project' : 'Create project'}
        description={
          isEdit
            ? 'Update the project details below.'
            : 'Projects group related work — technical or not — into one place.'
        }
        backTo={isEdit ? `/projects/${id}` : '/projects'}
        backLabel={isEdit ? 'Back to project' : 'Back to projects'}
      />

      <Card className="max-w-3xl">
        <CardBody>
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {formError && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
              >
                {formError}
              </div>
            )}

            <Field label="Project name" error={errors.name} required>
              {({ id: fieldId, describedBy, invalid }) => (
                <Input
                  id={fieldId}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  autoFocus
                  placeholder="e.g. Independence Day AI Card Campaign"
                  value={form.name}
                  onChange={(event) => setValue('name', event.target.value)}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Project type"
                error={errors.type}
                hint="Optional — you can set this later."
              >
                {({ id: fieldId, describedBy, invalid }) => (
                  <Select
                    id={fieldId}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    value={form.type}
                    onChange={(event) => setValue('type', event.target.value)}
                  >
                    <option value="">No type</option>
                    {options.projectTypes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>

              <Field
                label="Project owner"
                error={errors.owner}
                required
                hint="Any employee can own a project."
              >
                {({ id: fieldId, describedBy, invalid }) => (
                  <SearchSelect
                    id={fieldId}
                    describedBy={describedBy}
                    invalid={invalid}
                    options={ownerOptions}
                    value={form.owner}
                    onChange={(value) => setValue('owner', value)}
                    placeholder="Select an owner"
                    searchPlaceholder="Search employees…"
                    showAvatar
                  />
                )}
              </Field>
            </div>

            <Field label="Description" error={errors.description}>
              {({ id: fieldId, describedBy, invalid }) => (
                <Textarea
                  id={fieldId}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  placeholder="What is this project about?"
                  value={form.description}
                  onChange={(event) => setValue('description', event.target.value)}
                />
              )}
            </Field>

            <div className="grid gap-5 sm:grid-cols-3">
              <Field label="Start date" error={errors.startDate} required>
                {({ id: fieldId, describedBy, invalid }) => (
                  <Input
                    id={fieldId}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="date"
                    value={form.startDate}
                    onChange={(event) => setValue('startDate', event.target.value)}
                  />
                )}
              </Field>

              <Field label="End date" error={errors.endDate}>
                {({ id: fieldId, describedBy, invalid }) => (
                  <Input
                    id={fieldId}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    type="date"
                    min={form.startDate || undefined}
                    value={form.endDate}
                    onChange={(event) => setValue('endDate', event.target.value)}
                  />
                )}
              </Field>

              <Field label="Status">
                {({ id: fieldId }) => (
                  <Select
                    id={fieldId}
                    value={form.status}
                    onChange={(event) => setValue('status', event.target.value)}
                  >
                    {options.projectStatuses.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate(isEdit ? `/projects/${id}` : '/projects')}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                {isEdit ? 'Save changes' : 'Create project'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </>
  );
};
