const express = require("express");
const logging = require("logging").default;
const { initDatabase } = require("./database/db");
const { initMqttPublisher, closeMqttPublisher } = require("./mqtt/publisher");
const { setupOpenApi } = require("./openapi/openapi");
const { sendError } = require("./utils/httpError");
const kundenRoutes = require("./routes/kundenRoutes");

const artikelRoutes = require("./routes/artikelRoutes");
const bestellungenRoutes = require("./routes/bestellungenRoutes");

const log = logging("ms1");
const app = express();
const PORT = Number.parseInt(process.env.PORT || "8080", 10);

app.use(express.json());
setupOpenApi(app);

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "MS1" });
});

app.use("/kunden", kundenRoutes);
app.use("/artikel", artikelRoutes);
app.use("/bestellungen", bestellungenRoutes);

app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && Object.prototype.hasOwnProperty.call(error, "body")) {
    return sendError(res, 400, "Ungueltiges JSON-Dokument.");
  }

  return next(error);
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  log.error(error.stack || error.message);
  return sendError(res, 500, "Interner Serverfehler.");
});

async function start() {
  await initDatabase();
  initMqttPublisher();

  app.listen(PORT, () => {
    log.info(`MS1 laeuft auf http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  log.error(error.stack || error.message);
  process.exit(1);
});

process.on("SIGINT", () => {
  closeMqttPublisher();
  process.exit(0);
});

process.on("SIGTERM", () => {
  closeMqttPublisher();
  process.exit(0);
});
