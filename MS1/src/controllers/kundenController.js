const { getDb } = require("../database/db");
const { publishResourceChange } = require("../mqtt/publisher");
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

async function createKunde(req, res) {
  const db = getDb();

  const erlaubteFelder = [
    "vorname",
    "nachname",
    "email",
    "telefonnummer",
    "adresse"
  ];

  const pflichtFelder = erlaubteFelder;
  const body = req.body || {};
  const daten = Object.fromEntries(
    Object.entries(body).filter(([key]) => erlaubteFelder.includes(key))
  );

  const fehlendeFelder = pflichtFelder.filter((field) => {
    const value = daten[field];
    return typeof value !== "string" || value.trim() === "";
  });

  if (fehlendeFelder.length > 0) {
    return sendError(res, 400, `Fehlende Pflichtattribute: ${fehlendeFelder.join(", ")}`);
  }

  try {
    const result = await db.run(
      `INSERT INTO kunden (vorname, nachname, email, telefonnummer, adresse)
       VALUES (?, ?, ?, ?, ?)`,
      [
        daten.vorname.trim(),
        daten.nachname.trim(),
        daten.email.trim(),
        daten.telefonnummer.trim(),
        daten.adresse.trim()
      ]
    );

    const created = await db.get("SELECT * FROM kunden WHERE kunden_id = ?", [result.lastID]);
    await publishResourceChange("kunden", created.kunden_id, "create");
    return res.status(201).json(created);
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      return sendError(res, 409, "Kunde mit gleicher Email oder Telefonnummer existiert bereits.");
    }
    return sendError(res, 500, "Kunde konnte nicht angelegt werden.");
  }
}
async function patchKunde(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Kunden-ID.");
  }

  const erlaubteFelder = ["vorname", "nachname", "email", "telefonnummer", "adresse"];
  const body = req.body || {};
  const daten = Object.fromEntries(
    Object.entries(body).filter(([key]) => erlaubteFelder.includes(key))
  );
  const keys = Object.keys(daten);

  if (keys.length === 0) {
    return sendError(res, 400, "Keine gueltigen Attribute zum Aktualisieren uebergeben.");
  }

  const existing = await db.get("SELECT * FROM kunden WHERE kunden_id = ?", [id]);
  if (!existing) {
    return sendError(res, 404, "Kunde nicht gefunden.");
  }

  const setClause = keys.map((key) => `${key} = ?`).join(", ");
  const values = keys.map((key) => {
    const value = daten[key];
    return typeof value === "string" ? value.trim() : value;
  });

  try {
    await db.run(`UPDATE kunden SET ${setClause} WHERE kunden_id = ?`, [...values, id]);
    const updated = await db.get("SELECT * FROM kunden WHERE kunden_id = ?", [id]);
    await publishResourceChange("kunden", updated.kunden_id, "update", { geaenderteFelder: keys });
    return res.json(updated);
  } catch (error) {
    if (String(error.message).includes("UNIQUE constraint failed")) {
      return sendError(res, 409, "Kunde mit gleicher Email oder Telefonnummer existiert bereits.");
    }
    return sendError(res, 500, "Kunde konnte nicht aktualisiert werden.");
  }
}

async function deleteKunde(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Kunden-ID.");
  }

  const existing = await db.get("SELECT * FROM kunden WHERE kunden_id = ?", [id]);
  if (!existing) {
    return sendError(res, 404, "Kunde nicht gefunden.");
  }

  try {
    await db.run("DELETE FROM kunden WHERE kunden_id = ?", [id]);
    await publishResourceChange("kunden", id, "delete");
    return res.status(204).send();
  } catch (error) {
    if (String(error.message).includes("FOREIGN KEY constraint failed")) {
      return sendError(res, 409, "Kunde wird noch von Bestellungen referenziert.");
    }
    return sendError(res, 500, "Kunde konnte nicht geloescht werden.");
  }
}

module.exports = {
  getAllKunden,
  getKundeById,
  createKunde,
  patchKunde,
  deleteKunde
};



