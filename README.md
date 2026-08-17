# Workly — Office Project & Task Management System (Phase 1)

A simple internal work-management system for the whole company. It handles
**technical and non-technical work identically** — a Marketing campaign and an
LMS build are managed the same way.

```
Company → Projects → Tasks → Assigned Employees
```

---

## Stack

| Layer    | Technology                                            |
| -------- | ----------------------------------------------------- |
| Frontend | React 18, Vite, Tailwind CSS, React Router 6          |
| Backend  | Node.js, Express 4, REST API                          |
| Database | MongoDB with Mongoose 8                               |
| Auth     | JWT access tokens, bcrypt password hashing            |
| Validation | zod (server), inline form validation (client)       |

---

## Quick start

Two terminals, from the repo root:

```bash
# 1 — API  (http://localhost:8090)
cd server
npm install
npm run seed:fresh     # creates the demo admin, employees, projects and tasks
npm run dev

# 2 — Web app  (http://localhost:5173)
cd client
npm install
npm run dev
```

Open **http://localhost:5173**.

### Demo accounts

| Role     | Email               | Password       |
| -------- | ------------------- | -------------- |
| Admin    | `admin@office.com`  | `Admin@123`    |
| Employee | `priya@office.com`  | `Employee@123` |

Other employees: `arjun@` (Marketing), `neha@` (Sales), `rahul@` (HR),
`divya@` (Operations) — all with `Employee@123`.

> Change these before using the system for real. `server/.env` is git-ignored;
> `.env.example` documents every variable.

---

## Database

`server/.env` controls the connection:

```bash
MONGODB_URI=mongodb+srv://…      # Atlas, or mongodb://127.0.0.1:27017 for local
DB_NAME=task_manager
```

**Leave `MONGODB_URI` empty** and the API boots a bundled MongoDB automatically
(downloaded once, data persisted in `server/.data/mongo`). That makes a fresh
clone runnable with no database installed. It listens on a fixed port so you can
run `npm run seed` while the API is already running.

---

## Roles

**Admin** — full access: create/edit/archive projects, create/edit/delete and
assign tasks, manage employees, see every dashboard figure.

**Employee** — sees only their own tasks. They can read the projects those tasks
belong to and move a task's status along `To Do → In Progress → Completed`
(and back). They cannot reassign a task, change its project, or manage anyone.

Authorisation is enforced **on the server for every endpoint**. The frontend
route guards are a convenience only — they are not the security boundary.

---

## API

All routes are prefixed `/api`. Everything except `/health`, `/meta/options` and
`/auth/login` requires an `Authorization: Bearer <token>` header.

### Auth
| Method | Route | Access | Notes |
| --- | --- | --- | --- |
| POST | `/auth/login` | public | |
| POST | `/auth/register` | public **only** while no users exist | Bootstraps the first admin; admin-only afterwards |
| GET | `/auth/me` | any | |
| PUT | `/auth/me` | any | Update own name / photo |
| POST | `/auth/change-password` | any | |

### Projects
| Method | Route | Access |
| --- | --- | --- |
| GET | `/projects` | any — filters: `search`, `type`, `status`, `owner`, `sort`, `page`, `limit` |
| GET | `/projects/options` | any — compact list for dropdowns |
| GET | `/projects/:id` | any |
| GET | `/projects/:id/tasks` | any — non-admins see only their own tasks, as on `/tasks` |
| POST | `/projects` | admin |
| PUT | `/projects/:id` | admin |
| DELETE | `/projects/:id` | admin — archives by default, `?hard=true` deletes permanently |

### Tasks
| Method | Route | Access |
| --- | --- | --- |
| GET | `/tasks` | any — filters: `search`, `project`, `assignedTo`, `priority`, `status`, `overdue`, `mine`, `sort`, `page`, `limit`. Non-admins are scoped to their own tasks server-side |
| GET | `/tasks/:id` | admin, or the assignee |
| PATCH | `/tasks/:id/status` | admin (any status), or the assignee (allowed transitions only) |
| POST | `/tasks` | admin |
| PUT | `/tasks/:id` | admin |
| DELETE | `/tasks/:id` | admin |

### Employees
| Method | Route | Access |
| --- | --- | --- |
| GET | `/employees` | admin — filters: `search`, `department`, `status`, `role` |
| GET | `/employees/assignable` | any — active users, name/email/department only |
| GET | `/employees/:id` | admin |
| POST | `/employees` | admin |
| PUT | `/employees/:id` | admin |
| PATCH | `/employees/:id/status` | admin |

### Notifications (in-app)
| Method | Route | Access |
| --- | --- | --- |
| GET | `/notifications` | any — own only; `?unread=true`, `page`, `limit`. `meta.unreadCount` included |
| GET | `/notifications/unread-count` | any — cheap poll for the bell badge |
| PATCH | `/notifications/:id/read` | any — own only (404 otherwise) |
| POST | `/notifications/read-all` | any — own only |

### Dashboard & meta
| Method | Route | Access |
| --- | --- | --- |
| GET | `/dashboard/admin` | admin |
| GET | `/dashboard/employee` | any |
| GET | `/meta/options` | public — every enum (types, departments, statuses…) |

Responses are `{ success, message?, data, meta? }`; errors are
`{ success: false, message, details? }` where `details` carries field-level
validation messages.

---

## Business rules enforced

1. Every task belongs to a project and has exactly one assignee.
2. Only admins create projects or assign/reassign tasks.
3. Employees may update the status of their own tasks only.
4. **Archived projects reject new tasks** (and tasks cannot be moved into them).
5. **Inactive employees cannot be assigned tasks** and cannot sign in.
6. An employee's department never restricts which project or task they can work on.
7. Overdue = `dueDate < now` **and** `status ≠ Completed`.
8. Project progress = `completed ÷ total × 100`, rounded; `0%` when a project has no tasks.
9. The last active admin account cannot be demoted or deactivated, and no admin can deactivate themselves.
10. Password hashes are never returned by any endpoint.
11. **Project type is optional.** A project can be created before it is categorised and typed
    later. Untyped projects are stored as `type: null`, appear normally in the unfiltered
    list, and match no specific type filter. An invalid type is still rejected.
12. On `PUT`, a field the caller omits is left untouched; sending `null` or `""` clears it.
    Partial updates cannot silently wipe data.
13. `overdue=true` combined with `status=Completed` returns **nothing** — a completed
    task is never overdue, so the combination has no results by definition.
14. Assigning or reassigning a task raises an in-app notification for the assignee (and
    tells the previous owner when a task moves away). Assigning a task to yourself
    raises nothing. Deleting a task removes its notifications, and so does permanently
    deleting the project the task belonged to.

---

## Task management

Beyond basic CRUD, the task list is built for the actions people repeat all day:

- **Status tabs with live counts** — All / To Do / In Progress / Completed / Overdue.
  Counts respect the other active filters (project, employee, priority, search) but not
  the tab itself, so switching tabs never changes the numbers.
- **Inline status change** — admins get a dropdown in each row; employees get a
  one-click **Start / Complete / Reopen** for their own tasks. No page load, and the
  control is only rendered where the server would actually allow the change.
- **Sortable columns** — Task, Priority and Due Date. First click sorts ascending,
  clicking the active column flips direction. Priority sorts by real rank
  (Urgent → Low), not alphabetically, and titles sort case-insensitively.
- **Assigned to me** — one-click `mine=true` filter for admins.

## Notifications

In-app only, deliberately: the Phase 1 scope defers email and WhatsApp delivery, and
those remain unbuilt. A bell sits in the sidebar (desktop) and the top bar (mobile),
showing an unread badge. It polls every 45 seconds — no websockets in Phase 1 — and
refreshes immediately after any local action. Clicking a notification marks it read and
opens the task.

---

## Project structure

```
server/src/
  config/       env, database connection, all enums (constants.js)
  models/       User, Project, Task
  middleware/   auth (JWT + role guards), validation, error handling
  validators/   zod schemas per resource
  services/     business logic — the rules above live here
  controllers/  thin HTTP layer
  routes/       route + guard wiring
  utils/        ApiError, asyncHandler, token, pagination
  seed/         development seed data

client/src/
  components/   shared UI (ui/ holds the primitives)
  pages/        one file per screen, dashboard/ splits admin vs employee
  layouts/      sidebar + responsive shell
  context/      auth and toast providers
  services/     API client and per-resource endpoints
  hooks/        data fetching, debounce, enum options
  routes/       route guards
  utils/        formatting and display metadata
```

Adding a project type or department is a one-line change in
`server/src/config/constants.js` — the API serves the lists and every dropdown
picks them up automatically.

---

## Testing

```bash
cd server
npm test          # the whole suite
npm run test:watch
```

199 integration tests run against a real Express server and a real MongoDB (booted
in memory per file), so routing, validation, auth middleware and the error handler
are all exercised as they behave in production. Nothing is mocked.

They cover every endpoint and every business rule listed above, plus the security
boundaries that are easy to regress: employee scoping on both task routes, the
last-admin protections, password hashes never leaving the API, regex and NoSQL
injection through filters, the CORS allowlist, rate limiting, request size limits,
the production configuration guards, and a full production-mode smoke test that
boots `src/index.js`, serves the built client and shuts down on SIGTERM.

---

## Deployment

The app refuses to start with `NODE_ENV=production` unless it is configured safely:
a `JWT_SECRET` that is neither the development default nor shorter than 32
characters, a real `MONGODB_URI`, `BCRYPT_ROUNDS` of at least 10, and a
`CLIENT_ORIGIN` that is not localhost. Every problem is reported at once.

### Single origin (recommended)

Set `SERVE_CLIENT=true` (the default in production) and this process serves the
built React app alongside the API. One host, no CORS, and deep links work because
of the SPA fallback. Hashed assets are cached for a year; `index.html` never is.

```bash
docker compose up --build            # app + MongoDB, needs JWT_SECRET in .env
```

or without Docker:

```bash
npm install && npm run build && npm start
```

### Live

| | |
| --- | --- |
| App | https://office.yaticorp.com |
| API | https://api.office.yaticorp.com/api |
| Health | https://api.office.yaticorp.com/api/health |

The platform URLs (`office-pms.vercel.app`, `api-production-b4b40.up.railway.app`)
still work and stay in `CLIENT_ORIGIN` as a fallback if DNS for the custom domain
ever fails.

Deployed 15 Aug 2026. Database: Atlas, `office_pms_prod` on the existing cluster.
Public registration is closed — the first admin exists, so new accounts are created
from the Employees screen.

Both platforms deploy from `main` on this repository:

| Platform | Root | Builds with |
| --- | --- | --- |
| Vercel (client) | `client/` | `vercel.json` — Vite preset |
| Railway (API) | repo root | `railway.json` → `Dockerfile.server` |

Railway builds from the repository root rather than `server/`, because
`Dockerfile.server` copies from `server/` and needs the root as its build context.

The Railway service pins `PORT=8090` and its domain's target port is set to 8090 to
match `EXPOSE` in the Dockerfile. Leave these alone: if Railway injects its own `PORT`
while the edge routes by `EXPOSE`, the two disagree and every public request is
refused at the proxy — while the container looks perfectly healthy in the logs and
passes Railway's internal health check.

### Split hosting — client on Vercel, API on Railway

Config for this is committed: `client/vercel.json` (SPA rewrite, security headers,
asset caching) and `railway.json` → `Dockerfile.server` (backend-only image, health
check on `/api/health`).

The two hosts need each other's URLs, so the first deploy goes around once:

**1. Database.** In Atlas, use the existing cluster with a *new* database name for
production, e.g. `office_pms_prod`, so production and local development never share
data. Allow Railway's egress in the Atlas IP access list.

**2. API on Railway.** Deploy from the repo — `railway.json` selects the backend
Dockerfile automatically. Set:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | the Atlas connection string |
| `DB_NAME` | `office_pms_prod` |
| `JWT_SECRET` | `openssl rand -hex 32` — 32+ chars, not the dev default |
| `BCRYPT_ROUNDS` | `12` |
| `CLIENT_ORIGIN` | the Vercel URL — placeholder for now, corrected in step 4 |

`PORT`, `SERVE_CLIENT=false` and `TRUST_PROXY=1` are handled for you (Railway injects
the first; the image sets the other two). Note the deployed URL.

**3. Client on Vercel.** Set the project's **Root Directory** to `client`; Vercel
reads `vercel.json` from there. Add one environment variable:

```
VITE_API_URL = https://<your-railway-app>.up.railway.app/api
```

This is compiled into the bundle at build time, not read at runtime — changing the
API URL later means redeploying Vercel, not just editing a variable.

**4. Close the loop.** Set `CLIENT_ORIGIN` on Railway to the real Vercel URL and
redeploy. Until this matches exactly (scheme included, no trailing slash) the browser
will block every API call as a CORS error. Add preview or custom domains as a
comma-separated list.

**5. Create the first admin.** Once, against the deployed API:

```bash
curl -X POST https://<your-railway-app>.up.railway.app/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Your Name","email":"you@yaticorp.com","password":"<a strong password>"}'
```

That account is created as an admin, and the endpoint closes to the public
permanently the moment it succeeds. Everyone else is added from the Employees screen.

### Before the first deploy

1. Generate a secret: `openssl rand -hex 32` → `JWT_SECRET`.
2. Point `MONGODB_URI` at a real database and raise `BCRYPT_ROUNDS` to 12.
3. Set `TRUST_PROXY` to the number of proxies in front of the app (1 on most
   platforms) so rate limiting sees real client IPs rather than the proxy's.
4. **Do not run the seed.** It writes the published demo passwords and `--fresh`
   deletes everything; it refuses to run in production for that reason. Create the
   first admin by calling `POST /api/auth/register` once — the endpoint is public
   only while the database has no users, and closes permanently afterwards.
5. Point the platform's health check at `GET /api/health`, which returns 503 while
   the database is unreachable.

Sign-in, registration and password changes are rate limited (10 failed attempts per
15 minutes per IP by default; successful sign-ins are not counted). Tune with
`AUTH_RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_WINDOW_MS`.

`server/.env.example` documents every variable.

---

## Scope

**Phase 1 includes:** auth, roles, projects, tasks, assignment, employees,
both dashboards, in-app notifications, search/filtering, responsive UI, validation,
loading/empty/error states.

**Deliberately excluded:** comments, attachments, email/WhatsApp delivery, time
tracking, subtasks, Kanban, Gantt, calendar, analytics, client/billing. The schema
and folder layout leave room for these without rework.
