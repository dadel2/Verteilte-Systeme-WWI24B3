const express = require("express");
const {
  getAllKunden,
  getKundeById,
  createKunde,
  patchKunde,
  deleteKunde
} = require("../controllers/kundenController");

const router = express.Router();

router.get("/", getAllKunden);
router.get("/:id", getKundeById);
router.post("/", createKunde);
router.patch("/:id", patchKunde);
router.delete("/:id", deleteKunde);

module.exports = router;
