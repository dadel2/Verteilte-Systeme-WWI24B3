const { getDb } = require("../database/db");
const { publishResourceChange } = require("../mqtt/publisher");
const { sendError } = require("../utils/httpError");

function parseGueltigenGesamtpreis(value) {
  const preis = Number(value);
  if (!Number.isFinite(preis) || preis < 0) {
    return null;
  }
  return preis;
}

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
  const daten = Object.fromEntries(
    Object.entries(body).filter(([key]) => erlaubteFelder.includes(key))
  );

  const fehlendeFelder = pflichtFelder.filter(
    (field) => daten[field] === undefined || daten[field] === null
  );
  if (fehlendeFelder.length > 0) {
    return sendError(res, 400, `Fehlende Pflichtattribute: ${fehlendeFelder.join(", ")}`);
  }

  if (!Array.isArray(daten.artikel_ids) || daten.artikel_ids.length === 0) {
    return sendError(res, 400, "artikel_ids muss ein nicht-leeres Array sein.");
  }

  const artikelIds = [...new Set(daten.artikel_ids.map((id) => Number.parseInt(id, 10)))];
  if (artikelIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    return sendError(res, 400, "artikel_ids enthaelt ungueltige IDs.");
  }

  const kundenId = Number.parseInt(daten.kunden_id, 10);
  if (!Number.isInteger(kundenId) || kundenId <= 0) {
    return sendError(res, 400, "Ungueltige kunden_id.");
  }

  const bestellDatum = String(daten.bestell_datum || "").trim();
  if (bestellDatum.length === 0) {
    return sendError(res, 400, "Ungueltiges bestell_datum.");
  }

  const bestellstatus = String(daten.bestellstatus || "").trim();
  if (bestellstatus.length === 0) {
    return sendError(res, 400, "Ungueltiger bestellstatus.");
  }

  const gesamtpreis = parseGueltigenGesamtpreis(daten.gesamtpreis);
  if (gesamtpreis === null) {
    return sendError(res, 400, "Ungueltiger gesamtpreis (muss >= 0 sein).");
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
        bestellDatum,
        gesamtpreis,
        bestellstatus,
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

    await publishResourceChange("bestellungen", created.bestell_id, "create");
    return res.status(201).json({ ...created, artikel });
  } catch (error) {
    await db.exec("ROLLBACK");
    return sendError(res, 500, "Bestellung konnte nicht angelegt werden.");
  }
}

async function patchBestellung(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Bestell-ID.");
  }

  const existing = await db.get("SELECT * FROM bestellungen WHERE bestell_id = ?", [id]);
  if (!existing) {
    return sendError(res, 404, "Bestellung nicht gefunden.");
  }

  const erlaubteFelder = ["bestell_datum", "gesamtpreis", "bestellstatus", "kunden_id", "artikel_ids"];
  const body = req.body || {};
  const daten = Object.fromEntries(
    Object.entries(body).filter(([key]) => erlaubteFelder.includes(key))
  );
  const keys = Object.keys(daten);

  if (keys.length === 0) {
    return sendError(res, 400, "Keine gueltigen Attribute zum Aktualisieren uebergeben.");
  }

  const updateKeys = keys.filter((key) => key !== "artikel_ids");

  try {
    await db.exec("BEGIN TRANSACTION");

    if (updateKeys.includes("kunden_id")) {
      const kundenId = Number.parseInt(daten.kunden_id, 10);
      if (!Number.isInteger(kundenId) || kundenId <= 0) {
        await db.exec("ROLLBACK");
        return sendError(res, 400, "Ungueltige kunden_id.");
      }

      const kunde = await db.get("SELECT kunden_id FROM kunden WHERE kunden_id = ?", [kundenId]);
      if (!kunde) {
        await db.exec("ROLLBACK");
        return sendError(res, 409, "Referenzierter Kunde existiert nicht.");
      }
      daten.kunden_id = kundenId;
    }

    if (updateKeys.length > 0) {
      const setClause = updateKeys.map((key) => `${key} = ?`).join(", ");
      const values = updateKeys.map((key) => {
        if (key === "gesamtpreis") {
          const preis = parseGueltigenGesamtpreis(daten[key]);
          if (preis === null) {
            throw new Error("INVALID_GESAMTPREIS");
          }
          return preis;
        }

        const value = String(daten[key] || "").trim();
        if ((key === "bestell_datum" || key === "bestellstatus") && value.length === 0) {
          throw new Error(`INVALID_${key.toUpperCase()}`);
        }
        return value;
      });

      await db.run(`UPDATE bestellungen SET ${setClause} WHERE bestell_id = ?`, [...values, id]);
    }

    if (Object.prototype.hasOwnProperty.call(daten, "artikel_ids")) {
      if (!Array.isArray(daten.artikel_ids) || daten.artikel_ids.length === 0) {
        await db.exec("ROLLBACK");
        return sendError(res, 400, "artikel_ids muss ein nicht-leeres Array sein.");
      }

      const artikelIds = [
        ...new Set(daten.artikel_ids.map((artikelId) => Number.parseInt(artikelId, 10)))
      ];
      if (artikelIds.some((artikelId) => !Number.isInteger(artikelId) || artikelId <= 0)) {
        await db.exec("ROLLBACK");
        return sendError(res, 400, "artikel_ids enthaelt ungueltige IDs.");
      }

      const placeholders = artikelIds.map(() => "?").join(",");
      const vorhandeneArtikel = await db.all(
        `SELECT artikel_id FROM artikel WHERE artikel_id IN (${placeholders})`,
        artikelIds
      );
      if (vorhandeneArtikel.length !== artikelIds.length) {
        await db.exec("ROLLBACK");
        return sendError(res, 409, "Mindestens ein referenzierter Artikel existiert nicht.");
      }

      await db.run("DELETE FROM bestellung_artikel WHERE bestell_id = ?", [id]);
      for (const artikelId of artikelIds) {
        await db.run("INSERT INTO bestellung_artikel (bestell_id, artikel_id) VALUES (?, ?)", [id, artikelId]);
      }
    }

    await db.exec("COMMIT");
  } catch (error) {
    await db.exec("ROLLBACK");
    if (error.message === "INVALID_GESAMTPREIS") {
      return sendError(res, 400, "Ungueltiger gesamtpreis (muss >= 0 sein).");
    }
    if (error.message === "INVALID_BESTELL_DATUM") {
      return sendError(res, 400, "Ungueltiges bestell_datum.");
    }
    if (error.message === "INVALID_BESTELLSTATUS") {
      return sendError(res, 400, "Ungueltiger bestellstatus.");
    }
    return sendError(res, 500, "Bestellung konnte nicht aktualisiert werden.");
  }

  const updated = await db.get("SELECT * FROM bestellungen WHERE bestell_id = ?", [id]);
  const artikel = await db.all(
    `SELECT a.artikel_id, a.name, a.beschreibung, a.kategorie
     FROM bestellung_artikel ba
     JOIN artikel a ON a.artikel_id = ba.artikel_id
     WHERE ba.bestell_id = ?
     ORDER BY a.artikel_id`,
    [id]
  );

  await publishResourceChange("bestellungen", updated.bestell_id, "update");
  return res.json({ ...updated, artikel });
}

async function deleteBestellung(req, res) {
  const db = getDb();
  const id = Number.parseInt(req.params.id, 10);

  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "Ungueltige Bestell-ID.");
  }

  const existing = await db.get("SELECT * FROM bestellungen WHERE bestell_id = ?", [id]);
  if (!existing) {
    return sendError(res, 404, "Bestellung nicht gefunden.");
  }

  try {
    await db.exec("BEGIN TRANSACTION");
    await db.run("DELETE FROM bestellung_artikel WHERE bestell_id = ?", [id]);
    await db.run("DELETE FROM bestellungen WHERE bestell_id = ?", [id]);
    await db.exec("COMMIT");
    await publishResourceChange("bestellungen", id, "delete");
    return res.status(204).send();
  } catch (error) {
    await db.exec("ROLLBACK");
    return sendError(res, 500, "Bestellung konnte nicht geloescht werden.");
  }
}

module.exports = {
  getAllBestellungen,
  getBestellungById,
  createBestellung,
  patchBestellung,
  deleteBestellung
};
