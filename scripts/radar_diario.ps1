# Rotina diária do radar do X: coleta pelo Agent Reach e publica se algo mudou.
# Roda pelo Agendador de Tarefas do Windows, na máquina onde o login do X está no Agent Reach.
# Log em %LOCALAPPDATA%\fernanda-radar\radar.log

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
$py   = Join-Path $env:APPDATA 'uv\tools\agent-reach\Scripts\python.exe'
$log  = Join-Path $env:LOCALAPPDATA 'fernanda-radar\radar.log'
New-Item -ItemType Directory -Force (Split-Path $log) | Out-Null
$env:PYTHONIOENCODING = 'utf-8'

function Say($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Out-File -Append -Encoding utf8 $log }

Set-Location $repo
Say '--- início'
git pull --ff-only *>> $log
if ($LASTEXITCODE -ne 0) { Say 'git pull falhou, parando'; exit 1 }

& $py scripts/radar_x.py *>> $log
if ($LASTEXITCODE -ne 0) { Say 'coleta falhou, nada publicado'; exit 1 }

git add data/radar.json
git diff --cached --quiet
if ($LASTEXITCODE -eq 0) { Say 'nada mudou'; exit 0 }
git commit -q -m 'Atualiza o radar do X' *>> $log
git push -q *>> $log
if ($LASTEXITCODE -ne 0) { Say 'git push falhou'; exit 1 }
Say 'publicado'
