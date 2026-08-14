import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Pencil, Plus, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { FilterBar } from '../components/FilterBar.jsx';
import { EmployeeFormModal } from '../components/EmployeeFormModal.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { MetaBadge } from '../components/ui/Badge.jsx';
import { UserCell } from '../components/ui/Avatar.jsx';
import { ConfirmDialog } from '../components/ui/Modal.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { TBody, TD, TH, THead, TR, TableWrap } from '../components/ui/Table.jsx';
import { EmptyState, ErrorState, TableSkeleton } from '../components/ui/States.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useOptions } from '../hooks/useOptions.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { employeesApi } from '../services/resources.js';
import { ROLE_META, USER_STATUS_META } from '../utils/constants.js';
import { typeLabel } from '../utils/format.js';

export const EmployeesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const options = useOptions();
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(search);

  const department = searchParams.get('department') || 'all';
  const status = searchParams.get('status') || 'all';
  const page = Number(searchParams.get('page')) || 1;

  const [formModal, setFormModal] = useState({ open: false, employee: null });
  const [statusTarget, setStatusTarget] = useState(null);
  const [updating, setUpdating] = useState(false);

  const setParam = (key, value) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === 'all') next.delete(key);
      else next.set(key, value);
      if (key !== 'page') next.delete('page');
      return next;
    });
  };

  const fetcher = useCallback(
    (fetchOptions) =>
      employeesApi.list({ search: debouncedSearch, department, status, page, limit: 20 }, fetchOptions),
    [debouncedSearch, department, status, page],
  );

  const { data: employees, meta, loading, error, refetch } = useApiResource(fetcher);

  const filters = useMemo(
    () => [
      {
        name: 'department',
        label: 'Department',
        value: department,
        options: options.departments,
        onChange: (value) => setParam('department', value),
      },
      {
        name: 'status',
        label: 'Status',
        value: status,
        options: options.userStatuses,
        onChange: (value) => setParam('status', value),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [department, status, options],
  );

  const resetFilters = () => {
    setSearch('');
    setSearchParams(new URLSearchParams());
  };

  const hasFilters = Boolean(debouncedSearch) || department !== 'all' || status !== 'all';

  const onToggleStatus = async () => {
    const nextStatus = statusTarget.status === 'active' ? 'inactive' : 'active';
    setUpdating(true);
    try {
      const response = await employeesApi.setStatus(statusTarget._id, nextStatus);
      toast.success(response.message);
      setStatusTarget(null);
      refetch();
    } catch (caught) {
      toast.error(caught.message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Employees"
        description="Everyone who can sign in and be assigned tasks."
        action={
          <Button icon={Plus} onClick={() => setFormModal({ open: true, employee: null })}>
            Add employee
          </Button>
        }
      />

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by name or email…"
          filters={filters}
          onReset={resetFilters}
        />

        {loading && !employees ? (
          <TableSkeleton rows={6} columns={6} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : employees.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No employees match your filters' : 'No employees yet'}
            description={
              hasFilters
                ? 'Try a different search term or clear the filters.'
                : 'Add employees to start assigning tasks.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button icon={Plus} onClick={() => setFormModal({ open: true, employee: null })}>
                  Add employee
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block">
              <TableWrap>
                <THead>
                  <TH>Employee</TH>
                  <TH>Department</TH>
                  <TH>Role</TH>
                  <TH className="text-center">Active</TH>
                  <TH className="text-center">Completed</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Actions</TH>
                </THead>
                <TBody>
                  {employees.map((employee) => (
                    <TR key={employee._id}>
                      <TD>
                        <Link to={`/employees/${employee._id}`} className="block">
                          <UserCell user={employee} subtitle={employee.email} />
                        </Link>
                      </TD>
                      <TD>{typeLabel(employee.department)}</TD>
                      <TD>
                        <MetaBadge map={ROLE_META} value={employee.role} />
                      </TD>
                      <TD className="text-center font-medium">{employee.activeTasks}</TD>
                      <TD className="text-center font-medium">{employee.completedTasks}</TD>
                      <TD>
                        <MetaBadge map={USER_STATUS_META} value={employee.status} />
                      </TD>
                      <TD>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${employee.name}`}
                            onClick={() => setFormModal({ open: true, employee })}
                          >
                            <Pencil size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`${
                              employee.status === 'active' ? 'Deactivate' : 'Activate'
                            } ${employee.name}`}
                            disabled={employee._id === currentUser?._id}
                            onClick={() => setStatusTarget(employee)}
                          >
                            {employee.status === 'active' ? (
                              <ToggleRight size={17} className="text-green-600" />
                            ) : (
                              <ToggleLeft size={17} className="text-slate-400" />
                            )}
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            </div>

            {/* Mobile */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {employees.map((employee) => (
                <li key={employee._id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/employees/${employee._id}`} className="min-w-0 flex-1">
                      <UserCell user={employee} subtitle={employee.email} size="md" />
                    </Link>
                    <MetaBadge map={USER_STATUS_META} value={employee.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
                      {typeLabel(employee.department)}
                    </span>
                    <MetaBadge map={ROLE_META} value={employee.role} />
                    <span>{employee.activeTasks} active</span>
                    <span>{employee.completedTasks} completed</span>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={Pencil}
                      onClick={() => setFormModal({ open: true, employee })}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={employee._id === currentUser?._id}
                      onClick={() => setStatusTarget(employee)}
                    >
                      {employee.status === 'active' ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination meta={meta} onChange={(next) => setParam('page', String(next))} />
          </>
        )}
      </Card>

      <EmployeeFormModal
        open={formModal.open}
        employee={formModal.employee}
        onClose={() => setFormModal({ open: false, employee: null })}
        onSaved={refetch}
      />

      <ConfirmDialog
        open={Boolean(statusTarget)}
        onClose={() => setStatusTarget(null)}
        onConfirm={onToggleStatus}
        loading={updating}
        tone={statusTarget?.status === 'active' ? 'danger' : 'primary'}
        title={
          statusTarget?.status === 'active' ? 'Deactivate this employee?' : 'Activate this employee?'
        }
        message={
          statusTarget?.status === 'active'
            ? `${statusTarget?.name} will not be able to sign in and cannot be assigned new tasks. Their existing tasks stay in place.`
            : `${statusTarget?.name} will be able to sign in again and can be assigned new tasks.`
        }
        confirmLabel={statusTarget?.status === 'active' ? 'Deactivate' : 'Activate'}
      />
    </>
  );
};
