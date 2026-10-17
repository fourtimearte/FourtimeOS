# ===========================================================================
# BACKUP DO BANCO DO FOURTIME OS PARA O GOOGLE DRIVE (17/10/2026)
#
# O plano Free do Supabase não guarda cópia nenhuma dos dados. Este roteiro
# tira uma cópia do banco (os dados do sistema e as contas da equipe) com o
# pg_dump e grava na pasta do Google Drive para computador, que sobe sozinha
# para a nuvem.
#
# Como usar: dois cliques em "FAZER BACKUP.bat". Na primeira vez ele pergunta
# três coisas e guarda as respostas neste computador:
#   1. o endereço do banco (Supabase, botão Connect, Session pooler), SEM a senha;
#   2. a pasta de destino (acha o Google Drive sozinho; se não achar, pergunta);
#   3. se é para lembrar a senha neste computador (guardada cifrada pelo
#      Windows, só este usuário deste computador consegue ler).
# A senha do banco nunca vai para o repositório, nem para o Claude.
#
# Com a senha lembrada, ele também oferece rodar sozinho toda semana
# (Agendador de Tarefas do Windows, domingo ao meio-dia).
#
# Restaurar (só em caso de desastre, e de preferência num projeto NOVO):
#   pg_restore --no-owner --no-privileges -d "<endereço do projeto novo>" arquivo.dump
# ===========================================================================
param([switch]$Automatico)

$ErrorActionPreference = 'Stop'
$pasta = Join-Path $env:APPDATA 'FourtimeBackup'
$arqConfig = Join-Path $pasta 'config.json'
$arqSenha = Join-Path $pasta 'senha.cifrada'
$arqLog = Join-Path $pasta 'backup.log'
New-Item -ItemType Directory -Force -Path $pasta | Out-Null

function Anotar($texto) {
  $linha = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $texto
  Add-Content -Path $arqLog -Value $linha -Encoding UTF8
  Write-Host $texto
}

function Parar($texto) {
  Anotar ('ERRO: ' + $texto)
  if (-not $Automatico) { Read-Host 'Aperte Enter para fechar' | Out-Null }
  exit 1
}

# ---------- 1. o pg_dump -----------------------------------------------------
function AcharPrograma($nome) {
  $c = Get-Command $nome -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  $achados = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin' -Filter ($nome + '.exe') -ErrorAction SilentlyContinue |
    Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending
  if ($achados) { return $achados[0].FullName }
  return $null
}
$pgDump = AcharPrograma 'pg_dump'
$pgRestore = AcharPrograma 'pg_restore'
if (-not $pgDump -or -not $pgRestore) {
  if (-not $Automatico) {
    Write-Host ''
    Write-Host 'Falta o PostgreSQL neste computador (o pg_dump vem com ele).'
    Write-Host 'Vou abrir a página de download: instale a versão mais nova para Windows.'
    Write-Host 'No instalador, basta marcar "Command Line Tools" (o servidor não é preciso).'
    Start-Process 'https://www.postgresql.org/download/windows/'
  }
  Parar 'pg_dump não encontrado. Instale o PostgreSQL e rode de novo.'
}

# ---------- 2. a configuração ----------------------------------------------
$config = $null
if (Test-Path $arqConfig) { $config = Get-Content $arqConfig -Raw -Encoding UTF8 | ConvertFrom-Json }

if (-not $config) {
  if ($Automatico) { Parar 'Sem configuração. Rode o FAZER BACKUP.bat uma vez à mão.' }
  Write-Host ''
  Write-Host 'PRIMEIRA VEZ. No Supabase, abra o projeto fourtime-os, clique em Connect (no topo),'
  Write-Host 'escolha "Session pooler" e copie o endereço que começa com postgresql://'
  Write-Host 'Pode colar como está, com [YOUR-PASSWORD] no lugar da senha.'
  $uri = (Read-Host 'Cole o endereço aqui').Trim()
  if ($uri -notmatch '^postgres(ql)?://([^:@/]+)(:[^@]*)?@([^:/]+):(\d+)/(\S+)$') { Parar 'Esse não parece o endereço do Session pooler.' }
  $usuario = $Matches[2]; $servidor = $Matches[4]; $porta = $Matches[5]; $banco = $Matches[6]
  if ($servidor -notmatch 'pooler\.supabase\.com$') { Write-Host 'Atenção: o endereço não é do pooler. Vou tentar assim mesmo.' }

  # o destino: a pasta do Google Drive para computador
  $destino = $null
  foreach ($d in (Get-PSDrive -PSProvider FileSystem)) {
    foreach ($nome in @('Meu Drive', 'My Drive')) {
      $p = Join-Path $d.Root $nome
      if (Test-Path $p) { $destino = $p; break }
    }
    if ($destino) { break }
  }
  if ($destino) {
    $resp = Read-Host ('Achei o Google Drive em "' + $destino + '". Uso esse? (S/N)')
    if ($resp -notmatch '^[sS]') { $destino = $null }
  }
  if (-not $destino) { $destino = (Read-Host 'Cole o caminho da pasta do Google Drive onde guardar').Trim('" ') }
  if (-not (Test-Path $destino)) { Parar ('A pasta "' + $destino + '" não existe.') }
  $destino = Join-Path $destino 'BACKUP FOURTIME OS\banco'

  $config = [pscustomobject]@{ usuario = $usuario; servidor = $servidor; porta = $porta; banco = $banco; destino = $destino }
  $config | ConvertTo-Json | Set-Content -Path $arqConfig -Encoding UTF8
  Anotar ('Configuração guardada: ' + $servidor + ', destino ' + $destino)
}
New-Item -ItemType Directory -Force -Path $config.destino | Out-Null

# ---------- 3. a senha --------------------------------------------------------
$seguro = $null
if (Test-Path $arqSenha) {
  try { $seguro = Get-Content $arqSenha -Raw | ConvertTo-SecureString } catch { $seguro = $null }
}
if (-not $seguro) {
  if ($Automatico) { Parar 'A senha não está lembrada neste computador. Rode o FAZER BACKUP.bat à mão.' }
  $seguro = Read-Host 'Senha do banco (Supabase, Project Settings, Database)' -AsSecureString
  $resp = Read-Host 'Lembrar a senha neste computador, cifrada pelo Windows? (S/N)'
  if ($resp -match '^[sS]') { $seguro | ConvertFrom-SecureString | Set-Content -Path $arqSenha }
}
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($seguro)
$env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$env:PGSSLMODE = 'require'

# ---------- 4. a cópia --------------------------------------------------------
$quando = Get-Date -Format 'yyyy-MM-dd_HHmm'
$nome = 'fourtime-banco-' + $quando + '.dump'
$temp = Join-Path $env:TEMP $nome
$conexao = @('--host', $config.servidor, '--port', $config.porta, '--username', $config.usuario, '--dbname', $config.banco)

function Copiar($esquemas) {
  $parametros = $conexao + @('--format=custom', '--no-password', '--file', $temp)
  foreach ($e in $esquemas) { $parametros += @('--schema', $e) }
  # o pg_dump escreve avisos no canal de erro; no PowerShell 5 isso vira erro
  # de verdade com 'Stop', então aqui o erro é lido pelo código de saída
  $ErrorActionPreference = 'Continue'
  & $pgDump @parametros 2>&1 | ForEach-Object { Add-Content -Path $arqLog -Value ('  pg_dump: ' + $_) -Encoding UTF8 }
  return $LASTEXITCODE
}

Anotar ('Copiando o banco (' + $config.servidor + ')...')
if (Test-Path $temp) { Remove-Item $temp -Force }
$cod = Copiar @('public', 'auth')
$soPublic = $false
if ($cod -ne 0) {
  Anotar 'Com as contas (auth) não deu; tentando só os dados do sistema (public).'
  $cod = Copiar @('public')
  $soPublic = $true
}
$env:PGPASSWORD = $null
if ($cod -ne 0) { Parar ('o pg_dump falhou (código ' + $cod + '). Detalhes em ' + $arqLog + '. Senha errada? Rode de novo; se a senha estava lembrada, apague ' + $arqSenha) }

# ---------- 5. conferir antes de guardar -------------------------------------
$ErrorActionPreference = 'Continue'
$lista = & $pgRestore --list $temp 2>&1
$codLista = $LASTEXITCODE
$ErrorActionPreference = 'Stop'
if ($codLista -ne 0) { Parar 'o arquivo gerado não abre no pg_restore.' }
$tabelas = @($lista | Where-Object { $_ -match ' TABLE DATA public ' }).Count
$temCotacao = [bool]($lista | Where-Object { $_ -match ' TABLE DATA public cotacao ' })
$temPedido = [bool]($lista | Where-Object { $_ -match ' TABLE DATA public pedido ' })
if ($tabelas -lt 50 -or -not $temCotacao -or -not $temPedido) { Parar ('a cópia veio incompleta (' + $tabelas + ' tabelas de dados). Nada foi guardado no Drive.') }

$final = Join-Path $config.destino $nome
Copy-Item $temp $final -Force
Remove-Item $temp -Force
$mb = [math]::Round((Get-Item $final).Length / 1MB, 1)
$extra = ''
if ($soPublic) { $extra = ' (sem as contas da equipe)' }
Anotar ('PRONTO: ' + $final + ', ' + $mb + ' MB, ' + $tabelas + ' tabelas com dados' + $extra + '.')

# ---------- 6. toda semana, sozinho -----------------------------------------
if (-not $Automatico -and (Test-Path $arqSenha)) {
  $tarefa = 'Fourtime OS backup do banco'
  $ErrorActionPreference = 'Continue'
  schtasks /Query /TN $tarefa 2>&1 | Out-Null
  $existe = ($LASTEXITCODE -eq 0)
  if (-not $existe) {
    $resp = Read-Host 'Quer que o backup rode sozinho todo domingo ao meio-dia? (S/N)'
    if ($resp -match '^[sS]') {
      $acao = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $PSCommandPath + '" -Automatico'
      schtasks /Create /SC WEEKLY /D SUN /ST 12:00 /TN $tarefa /TR $acao /F | Out-Null
      if ($LASTEXITCODE -eq 0) { Anotar 'Agendado: todo domingo às 12:00 (o computador precisa estar ligado).' }
      else { Anotar 'Não consegui agendar. Dá para rodar à mão quando quiser.' }
    }
  }
}

if (-not $Automatico) { Read-Host 'Aperte Enter para fechar' | Out-Null }
