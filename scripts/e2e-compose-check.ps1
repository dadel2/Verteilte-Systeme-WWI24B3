param(
  [switch]$KeepRunning
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

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

function Wait-ForLogPattern {
  param(
    [string]$ServiceName,
    [string]$Pattern,
    [int]$TimeoutSeconds = 30
  )

  $started = Get-Date
  while (((Get-Date) - $started).TotalSeconds -lt $TimeoutSeconds) {
    try {
      $logs = docker compose logs $ServiceName --tail 200 2>&1 | Out-String
      if ([regex]::IsMatch($logs, $Pattern)) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 700
    }

    Start-Sleep -Milliseconds 700
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
  if ($healthOk) {
    Write-Host "[PASS] MS1 /health erreichbar"
  } else {
    Write-Host "[FAIL] MS1 /health nicht erreichbar"
    throw "MS1 Health-Endpoint ist nicht erreichbar."
  }

  Write-Host "==> Warte auf MS2 MQTT-Subscribe Log"
  $subscribeOk = Wait-ForLogPattern -ServiceName "ms2" -Pattern "MS2 abonniert Topic-Filter" -TimeoutSeconds 40
  $results += $subscribeOk
  if ($subscribeOk) {
    Write-Host "[PASS] MS2 hat Topic-Filter abonniert"
  } else {
    Write-Host "[FAIL] MS2 Subscribe-Log nicht gefunden"
  }

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

  Write-Host "==> Warte auf fachliche Event-Ausgabe in MS2 Logs"
  $eventOk = Wait-ForLogPattern -ServiceName "ms2" -Pattern "Aenderung: kunden mit ID .* wurde" -TimeoutSeconds 40
  $results += $eventOk
  if ($eventOk) {
    Write-Host "[PASS] MS2 hat Kunden-Event geloggt"
  } else {
    Write-Host "[FAIL] MS2 hat kein Kunden-Event geloggt"
  }

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
