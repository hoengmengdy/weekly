# One-time (and after every code update) preparation for hosting Workday on this Windows PC.
# Safe to re-run: it never deletes or recreates backend/instance/workday.db and never
# overwrites an existing backend/.env.
param([string]$PublicUrl = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location -LiteralPath $root
$python = Join-Path $root '.venv\Scripts\python.exe'
if (-not (Test-Path $python)) { throw "Missing $python. Run: python -m venv .venv" }

Write-Host '1/5 Installing locked Python dependencies into .venv'
& $python -m pip install --disable-pip-version-check -q -r backend/requirements.lock.txt
if ($LASTEXITCODE -ne 0) { throw 'pip install failed' }

Write-Host '2/5 Writing backend/.env (only if it does not exist yet)'
$envFile = Join-Path $root 'backend\.env'
if (Test-Path $envFile) {
    Write-Host '    backend/.env already exists - left unchanged.'
} else {
    # The secret is generated straight into the file and never printed.
    $secret = & $python -c "import secrets; print(secrets.token_hex(32))"
    if (-not $PublicUrl) { $PublicUrl = 'http://127.0.0.1:5000' }
    @(
        '# Production settings for self-hosting on this Windows PC. Never commit or share this file.'
        'FLASK_ENV=production'
        "SECRET_KEY=$secret"
        '# Keep the existing local SQLite database (single Waitress process only).'
        'DATABASE_URL='
        'ALLOW_SQLITE_IN_PRODUCTION=true'
        '# cloudflared on this PC is the single trusted proxy hop.'
        'TRUSTED_PROXY_HOPS=1'
        '# Exact public HTTPS origin, e.g. https://workday.example.com (used for CORS and reset links).'
        "FRONTEND_URL=$PublicUrl"
        'COMPANY_NAME=Workday'
        'UPLOAD_FOLDER='
        'MAX_CONTENT_LENGTH=10485760'
        'ALLOW_OVERNIGHT=false'
        'RATELIMIT_STORAGE_URI=memory://'
        'PDF_FONT_PATH='
        'MAIL_SERVER='
        'MAIL_PORT=587'
        'MAIL_USE_TLS=true'
        'MAIL_FROM='
        'MAIL_USERNAME='
        'MAIL_PASSWORD='
    ) | Set-Content -LiteralPath $envFile -Encoding ascii
    # Restrict the file to the current user, SYSTEM and Administrators.
    icacls $envFile /inheritance:r /grant:r "${env:USERNAME}:(R,W)" 'SYSTEM:(F)' 'Administrators:(F)' | Out-Null
    Write-Host '    Created backend/.env with a new random SECRET_KEY (existing sign-ins must log in again).'
}

Write-Host '3/5 Backing up the database before checking migrations'
$db = Join-Path $root 'backend\instance\workday.db'
if (Test-Path $db) {
    $backupDir = Join-Path $root 'backups'
    New-Item -ItemType Directory -Force $backupDir | Out-Null
    $target = Join-Path $backupDir ('workday-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.db')
    # sqlite3's online backup API copies a consistent snapshot even while the site is running.
    & $python -I -c "import sqlite3,sys; s=sqlite3.connect(sys.argv[1]); d=sqlite3.connect(sys.argv[2]); s.backup(d); d.close(); s.close()" $db $target
    if ($LASTEXITCODE -ne 0) { throw 'Database backup failed' }
    Write-Host "    Backup: $target"
}

Write-Host '4/5 Applying pending migrations (no-op when already current; never drops data)'
& $python -m flask --app INDEx db upgrade -d backend/migrations
if ($LASTEXITCODE -ne 0) { throw 'Migration failed - restore from the backup above if needed' }

Write-Host '5/5 Building the frontend'
Push-Location -LiteralPath (Join-Path $root 'frontend')
try {
    if (-not (Test-Path 'node_modules')) { & npm.cmd ci --no-audit --no-fund; if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' } }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
} finally { Pop-Location }
Write-Host 'Done. Start the site with: .\scripts\windows\start-web.ps1'
