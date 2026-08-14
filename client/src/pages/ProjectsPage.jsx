import { useCallback, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FolderKanban, LayoutGrid, List, Plus } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';
import { FilterBar } from '../components/FilterBar.jsx';
import { Button } from '../components/ui/Button.jsx';
import { Card } from '../components/ui/Card.jsx';
import { MetaBadge } from '../components/ui/Badge.jsx';
import { ProgressBar } from '../components/ui/ProgressBar.jsx';
import { UserCell } from '../components/ui/Avatar.jsx';
import { Pagination } from '../components/ui/Pagination.jsx';
import { TBody, TD, TH, THead, TR, TableWrap } from '../components/ui/Table.jsx';
import { EmptyState, ErrorState, TableSkeleton } from '../components/ui/States.jsx';
import { useApiResource } from '../hooks/useApiResource.js';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import { useOptions } from '../hooks/useOptions.js';
import { projectsApi } from '../services/resources.js';
import { PROJECT_STATUS_META } from '../utils/constants.js';
import { cx, formatDate, typeLabel } from '../utils/format.js';

const ProjectCard = ({ project }) => (
  <Link
    to={`/projects/${project._id}`}
    className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-card transition hover:border-slate-300 hover:shadow-pop"
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="truncate font-semibold text-slate-900">{project.name}</h3>
        {project.type && (
          <p className="mt-0.5 text-xs text-slate-500">{typeLabel(project.type)}</p>
        )}
      </div>
      <MetaBadge map={PROJECT_STATUS_META} value={project.status} />
    </div>

    {project.description && (
      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{project.description}</p>
    )}

    <div className="mt-4">
      <ProgressBar
        value={project.stats?.progress ?? 0}
        showLabel
        label={`${project.stats?.completed ?? 0} of ${project.stats?.totalTasks ?? 0} tasks`}
      />
    </div>

    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
      <UserCell user={project.owner} />
      <div className="text-right">
        <p className="text-xs text-slate-400">Due</p>
        <p className="text-xs font-medium text-slate-600">{formatDate(project.endDate)}</p>
      </div>
    </div>
  </Link>
);

export const ProjectsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const options = useOptions();
  const [view, setView] = useState('grid');

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebouncedValue(search);

  const type = searchParams.get('type') || 'all';
  const status = searchParams.get('status') || 'all';
  const page = Number(searchParams.get('page')) || 1;

  // Filters live in the URL so a filtered view can be shared or bookmarked.
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
      projectsApi.list({ search: debouncedSearch, type, status, page, limit: 12 }, fetchOptions),
    [debouncedSearch, type, status, page],
  );

  const { data: projects, meta, loading, error, refetch } = useApiResource(fetcher);

  const filters = useMemo(
    () => [
      { name: 'type', label: 'Type', value: type, options: options.projectTypes, onChange: (v) => setParam('type', v) },
      { name: 'status', label: 'Status', value: status, options: options.projectStatuses, onChange: (v) => setParam('status', v) },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [type, status, options],
  );

  const resetFilters = () => {
    setSearch('');
    setSearchParams(new URLSearchParams());
  };

  const hasFilters = Boolean(debouncedSearch) || type !== 'all' || status !== 'all';

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every project across the company, technical and non-technical."
        action={
          <Button as={Link} to="/projects/new" icon={Plus}>
            New project
          </Button>
        }
      />

      <Card>
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search by project name…"
          filters={filters}
          onReset={resetFilters}
          extra={{
            node: (
              <div className="ml-auto hidden items-center gap-1 rounded-lg bg-slate-100 p-1 sm:flex">
                {[
                  { id: 'grid', icon: LayoutGrid, label: 'Card view' },
                  { id: 'table', icon: List, label: 'Table view' },
                ].map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setView(id)}
                    aria-label={label}
                    aria-pressed={view === id}
                    className={cx(
                      'grid h-8 w-8 place-items-center rounded-md transition',
                      view === id ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500 hover:text-slate-700',
                    )}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            ),
          }}
        />

        {loading && !projects ? (
          <TableSkeleton rows={6} columns={5} />
        ) : error ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={hasFilters ? 'No projects match your filters' : 'No projects yet'}
            description={
              hasFilters
                ? 'Try a different search term or clear the filters.'
                : "Create your first project to start managing your team's work."
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button as={Link} to="/projects/new" icon={Plus}>
                  Create project
                </Button>
              )
            }
          />
        ) : (
          <>
            {view === 'grid' ? (
              <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                {projects.map((project) => (
                  <ProjectCard key={project._id} project={project} />
                ))}
              </div>
            ) : (
              <TableWrap>
                <THead>
                  <TH>Project</TH>
                  <TH>Type</TH>
                  <TH>Owner</TH>
                  <TH className="w-44">Progress</TH>
                  <TH>Status</TH>
                  <TH>End Date</TH>
                </THead>
                <TBody>
                  {projects.map((project) => (
                    <TR key={project._id}>
                      <TD>
                        <Link
                          to={`/projects/${project._id}`}
                          className="font-medium text-slate-900 transition hover:text-brand-700"
                        >
                          {project.name}
                        </Link>
                      </TD>
                      <TD>{typeLabel(project.type)}</TD>
                      <TD>
                        <UserCell user={project.owner} />
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <ProgressBar value={project.stats?.progress ?? 0} size="sm" className="w-24" />
                          <span className="text-xs font-medium text-slate-600">
                            {project.stats?.progress ?? 0}%
                          </span>
                        </div>
                      </TD>
                      <TD>
                        <MetaBadge map={PROJECT_STATUS_META} value={project.status} />
                      </TD>
                      <TD className="whitespace-nowrap">{formatDate(project.endDate)}</TD>
                    </TR>
                  ))}
                </TBody>
              </TableWrap>
            )}
            <Pagination meta={meta} onChange={(next) => setParam('page', String(next))} />
          </>
        )}
      </Card>
    </>
  );
};
