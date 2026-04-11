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

async function createBestellung(req, res) {
  const db = getDb();
  const body = req.body || {};

  const erlaubteFelder = ["bestell_datum", "gesamtpreis", "bestellstatus", "kunden_id", "artikel_ids"];
  const pflichtFelder = erlaubteFelder;

  const invalidKeys = Object.keys(body).filter((key) => !erlaubteFelder.includes(key));
  if (invalidKeys.length > 0) {
    return sendError(res, 400, `Ungueltige Attribute: ${invalidKeys.join(", ")}`);
  }

  const fehlendeFelder = pflichtFelder.filter((field) => body[field] === undefined || body[field] === null);
  if (fehlendeFelder.length > 0) {
    return sendError(res, 400, `Fehlende Pflichtattribute: ${fehlendeFelder.join(", ")}`);
  }

  if (!Array.isArray(body.artikel_ids) || body.artikel_ids.length === 0) {
    return sendError(res, 400, "artikel_ids muss ein nicht-leeres Array sein.");
  }

  const artikelIds = [...new Set(body.artikel_ids.map((id) => Number.parseInt(id, 10)))];
  if (artikelIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return sendError(res, 400, "artikel_ids enthaelt ungueltige IDs.");
  }

  const kundenId = Number.parseInt(body.kunden_id, 10);
  if (!Number.isInteger(kundenId) || kundenId <= 0) {
    return sendError(res, 400, "Ungueltige kunden_id.");
  }

  const kunde = await db.get("SELECT kunden_id FROM kunden WHERE kunden_id = ?", [kundenId]);
  if (!kunde) {
    return sendError(res, 409, "Referenzierter Kunde existiert nicht.");
  }

  const placeholders = artikelIds.map(() => "?").join(",");
  const vorhandeneArtikel = await db.all(
    `SELECT artikel_id FROM artikel WHERE artikel_id IN (${placeholders})`,
    artikelIds
  );
  if (vorhandeneArtikel.length !== artikelIds.length) {
    return sendError(res, 409, "Mindestens ein referenzierter Artikel existiert nicht.");
  }

  try {
    await db.exec("BEGIN TRANSACTION");

    const result = await db.run(
      `INSERT INTO bestellungen (bestell_datum, gesamtpreis, bestellstatus, kunden_id)
       VALUES (?, ?, ?, ?)`,
      [
        String(body.bestell_datum).trim(),
        Number(body.gesamtpreis),
        String(body.bestellstatus).trim(),
        kundenId
      ]
    );

    for (const artikelId of artikelIds) {
      await db.run(
        "INSERT INTO bestellung_artikel (bestell_id, artikel_id) VALUES (?, ?)",
        [result.lastID, artikelId]
      );
    }

    await db.exec("COMMIT");

    const created = await db.get("SELECT * FROM bestellungen WHERE bestell_id = ?", [result.lastID]);
    const artikel = await db.all(
      `SELECT a.artikel_id, a.name, a.beschreibung, a.kategorie
       FROM bestellung_artikel ba
       JOIN artikel a ON a.artikel_id = ba.artikel_id
       WHERE ba.bestell_id = ?
       ORDER BY a.artikel_id`,
      [result.lastID]
    );

    return res.status(201).json({ ...created, artikel });
  } catch (error) {
    await db.exec("ROLLBACK");
    return sendError(res, 500, "Bestellung konnte nicht angelegt werden.");
  }
}

module.exports = {
  getAllBestellungen,
  getBestellungById,
  createBestellung
};
