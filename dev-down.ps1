$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $root
try {
    docker compose stop postgres neo4j
} finally {
    Pop-Location
}

Write-Host "Services Docker arretes: postgres, neo4j"
Write-Host "Les terminaux backend/frontend restent a fermer manuellement si ouverts."
