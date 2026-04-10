const express = require("express");
const logging = require("logging").default;
const { initDatabase } = require("./database/db");
const kundenRoutes = require("./routes/kundenRoutes");

const artikelRoutes = require("./routes/artikelRoutes");

const log = logging("ms1");
const app = express();
const PORT = Number.parseInt(process.env.PORT || "8080", 10);

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "MS1" });
});

app.use("/kunden", kundenRoutes);
app.use("/artikel", artikelRoutes);

async function start() {
  await initDatabase();

  app.listen(PORT, () => {
    log.info(`MS1 laeuft auf http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  log.error(error.stack || error.message);
  process.exit(1);
});
