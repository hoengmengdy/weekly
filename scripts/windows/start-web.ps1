# Runs Workday with the Waitress production server on 127.0.0.1 only.
# Nothing listens on the LAN or the internet; remote users arrive through cloudflared.
param([int]$Port = 5000, [int]$Threads = 8)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $root
$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path (Join-Path $root 'backend\.env'))) { throw 'backend/.env is missing. Run .\scripts\windows\setup-production.ps1 first.' }
if (-not (Test-Path (Join-Path $root 'frontend\dist\index.html'))) { throw 'frontend/dist is missing. Run .\scripts\windows\setup-production.ps1 first.' }
$busy = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($busy) { throw "Port $Port is already in use by process $($busy[0].OwningProcess). Stop it first (see docs/WINDOWS_HOSTING.md)." }

$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
Write-Host "Workday listening on http://127.0.0.1:$Port (logs: $logs\web-$stamp.*.log)"
# Waitress strips X-Forwarded-* by default; keep them so the app's TRUSTED_PROXY_HOPS
# (ProxyFix) can read the real client IP and HTTPS from cloudflared. Safe only because
# Waitress listens on loopback, where cloudflared is the only client.
$process = Start-Process -FilePath $python -WorkingDirectory $root -NoNewWindow -PassThru -Wait `
    -ArgumentList '-m', 'waitress', "--listen=127.0.0.1:$Port", "--threads=$Threads", '--no-clear-untrusted-proxy-headers', 'INDEx:app' `
    -RedirectStandardOutput "$logs\web-$stamp.out.log" -RedirectStandardError "$logs\web-$stamp.err.log"
exit $process.ExitCode
