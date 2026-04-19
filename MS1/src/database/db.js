const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const logging = require("logging").default;

const log = logging("db");
const dbPath = process.env.DB_FILE
  ? path.resolve(process.env.DB_FILE)
  : path.join(__dirname, "..", "..", "pizza-service.db");

let dbInstance = null;

const schemaSql = `
CREATE TABLE IF NOT EXISTS kunden (
  kunden_id INTEGER PRIMARY KEY AUTOINCREMENT,
  vorname TEXT NOT NULL,
  nachname TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  telefonnummer TEXT NOT NULL UNIQUE,
  adresse TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS artikel (
  artikel_id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  beschreibung TEXT,
  kategorie TEXT NOT NULL,
  UNIQUE(name, kategorie)
);

CREATE TABLE IF NOT EXISTS bestellungen (
  bestell_id INTEGER PRIMARY KEY AUTOINCREMENT,
  bestell_datum TEXT NOT NULL,
  gesamtpreis REAL NOT NULL CHECK (gesamtpreis >= 0),
  bestellstatus TEXT NOT NULL,
  kunden_id INTEGER NOT NULL,
  FOREIGN KEY (kunden_id) REFERENCES kunden(kunden_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS bestellung_artikel (
  bestell_id INTEGER NOT NULL,
  artikel_id INTEGER NOT NULL,
  PRIMARY KEY (bestell_id, artikel_id),
  FOREIGN KEY (bestell_id) REFERENCES bestellungen(bestell_id) ON DELETE RESTRICT,
  FOREIGN KEY (artikel_id) REFERENCES artikel(artikel_id) ON DELETE RESTRICT
);
`;

async function seedDemoDataIfEmpty() {
  const db = getDb();

  const demoKunden = [
    ["Max", "Mustermann", "max@example.com", "+49111111111", "Musterweg 1"],
    ["Anna", "Schmidt", "anna@example.com", "+49222222222", "Hauptstr. 10"],
    ["Luca", "Weber", "luca@example.com", "+49333333333", "Ringstr. 5"]
  ];
  for (const kunde of demoKunden) {
    await db.run(
      "INSERT OR IGNORE INTO kunden (vorname, nachname, email, telefonnummer, adresse) VALUES (?, ?, ?, ?, ?)",
      kunde
    );
  }

  const demoArtikel = [
    ["Margherita", "Tomate, Mozzarella, Basilikum", "Pizza"],
    ["Salami", "Tomate, Mozzarella, Salami", "Pizza"],
    ["Tiramisu", "Klassisches Dessert", "Dessert"]
  ];
  for (const artikel of demoArtikel) {
    await db.run(
      "INSERT OR IGNORE INTO artikel (name, beschreibung, kategorie) VALUES (?, ?, ?)",
      artikel
    );
  }

  const kundenIds = (
    await db.all("SELECT kunden_id FROM kunden ORDER BY kunden_id LIMIT 3")
  ).map((row) => row.kunden_id);
  const artikelIds = (
    await db.all("SELECT artikel_id FROM artikel ORDER BY artikel_id LIMIT 3")
  ).map((row) => row.artikel_id);

  const bestellungsCount = (await db.get("SELECT COUNT(*) AS count FROM bestellungen")).count;
  const fehlendeBestellungen = Math.max(0, 3 - bestellungsCount);
  const statusFolge = ["neu", "in-zubereitung", "geliefert"];

  for (let i = 0; i < fehlendeBestellungen; i++) {
    const kundenId = kundenIds[i % kundenIds.length];
    const status = statusFolge[i % statusFolge.length];
    const preis = Number((9.5 + (i + 1) * 4.25).toFixed(2));
    const datum = "2026-04-10";

    const result = await db.run(
      "INSERT INTO bestellungen (bestell_datum, gesamtpreis, bestellstatus, kunden_id) VALUES (?, ?, ?, ?)",
      [datum, preis, status, kundenId]
    );

    const bestellId = result.lastID;
    const primarArtikel = artikelIds[i % artikelIds.length];
    await db.run(
      "INSERT INTO bestellung_artikel (bestell_id, artikel_id) VALUES (?, ?)",
      [bestellId, primarArtikel]
    );

    const sekundarArtikel = artikelIds[(i + 1) % artikelIds.length];
    if (sekundarArtikel !== primarArtikel) {
      await db.run(
        "INSERT INTO bestellung_artikel (bestell_id, artikel_id) VALUES (?, ?)",
        [bestellId, sekundarArtikel]
      );
    }
  }

  log.info("Demo-Content geprueft/angelegt.");
}

async function initDatabase() {
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec("PRAGMA foreign_keys = ON;");
  await dbInstance.exec(schemaSql);
  await seedDemoDataIfEmpty();

  log.info(`SQLite bereit: ${dbPath}`);
}

function getDb() {
  if (!dbInstance) {
    throw new Error("Datenbank wurde noch nicht initialisiert.");
  }
  return dbInstance;
}

module.exports = {
  initDatabase,
  getDb
};
