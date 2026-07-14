param(
    [int]$BatchSize = 500,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$envFile = Join-Path $root "backend\.env"

if (-not (Test-Path -LiteralPath $envFile)) {
    throw "backend/.env absent. Ajoute les identifiants Aura et Neon."
}
if ($BatchSize -lt 1) {
    throw "BatchSize doit etre positif."
}
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI introuvable."
}

Push-Location $root
try {
    $compose = @(
        "compose", "--env-file", "backend/.env",
        "-f", "docker-compose.yml",
        "-f", "docker-compose.cloud.yml"
    )
    if (-not $SkipBuild) {
        & docker @compose build backend
        if ($LASTEXITCODE -ne 0) { throw "Build backend echoue." }
    }
    & docker @compose run --rm --no-deps backend `
        python -u -m app.graph.seed.import_snapshot --batch-size $BatchSize
    if ($LASTEXITCODE -ne 0) { throw "Import du snapshot vers Aura echoue." }
} finally {
    Pop-Location
}
