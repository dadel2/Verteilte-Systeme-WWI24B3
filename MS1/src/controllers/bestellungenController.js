const { getDb } = require("../database/db");
const { sendError } = require("../utils/httpError");

async function getAllBestellungen(req, res) {
  const db = getDb();
  const q = (req.query.q || "").trim();

  if (!q) {
    const rows = await db.all("SELECT * FROM bestellungen ORDER BY bestell_id");
    return res.json(rows);
  }

  const like = `%${q.toLowerCase()}%`;
  const rows = await db.all(
    `SELECT * FROM bestellungen
     WHERE LOWER(bestell_datum) LIKE ?
        OR LOWER(bestellstatus) LIKE ?
        OR LOWER(CAST(kunden_id AS TEXT)) LIKE ?
        OR LOWER(CAST(gesamtpreis AS TEXT)) LIKE ?
     ORDER BY bestell_id`,
    [like, like, like, like]
  );

  return res.json(rows);
}

async function getBestellungById(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Bestell-ID.");
  }

  const row = await db.get("SELECT * FROM bestellungen WHERE bestell_id = ?", [id]);
  if (!row) {
    return sendError(res, 404, "Bestellung nicht gefunden.");
  }

  const artikel = await db.all(
    `SELECT a.artikel_id, a.name, a.beschreibung, a.kategorie
     FROM bestellung_artikel ba
     JOIN artikel a ON a.artikel_id = ba.artikel_id
     WHERE ba.bestell_id = ?
     ORDER BY a.artikel_id`,
    [id]
  );

  return res.json({ ...row, artikel });
}

module.exports = {
  getAllBestellungen,
  getBestellungById
};
