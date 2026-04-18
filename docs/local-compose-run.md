# Lokaler Start mit Docker Compose

## 1) Alle Services starten

```powershell
Set-Location -LiteralPath "C:\Users\davib\Documents\GitHub\Verteilte-Systeme-WWI24B3"
docker compose up -d --build
docker compose ps
```

## 2) Gesundheit von MS1 pruefen

```powershell
Invoke-RestMethod -Method Get -Uri "http://localhost:8080/health"
```

Erwartung:

```json
{"status":"ok","service":"MS1"}
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
- `Abonniert: pizza-service/events/#`
- `Aenderung empfangen: Ressource 'kunden' ...`

## 4) Services stoppen

```powershell
docker compose down
```
