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

  const kundenCount = (await db.get("SELECT COUNT(*) AS count FROM kunden")).count;
  if (kundenCount === 0) {
    await db.run(
      "INSERT INTO kunden (vorname, nachname, email, telefonnummer, adresse) VALUES (?, ?, ?, ?, ?)",
      ["Max", "Mustermann", "max@example.com", "+49111111111", "Musterweg 1"]
    );
    await db.run(
      "INSERT INTO kunden (vorname, nachname, email, telefonnummer, adresse) VALUES (?, ?, ?, ?, ?)",
      ["Anna", "Schmidt", "anna@example.com", "+49222222222", "Hauptstr. 10"]
    );
    await db.run(
      "INSERT INTO kunden (vorname, nachname, email, telefonnummer, adresse) VALUES (?, ?, ?, ?, ?)",
      ["Luca", "Weber", "luca@example.com", "+49333333333", "Ringstr. 5"]
    );
  }

  const artikelCount = (await db.get("SELECT COUNT(*) AS count FROM artikel")).count;
  if (artikelCount === 0) {
    await db.run(
      "INSERT INTO artikel (name, beschreibung, kategorie) VALUES (?, ?, ?)",
      ["Margherita", "Tomate, Mozzarella, Basilikum", "Pizza"]
    );
    await db.run(
      "INSERT INTO artikel (name, beschreibung, kategorie) VALUES (?, ?, ?)",
      ["Salami", "Tomate, Mozzarella, Salami", "Pizza"]
    );
    await db.run(
      "INSERT INTO artikel (name, beschreibung, kategorie) VALUES (?, ?, ?)",
      ["Tiramisu", "Klassisches Dessert", "Dessert"]
    );
  }

  const bestellungenCount = (await db.get("SELECT COUNT(*) AS count FROM bestellungen")).count;
  if (bestellungenCount === 0) {
    await db.run(
      "INSERT INTO bestellungen (bestell_datum, gesamtpreis, bestellstatus, kunden_id) VALUES (?, ?, ?, ?)",
      ["2026-04-10", 18.5, "neu", 1]
    );
    await db.run(
      "INSERT INTO bestellungen (bestell_datum, gesamtpreis, bestellstatus, kunden_id) VALUES (?, ?, ?, ?)",
      ["2026-04-10", 24.0, "in-zubereitung", 2]
    );
    await db.run(
      "INSERT INTO bestellungen (bestell_datum, gesamtpreis, bestellstatus, kunden_id) VALUES (?, ?, ?, ?)",
      ["2026-04-10", 9.9, "geliefert", 3]
    );

    await db.run("INSERT INTO bestellung_artikel (bestell_id, artikel_id) VALUES (?, ?)", [1, 1]);
    await db.run("INSERT INTO bestellung_artikel (bestell_id, artikel_id) VALUES (?, ?)", [1, 3]);
    await db.run("INSERT INTO bestellung_artikel (bestell_id, artikel_id) VALUES (?, ?)", [2, 2]);
    await db.run("INSERT INTO bestellung_artikel (bestell_id, artikel_id) VALUES (?, ?)", [3, 3]);
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
