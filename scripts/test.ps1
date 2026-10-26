$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
New-Item -ItemType Directory -Force -Path '.qa' | Out-Null
$testPath = Join-Path $projectRoot ('.qa/pytest-' + [guid]::NewGuid().ToString('N'))
& '.\.venv\Scripts\python.exe' -m pytest backend/tests -q --basetemp=$testPath
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Push-Location -LiteralPath 'frontend'
try {
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
