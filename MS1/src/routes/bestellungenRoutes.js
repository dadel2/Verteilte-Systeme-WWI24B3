const express = require("express");
const {
  getAllBestellungen,
  getBestellungById,
  createBestellung,
  patchBestellung,
  deleteBestellung
} = require("../controllers/bestellungenController");

const router = express.Router();

router.get("/", getAllBestellungen);
router.get("/:id", getBestellungById);
router.post("/", createBestellung);
router.patch("/:id", patchBestellung);
router.delete("/:id", deleteBestellung);

module.exports = router;
