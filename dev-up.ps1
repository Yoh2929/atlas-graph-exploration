param(
    [switch]$Seed,
    [switch]$SeedDryRun,
    [int]$SeedLimit = 0,
    [switch]$SkipBuild,
    [switch]$FollowLogs
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$logDir = Join-Path $root "logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$logPath = Join-Path $logDir ("dev-up-{0}.log" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Start-Transcript -Path $logPath -Force | Out-Null
Write-Host "Trace complete: $logPath"

function Invoke-Compose {
    $composeArguments = @($args)
    & docker compose @composeArguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose $($composeArguments -join ' ') a echoue (code $LASTEXITCODE)."
    }
}

function Wait-Http {
    param(
        [string]$Url,
        [string]$Name,
        [int]$Attempts = 60
    )
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                Write-Host "  $Name pret: $Url"
                return
            }
        } catch {
            Start-Sleep -Seconds 2
        }
    }
    throw "$Name n'est pas devenu accessible: $Url"
}

Write-Host "[1/7] Verification de Docker..."
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker CLI introuvable. Installe Docker Desktop puis relance ce script."
}

$dockerReady = $false
try {
    docker info | Out-Null
    $dockerReady = ($LASTEXITCODE -eq 0)
} catch {
    $dockerReady = $false
}

if (-not $dockerReady) {
    $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if (Test-Path -LiteralPath $dockerDesktop) {
        Start-Process -FilePath $dockerDesktop -WindowStyle Hidden | Out-Null
    }
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 2
        try {
            docker info | Out-Null
            if ($LASTEXITCODE -eq 0) {
                $dockerReady = $true
                break
            }
        } catch {
            # Docker Desktop demarre encore.
        }
    }
}
if (-not $dockerReady) {
    throw "Docker n'a pas demarre. Ouvre Docker Desktop puis relance le script."
}

Write-Host "[2/7] Preparation de la configuration..."
$backendEnv = Join-Path $root "backend\.env"
if (-not (Test-Path -LiteralPath $backendEnv)) {
    Copy-Item -LiteralPath (Join-Path $root "backend\.env.example") -Destination $backendEnv
    Write-Host "  backend/.env cree depuis .env.example"
}

Write-Host "[3/7] Build des images..."
Push-Location $root
try {
    if ($SkipBuild) {
        Write-Host "  Build ignore (-SkipBuild)"
    } else {
        Invoke-Compose build --quiet
        Write-Host "  Images pretes (cache Docker reutilise si possible)"
    }

    Write-Host "[4/7] Demarrage et healthchecks des services..."
    Invoke-Compose up --detach --remove-orphans --wait --wait-timeout 180
    Invoke-Compose ps

    Write-Host "[5/7] Seed du graphe..."
    $countOutput = & docker compose exec -T neo4j cypher-shell `
        -u neo4j -p changeme123 `
        "MATCH (n:Concept) RETURN count(n) AS count;"
    if ($LASTEXITCODE -ne 0) {
        throw "Impossible de compter les noeuds Neo4j."
    }
    $count = [int](($countOutput | Select-Object -Last 1).Trim())

    if ($SeedDryRun) {
        $effectiveLimit = if ($SeedLimit -gt 0) { $SeedLimit } else { 250 }
        $edgeLimit = [Math]::Max(1000, $effectiveLimit * 8)
        Write-Host "  Dry-run: budget $effectiveLimit noeuds / $edgeLimit relations"
        Write-Host "  Pour tester davantage: .\dev-up.ps1 -SeedDryRun -SeedLimit 2000"
        Invoke-Compose exec -T `
            -e "ATLAS_SEED_MAX_NODES=$effectiveLimit" `
            -e "ATLAS_SEED_MAX_EDGES=$edgeLimit" `
            backend python -u -m app.graph.seed.run --dry-run
    } elseif ($Seed -or $count -eq 0) {
        $reason = if ($Seed) { "option -Seed" } else { "base vide" }
        Write-Host "  Lancement du seed ($reason)..."
        if ($SeedLimit -gt 0) {
            $edgeLimit = [Math]::Max(1000, $SeedLimit * 8)
            Invoke-Compose exec -T `
                -e "ATLAS_SEED_MAX_NODES=$SeedLimit" `
                -e "ATLAS_SEED_MAX_EDGES=$edgeLimit" `
                backend python -u -m app.graph.seed.run
        } else {
            Write-Host "  Aucun plafond global de noeuds ou relations."
            Invoke-Compose exec -T `
                -e "ATLAS_SEED_MAX_NODES=0" `
                -e "ATLAS_SEED_MAX_EDGES=0" `
                backend python -u -m app.graph.seed.run
        }
    } else {
        Write-Host "  Seed ignore: Neo4j contient deja $count noeuds. Utilise .\dev-up.ps1 -Seed pour forcer."
    }

    Write-Host "[6/7] Verification HTTP..."
    Wait-Http -Url "http://127.0.0.1:8000/api/health" -Name "Backend"
    Wait-Http -Url "http://127.0.0.1:3000" -Name "Frontend"

    Write-Host "[7/7] Derniers logs applicatifs..."
    Invoke-Compose logs --tail 8 backend frontend neo4j postgres

    Write-Host ""
    Write-Host "Atlas est pret."
    Write-Host "- Frontend: http://127.0.0.1:3000"
    Write-Host "- API:      http://127.0.0.1:8000/docs"
    Write-Host "- Neo4j:    http://127.0.0.1:7474"
    Write-Host ""
    Write-Host "Seed force:   .\dev-up.ps1 -Seed"
    Write-Host "Test rapide:  .\dev-up.ps1 -SeedDryRun"
    Write-Host "Sans rebuild: .\dev-up.ps1 -SkipBuild"
    Write-Host "Logs en direct: .\dev-up.ps1 -SkipBuild -FollowLogs"

    if ($FollowLogs) {
        Write-Host ""
        Write-Host "Logs en direct (Ctrl+C arrete l'affichage, pas les services)..."
        & docker compose logs --follow --tail 50 backend frontend neo4j postgres
    }
} finally {
    Pop-Location
    try {
        Stop-Transcript | Out-Null
    } catch {
        # Aucun transcript actif (erreur tres precoce).
    }
}
