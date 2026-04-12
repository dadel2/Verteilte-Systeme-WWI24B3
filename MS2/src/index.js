const mqtt = require("mqtt");
const logging = require("logging").default;

const log = logging("ms2");

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const topicFilter = process.env.MQTT_TOPIC || "pizza-service/events/#";

function formatEvent(topic, payload) {
  const ressourcentyp = payload.ressourcentyp || "unbekannt";
  const id = payload.id !== undefined ? payload.id : "unbekannt";
  const aenderung = payload.aenderung || "unbekannt";
  const zeitstempel = payload.zeitstempel || "kein Zeitstempel";

  return `Aenderung empfangen: Ressource '${ressourcentyp}' (ID ${id}) wurde '${aenderung}' am ${zeitstempel}. Topic: ${topic}`;
}

function startSubscriber() {
  const client = mqtt.connect(brokerUrl, {
    clientId: `ms2-${Math.random().toString(16).slice(2, 10)}`,
    connectTimeout: 2000,
    reconnectPeriod: 3000
  });

  client.on("connect", () => {
    log.info(`Verbunden mit MQTT-Broker: ${brokerUrl}`);
    client.subscribe(topicFilter, { qos: 1 }, (error) => {
      if (error) {
        log.error(`Subscribe fehlgeschlagen: ${error.message}`);
        return;
      }

      log.info(`Abonniert: ${topicFilter}`);
    });
  });

  client.on("message", (topic, messageBuffer) => {
    const raw = messageBuffer.toString("utf8");

    try {
      const payload = JSON.parse(raw);
      log.info(formatEvent(topic, payload));
    } catch (error) {
      log.warn(`Ungueltige JSON-Nachricht auf ${topic}: ${raw}`);
    }
  });

  client.on("reconnect", () => {
    log.warn("MQTT reconnect...");
  });

  client.on("error", (error) => {
    const message = error && error.message ? error.message : String(error);
    log.warn(`MQTT Fehler: ${message}`);
  });

  process.on("SIGINT", () => {
    client.end(true);
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    client.end(true);
    process.exit(0);
  });
}

startSubscriber();
