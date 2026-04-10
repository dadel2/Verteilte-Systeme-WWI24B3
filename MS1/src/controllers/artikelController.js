const { getDb } = require("../database/db");
const { sendError } = require("../utils/httpError");

async function getAllArtikel(req, res) {
  const db = getDb();
  const q = (req.query.q || "").trim();

  if (!q) {
    const rows = await db.all("SELECT * FROM artikel ORDER BY artikel_id");
    return res.json(rows);
  }

  const like = `%${q.toLowerCase()}%`;
  const rows = await db.all(
    `SELECT * FROM artikel
     WHERE LOWER(name) LIKE ?
        OR LOWER(beschreibung) LIKE ?
        OR LOWER(kategorie) LIKE ?
     ORDER BY artikel_id`,
    [like, like, like]
  );

  return res.json(rows);
}

async function getArtikelById(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Artikel-ID.");
  }

  const row = await db.get("SELECT * FROM artikel WHERE artikel_id = ?", [id]);
  if (!row) {
    return sendError(res, 404, "Artikel nicht gefunden.");
  }

  return res.json(row);
}

module.exports = {
  getAllArtikel,
  getArtikelById
};
