import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const PageHeader = ({ title, description, action, backTo, backLabel = 'Back' }) => (
  <div className="mb-5">
    {backTo && (
      <Link
        to={backTo}
        className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-slate-800"
      >
        <ChevronLeft size={16} />
        {backLabel}
      </Link>
    )}
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  </div>
);
