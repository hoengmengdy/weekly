# Workday — Employee Task Management & Daily Reporting

A working React/TypeScript + Flask application built from the supplied specification. The interface defaults to Khmer and can switch to English. Records, metrics, notifications, reviews and audit history are stored in SQLAlchemy. PostgreSQL is required in production; SQLite is available for a quick local start.

## Start on Windows

Run these commands from this project folder in PowerShell. `npm.cmd` avoids PowerShell execution-policy restrictions. No activation script is necessary.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
.\.venv\Scripts\python.exe -m flask --app INDEx db upgrade -d backend/migrations
.\.venv\Scripts\python.exe -m flask --app INDEx create-admin
Set-Location frontend
npm.cmd ci
npm.cmd run build
Set-Location ..
.\.venv\Scripts\python.exe INDEx.py
```

Open **http://127.0.0.1:5000**. The admin command prompts for a name, unique username, email and password of at least 12 characters. Password entry is hidden. There are no default credentials or sample business records. This workspace already has dependencies installed and the local migration applied; create your first admin, then run `INDEx.py` using `.venv`.

For frontend development, run the Flask launcher in one terminal, and `npm.cmd run dev` from `frontend` in another. Open **http://127.0.0.1:5173**; Vite proxies `/api` to Flask. Use `127.0.0.1` consistently rather than mixing it with `localhost`.

On Linux/macOS substitute `.venv/bin/python` and `npm` for their Windows equivalents.

## First-use workflow

1. Sign in as the super admin. Create departments and task categories.
2. Create a manager account, then employee accounts linked to that manager. Users cannot self-register or choose their own role.
3. Sign in as the manager, create a task and choose one or more team members.
4. As an employee, accept the task, start work, and update your own progress. Create a daily report, save its draft, attach evidence, and submit it.
5. As the manager, open Approval center. Start review, approve the report, or request a revision with feedback. A task is completed separately through Pending Review → Completed.
6. Use Analytics & reports to filter and export. Dashboards refresh after mutations; no production metrics are fabricated.

See [the user guide](docs/USER_GUIDE.md), [API reference](docs/API.md) and [database notes](docs/DATABASE.md).

## Configuration

`backend/.env` is optional for local development. Blank `DATABASE_URL`, `UPLOAD_FOLDER` and `PDF_FONT_PATH` use local defaults. The app creates an ignored local development secret under `backend/instance`; this is never a production secret.

| Variable | Purpose |
| --- | --- |
| `FLASK_ENV` | `development` or `production`; production requires a secret of at least 32 characters and PostgreSQL |
| `SECRET_KEY` | Signing key; generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | `postgresql+psycopg://USER:PASSWORD@HOST:5432/DATABASE`; percent-encode special characters in credentials |
| `FRONTEND_URL` | The single allowed frontend origin and password-reset link origin |
| `UPLOAD_FOLDER` | Private persistent storage, outside the frontend public directory |
| `MAX_CONTENT_LENGTH` | Maximum request size in bytes; default 10 MiB including multipart overhead |
| `ALLOW_OVERNIGHT` | `false` by default; if true an end time before the start time means the next day |
| `RATELIMIT_STORAGE_URI` | Defaults to in-process memory. Use a shared Redis backend for multiple workers/instances |
| `COMPANY_NAME` | Initial export/workspace name; super admin can update it in settings |
| `PDF_FONT_PATH` | Optional replacement TTF; bundled Noto Sans Khmer is used by default |
| `MAIL_SERVER`, `MAIL_PORT`, `MAIL_USE_TLS` | SMTP host, port (587), and STARTTLS setting |
| `MAIL_FROM`, `MAIL_USERNAME`, `MAIL_PASSWORD` | Sender and SMTP credentials |

`frontend/.env.example` documents `VITE_API_BASE_URL`. Keep `/api/v1` for same-origin hosting. Cookie authentication uses HTTP-only signed cookies, eight-hour expiry, CSRF tokens and session-version revocation. JWT refresh is intentionally unnecessary. Cookie settings follow [Flask security guidance](https://flask.palletsprojects.com/en/stable/web-security/).

Password reset returns a generic response to prevent account discovery. SMTP must be configured for delivery; delivery failures are logged without passwords or reset tokens. Tokens are random, hashed in the database, expire after 30 minutes, and are single-use.

## Tests and migrations

```powershell
New-Item -ItemType Directory -Force .qa
.\.venv\Scripts\python.exe -m pytest backend/tests -q --basetemp=.qa/pytest-manual
Set-Location frontend
npm.cmd test
npm.cmd run build
```

`scripts/test.ps1` runs all three checks with a unique workspace-local pytest temporary directory. Pytest removes its selected temporary directory at the start of a run; use only a dedicated test directory. Tests use isolated temporary SQLite databases and temporary files, never the application database.

After model changes:

```powershell
.\.venv\Scripts\python.exe -m flask --app INDEx db migrate -d backend/migrations -m "describe change"
# Review the generated migration before applying it.
.\.venv\Scripts\python.exe -m flask --app INDEx db upgrade -d backend/migrations
.\.venv\Scripts\python.exe -m flask --app INDEx db check -d backend/migrations
```

The checked-in initial migration creates all tables and constraints. Do not use `db.create_all()` to manage production schema changes.

## PostgreSQL with Docker Compose

Create an ignored root `.env` containing generated `POSTGRES_PASSWORD` and `SECRET_KEY`. Use a URL-safe hex password with this Compose configuration. The database has a named persistent volume and is not exposed to the host network.

```powershell
docker compose up -d db
docker compose build web
docker compose run --rm web python -m flask --app INDEx db upgrade -d backend/migrations
docker compose run --rm web python -m flask --app INDEx create-admin
docker compose up -d web
```

Open http://127.0.0.1:5000. The Docker configuration defaults to development cookies for local HTTP. Set `FLASK_ENV=production`, an HTTPS `FRONTEND_URL`, and terminate TLS through a reverse proxy before using it on a server.

## Production deployment

The recommended deployment serves the built frontend and Flask API under one HTTPS origin, keeping cookies and CSRF straightforward.

**Render:** deploy the Dockerfile as a web service, bind the platform port with `waitress-serve --listen=0.0.0.0:$PORT INDEx:app`, attach a persistent disk for `UPLOAD_FOLDER`, and connect a managed PostgreSQL instance. Set production environment variables and SMTP. Run the migration as a pre-deploy command and create the first admin once from a trusted shell. Configure `/health` as the health check. Back up both PostgreSQL and uploads.

**VPS:** build the image or install the locked dependencies, run migrations, and serve with Waitress behind Caddy/Nginx HTTPS. Do not use Flask's development server in production. Restrict filesystem access to the service account and keep secrets outside source control. Schedule `python -m flask --app INDEx notify-deadlines` hourly; it deduplicates due-soon and overdue notices.

**Vercel frontend option:** copy `frontend/vercel.example.json` to `frontend/vercel.json` and replace its example backend URL. Set project root to `frontend`, build with `npm run build`, output `dist`. The example includes an external API rewrite and SPA fallback. Keep `VITE_API_BASE_URL=/api/v1` so browser requests remain same-origin. Set `FRONTEND_URL` on Flask to the exact HTTPS frontend origin. Configure the proxy's Origin/Referer forwarding and verify login, CSRF and cookies after deployment. Never put a signing key or database credential in Vite variables. Flask and durable uploads remain on Render/VPS; they are not hosted by the frontend build.

For Redis-backed rate limiting install `redis`, set `RATELIMIT_STORAGE_URI=redis://...`, and restrict Redis access to the service. With the default memory backend use a single server instance; counters reset on restart.

## Verification and limits

See [QA results](docs/QA.md) for executed checks and remaining environment verification. No cloud deployment or external email delivery is performed by setup. There is no malware scanning service; uploads are size-limited, allowlisted, inspected for file format and served only through authorized downloads. PDF layout uses the bundled font and HarfBuzz shaping. CSV/Excel preserve UTF-8 text. The Noto font's SIL Open Font License is included beside each bundled copy; upstream: [Noto Khmer](https://notofonts.github.io/khmer/).
#   w e e k l y  
 