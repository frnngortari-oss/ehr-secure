param(
  [string]$NeonUrl = "",
  [string]$LocalUrl = "",
  [string]$BackupDir = "backups"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Load-DotEnv([string]$path) {
  if (!(Test-Path $path)) { return }
  Get-Content $path | ForEach-Object {
    if ($_ -match "^\s*#") { return }
    if ($_ -match "^\s*$") { return }
    $parts = $_ -split "=", 2
    if ($parts.Length -ne 2) { return }
    $k = $parts[0].Trim()
    $v = $parts[1].Trim().Trim('"')
    [Environment]::SetEnvironmentVariable($k, $v, "Process")
  }
}

Load-DotEnv ".env"
Load-DotEnv ".env.localdb"

if ([string]::IsNullOrWhiteSpace($NeonUrl)) {
  $NeonUrl = $env:DIRECT_URL
}
if ([string]::IsNullOrWhiteSpace($NeonUrl)) {
  $NeonUrl = $env:DATABASE_URL
}
if ([string]::IsNullOrWhiteSpace($LocalUrl)) {
  $LocalUrl = $env:LOCAL_DATABASE_URL
}

if ([string]::IsNullOrWhiteSpace($NeonUrl)) {
  throw "No se encontro Neon URL. Pasa -NeonUrl o define DIRECT_URL en .env"
}
if ([string]::IsNullOrWhiteSpace($LocalUrl)) {
  throw "No se encontro LOCAL_DATABASE_URL. Define LOCAL_DATABASE_URL en .env"
}

$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (!$pgDump -or !$pgRestore) {
  Write-Host "pg_dump/pg_restore no encontrados. Usando fallback por Prisma..."
  $env:DIRECT_URL = $NeonUrl
  $env:LOCAL_DATABASE_URL = $LocalUrl
  npx tsx scripts/offline-sync.ts
  exit $LASTEXITCODE
}

if (!(Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupFile = Join-Path $BackupDir "ehr_neon_$stamp.dump"

Write-Host "Exportando Neon a $backupFile ..."
& pg_dump --format=custom --no-owner --no-acl --dbname="$NeonUrl" --file="$backupFile"

Write-Host "Restaurando backup en base local ..."
& pg_restore --clean --if-exists --no-owner --no-acl --dbname="$LocalUrl" "$backupFile"

Write-Host "Sincronizacion completa."
