const express = require("express");
const {
  getAllBestellungen,
  getBestellungById,
  createBestellung
} = require("../controllers/bestellungenController");

const router = express.Router();

router.get("/", getAllBestellungen);
router.get("/:id", getBestellungById);
router.post("/", createBestellung);

module.exports = router;
