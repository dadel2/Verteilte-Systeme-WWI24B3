# Lokaler Start mit Docker Compose

## 1) Alle Services starten

```powershell
Set-Location -LiteralPath "C:\Users\davib\Documents\GitHub\Verteilte-Systeme-WWI24B3"
docker compose up -d --build
docker compose ps
```

Optional: EMQX Dashboard (Broker-UI) im Browser:

```text
http://localhost:18083
```

Login: `admin` / `public`

Alternativ als One-Command-Ende-zu-Ende-Test:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\e2e-compose-check.ps1
```

## 2) MS1 pruefen

Health-Check:

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/health"
```

Erwartung:

```json
{"status":"ok","service":"MS1"}
```

Swagger UI:

```text
http://localhost:8080/api-docs
```

## 3) MQTT-Ende-zu-Ende pruefen

Neuen Kunden anlegen (MS1 publisht Event):

```powershell
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$body = @{
  vorname = "Docker"
  nachname = "Test"
  email = "docker.test.$ts@example.com"
  telefonnummer = "+4915200$ts"
  adresse = "Composeweg 1, 12345 Berlin"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:8080/kunden" `
  -ContentType "application/json" `
  -Body $body
```

Subscriber-Logs kontrollieren:

```powershell
docker compose logs ms2 --tail 50
```

Erwartung in den Logs:
- `Verbunden mit MQTT-Broker`
- `MS2 abonniert Topic-Filter: pizza-service/events/#`
- `Aenderung: kunden mit ID ... wurde ...`

## 4) Services stoppen

```powershell
docker compose down
```
