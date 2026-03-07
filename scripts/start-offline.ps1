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

if ([string]::IsNullOrWhiteSpace($env:LOCAL_DATABASE_URL)) {
  throw "No existe LOCAL_DATABASE_URL. Agregalo en .env"
}

$env:DATABASE_URL = $env:LOCAL_DATABASE_URL
$env:DIRECT_URL = $env:LOCAL_DATABASE_URL

Write-Host "Iniciando app en modo offline con base local ..."
npm run dev
