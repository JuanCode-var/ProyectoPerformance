param(
  [switch]$NoBuild,
  [switch]$NoCache,
  [switch]$Full,
  [switch]$NoWait,
  [switch]$Help
)

if ($Help) {
  Write-Host @"
Uso: ./scripts/levantar-podman.ps1 [-NoBuild] [-NoCache] [-Full] [-NoWait] [-Help]

- NoBuild  : No ejecuta build en el "up" (por defecto hace --build)
- NoCache  : Ejecuta "podman compose build --no-cache" antes de subir
- Full     : Fuerza recreación y elimina huérfanos (--force-recreate --remove-orphans)
- NoWait   : No espera a healthchecks básicos tras levantar
- Help     : Muestra esta ayuda
"@
  exit 0
}

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Ir a la raíz del repo
$ROOT_DIR = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $ROOT_DIR

function Invoke-Compose {
  param([string[]]$Args)
  Write-Host ("`n> podman compose {0}" -f ($Args -join ' ')) -ForegroundColor Cyan
  & podman compose @Args
}

# Build sin caché previo si se solicita
if ($NoCache) {
  Invoke-Compose @('build','--no-cache')
}

# Construir args de "up"
$upArgs = @('up','-d')
if (-not $NoBuild -and -not $NoCache) {
  $upArgs += '--build'
}
if ($Full) {
  $upArgs += @('--force-recreate','--remove-orphans')
}

Write-Host "`n🚀 Levantando stack con Podman Compose..."
Invoke-Compose $upArgs | Out-Null

Write-Host "`n📋 Estado de los servicios:" -ForegroundColor Yellow
& podman compose ps

function Wait-ForUrl {
  param(
    [string]$Url,
    [string]$Name,
    [int]$Retries = 60,
    [int]$SleepSec = 2
  )
  for ($i = 1; $i -le $Retries; $i++) {
    try {
      $resp = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 500) {
        Write-Host ("✅ {0} OK ({1})" -f $Name, $Url) -ForegroundColor Green
        return $true
      }
    } catch {
      # ignore and retry
    }
    Start-Sleep -Seconds $SleepSec
  }
  Write-Warning ("{0} no respondió a tiempo ({1})" -f $Name, $Url)
  return $false
}

if (-not $NoWait) {
  Wait-ForUrl 'http://localhost:4000/health' 'API' | Out-Null
  Wait-ForUrl 'http://localhost:8080' 'Frontend' | Out-Null
  Wait-ForUrl 'http://localhost:3001/api/health' 'micro-pagespeed' | Out-Null
}

Write-Host @"

✅ Stack listo.
- Frontend:           http://localhost:8080
- API (health):       http://localhost:4000/health
- micro-pagespeed:    http://localhost:3001/api/health
- security-service:   http://localhost:3002/api/analyze (POST)
- MongoDB:            localhost:27017 (volumen: mongo_data)

Comandos útiles:
- Ver estado:         podman compose ps
- Ver logs API:       podman logs pulsechoukairperformancert-api-1 --tail 100
- Detener todo:       ./scripts/detener-podman.ps1
"@ -ForegroundColor Green
