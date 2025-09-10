param(
  [switch]$Full,
  [switch]$NoPrompt,
  [switch]$Help
)

if ($Help) {
  Write-Host @"
Uso: ./scripts/detener-podman.ps1 [-Full] [-NoPrompt] [-Help]

- Full      : Elimina contenedores, redes, huérfanos y volúmenes del compose
- NoPrompt  : No solicita confirmación y aplica la opción elegida directamente
- Help      : Muestra esta ayuda
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

if ($Full) {
  if (-not $NoPrompt) {
    $resp = Read-Host "Esto eliminará contenedores, redes y volúmenes (mongo_data). Continuar? (y/N)"
    if ($resp -ne 'y' -and $resp -ne 'Y') { Write-Host 'Cancelado.'; exit 0 }
  }
  Invoke-Compose @('down','--volumes','--remove-orphans')
  Write-Host "Limpieza de imágenes no utilizadas..."
  & podman image prune -f | Out-Null
} else {
  if (-not $NoPrompt) {
    $resp = Read-Host "Detener y eliminar contenedores y redes del compose. Continuar? (y/N)"
    if ($resp -ne 'y' -and $resp -ne 'Y') { Write-Host 'Cancelado.'; exit 0 }
  }
  Invoke-Compose @('down')
}

Write-Host "✅ Hecho." -ForegroundColor Green
