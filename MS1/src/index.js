const express = require("express");

const app = express();
const PORT = 8080;

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "MS1" });
});

app.listen(PORT, () => {
  console.log(`MS1 laeuft auf http://localhost:${PORT}`);
});
