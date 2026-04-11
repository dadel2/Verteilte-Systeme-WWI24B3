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

async function createArtikel(req, res) {
  const db = getDb();
  const erlaubteFelder = ["name", "beschreibung", "kategorie"];
  const pflichtFelder = ["name", "kategorie"];
  const body = req.body || {};

  const invalidKeys = Object.keys(body).filter((key) => !erlaubteFelder.includes(key));
  if (invalidKeys.length > 0) {
    return sendError(res, 400, `Ungueltige Attribute: ${invalidKeys.join(", ")}`);
  }

  const fehlendeFelder = pflichtFelder.filter((field) => {
    const value = body[field];
    return typeof value !== "string" || value.trim() === "";
  });
  if (fehlendeFelder.length > 0) {
    return sendError(res, 400, `Fehlende Pflichtattribute: ${fehlendeFelder.join(", ")}`);
  }

  try {
    const result = await db.run(
      "INSERT INTO artikel (name, beschreibung, kategorie) VALUES (?, ?, ?)",
      [body.name.trim(), (body.beschreibung || "").trim(), body.kategorie.trim()]
    );
    const created = await db.get("SELECT * FROM artikel WHERE artikel_id = ?", [result.lastID]);
    return res.status(201).json(created);
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      return sendError(res, 409, "Artikel mit gleicher Kombination aus Name und Kategorie existiert bereits.");
    }
    return sendError(res, 500, "Artikel konnte nicht angelegt werden.");
  }
}

async function patchArtikel(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Artikel-ID.");
  }

  const erlaubteFelder = ["name", "beschreibung", "kategorie"];
  const body = req.body || {};
  const keys = Object.keys(body);

  if (keys.length === 0) {
    return sendError(res, 400, "Keine Attribute zum Aktualisieren uebergeben.");
  }

  const invalidKeys = keys.filter((key) => !erlaubteFelder.includes(key));
  if (invalidKeys.length > 0) {
    return sendError(res, 400, `Ungueltige Attribute: ${invalidKeys.join(", ")}`);
  }

  const existing = await db.get("SELECT * FROM artikel WHERE artikel_id = ?", [id]);
  if (!existing) {
    return sendError(res, 404, "Artikel nicht gefunden.");
  }

  const setClause = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => {
    const value = body[key];
    return typeof value === "string" ? value.trim() : value;
  });

  try {
    await db.run(`UPDATE artikel SET ${setClause} WHERE artikel_id = ?`, [...values, id]);
    const updated = await db.get("SELECT * FROM artikel WHERE artikel_id = ?", [id]);
    return res.json(updated);
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      return sendError(res, 409, "Artikel mit gleicher Kombination aus Name und Kategorie existiert bereits.");
    }
    return sendError(res, 500, "Artikel konnte nicht aktualisiert werden.");
  }
}

async function deleteArtikel(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Artikel-ID.");
  }

  const existing = await db.get("SELECT * FROM artikel WHERE artikel_id = ?", [id]);
  if (!existing) {
    return sendError(res, 404, "Artikel nicht gefunden.");
  }

  try {
    await db.run("DELETE FROM artikel WHERE artikel_id = ?", [id]);
    return res.status(204).send();
  } catch (error) {
    if (String(error.message).includes("FOREIGN KEY constraint failed")) {
      return sendError(res, 409, "Artikel wird noch von Bestellungen referenziert.");
    }
    return sendError(res, 500, "Artikel konnte nicht geloescht werden.");
  }
}

module.exports = {
  getAllArtikel,
  getArtikelById,
  createArtikel,
  patchArtikel,
  deleteArtikel
};
