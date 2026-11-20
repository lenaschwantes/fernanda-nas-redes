# Rotina diária do radar do X: coleta pelo Agent Reach e publica se algo mudou.
# Roda pelo Agendador de Tarefas do Windows, na máquina onde o login do X está no Agent Reach.
# Log em %LOCALAPPDATA%\fernanda-radar\radar.log

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
# O app desktop do Claude é empacotado: o que ele instala em AppData vai pra pasta virtual do pacote.
# Fora do app (no Agendador), o Agent Reach só existe nesse caminho real.
$py = Get-ChildItem (Join-Path $env:LOCALAPPDATA 'Packages\Claude_*\LocalCache\Roaming\uv\tools\agent-reach\Scripts\python.exe') -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
if (-not $py) { $py = Join-Path $env:APPDATA 'uv\tools\agent-reach\Scripts\python.exe' }
$dir  = Join-Path $env:LOCALAPPDATA 'fernanda-radar'
$log  = Join-Path $dir 'radar.log'
New-Item -ItemType Directory -Force $dir | Out-Null
$env:PYTHONIOENCODING = 'utf-8'

function Say($msg) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  $msg" | Out-File -Append -Encoding utf8 $log }
function RunGit { $o = & git.exe @args 2>&1 | Out-String; if ($o.Trim()) { $o.Trim() | Out-File -Append -Encoding utf8 $log } }

Set-Location $repo
Say "--- início (python: $py)"
RunGit pull --ff-only
if ($LASTEXITCODE -ne 0) { Say 'git pull falhou, parando'; exit 1 }

# Start-Process -Wait espera também os processos filhos do Python do uv
$out = Join-Path $dir 'coleta.out'; $err = Join-Path $dir 'coleta.err'
$p = Start-Process -FilePath $py -ArgumentList 'scripts/radar_x.py' -WorkingDirectory $repo `
     -NoNewWindow -Wait -PassThru -RedirectStandardOutput $out -RedirectStandardError $err
Get-Content $out, $err -Encoding UTF8 | Where-Object { $_ -match '\S' -and $_ -notmatch '^\s*\d+: [0-9A-F]{8}' } |
  Out-File -Append -Encoding utf8 $log
if ($p.ExitCode -ne 0) { Say "coleta falhou (saída $($p.ExitCode)), nada publicado"; exit 1 }

RunGit add data/radar.json
RunGit diff --cached --quiet
if ($LASTEXITCODE -eq 0) { Say 'nada mudou'; exit 0 }
RunGit commit -q -m 'Atualiza o radar do X'
RunGit push -q
if ($LASTEXITCODE -ne 0) { Say 'git push falhou'; exit 1 }
Say 'publicado'
