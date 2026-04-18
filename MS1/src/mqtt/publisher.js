const mqtt = require("mqtt");
const logging = require("logging").default;

const log = logging("mqtt-publisher");

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const topicPrefix = process.env.MQTT_TOPIC_PREFIX || "pizza-service/events";
const statusTopic = process.env.MQTT_STATUS_TOPIC || "pizza-service/status/ms1";
const rawQos = Number.parseInt(process.env.MQTT_QOS || "1", 10);
const publishQos = Number.isInteger(rawQos) && rawQos >= 0 && rawQos <= 2 ? rawQos : 1;

let mqttClient = null;

function buildStatusPayload(status, reason) {
  return JSON.stringify({
    service: "ms1",
    status,
    reason,
    zeitstempel: new Date().toISOString()
  });
}

function publishServiceStatus(status, reason) {
  if (!mqttClient || !mqttClient.connected) {
    return;
  }

  mqttClient.publish(
    statusTopic,
    buildStatusPayload(status, reason),
    { qos: publishQos, retain: true },
    (error) => {
      if (error) {
        log.warn(`Status-Publish fehlgeschlagen: ${error.message}`);
      }
    }
  );
}

function initMqttPublisher() {
  if (mqttClient) {
    return mqttClient;
  }

  const willPayload = buildStatusPayload("offline", "unexpected_disconnect");

  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `ms1-${Math.random().toString(16).slice(2, 10)}`,
    connectTimeout: 2000,
    reconnectPeriod: 3000,
    will: {
      topic: statusTopic,
      payload: willPayload,
      qos: publishQos,
      retain: true
    }
  });

  mqttClient.on("connect", () => {
    log.info(`MQTT verbunden: ${brokerUrl}`);
    publishServiceStatus("online", "startup");
  });

  mqttClient.on("reconnect", () => {
    log.warn("MQTT reconnect...");
  });

  mqttClient.on("error", (error) => {
    log.warn(`MQTT Fehler: ${error.message}`);
  });

  return mqttClient;
}

async function publishResourceChange(resourceType, resourceId, changeType) {
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
    publishServiceStatus("offline", "graceful_shutdown");
    mqttClient.end(false);
    mqttClient = null;
  }
}

module.exports = {
  initMqttPublisher,
  publishResourceChange,
  closeMqttPublisher
};
