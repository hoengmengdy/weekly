# Connects the local site to Cloudflare. Outbound only: no router port forwarding is needed.
#   Named tunnel (your domain):  .\scripts\windows\start-tunnel.ps1
#   Temporary test URL:          .\scripts\windows\start-tunnel.ps1 -Quick
param([switch]$Quick, [int]$Port = 5000, [string]$Config = (Join-Path $env:USERPROFILE '.cloudflared\workday.yml'))
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$logs = Join-Path $root 'logs'
New-Item -ItemType Directory -Force $logs | Out-Null
try { Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$Port/health" -TimeoutSec 5 | Out-Null }
catch { Write-Warning "The site is not answering on http://127.0.0.1:$Port/health. Start it first with start-web.ps1." }

if ($Quick) {
    # Random https://<words>.trycloudflare.com URL; it changes every time this runs.
    Write-Host 'Starting a Quick Tunnel. Look for the https://....trycloudflare.com URL below.'
    & cloudflared tunnel --no-autoupdate --url "http://127.0.0.1:$Port"
} else {
    if (-not (Test-Path $Config)) { throw "Missing $Config. Run setup-tunnel.ps1 -Hostname your.domain first, or use -Quick." }
    & cloudflared tunnel --config $Config --logfile (Join-Path $logs 'tunnel.log') run
}
exit $LASTEXITCODE
