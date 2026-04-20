const initSqlJs = require("sql.js");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { createSchema, seedData } = require("./seedData");

const DB_PATH = path.join(__dirname, "../db", "gestionale.db");
let db;

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const n of Object.keys(ifaces))
    for (const i of ifaces[n])
      if (i.family === "IPv4" && !i.internal) return i.address;
  return "localhost";
}

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
    db = new SQL.Database(fs.readFileSync(DB_PATH));
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
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_saldo REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_acconto1 REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_acconto2 REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_iva REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_contabilita REAL`,
    `ALTER TABLE clienti ADD COLUMN periodicita TEXT`,
    `ALTER TABLE clienti ADD COLUMN col2_value TEXT`,
    `ALTER TABLE clienti ADD COLUMN col3_value TEXT`,
  ];
  migrations.forEach((sql) => {
    try { db.run(sql); } catch (e) {}
  });
  saveDB();
}

module.exports = {
  get db() { return db; },
  initDB,
  saveDB,
  runQuery,
  queryAll,
  queryOne,
  getLocalIP
};