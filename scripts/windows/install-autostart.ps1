# Registers Windows Scheduled Tasks so Workday starts at boot, before anyone signs in.
# Run once from an elevated PowerShell ("Run as administrator"). Re-running updates the tasks.
#   .\scripts\windows\install-autostart.ps1              # web server + named tunnel + hourly deadline notices
#   .\scripts\windows\install-autostart.ps1 -NoTunnel    # web server only
#   .\scripts\windows\install-autostart.ps1 -Uninstall
param([switch]$NoTunnel, [switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$names = 'Workday Web', 'Workday Tunnel', 'Workday Deadline Notices'
if ($Uninstall) {
    foreach ($n in $names) { Unregister-ScheduledTask -TaskName $n -Confirm:$false -ErrorAction SilentlyContinue }
    Write-Host 'Workday scheduled tasks removed.'
    return
}
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { throw 'Open PowerShell with "Run as administrator" and run this script again.' }

$root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$scripts = Join-Path $root 'scripts\windows'
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
# S4U runs the task as you, whether or not you are signed in, without storing your password.
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
    -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
function PsAction([string]$script, [string]$extra = '') {
    New-ScheduledTaskAction -Execute 'powershell.exe' -WorkingDirectory $root `
        -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scripts\$script`" $extra"
}

Register-ScheduledTask -Force -TaskName 'Workday Web' -Principal $principal -Settings $settings `
    -Trigger (New-ScheduledTaskTrigger -AtStartup) -Action (PsAction 'start-web.ps1') `
    -Description 'Workday Waitress server on 127.0.0.1:5000' | Out-Null
Write-Host 'Registered: Workday Web'

if (-not $NoTunnel) {
    $config = Join-Path $env:USERPROFILE '.cloudflared\workday.yml'
    if (-not (Test-Path $config)) { throw "Missing $config. Run setup-tunnel.ps1 first, or pass -NoTunnel." }
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $trigger.Delay = 'PT30S'   # give the web server a head start
    Register-ScheduledTask -Force -TaskName 'Workday Tunnel' -Principal $principal -Settings $settings `
        -Trigger $trigger -Action (PsAction 'start-tunnel.ps1' "-Config `"$config`"") `
        -Description 'Cloudflare named tunnel for Workday' | Out-Null
    Write-Host 'Registered: Workday Tunnel'
}

$hourly = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Hours 1)
$notify = New-ScheduledTaskAction -Execute (Join-Path $root '.venv\Scripts\python.exe') -WorkingDirectory $root `
    -Argument '-m flask --app INDEx notify-deadlines'
$notifySettings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -Force -TaskName 'Workday Deadline Notices' -Principal $principal -Settings $notifySettings `
    -Trigger $hourly -Action $notify -Description 'Hourly due-soon/overdue notifications' | Out-Null
Write-Host 'Registered: Workday Deadline Notices'
Write-Host 'Start now without rebooting:  Start-ScheduledTask "Workday Web"; Start-ScheduledTask "Workday Tunnel"'
