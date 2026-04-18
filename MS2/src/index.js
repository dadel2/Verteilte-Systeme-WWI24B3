const mqtt = require("mqtt");
const logging = require("logging").default;

const log = logging("ms2");

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const eventTopicFilter = process.env.MQTT_TOPIC || "pizza-service/events/#";
const statusTopicFilter = process.env.MQTT_STATUS_TOPIC || "pizza-service/status/#";
const statusTopicPrefix = statusTopicFilter.replace(/#.*$/, "");
const subscribeQosRaw = Number.parseInt(process.env.MQTT_QOS || "1", 10);
const subscribeQos =
  Number.isInteger(subscribeQosRaw) && subscribeQosRaw >= 0 && subscribeQosRaw <= 2
    ? subscribeQosRaw
    : 1;

function formatEvent(topic, payload) {
  const ressourcentyp = payload.ressourcentyp || "unbekannt";
  const id = payload.id !== undefined ? payload.id : "unbekannt";
  const aenderung = payload.aenderung || "unbekannt";
  const zeitstempel = payload.zeitstempel || "kein Zeitstempel";

  return `Aenderung empfangen: Ressource '${ressourcentyp}' (ID ${id}) wurde '${aenderung}' am ${zeitstempel}. Topic: ${topic}`;
}

function formatStatus(topic, payload) {
  const service = payload.service || "unbekannt";
  const status = payload.status || "unbekannt";
  const reason = payload.reason || "kein Grund";
  const zeitstempel = payload.zeitstempel || "kein Zeitstempel";

  return `Service-Status: '${service}' ist '${status}' (Grund: ${reason}) am ${zeitstempel}. Topic: ${topic}`;
}

function startSubscriber() {
  const client = mqtt.connect(brokerUrl, {
    clientId: `ms2-${Math.random().toString(16).slice(2, 10)}`,
    connectTimeout: 2000,
    reconnectPeriod: 3000
  });

  client.on("connect", () => {
    log.info(`Verbunden mit MQTT-Broker: ${brokerUrl}`);
    client.subscribe(
      [
        { topic: eventTopicFilter, qos: subscribeQos },
        { topic: statusTopicFilter, qos: subscribeQos }
      ],
      (error) => {
      if (error) {
        log.error(`Subscribe fehlgeschlagen: ${error.message}`);
        return;
      }

        log.info(`Abonniert: ${eventTopicFilter} und ${statusTopicFilter}`);
      }
    );
  });

  client.on("message", (topic, messageBuffer, packet) => {
    const raw = messageBuffer.toString("utf8");
    const qosInfo = packet && Number.isInteger(packet.qos) ? packet.qos : "unbekannt";
    const retainedInfo = packet && typeof packet.retain === "boolean" ? packet.retain : "unbekannt";

    try {
      const payload = JSON.parse(raw);
      if (statusTopicPrefix && topic.startsWith(statusTopicPrefix)) {
        log.info(`${formatStatus(topic, payload)} [QoS=${qosInfo}, retained=${retainedInfo}]`);
        return;
      }

      log.info(`${formatEvent(topic, payload)} [QoS=${qosInfo}, retained=${retainedInfo}]`);
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
