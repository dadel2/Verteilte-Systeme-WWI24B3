const { getDb } = require("../database/db");
const { sendError } = require("../utils/httpError");

async function getAllKunden(req, res) {
  const db = getDb();
  const q = (req.query.q || "").trim();

  if (!q) {
    const rows = await db.all("SELECT * FROM kunden ORDER BY kunden_id");
    return res.json(rows);
  }

  const like = `%${q.toLowerCase()}%`;
  const rows = await db.all(
    `SELECT * FROM kunden
     WHERE LOWER(vorname) LIKE ?
        OR LOWER(nachname) LIKE ?
        OR LOWER(email) LIKE ?
        OR LOWER(telefonnummer) LIKE ?
        OR LOWER(adresse) LIKE ?
     ORDER BY kunden_id`,
    [like, like, like, like, like]
  );

  return res.json(rows);
}

async function getKundeById(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Kunden-ID.");
  }

  const row = await db.get("SELECT * FROM kunden WHERE kunden_id = ?", [id]);
  if (!row) {
    return sendError(res, 404, "Kunde nicht gefunden.");
  }

  return res.json(row);
}

module.exports = {
  getAllKunden,
  getKundeById
};
