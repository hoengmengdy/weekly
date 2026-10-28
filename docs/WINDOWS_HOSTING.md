# Hosting Workday on this Windows PC (Cloudflare Tunnel)

This guide makes the site reachable over HTTPS from any network (other Wi-Fi, mobile data) while this PC is the server. Nothing is opened on your router: `cloudflared` makes an **outbound** connection to Cloudflare, and Cloudflare forwards visitors through it.

```
Phone / laptop ──HTTPS──▶ Cloudflare edge ◀──outbound tunnel── cloudflared (this PC) ──▶ Waitress 127.0.0.1:5000 ──▶ backend/instance/workday.db
```

Run all commands in **PowerShell** from the project folder:

```powershell
Set-Location "C:\Word\Employee Task Management & Daily Reporting System"
```

## What the production setup does

| Piece | Setting |
| --- | --- |
| Web server | Waitress (not the Flask development server), `127.0.0.1:5000`, 8 threads, loopback only |
| Frontend | Vite build in `frontend/dist`, served by Flask on the same origin; the API is called at the relative `/api/v1` |
| Database | Existing `backend/instance/workday.db` (SQLite), kept via `ALLOW_SQLITE_IN_PRODUCTION=true` |
| Security | `FLASK_ENV=production`: no debug, random 64-hex `SECRET_KEY`, `Secure`+`HttpOnly` cookies, HSTS, CSRF with strict Referer checks over HTTPS, generic JSON errors (no tracebacks) |
| Proxy | `TRUSTED_PROXY_HOPS=1` plus Waitress `--no-clear-untrusted-proxy-headers`, so rate limits apply to each visitor's real IP and the app knows the request was HTTPS |
| CORS / links | `FRONTEND_URL` = your exact public `https://` origin |

All of this lives in `backend/.env`. It's git-ignored and readable only by your account, and it must never be shared.

## 1. Prepare (once, and after every code update)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup-production.ps1
```

This installs the locked Python packages into `.venv` and creates `backend/.env` **only if it is missing**. It takes a consistent backup into `backups\`, applies pending migrations (`flask db upgrade` never drops data and is a no-op when current), and builds the frontend.

The first run generates a new `SECRET_KEY`, so everyone has to sign in again once. Accounts, passwords, tasks and reports are unaffected.

## 2. Start the website locally

Only one program can use port 5000. **First stop the development server** (`python INDEx.py` / `flask run`): close its window or press `Ctrl+C`. If you can't find the window:

```powershell
Get-NetTCPConnection -LocalPort 5000 -State Listen | ForEach-Object { Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)" | Select-Object ProcessId, CommandLine }
Stop-Process -Id <ProcessId>     # use an elevated PowerShell if access is denied
```

Then start production (leave this window open):

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-web.ps1
```

Check it from a second PowerShell window:

```powershell
Invoke-RestMethod http://127.0.0.1:5000/health      # -> status ok
Start-Process http://127.0.0.1:5000                 # opens the sign-in page
```

## 3a. Permanent HTTPS URL with your own domain (recommended)

Requirements:

- A free Cloudflare account: https://dash.cloudflare.com/sign-up
- A domain you control, **added to Cloudflare**: *Add a site*, pick the Free plan, then change the nameservers at your registrar to the two Cloudflare shows you. Wait until the domain status is **Active**. A domain is the only cost, typically a few dollars a year. The tunnel itself is free.
- `cloudflared` (already installed here; otherwise `winget install --id Cloudflare.cloudflared`).

Steps, using `workday.example.com` as the example. Use any subdomain of your domain:

```powershell
cloudflared tunnel login
# A browser opens: sign in and choose your domain. This saves %USERPROFILE%\.cloudflared\cert.pem.

powershell -ExecutionPolicy Bypass -File .\scripts\windows\setup-tunnel.ps1 -Hostname workday.example.com
```

`setup-tunnel.ps1` does four things:

1. Creates a named tunnel `workday`. Its credentials go to `%USERPROFILE%\.cloudflared\<id>.json`. Keep that file private.
2. Creates the DNS record `workday.example.com` → the tunnel. It's proxied by Cloudflare, so HTTPS certificates are automatic.
3. Writes `%USERPROFILE%\.cloudflared\workday.yml`, which sends only that hostname to `http://127.0.0.1:5000` and returns 404 for everything else.
4. Sets `FRONTEND_URL=https://workday.example.com` in `backend/.env`.

Restart the web server (`Ctrl+C` in its window, then run `start-web.ps1` again) so the new `FRONTEND_URL` applies. Then start the tunnel:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-tunnel.ps1
```

## 3b. No domain yet: temporary Quick Tunnel (testing only)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\start-tunnel.ps1 -Quick
```

It prints a URL like `https://random-words.trycloudflare.com`. Limitations:

- You need no account, but the URL is random and **changes every time** cloudflared restarts. Bookmarks and shared links break.
- There's no uptime guarantee, and Cloudflare limits Quick Tunnels (about 200 concurrent requests, no Server-Sent Events). Use it for testing only.
- Login and normal use work, because the app runs on a single origin. For password-reset email links to point to the right place, set `FRONTEND_URL` in `backend/.env` to the current trycloudflare URL and restart the web server.
- Anyone who learns the URL reaches your sign-in page. Accounts and passwords still protect the data.

## 4. Verify from another network

On a phone with **Wi-Fi turned off** (mobile data), open your `https://` URL, then check:

1. The padlock shows a valid certificate, and the Workday sign-in page loads.
2. Sign in with a real account and open Tasks and Reports. Your existing records should appear.
3. Make a small change (for example, mark a notification read), reload, and confirm it's still there. Then confirm the same change on the PC at `http://127.0.0.1:5000`.

From the PC you can also run `Invoke-RestMethod https://workday.example.com/health`. A remote check from a phone is still the real test.

## 5. Start automatically after Windows restarts

Run once in an **elevated** PowerShell (right-click → *Run as administrator*), as the Windows account that owns the project:

```powershell
Set-Location "C:\Word\Employee Task Management & Daily Reporting System"
powershell -ExecutionPolicy Bypass -File .\scripts\windows\install-autostart.ps1
Start-ScheduledTask "Workday Web"; Start-ScheduledTask "Workday Tunnel"
```

This registers four Scheduled Tasks. They run as your account, without anyone signed in and without storing your password:

- **Workday Web**: Waitress, restarted every minute if it stops.
- **Workday Tunnel**: the named tunnel, starting 30 s after boot.
- **Workday Deadline Notices**: `flask notify-deadlines` every hour.
- **Workday Daily Tasks**: `flask generate-daily-tasks` every minute, creating at most one task per repeating template each day (UTC+7). Re-run the installer after updating to register this job.

Use `-NoTunnel` to skip the tunnel and `-Uninstall` to remove all four. Also set *Settings → System → Power* so the PC **never sleeps**: a sleeping PC takes the site offline.

## Day-to-day operations

| Action | Command |
| --- | --- |
| Status | `Get-ScheduledTask "Workday *" \| Select-Object TaskName, State` and `Invoke-RestMethod http://127.0.0.1:5000/health` |
| Stop | `Stop-ScheduledTask "Workday Tunnel"; Stop-ScheduledTask "Workday Web"` |
| Start | `Start-ScheduledTask "Workday Web"; Start-ScheduledTask "Workday Tunnel"` |
| Restart (e.g. after editing `backend/.env`) | Stop, then Start (above) |
| Update code | Stop, `git pull`, rerun `setup-production.ps1`, Start |
| Tunnel status | `cloudflared tunnel info workday` |
| Logs | `logs\web-*.err.log` (Waitress and app errors), `logs\tunnel.log` (cloudflared) |
| Manual DB backup | rerun `setup-production.ps1`, or copy a file from `backups\` off this PC regularly |
| Restore a backup | stop the site, `Copy-Item backups\workday-<stamp>.db backend\instance\workday.db`, start. This **replaces current data**, so only do it deliberately. |

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `start-web.ps1`: *Port 5000 is already in use* | The dev server or an earlier instance is still running. See step 2. |
| `Production requires PostgreSQL DATABASE_URL` | `ALLOW_SQLITE_IN_PRODUCTION=true` is missing from `backend/.env`. |
| `Production SECRET_KEY must have at least 32 characters` | `SECRET_KEY` is empty. Delete `backend/.env` and rerun setup only if you're sure nothing else in it matters, or paste a new key from `python -c "import secrets;print(secrets.token_hex(32))"`. |
| Browser shows **Error 1033** | The tunnel isn't running or isn't connected. Start it and check `logs\tunnel.log`. |
| Browser shows **502 Bad Gateway** | The tunnel works but Waitress isn't running on 127.0.0.1:5000. |
| Login fails with *CSRF* / *referrer does not match* | Open the site only through its public URL (not mixed with another hostname), and make sure `FRONTEND_URL` matches it exactly. Clear cookies for the site. |
| Signed in on `http://127.0.0.1:5000` but lose the session | Production cookies are `Secure`. Use the public `https://` URL, or `http://localhost:5000`. |
| *Too many requests* at login | Login is limited to 10 per minute per visitor IP. Wait a minute. Counters reset when the web server restarts. |
| Quick Tunnel says *config.yml* problems | Quick Tunnels refuse to run if `%USERPROFILE%\.cloudflared\config.yml` exists. This setup uses `workday.yml`, so don't create `config.yml`. |

## Security notes

- Waitress listens only on `127.0.0.1`, so no other device can reach it directly. Don't change `--listen` to `0.0.0.0`: forwarded headers are trusted precisely because only cloudflared can connect.
- `backend/.env`, `backend/instance/`, `backups/`, `logs/` and `%USERPROFILE%\.cloudflared\` contain secrets or data. They're git-ignored and never served. Flask only serves files from `frontend/dist`.
- Optional extra protection: Cloudflare Zero Trust → Access → add an application for your hostname to require an email one-time PIN before the sign-in page loads.
- SQLite plus a single Waitress process suits a small team. If usage grows or several servers are needed, move to PostgreSQL. The migrations already support it.
