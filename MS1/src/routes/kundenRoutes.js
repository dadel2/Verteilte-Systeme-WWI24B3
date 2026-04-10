const express = require("express");
const {
  getAllKunden,
  getKundeById
} = require("../controllers/kundenController");

const router = express.Router();

router.get("/", getAllKunden);
router.get("/:id", getKundeById);

module.exports = router;
