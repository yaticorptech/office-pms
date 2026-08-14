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
| GET | `/projects/:id/tasks` | any |
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
    raises nothing. Deleting a task removes its notifications.

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

## Scope

**Phase 1 includes:** auth, roles, projects, tasks, assignment, employees,
both dashboards, search/filtering, responsive UI, validation, loading/empty/error
states.

**Deliberately excluded:** comments, attachments, notifications, time tracking,
subtasks, Kanban, Gantt, calendar, analytics, client/billing. The schema and
folder layout leave room for these without rework.
