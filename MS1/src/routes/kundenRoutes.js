const express = require("express");
const {
  getAllKunden,
  getKundeById,
  createKunde
} = require("../controllers/kundenController");


const router = express.Router();

router.get("/", getAllKunden);
router.get("/:id", getKundeById);
router.post("/", createKunde);
module.exports = router;
