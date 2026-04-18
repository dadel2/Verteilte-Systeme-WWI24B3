Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

param(
  [switch]$KeepRunning
)

function Assert-Contains {
  param(
    [string]$Text,
    [string]$Pattern,
    [string]$Label
  )

  if ($Text -match $Pattern) {
    Write-Host "[PASS] $Label"
    return $true
  }

  Write-Host "[FAIL] $Label"
  return $false
}

function Wait-ForHealth {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $started = Get-Date
  while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSeconds) {
    try {
      $response = Invoke-RestMethod -Method Get -Uri $Url
      if ($response.status -eq "ok") {
        return $true
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  }

  return $false
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root

$results = @()

try {
  Write-Host "==> Starte Docker Compose (Build + Up)"
  docker compose up -d --build

  Write-Host "==> Warte auf MS1 Health-Endpoint"
  $healthOk = Wait-ForHealth -Url "http://localhost:8080/health" -TimeoutSeconds 80
  $results += $healthOk
  if (-not $healthOk) {
    throw "MS1 Health-Endpoint ist nicht erreichbar."
  }
  Write-Host "[PASS] MS1 /health erreichbar"

  Write-Host "==> Trigger Event: POST /kunden"
  $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $body = @{
    vorname = "Auto"
    nachname = "Check"
    email = "auto.check.$stamp@example.com"
    telefonnummer = "+4915300$stamp"
    adresse = "Scriptweg 1, 12345 Berlin"
  } | ConvertTo-Json

  $created = Invoke-RestMethod -Method Post `
    -Uri "http://localhost:8080/kunden" `
    -ContentType "application/json" `
    -Body $body

  $postOk = $null -ne $created.kunden_id
  $results += $postOk
  if ($postOk) {
    Write-Host "[PASS] Kunde erstellt (ID $($created.kunden_id))"
  } else {
    Write-Host "[FAIL] Kunde konnte nicht erstellt werden"
  }

  Start-Sleep -Seconds 3
  $ms2Log = docker compose logs ms2 --tail 200
  $results += Assert-Contains -Text $ms2Log -Pattern "Aenderung empfangen: Ressource 'kunden'" -Label "MS2 hat Kunden-Event empfangen"
  $results += Assert-Contains -Text $ms2Log -Pattern "retained=true|retained=True" -Label "Retained-Status sichtbar"

  Write-Host "==> Retained-Check durch MS2 Neustart"
  docker compose restart ms2 | Out-Null
  Start-Sleep -Seconds 4
  $ms2AfterRestart = docker compose logs ms2 --tail 200
  $results += Assert-Contains -Text $ms2AfterRestart -Pattern "Service-Status: 'ms1' ist 'online'" -Label "Retained Online-Status nach MS2 Restart"

  Write-Host "==> Last-Will Check (hartes Stoppen von MS1)"
  docker compose kill ms1 | Out-Null
  Start-Sleep -Seconds 4
  $ms2AfterKill = docker compose logs ms2 --tail 250
  $results += Assert-Contains -Text $ms2AfterKill -Pattern "unexpected_disconnect" -Label "Last-Will Event empfangen"

  Write-Host "==> MS1 wieder starten"
  docker compose up -d ms1 | Out-Null
  Start-Sleep -Seconds 4
  $ms2AfterRecover = docker compose logs ms2 --tail 250
  $results += Assert-Contains -Text $ms2AfterRecover -Pattern "Service-Status: 'ms1' ist 'online'" -Label "Online-Status nach Restart empfangen"

  $passCount = ($results | Where-Object { $_ }).Count
  $totalCount = $results.Count
  Write-Host ""
  Write-Host "==> Ergebnis: $passCount / $totalCount Checks erfolgreich"
} finally {
  if (-not $KeepRunning) {
    Write-Host "==> Stoppe Compose Umgebung"
    docker compose down
  } else {
    Write-Host "==> Compose bleibt aktiv (KeepRunning gesetzt)"
  }
}
