const mqtt = require("mqtt");
const http = require("http");
const { URL } = require("url");
const path = require("path");
const fs = require("fs");
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
const portRaw = Number.parseInt(process.env.PORT || "8081", 10);
const httpPort = Number.isInteger(portRaw) && portRaw > 0 ? portRaw : 8081;
const historyLimitRaw = Number.parseInt(process.env.MS2_EVENT_HISTORY_LIMIT || "200", 10);
const historyLimit = Number.isInteger(historyLimitRaw) && historyLimitRaw > 0 ? historyLimitRaw : 200;
const dashboardPath = path.join(__dirname, "public", "index.html");

const eventHistory = [];
const serviceStatusByName = new Map();

let mqttClient = null;
let httpServer = null;
let shuttingDown = false;

function pushEvent(entry) {
  eventHistory.unshift(entry);
  if (eventHistory.length > historyLimit) {
    eventHistory.length = historyLimit;
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function parseLimit(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(parsed, historyLimit);
}

function startHttpApi() {
  httpServer = http.createServer((req, res) => {
    if (!req.url) {
      return sendJson(res, 400, { error: "Ungueltige Anfrage." });
    }

    const requestUrl = new URL(req.url, "http://localhost");

    if (req.method === "GET" && requestUrl.pathname === "/health") {
      return sendJson(res, 200, { status: "ok", service: "MS2" });
    }

    if (req.method === "GET" && requestUrl.pathname === "/") {
      fs.readFile(dashboardPath, "utf8", (error, html) => {
        if (error) {
          return sendJson(res, 500, { error: "Dashboard konnte nicht geladen werden." });
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(html);
      });
      return;
    }

    if (req.method === "GET" && requestUrl.pathname === "/events") {
      const limit = parseLimit(requestUrl.searchParams.get("limit"), 50);
      return sendJson(res, 200, {
        count: Math.min(limit, eventHistory.length),
        totalStored: eventHistory.length,
        events: eventHistory.slice(0, limit)
      });
    }

    if (req.method === "GET" && requestUrl.pathname === "/status") {
      return sendJson(res, 200, {
        services: Object.fromEntries(serviceStatusByName.entries())
      });
    }

    return sendJson(res, 404, { error: "Route nicht gefunden." });
  });

  httpServer.listen(httpPort, () => {
    log.info(`MS2 HTTP API laeuft auf http://localhost:${httpPort}`);
  });
}

function closeHttpApi() {
  return new Promise((resolve) => {
    if (!httpServer) {
      resolve();
      return;
    }

    httpServer.close(() => {
      httpServer = null;
      resolve();
    });
  });
}

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
  mqttClient = mqtt.connect(brokerUrl, {
    clientId: `ms2-${Math.random().toString(16).slice(2, 10)}`,
    connectTimeout: 2000,
    reconnectPeriod: 3000
  });

  mqttClient.on("connect", () => {
    log.info(`Verbunden mit MQTT-Broker: ${brokerUrl}`);
    mqttClient.subscribe(
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

  mqttClient.on("message", (topic, messageBuffer, packet) => {
    const raw = messageBuffer.toString("utf8");
    const qosInfo = packet && Number.isInteger(packet.qos) ? packet.qos : "unbekannt";
    const retainedInfo = packet && typeof packet.retain === "boolean" ? packet.retain : "unbekannt";
    const receivedAt = new Date().toISOString();

    try {
      const payload = JSON.parse(raw);
      if (statusTopicPrefix && topic.startsWith(statusTopicPrefix)) {
        const serviceName = payload.service || "unbekannt";
        serviceStatusByName.set(serviceName, {
          status: payload.status || "unbekannt",
          reason: payload.reason || "kein Grund",
          zeitstempel: payload.zeitstempel || receivedAt,
          topic,
          qos: qosInfo,
          retained: retainedInfo,
          receivedAt
        });
        pushEvent({
          type: "status",
          topic,
          payload,
          qos: qosInfo,
          retained: retainedInfo,
          receivedAt
        });
        log.info(`${formatStatus(topic, payload)} [QoS=${qosInfo}, retained=${retainedInfo}]`);
        return;
      }

      pushEvent({
        type: "event",
        topic,
        payload,
        qos: qosInfo,
        retained: retainedInfo,
        receivedAt
      });
      log.info(`${formatEvent(topic, payload)} [QoS=${qosInfo}, retained=${retainedInfo}]`);
    } catch (error) {
      pushEvent({
        type: "invalid_json",
        topic,
        payload: raw,
        qos: qosInfo,
        retained: retainedInfo,
        receivedAt
      });
      log.warn(`Ungueltige JSON-Nachricht auf ${topic}: ${raw}`);
    }
  });

  mqttClient.on("reconnect", () => {
    log.warn("MQTT reconnect...");
  });

  mqttClient.on("error", (error) => {
    const message = error && error.message ? error.message : String(error);
    log.warn(`MQTT Fehler: ${message}`);
  });
}

async function shutdown() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  await closeHttpApi();

  if (mqttClient) {
    await new Promise((resolve) => {
      mqttClient.end(false, {}, () => resolve());
    });
    mqttClient = null;
  }

  process.exit(0);
}

startHttpApi();
startSubscriber();

process.on("SIGINT", () => {
  shutdown();
});

process.on("SIGTERM", () => {
  shutdown();
});
