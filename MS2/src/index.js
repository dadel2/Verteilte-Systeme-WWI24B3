const mqtt = require("mqtt");
const logging = require("logging").default;

const log = logging("ms2");

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const topicFilter = process.env.MQTT_TOPIC || "pizza-service/events/#";
const subscribeQosRaw = Number.parseInt(process.env.MQTT_QOS || "1", 10);
const subscribeQos =
  Number.isInteger(subscribeQosRaw) && subscribeQosRaw >= 0 && subscribeQosRaw <= 2
    ? subscribeQosRaw
    : 1;

let mqttClient = null;
let shuttingDown = false;

function mapChangeVerb(changeType) {
  const normalized = String(changeType || "").toLowerCase();
  if (normalized === "create") {
    return "angelegt";
  }
  if (normalized === "update") {
    return "aktualisiert";
  }
  if (normalized === "delete") {
    return "gelöscht";
  }
  return "geaendert";
}

function mapResourceLabel(resourceType) {
  const normalized = String(resourceType || "").toLowerCase();
  if (normalized === "kunden") {
    return "Kunden";
  }
  if (normalized === "artikel") {
    return "Artikel";
  }
  if (normalized === "bestellungen") {
    return "Bestellungen";
  }
  return "Ressource";
}

function formatUserMessage(payload) {
  const ressourcentyp = payload.ressourcentyp || "";
  const id = payload.id ?? "unbekannt";
  const aenderung = payload.aenderung || "unbekannt";
  const geaenderteFelder = Array.isArray(payload.geaenderte_felder)
    ? payload.geaenderte_felder
        .map((field) => String(field || "").trim())
        .filter((field) => field.length > 0)
    : [];
  const resourceLabel = mapResourceLabel(ressourcentyp);
  const changeVerb = mapChangeVerb(aenderung);

  if (String(aenderung).toLowerCase() === "update" && geaenderteFelder.length > 0) {
    return `${resourceLabel} ID ${id} wurde ${changeVerb} (Felder: ${geaenderteFelder.join(", ")}).`;
  }

  return `${resourceLabel} ID ${id} wurde ${changeVerb}.`;
}

function startSubscriber() {
  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `ms2-${Math.random().toString(16).slice(2, 10)}`,
    connectTimeout: 2000,
    reconnectPeriod: 3000
  });

  mqttClient.on("connect", () => {
    log.info(`Verbunden mit MQTT-Broker: ${brokerUrl}`);
    mqttClient.subscribe(topicFilter, { qos: subscribeQos }, (error) => {
      if (error) {
        log.error(`Subscribe auf ${topicFilter} fehlgeschlagen: ${error.message}`);
        return;
      }
      log.info(`MS2 abonniert Topic-Filter: ${topicFilter}`);
    });
  });

  mqttClient.on("message", (topic, messageBuffer) => {
    const rawMessage = messageBuffer.toString("utf8");

    try {
      const payload = JSON.parse(rawMessage);
      log.info(formatUserMessage(payload));
    } catch (error) {
      log.warn(`Ungueltige JSON-Nachricht auf ${topic}: ${rawMessage}`);
    }
  });

  mqttClient.on("reconnect", () => {
    log.warn("MQTT reconnect...");
  });

  mqttClient.on("error", (error) => {
    log.warn(`MQTT Fehler: ${error.message}`);
  });
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  if (mqttClient) {
    await new Promise((resolve) => {
      mqttClient.end(false, {}, resolve);
    });
    mqttClient = null;
  }

  process.exit(0);
}

startSubscriber();

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
