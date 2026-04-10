const express = require("express");
const {
  getAllArtikel,
  getArtikelById
} = require("../controllers/artikelController");

const router = express.Router();

router.get("/", getAllArtikel);
router.get("/:id", getArtikelById);

module.exports = router;
