# Pizza Service - Verteilte Systeme

## Kurze Projektbeschreibung
Dieses Projekt bildet einen verteilten Pizza-Service mit zwei Microservices nach:

- `MS1`: REST-API mit SQLite fuer Kunden, Artikel und Bestellungen
- `MS2`: MQTT-Subscriber mit Monitoring-API und Web-Dashboard
- `mqtt-broker` (Mosquitto): asynchrone Kommunikation zwischen den Services

Die Services werden mit Docker Compose gemeinsam gestartet.

## Warum dieses Thema (Pizza Service)
Ich habe mich fuer das Thema Pizza Service entschieden, weil es ein realistisches, aber ueberschaubares Fachszenario ist.  
Damit lassen sich zentrale Konzepte aus Verteilten Systemen gut zeigen:

- Datenhaltung und Validierung (MS1 + SQLite)
- synchrone Kommunikation (REST)
- asynchrone Ereignisse (MQTT Publisher/Subscriber)
- Service-Status ueber Retained Message und Last Will
- reproduzierbarer Betrieb mit Docker Compose

## Regeln fuer die Datensaetze

### Kunde
- Pflichtfelder bei `POST /kunden`: `vorname`, `nachname`, `email`, `telefonnummer`, `adresse`
- Alle Pflichtfelder muessen nicht-leere Strings sein.
- `email` ist eindeutig.
- `telefonnummer` ist eindeutig.
- Ungueltige oder unbekannte Attribute werden mit `400` abgewiesen.

### Artikel
- Pflichtfelder bei `POST /artikel`: `name`, `kategorie`
- Optional: `beschreibung`
- `name + kategorie` muss eindeutig sein.
- Ungueltige oder unbekannte Attribute werden mit `400` abgewiesen.

### Bestellung
- Pflichtfelder bei `POST /bestellungen`:
  `bestell_datum`, `gesamtpreis`, `bestellstatus`, `kunden_id`, `artikel_ids`
- `artikel_ids` muss ein nicht-leeres Array mit gueltigen Integer-IDs > 0 sein.
- `kunden_id` muss auf einen existierenden Kunden zeigen.
- Alle `artikel_ids` muessen auf existierende Artikel zeigen.
- `gesamtpreis` muss >= 0 sein
- Beziehungen:
  - Kunde -> Bestellung 
  - Bestellung <-> Artikel ueber 'bestellung_artikel'

## MQTT-Regeln im Projekt
- Event-Topic Prefix: pizza-service/events
- Status-Topic MS1: pizza-service/status/ms1
- QoS: 1
- Statusmeldungen werden retained publisht.
- Last Will von MS1: 'offline' mit: reason  'unexpected_disconnect'

## Docker Endpunkte

- MS1 Health: `http://localhost:8080/health`
- MS2 Health: `http://localhost:8081/health`
- MS2 Dashboard: `http://localhost:8081/`
- MS2 Events: `http://localhost:8081/events?limit=20`
- MS2 Status: `http://localhost:8081/status`

## Docker-Dokumentation (Links)
- Docker Get Started: https://docs.docker.com/get-started/
- Docker Desktop (Windows): https://docs.docker.com/desktop/setup/install/windows-install/
- Docker Compose Overview: https://docs.docker.com/compose/
- Compose File Reference: https://docs.docker.com/reference/compose-file/
- Mosquitto Docker Image: https://hub.docker.com/_/eclipse-mosquitto
