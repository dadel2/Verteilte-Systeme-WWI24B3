const express = require("express");
const {
  getAllBestellungen,
  getBestellungById
} = require("../controllers/bestellungenController");

const router = express.Router();

router.get("/", getAllBestellungen);
router.get("/:id", getBestellungById);

module.exports = router;
