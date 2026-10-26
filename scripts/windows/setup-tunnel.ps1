# Creates a named Cloudflare Tunnel for your own domain and points it at the local site.
# Prerequisites: the domain's DNS is managed by Cloudflare, and you ran `cloudflared tunnel login` once.
param(
    [Parameter(Mandatory = $true)][string]$Hostname,   # e.g. workday.example.com
    [string]$TunnelName = 'workday',
    [int]$Port = 5000
)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$cfDir = Join-Path $env:USERPROFILE '.cloudflared'
if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) { throw 'cloudflared is not installed: winget install --id Cloudflare.cloudflared' }
if (-not (Test-Path (Join-Path $cfDir 'cert.pem'))) { throw 'Not logged in. Run: cloudflared tunnel login   (choose your domain in the browser)' }

$existing = cloudflared tunnel list --output json | ConvertFrom-Json | Where-Object { $_.name -eq $TunnelName -and -not $_.deleted_at }
if ($existing) {
    $id = $existing[0].id
    Write-Host "Reusing tunnel '$TunnelName' ($id)"
} else {
    cloudflared tunnel create $TunnelName
    if ($LASTEXITCODE -ne 0) { throw 'Tunnel creation failed' }
    $id = (cloudflared tunnel list --output json | ConvertFrom-Json | Where-Object name -eq $TunnelName)[0].id
}
$credentials = Join-Path $cfDir "$id.json"
if (-not (Test-Path $credentials)) { throw "Credentials file $credentials is missing. It is only written on the PC that created the tunnel." }

# Creates/updates the proxied CNAME <Hostname> -> <id>.cfargotunnel.com in Cloudflare DNS.
cloudflared tunnel route dns --overwrite-dns $TunnelName $Hostname
if ($LASTEXITCODE -ne 0) { throw 'DNS routing failed. Is the domain active in this Cloudflare account?' }

# Named workday.yml (not config.yml) so that quick tunnels keep working too.
$config = Join-Path $cfDir 'workday.yml'
@(
    "tunnel: $id"
    "credentials-file: $credentials"
    'no-autoupdate: true'
    'ingress:'
    "  - hostname: $Hostname"
    "    service: http://127.0.0.1:$Port"
    '  - service: http_status:404'
) | Set-Content -LiteralPath $config -Encoding ascii
Write-Host "Wrote $config"

$envFile = Join-Path $root 'backend\.env'
if (Test-Path $envFile) {
    $lines = Get-Content -LiteralPath $envFile
    $lines = $lines | ForEach-Object { if ($_ -match '^FRONTEND_URL=') { "FRONTEND_URL=https://$Hostname" } else { $_ } }
    $lines | Set-Content -LiteralPath $envFile -Encoding ascii
    Write-Host "Set FRONTEND_URL=https://$Hostname in backend/.env (restart the web server to apply)."
}
Write-Host 'Next: .\scripts\windows\start-tunnel.ps1   (or install-autostart.ps1 for boot-time start)'
