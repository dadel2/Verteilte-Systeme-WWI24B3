const mqtt = require("mqtt");
const logging = require("logging").default;

const log = logging("mqtt-publisher");

const brokerUrl = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const topicPrefix = process.env.MQTT_TOPIC_PREFIX || "pizza-service/events";

let mqttClient = null;

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
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (error) => {
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
    mqttClient.end(true);
    mqttClient = null;
  }
}

module.exports = {
  initMqttPublisher,
  publishResourceChange,
  closeMqttPublisher
};
