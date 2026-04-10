const path = require("path");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const logging = require("logging").default;

const log = logging("db");
const dbPath = path.join(__dirname, "..", "..", "pizza-service.db");

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

async function initDatabase() {
  dbInstance = await open({
    filename: dbPath,
    driver: sqlite3.Database
  });

  await dbInstance.exec("PRAGMA foreign_keys = ON;");
  await dbInstance.exec(schemaSql);

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
