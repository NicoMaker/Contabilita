const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");
const { createSchema, seedData } = require("./seedData");

const DB_PATH = path.join(__dirname, "../../db", "gestionale.db");
let db;

function saveDB() {
  const data = db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDB();
  return db;
}

// ⭐ NUOVA FUNZIONE per eseguire query e ottenere l'ultimo ID
function runQueryAndGetId(sql, params = []) {
  db.run(sql, params);
  saveDB();
  // Ottieni l'ultimo ID inserito
  const stmt = db.prepare("SELECT last_insert_rowid() as id");
  stmt.step();
  const result = stmt.getAsObject();
  stmt.free();
  return result.id;
}

function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  return queryAll(sql, params)[0] || null;
}

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log("✅ Database caricato da file");
    migrateDB();
  } else {
    db = new SQL.Database();
    console.log("🆕 Nuovo database creato");
    createSchema(db);
    seedData(db);
    saveDB();
  }
  return db;
}

function migrateDB() {
  const migrations = [
    `ALTER TABLE sottotipologie ADD COLUMN is_separator INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti ADD COLUMN is_contabilita INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti ADD COLUMN has_rate INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti ADD COLUMN rate_labels TEXT`,
    `ALTER TABLE adempimenti ADD COLUMN is_checkbox INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_saldo REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_acconto1 REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_acconto2 REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_iva REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_contabilita REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN cont_completata INTEGER DEFAULT 0`,
    `ALTER TABLE clienti ADD COLUMN periodicita TEXT`,
    `ALTER TABLE clienti ADD COLUMN col2_value TEXT`,
    `ALTER TABLE clienti ADD COLUMN col3_value TEXT`,
  ];
  migrations.forEach((sql) => {
    try {
      db.run(sql);
    } catch (e) {
      // Ignora errori di colonna già esistente
    }
  });
  saveDB();
}

module.exports = {
  get db() {
    return db;
  },
  initDB,
  saveDB,
  runQuery,
  runQueryAndGetId,  // ⭐ ESPORTA LA NUOVA FUNZIONE
  queryAll,
  queryOne,
};