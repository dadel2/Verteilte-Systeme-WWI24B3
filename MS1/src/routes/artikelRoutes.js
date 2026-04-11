const express = require("express");
const {
  getAllArtikel,
  getArtikelById,
  createArtikel,
  patchArtikel,
  deleteArtikel
} = require("../controllers/artikelController");

const router = express.Router();

router.get("/", getAllArtikel);
router.get("/:id", getArtikelById);
router.post("/", createArtikel);
router.patch("/:id", patchArtikel);
router.delete("/:id", deleteArtikel);

module.exports = router;
