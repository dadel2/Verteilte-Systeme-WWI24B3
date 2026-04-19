const mqtt = require("mqtt");
const logging = require("logging").default;

const log = logging("mqtt-publisher");

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const topicPrefix = process.env.MQTT_TOPIC_PREFIX || "pizza-service/events";
const rawQos = Number.parseInt(process.env.MQTT_QOS || "1", 10);
const publishQos = Number.isInteger(rawQos) && rawQos >= 0 && rawQos <= 2 ? rawQos : 1;

let mqttClient = null;

function sanitizeChangedFields(changedFields) {
  if (!Array.isArray(changedFields)) {
    return [];
  }

  return [...new Set(
    changedFields
      .map((field) => String(field || "").trim())
      .filter((field) => field.length > 0)
  )];
}

function initMqttPublisher() {
  if (mqttClient) {
    return mqttClient;
  }

  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `ms1-${Math.random().toString(16).slice(2, 10)}`,
    connectTimeout: 2000,
    reconnectPeriod: 3000
  });

  mqttClient.on("connect", () => {
    log.info(`MQTT verbunden: ${brokerUrl}`);
  });

  mqttClient.on("reconnect", () => {
    log.warn("MQTT reconnect...");
  });

  mqttClient.on("error", (error) => {
    log.warn(`MQTT Fehler: ${error.message}`);
  });

  return mqttClient;
}

async function publishResourceChange(resourceType, resourceId, changeType, options = {}) {
  if (!mqttClient) {
    initMqttPublisher();
  }

  if (!mqttClient || !mqttClient.connected) {
    log.warn("MQTT nicht verbunden, Event nicht gesendet.");
    return false;
  }

  const topic = `${topicPrefix}/${resourceType}`;
  const payload = {
    ressourcentyp: resourceType,
    id: resourceId,
    aenderung: changeType,
    zeitstempel: new Date().toISOString()
  };

  const geaenderteFelder = sanitizeChangedFields(options.geaenderteFelder);
  if (geaenderteFelder.length > 0) {
    payload.geaenderte_felder = geaenderteFelder;
  }

  return new Promise((resolve) => {
    mqttClient.publish(topic, JSON.stringify(payload), { qos: publishQos, retain: false }, (error) => {
      if (error) {
        log.warn(`MQTT Publish fehlgeschlagen: ${error.message}`);
        resolve(false);
        return;
      }

      resolve(true);
    });
  });
}

function closeMqttPublisher() {
  if (mqttClient) {
    mqttClient.end(false);
    mqttClient = null;
  }
}

module.exports = {
  initMqttPublisher,
  publishResourceChange,
  closeMqttPublisher
};
