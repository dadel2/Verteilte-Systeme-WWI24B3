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

function formatUserMessage(topic, payload) {
  const ressourcentyp = payload.ressourcentyp || "unbekannt";
  const id = payload.id ?? "unbekannt";
  const aenderung = payload.aenderung || "unbekannt";
  const zeitstempel = payload.zeitstempel || "kein Zeitstempel";

  return `Aenderung: ${ressourcentyp} mit ID ${id} wurde '${aenderung}' (${zeitstempel}) [Topic: ${topic}]`;
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
      log.info(formatUserMessage(topic, payload));
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
