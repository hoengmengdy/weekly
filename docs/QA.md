# Implementation and verification

## Pasted-link and Khmer-label fix — 26 October 2026

Fixed work-link labels/help text that had been saved as literal question marks. Work links now normalize pasted bullets, numbered-list prefixes and missing schemes on bare domain URLs before validation, preserving Facebook profile query parameters. Frontend and backend use the same normalization rules; unsafe schemes and embedded credentials remain rejected. **36 backend tests and 11 frontend tests passed**, including screenshot-style pasted values, all 15 rendered links, and a regression check for the actual Khmer label/help text. TypeScript/Vite production build passed. Browser visual QA remains unavailable as noted below.

## Fifteen work links — 26 October 2026

Reports now accept up to 15 HTTP/HTTPS work links, one per line. Every link is validated and displayed separately in report details and review snapshots; CSV, Excel and PDF retain all links. Existing single-link records remain compatible. Migration `f070233cddf7` widens PostgreSQL storage to TEXT. SQLite retains its existing VARCHAR declaration because SQLite does not enforce that length, avoiding a rebuild of the report table and its history references.

Validation: **35 backend tests passed**, **9 frontend tests passed**, TypeScript/Vite production build passed, real HTTP workflow with 15 links passed, and schema drift check passed. Tests cover all 15 clickable links, rejecting a sixteenth, invalid or credential-bearing URLs anywhere in the list, blank lines/Windows newlines, values exceeding the former total-length limit, revision snapshots and multi-link exports.

## Work-link update — 26 October 2026

Added the optional Facebook / work link input, clickable report-detail and review-history links, API URL validation, export column, and migration `24c89e92249e`. The migration preserved all 3 users, 3 tasks and 2 existing reports; older reports have an empty link. Validation: **33 backend tests passed**, **6 frontend tests passed**, production TypeScript/Vite build passed, and migration drift check passed. New tests cover link storage, reviewer visibility, snapshots, exports, ownership isolation, rejection of unsafe URLs, and entering/opening a work link through the React report flow.

Verified locally on 26 October 2026 using Python 3.12 and Node 24. Dependencies are installed in `.venv` and `frontend/node_modules`; Python and npm lock files are checked in. No admin credentials or sample business records have been created in the default database.

## Phase results

| Phase | Delivered files and behavior | Checks |
| --- | --- | --- |
| 1: Inspect | Existing folder contained an empty `INDEx.py`. Preserved it as a real application launcher; added separate backend/frontend/docs directories | Inspected attachment and project; no existing business code to overwrite |
| 2: Database/API | `backend/app/{models,schemas,extensions,services,routes,__init__}.py`, `backend/manage.py`, initial migration | Migration applied locally; schema drift check passes; PostgreSQL offline DDL generation passes |
| 3: Interface | React/TypeScript/Vite, Tailwind, Router, TanStack Query, React Hook Form, Zod, Recharts and Lucide; Khmer/English navigation, task/report/user forms, details, review, notifications and settings | TypeScript and production Vite build pass; frontend tests pass |
| 4: Workflows | Multi-assignee tasks, per-assignee progress, reviewed report versions, secure attachments, audit history, scoped metrics, deadline CLI, CSV/XLSX/PDF, print styles | Backend tests and real HTTP workflow pass |
| 5: QA | `backend/tests`, frontend interaction tests, `scripts/http_smoke.py`, `scripts/test.ps1` | Results below |
| 6: Delivery | README, API/database/user guide, `.env.example` files, Dockerfile, Compose, Vercel rewrite example, lock files, bundled licensed Khmer font | Setup and deployment commands documented |

## Executed checks

- `python -m pytest backend/tests -q --basetemp=.qa/pytest-run5`: **28 passed**. Coverage includes login success/failure, disabled accounts, copied-cookie revocation, manager and employee isolation, hidden internal notes, assignments, task transitions, archives, report drafts/submissions/revisions/approvals/reopening, single-use reset tokens, progress/time/date validation, upload content/permission checks, pagination/filtering/sorting, CSV formula injection, XLSX/PDF generation, dashboard metrics, notifications, CSRF, secure headers and rate limiting.
- `npm.cmd test`: **6 passed**. Includes Khmer default status text, input validation, preserving values after server rejection, protected content, CSRF request headers, and the full React login → draft creation → submit → logout flow with controlled HTTP responses.
- `npm.cmd run build`: TypeScript compile and optimized frontend bundle succeed.
- `python scripts/http_smoke.py`: **passed** against a temporary real local HTTP server and temporary database, with CSRF enabled. Verified manager login → assignment → employee login/accept/start → Khmer report → submission → revision → author edit/resubmit → manager approval → task completion → database metrics → CSV/Excel/Khmer PDF → logout. Server shuts down and temporary records are removed after the check.
- `flask --app INDEx db upgrade -d backend/migrations`: initial SQLite schema applied.
- `flask --app INDEx db check -d backend/migrations`: no schema drift.
- PostgreSQL `db upgrade --sql`: initial migration compiles to transactional PostgreSQL DDL with tables, foreign keys, check constraints and indexes. This is an offline compatibility check, not a live PostgreSQL test.
- Python `compileall`: backend, launcher and smoke script compile.

The first checks exposed a Windows npm path issue from the folder's ampersand, a test-fixture FK ordering problem, and a PDF stylesheet compatibility issue. These were fixed before the passing results above. Runtime secrets and QA data are ignored by source control.

## Environment verification still required

- **Browser rendering:** no browser was exposed by the connected browser tools (`listBrowsers` returned an empty list). No visual, real-browser/mobile or screenshot QA is claimed. DOM interaction tests and production compilation passed.
- **Live PostgreSQL:** neither Docker nor PostgreSQL CLI/server was available. Run migrations and the workflow against a dedicated PostgreSQL staging instance before production use; the Compose configuration and offline SQL generation are provided.
- **SMTP:** no mail server credentials were supplied. Password reset is tested with a captured email delivery stub; actual delivery is not verified.
- **Cloud deployment:** no service/domain/database credentials were supplied and no cloud resources were created. Docker, Render/VPS and Vercel frontend instructions are included.

Use one server instance with in-memory rate limits, or configure a shared Redis rate-limit store for multiple instances. Schedule `notify-deadlines` to receive deadline reminders. Malware scanning is not integrated. Current PDF labels are English while report content supports Khmer; the UI navigation/form/status dictionaries default to Khmer, while server validation messages and generated audit action names are English.
