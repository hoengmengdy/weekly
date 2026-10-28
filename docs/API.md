# API v1

Work-link normalization: `evidence_url` accepts pasted bullet/numbered-list prefixes and bare domain URLs. Prefixes are removed and `https://` is added to bare domains before validating each link. The limit remains 15 links, one per line, with at most 2048 characters per normalized URL.

Base path: `/api/v1`. JSON request/response bodies. All routes except CSRF/login/forgot/reset require authentication. Every non-GET request also requires CSRF protection, including login. No JWT or refresh endpoint is used: sessions are HTTP-only signed cookies.

```javascript
const {csrf_token} = await fetch('/api/v1/auth/csrf', {credentials:'include'}).then(r=>r.json());
const response = await fetch('/api/v1/auth/login', {
  method:'POST', credentials:'include',
  headers:{'Content-Type':'application/json','X-CSRFToken':csrf_token},
  body:JSON.stringify({username:'your-username',password:'your-password'})
});
// Login returns {user, csrf_token}. Use the new CSRF token for later writes.
```

Errors: `{"error":{"code":422,"message":"..."}}`. Common codes: 400 CSRF, 401 unauthenticated, 403 role denied, 404 inaccessible/missing record, 409 conflict/workflow/unique constraint, 413 request too large, 422 invalid input, 429 rate limit. IDs from another employee's records return 404. Unsupported routes return 404 rather than the SPA index.

Lists return `{items,total,page,pages,per_page}`. `page` starts at 1; `per_page` defaults to 20 and is capped at 100. Departments/categories are compact option lists and return `{items}`. List sorting is allowlisted, default `newest`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/auth/csrf` | Obtain a CSRF token |
| POST | `/auth/login` | Username/email and password; 10 attempts/minute/IP |
| POST | `/auth/logout` | Revoke sessions and clear cookie |
| GET | `/auth/me` | Current public user profile |
| PATCH | `/auth/profile` | Full name, phone, position |
| POST | `/auth/change-password` | `current_password`, `new_password` |
| POST | `/auth/forgot-password` | `email`; generic response; 5/hour/IP |
| POST | `/auth/reset-password` | `token`, `password`; 10/hour/IP |
| GET/POST | `/auth/profile-image` | Current image / multipart `file` image upload |
| GET/POST | `/employees` | Scoped list / super admin creates |
| GET/PATCH | `/employees/{id}` | Scoped detail / super admin updates |
| PATCH | `/employees/{id}/status` | Super admin sets `active` boolean |
| GET/POST | `/departments` | List / super admin creates |
| PATCH | `/departments/{id}` | Super admin updates name/description |
| GET/POST | `/categories` | List / super admin creates |
| PATCH | `/categories/{id}` | Super admin renames a category |
| GET/POST | `/tasks` | Scoped list / manager creates |
| GET/PATCH | `/tasks/{id}` | Detail / creator or administrator updates |
| POST | `/tasks/{id}/assign` | `assigned_employee_ids`: integer array |
| PATCH | `/tasks/{id}/status` | `status` and optional own-assignment `progress` |
| POST | `/tasks/{id}/duplicate` | New Assigned task with source history |
| POST | `/tasks/{id}/archive` | Soft archive |
| GET | `/tasks/{id}/history` | Audit entries; employee details redact manager-only fields |
| POST | `/tasks/{id}/comments` | `body` text; notifies other participants |
| POST | `/tasks/{id}/attachments` | Manager uploads multipart `file` |
| GET/POST | `/reports` | Scoped list / assigned author creates Draft |
| GET/PATCH | `/reports/{id}` | Detail with reviews / author edits Draft or Revision Requested |
| POST | `/reports/{id}/submit` | Validate required output, lock report, notify creator |
| POST | `/reports/{id}/start-review` | Mark Under Review |
| POST | `/reports/{id}/approve` | Optional `feedback` |
| POST | `/reports/{id}/request-revision` | Required `feedback` |
| POST | `/reports/{id}/reopen` | Super admin only; required reason in `feedback` |
| POST | `/reports/{id}/attachments` | Author uploads to editable report |
| GET | `/attachments/{id}` | Authorized private download |
| GET | `/dashboard/employee`, `/dashboard/manager` | Scoped metrics |
| GET | `/analytics/performance`, `/analytics/task-summary` | Scoped task/report/employee metrics |
| GET | `/notifications` | Current user's notifications; `unread=true` filter |
| PATCH | `/notifications/{id}/read` | Current user's notice only |
| GET | `/exports/reports.csv`, `.xlsx`, `.pdf` | Authorized filtered report export |
| GET/PATCH | `/settings` | View / super admin changes `company_name` |
| GET | `/audit-logs` | Super admin paginated audit entries |

Employee input: employee_id, full_name, username, email, password (required on create, >=12 chars), phone, department_id, position, manager_id, role, active, date_joined. Unknown fields are rejected. Password hashes/session versions are never returned.

Task create requires title, assigned_employee_ids, start_date and deadline. Optional description, category_id, department_id, priority, completion_criteria, estimated_hours and internal_notes. Task detail returns assignees, progress, computed overdue state, comments and attachments. Employee output excludes internal notes and other employees' assignment progress.

Report create requires task_id and report_date. Optional work_description, expected_output, actual_output, evidence_url, quantity_target, quantity_completed, progress, start_time, end_time, challenges, solutions, notes. `evidence_url` is an optional newline-separated string of up to 15 HTTP/HTTPS work links (each at most 2048 characters, total at most 30734). Blank lines are ignored and line endings normalized. Existing single-link values remain supported. Embedded login credentials and other URL schemes are rejected for every link. Author is derived from session. Server calculates progress/hours; related task cannot change after creation. Submission requires nonempty descriptions/outputs. Status fields are only changed through workflow endpoints.

Task filters: `q`, `status`, `priority`, `department`, `employee`, `manager`, `category`, `date_from`, `date_to`, `archived=true`, `overdue=true`; sort `newest|deadline|title`. Date ranges use task deadline.

Report/export filters: `q`, `employee`, `task`, `department`, `manager`, `date_from`, `date_to`, `category`, `priority`, `task_status`, `report_status`; sort `newest|date|oldest`. Date ranges use report date. Analytics accepts both task and report filters plus `period=daily|weekly|monthly` for work trends. Draft hours are excluded from submitted-work metrics. Overall completion rate excludes cancelled/archived tasks. Exports share the report-query implementation.

Health: `GET /health` verifies database connectivity. `GET /` serves the built React app. Deadline notifications are scheduled through `flask --app INDEx notify-deadlines`, not an unauthenticated HTTP endpoint.

Daily repetition: task create/update accept `repeat_daily` (default false) and
`repeat_until` (nullable ISO date, inclusive). The end date must not precede the
start date when repetition is enabled. Disabling repetition clears the end date.
Task responses also include `recurrence_source_id` for generated occurrences.
Change schedules on their original task; generated copies cannot enable repeat.
Duplicate creates a non-repeating copy. Archive/cancel stops future repetitions.

`flask --app INDEx generate-daily-tasks` creates today's occurrences (UTC+7).
Authenticated `GET /auth/me` and `GET /tasks` also generate relevant current-day
assignments. No unauthenticated cron endpoint is exposed. The database enforces
one occurrence per source/date. Existing manager/team scope is checked again
when generating assignments. This feature does not backfill historical days.
