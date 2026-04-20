const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
const os = require("os");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
  transports: ["websocket", "polling"],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.set("io", io);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

app.use((req, res, next) => {
  if (req.path.startsWith("/api"))
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

const DB_PATH = path.join(__dirname, "db", "gestionale.db");
let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log("✅ Database caricato da file");
    migrateDB();
  } else {
    db = new SQL.Database();
    console.log("🆕 Nuovo database creato");
    createSchema();
    seedData();
    saveDB();
  }
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
    try {
      db.run(sql);
    } catch (e) {}
  });
  saveDB();
}

function saveDB() {
  const data = db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function runQuery(sql, params = []) {
  db.run(sql, params);
  saveDB();
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

function createSchema() {
  // Tabella tipologie cliente (PF, SP, SC, ASS)
  db.run(`
    CREATE TABLE IF NOT EXISTS tipologie_cliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      descrizione TEXT,
      colore TEXT DEFAULT '#5b8df6'
    )
  `);

  // Tabella sottotipologie (relazione con tipologie)
  db.run(`
    CREATE TABLE IF NOT EXISTS sottotipologie (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_tipologia INTEGER NOT NULL,
      codice TEXT NOT NULL,
      nome TEXT NOT NULL,
      is_separator INTEGER DEFAULT 0,
      ordine INTEGER DEFAULT 0,
      FOREIGN KEY (id_tipologia) REFERENCES tipologie_cliente(id)
    )
  `);

  // Tabella regimi contabili
  db.run(`
    CREATE TABLE IF NOT EXISTS regimi_contabili (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      descrizione TEXT
    )
  `);

  // Tabella periodicità
  db.run(`
    CREATE TABLE IF NOT EXISTS periodicita (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      descrizione TEXT
    )
  `);

  // Tabella clienti completa con tutti i riferimenti
  db.run(`
    CREATE TABLE IF NOT EXISTS clienti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      id_tipologia INTEGER NOT NULL,
      id_sottotipologia INTEGER,
      col2_value TEXT,
      col3_value TEXT,
      periodicita TEXT,
      codice_fiscale TEXT,
      partita_iva TEXT,
      email TEXT,
      telefono TEXT,
      indirizzo TEXT,
      citta TEXT,
      cap TEXT,
      provincia TEXT,
      pec TEXT,
      sdi TEXT,
      iban TEXT,
      note TEXT,
      referente TEXT,
      categorie_attive TEXT DEFAULT '["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]',
      attivo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (id_tipologia) REFERENCES tipologie_cliente(id),
      FOREIGN KEY (id_sottotipologia) REFERENCES sottotipologie(id)
    )
  `);

  // Tabella adempimenti
  db.run(`
    CREATE TABLE IF NOT EXISTS adempimenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      descrizione TEXT,
      categoria TEXT,
      scadenza_tipo TEXT CHECK(scadenza_tipo IN ('annuale','semestrale','trimestrale','mensile')),
      is_contabilita INTEGER DEFAULT 0,
      has_rate INTEGER DEFAULT 0,
      rate_labels TEXT,
      attivo INTEGER DEFAULT 1
    )
  `);

  // Tabella adempimenti cliente (collegamento cliente-adempimenti con stato)
  db.run(`
    CREATE TABLE IF NOT EXISTS adempimenti_cliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_cliente INTEGER NOT NULL,
      id_adempimento INTEGER NOT NULL,
      anno INTEGER NOT NULL,
      mese INTEGER CHECK(mese BETWEEN 1 AND 12),
      trimestre INTEGER CHECK(trimestre BETWEEN 1 AND 4),
      semestre INTEGER CHECK(semestre BETWEEN 1 AND 2),
      stato TEXT DEFAULT 'da_fare',
      data_scadenza TEXT,
      data_completamento TEXT,
      note TEXT,
      importo REAL,
      importo_saldo REAL,
      importo_acconto1 REAL,
      importo_acconto2 REAL,
      importo_iva REAL,
      importo_contabilita REAL,
      UNIQUE(id_cliente, id_adempimento, anno, mese, trimestre, semestre),
      FOREIGN KEY (id_cliente) REFERENCES clienti(id),
      FOREIGN KEY (id_adempimento) REFERENCES adempimenti(id)
    )
  `);

  console.log("📐 Schema creato");
}

function seedData() {
  // Tipologie cliente con colori
  const tipologie = [
    { codice: "PF", nome: "Persona Fisica", descrizione: "Contribuente persona fisica", colore: "#5b8df6" },
    { codice: "SP", nome: "Società di Persone", descrizione: "SNC, SAS, SS", colore: "#a78bfa" },
    { codice: "SC", nome: "Società di Capitali", descrizione: "SRL, SPA, SAPA", colore: "#34d399" },
    { codice: "ASS", nome: "Associazione", descrizione: "Associazioni e enti non commerciali", colore: "#fbbf24" },
  ];
  tipologie.forEach((t) =>
    db.run(`INSERT INTO tipologie_cliente (codice,nome,descrizione,colore) VALUES (?,?,?,?)`, 
      [t.codice, t.nome, t.descrizione, t.colore])
  );

  // Sottotipologie complete
  const sottotipologie = [
    // PF
    { it: 1, c: "PF_PRIV", n: "Privato", sep: 0, ord: 1 },
    { it: 1, c: "PF_DITTA_SEP", n: "— Ditta Individuale —", sep: 1, ord: 2 },
    { it: 1, c: "PF_DITTA_ORD", n: "Ditta Ind. – Ordinario", sep: 0, ord: 3 },
    { it: 1, c: "PF_DITTA_SEM", n: "Ditta Ind. – Semplificato", sep: 0, ord: 4 },
    { it: 1, c: "PF_DITTA_FOR", n: "Ditta Ind. – Forfettario", sep: 0, ord: 5 },
    { it: 1, c: "PF_SOCIO", n: "Socio", sep: 0, ord: 6 },
    { it: 1, c: "PF_PROF_SEP", n: "— Professionista —", sep: 1, ord: 7 },
    { it: 1, c: "PF_PROF_ORD", n: "Professionista – Ordinario", sep: 0, ord: 8 },
    { it: 1, c: "PF_PROF_SEM", n: "Professionista – Semplificato", sep: 0, ord: 9 },
    { it: 1, c: "PF_PROF_FOR", n: "Professionista – Forfettario", sep: 0, ord: 10 },
    // SP
    { it: 2, c: "SP_ORD", n: "SP – Ordinaria", sep: 0, ord: 1 },
    { it: 2, c: "SP_SEMP", n: "SP – Semplificata", sep: 0, ord: 2 },
    // SC
    { it: 3, c: "SC_ORD", n: "SC – Ordinaria", sep: 0, ord: 1 },
    // ASS
    { it: 4, c: "ASS_ORD", n: "ASS – Ordinaria", sep: 0, ord: 1 },
    { it: 4, c: "ASS_SEMP", n: "ASS – Semplificata", sep: 0, ord: 2 },
  ];
  sottotipologie.forEach((s) =>
    db.run(`INSERT INTO sottotipologie (id_tipologia,codice,nome,is_separator,ordine) VALUES (?,?,?,?,?)`,
      [s.it, s.c, s.n, s.sep, s.ord])
  );

  // Regimi contabili
  const regimi = [
    { codice: "ordinario", nome: "Ordinario", descrizione: "Regime contabile ordinario" },
    { codice: "semplificato", nome: "Semplificato", descrizione: "Regime contabile semplificato" },
    { codice: "forfettario", nome: "Forfettario", descrizione: "Regime forfettario" },
  ];
  regimi.forEach((r) =>
    db.run(`INSERT INTO regimi_contabili (codice,nome,descrizione) VALUES (?,?,?)`,
      [r.codice, r.nome, r.descrizione])
  );

  // Periodicità
  const periodicita = [
    { codice: "mensile", nome: "Mensile", descrizione: "Liquidazione IVA mensile" },
    { codice: "trimestrale", nome: "Trimestrale", descrizione: "Liquidazione IVA trimestrale" },
  ];
  periodicita.forEach((p) =>
    db.run(`INSERT INTO periodicita (codice,nome,descrizione) VALUES (?,?,?)`,
      [p.codice, p.nome, p.descrizione])
  );

  // Adempimenti fiscali
  const adempimenti = [
    { codice: "TASSA_NID", nome: "Tassa NID", cat: "TUTTI", scad: "annuale", ic: 0, hr: 0, rl: null },
    { codice: "INAIL", nome: "INAIL", cat: "LAVORO", scad: "annuale", ic: 0, hr: 0, rl: null },
    { codice: "INPS_TRIM", nome: "INPS Trimestrale", cat: "PREVIDENZA", scad: "trimestrale", ic: 0, hr: 0, rl: null },
    { codice: "LIPE", nome: "LIPE", cat: "IVA", scad: "trimestrale", ic: 0, hr: 0, rl: null },
    { codice: "ACCONTO_IVA", nome: "Acconto IVA", cat: "IVA", scad: "annuale", ic: 0, hr: 0, rl: null },
    { codice: "CU", nome: "Certificazione Unica", cat: "DICHIARAZIONI", scad: "annuale", ic: 0, hr: 0, rl: null },
    { codice: "770", nome: "Modello 770", cat: "DICHIARAZIONI", scad: "annuale", ic: 0, hr: 0, rl: null },
    { codice: "DICH_IVA", nome: "Dichiarazione IVA", cat: "DICHIARAZIONI", scad: "annuale", ic: 0, hr: 0, rl: null },
    { codice: "BILANCIO", nome: "Bilancio", cat: "BILANCIO", scad: "annuale", ic: 0, hr: 0, rl: null },
    { codice: "DIR_ANNUALE", nome: "Diritto Annuale CCIAA", cat: "TRIBUTI", scad: "annuale", ic: 0, hr: 0, rl: null },
    { codice: "IRAP", nome: "IRAP", cat: "TRIBUTI", scad: "annuale", ic: 0, hr: 1, rl: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: "DICH_REDDITI", nome: "Dichiarazione Redditi", cat: "DICHIARAZIONI", scad: "annuale", ic: 0, hr: 1, rl: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: "MOD730", nome: "Modello 730", cat: "DICHIARAZIONI", scad: "annuale", ic: 0, hr: 1, rl: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: "IMU", nome: "IMU", cat: "TRIBUTI", scad: "semestrale", ic: 0, hr: 0, rl: null },
    { codice: "CONTABILITA", nome: "Contabilità / F24", cat: "TRIBUTI", scad: "mensile", ic: 1, hr: 0, rl: null },
  ];
  adempimenti.forEach((a) =>
    db.run(`INSERT INTO adempimenti (codice,nome,categoria,scadenza_tipo,is_contabilita,has_rate,rate_labels) VALUES (?,?,?,?,?,?,?)`,
      [a.codice, a.nome, a.cat, a.scad, a.ic, a.hr, a.rl])
  );

  // Clienti di esempio con tutti i dati
  const clienti = [
    {
      nome: "Mario Rossi",
      it: 1, ist: 3, col2: "ditta", col3: "ordinario", per: "mensile",
      cf: "RSSMRA80A01L219K", piva: "12345678901",
      email: "mario.rossi@email.it", tel: "333 1234567",
      indirizzo: "Via Roma 1", citta: "Udine", cap: "33100", prov: "UD",
      pec: "mario.rossi@pec.it", sdi: "XXXXXXX",
      note: "Cliente storico", referente: "Mario Rossi",
      cat: '["IVA","DICHIARAZIONI","TRIBUTI"]'
    },
    {
      nome: "Anna Bianchi",
      it: 1, ist: 1, col2: "privato", col3: "", per: "",
      cf: "BNCNNA85M41F205X", piva: null,
      email: "anna.bianchi@email.it", tel: "347 9876543",
      indirizzo: "Via Venezia 5", citta: "Trieste", cap: "34100", prov: "TS",
      pec: null, sdi: null,
      note: "", referente: "",
      cat: '["DICHIARAZIONI"]'
    },
    {
      nome: "Studio Verdi SNC",
      it: 2, ist: 11, col2: "", col3: "ordinaria", per: "mensile",
      cf: null, piva: "01234567890",
      email: "info@studioverdi.it", tel: "0432 123456",
      indirizzo: "Corso Vittorio 10", citta: "Udine", cap: "33100", prov: "UD",
      pec: "studioverdi@pec.it", sdi: "KRRH6B9",
      note: "Ref: dott. Verdi", referente: "Dott. Verdi",
      cat: '["LAVORO","PREVIDENZA","IVA","DICHIARAZIONI","BILANCIO","TRIBUTI"]'
    },
    {
      nome: "Alfa Srl",
      it: 3, ist: 13, col2: "", col3: "ordinaria", per: "trimestrale",
      cf: null, piva: "09876543210",
      email: "info@alfasrl.it", tel: "040 654321",
      indirizzo: "Zona Industriale", citta: "Trieste", cap: "34100", prov: "TS",
      pec: "alfa@pec.it", sdi: "M5UXCR1",
      note: "", referente: "Dott. Alfa",
      cat: '["LAVORO","PREVIDENZA","IVA","DICHIARAZIONI","BILANCIO","TRIBUTI"]'
    },
  ];
  clienti.forEach((c) =>
    db.run(`INSERT INTO clienti (nome,id_tipologia,id_sottotipologia,col2_value,col3_value,periodicita,codice_fiscale,partita_iva,email,telefono,indirizzo,citta,cap,provincia,pec,sdi,note,referente,categorie_attive) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [c.nome, c.it, c.ist, c.col2, c.col3, c.per, c.cf, c.piva, c.email, c.tel, c.indirizzo, c.citta, c.cap, c.prov, c.pec, c.sdi, c.note, c.referente, c.cat])
  );

  console.log("🌱 Dati seed inseriti");
}

// ─── FUNZIONI CORE ────────────────────────────────────────────────────────────
function inserisciAdempimentoSeAssente(id_cliente, adp, anno) {
  let inseriti = 0;
  if (adp.scadenza_tipo === "trimestrale") {
    for (let t = 1; t <= 4; t++) {
      const ex = queryOne(
        `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND trimestre=?`,
        [id_cliente, adp.id, anno, t]
      );
      if (!ex) {
        db.run(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,trimestre,stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, t, "da_fare"]
        );
        inseriti++;
      }
    }
  } else if (adp.scadenza_tipo === "semestrale") {
    for (let s = 1; s <= 2; s++) {
      const ex = queryOne(
        `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND semestre=?`,
        [id_cliente, adp.id, anno, s]
      );
      if (!ex) {
        db.run(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,semestre,stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, s, "da_fare"]
        );
        inseriti++;
      }
    }
  } else if (adp.scadenza_tipo === "mensile") {
    for (let m = 1; m <= 12; m++) {
      const ex = queryOne(
        `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND mese=?`,
        [id_cliente, adp.id, anno, m]
      );
      if (!ex) {
        db.run(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, m, "da_fare"]
        );
        inseriti++;
      }
    }
  } else {
    const ex = queryOne(
      `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND mese IS NULL AND trimestre IS NULL AND semestre IS NULL`,
      [id_cliente, adp.id, anno]
    );
    if (!ex) {
      db.run(
        `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,stato) VALUES (?,?,?,?)`,
        [id_cliente, adp.id, anno, "da_fare"]
      );
      inseriti++;
    }
  }
  return inseriti;
}

function generaScadenzarioInterno(id_cliente, anno) {
  const cliente = queryOne(`SELECT * FROM clienti WHERE id=?`, [id_cliente]);
  if (!cliente) throw new Error("Cliente non trovato");
  const cat = JSON.parse(cliente.categorie_attive || "[]");
  const adps = queryAll(`SELECT * FROM adempimenti WHERE attivo=1`).filter(
    (a) => a.categoria === "TUTTI" || cat.includes(a.categoria)
  );
  let tot = 0;
  adps.forEach((a) => {
    tot += inserisciAdempimentoSeAssente(id_cliente, a, anno);
  });
  saveDB();
  return tot;
}

function generaAdempimentoPerTutti(id_adp, anno) {
  const a = queryOne(`SELECT * FROM adempimenti WHERE id=?`, [id_adp]);
  if (!a) return 0;
  let tot = 0;
  queryAll(`SELECT * FROM clienti WHERE attivo=1`).forEach((c) => {
    const cat = JSON.parse(c.categorie_attive || "[]");
    if (a.categoria !== "TUTTI" && !cat.includes(a.categoria)) return;
    tot += inserisciAdempimentoSeAssente(c.id, a, anno);
  });
  saveDB();
  return tot;
}

function generaTuttiClientiAnno(anno) {
  const clienti = queryAll(`SELECT * FROM clienti WHERE attivo=1`);
  const adempimenti = queryAll(`SELECT * FROM adempimenti WHERE attivo=1`);
  let tot = 0;
  clienti.forEach((c) => {
    const cat = JSON.parse(c.categorie_attive || "[]");
    adempimenti
      .filter((a) => a.categoria === "TUTTI" || cat.includes(a.categoria))
      .forEach((a) => {
        tot += inserisciAdempimentoSeAssente(c.id, a, anno);
      });
  });
  saveDB();
  return tot;
}

function copiaScadenzarioCliente(id_cliente, anno_da, anno_a) {
  const righe = queryAll(
    `SELECT * FROM adempimenti_cliente WHERE id_cliente=? AND anno=?`,
    [id_cliente, anno_da]
  );
  let tot = 0;
  righe.forEach((r) => {
    const ex = queryOne(
      `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND COALESCE(mese,0)=COALESCE(?,0) AND COALESCE(trimestre,0)=COALESCE(?,0) AND COALESCE(semestre,0)=COALESCE(?,0)`,
      [id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre]
    );
    if (!ex) {
      try {
        db.run(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,trimestre,semestre,stato) VALUES (?,?,?,?,?,?,?)`,
          [r.id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre, "da_fare"]
        );
        tot++;
      } catch (e) {}
    }
  });
  saveDB();
  return tot;
}

function copiaTuttiClienti(anno_da, anno_a) {
  let tot = 0;
  queryAll(`SELECT id FROM clienti WHERE attivo=1`).forEach((c) => {
    tot += copiaScadenzarioCliente(c.id, anno_da, anno_a);
  });
  return tot;
}

// ─── HELPER FUNZIONI ──────────────────────────────────────────────────────────
function getClienteConDettagli(id) {
  const sql = `
    SELECT 
      c.*,
      t.codice as tipologia_codice,
      t.nome as tipologia_nome,
      t.colore as tipologia_colore,
      s.codice as sottotipologia_codice,
      s.nome as sottotipologia_nome
    FROM clienti c 
    LEFT JOIN tipologie_cliente t ON c.id_tipologia=t.id 
    LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id 
    WHERE c.id=?
  `;
  return queryOne(sql, [id]);
}

function getClientiConDettagli(filtri = {}) {
  let sql = `
    SELECT 
      c.*,
      t.codice as tipologia_codice,
      t.nome as tipologia_nome,
      t.colore as tipologia_colore,
      s.codice as sottotipologia_codice,
      s.nome as sottotipologia_nome
    FROM clienti c 
    LEFT JOIN tipologie_cliente t ON c.id_tipologia=t.id 
    LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id 
    WHERE c.attivo=1
  `;
  const params = [];
  
  if (filtri.tipologia) {
    sql += ` AND t.codice=?`;
    params.push(filtri.tipologia);
  }
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.indirizzo LIKE ? OR c.pec LIKE ? OR c.sdi LIKE ?)`;
    params.push(s, s, s, s, s, s, s, s);
  }
  sql += ` ORDER BY c.nome`;
  return queryAll(sql, params);
}

function getScadenzarioConDettagliCliente(id_cliente, anno, filtri = {}) {
  let sql = `
    SELECT 
      ac.*,
      a.codice as adempimento_codice,
      a.nome as adempimento_nome,
      a.categoria,
      a.scadenza_tipo,
      a.is_contabilita,
      a.has_rate,
      a.rate_labels,
      c.nome as cliente_nome,
      c.codice_fiscale as cliente_cf,
      c.partita_iva as cliente_piva,
      c.email as cliente_email,
      c.telefono as cliente_tel,
      c.periodicita as cliente_periodicita,
      c.col2_value as cliente_col2,
      c.col3_value as cliente_col3,
      t.codice as cliente_tipologia_codice,
      t.nome as cliente_tipologia_nome,
      t.colore as cliente_tipologia_colore,
      s.codice as cliente_sottotipologia_codice,
      s.nome as cliente_sottotipologia_nome
    FROM adempimenti_cliente ac
    JOIN adempimenti a ON ac.id_adempimento=a.id
    JOIN clienti c ON ac.id_cliente=c.id
    LEFT JOIN tipologie_cliente t ON c.id_tipologia=t.id
    LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id
    WHERE ac.id_cliente=? AND ac.anno=?
  `;
  const params = [id_cliente, anno];

  if (filtri.stato && filtri.stato !== "tutti") {
    sql += ` AND ac.stato=?`;
    params.push(filtri.stato);
  }
  if (filtri.categoria && filtri.categoria !== "tutti") {
    sql += ` AND a.categoria=?`;
    params.push(filtri.categoria);
  }
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (a.nome LIKE ? OR a.codice LIKE ?)`;
    params.push(s, s);
  }
  
  sql += ` ORDER BY a.categoria, a.nome, ac.mese, ac.trimestre, ac.semestre`;
  return queryAll(sql, params);
}

function getScadenzarioGlobale(anno, filtri = {}) {
  let sql = `
    SELECT 
      ac.*,
      a.codice as adempimento_codice,
      a.nome as adempimento_nome,
      a.categoria,
      a.scadenza_tipo,
      a.is_contabilita,
      a.has_rate,
      a.rate_labels,
      c.id as cliente_id,
      c.nome as cliente_nome,
      c.codice_fiscale as cliente_cf,
      c.partita_iva as cliente_piva,
      c.email as cliente_email,
      c.telefono as cliente_tel,
      c.periodicita as cliente_periodicita,
      c.col2_value as cliente_col2,
      c.col3_value as cliente_col3,
      t.codice as cliente_tipologia_codice,
      t.nome as cliente_tipologia_nome,
      t.colore as cliente_tipologia_colore,
      s.codice as cliente_sottotipologia_codice,
      s.nome as cliente_sottotipologia_nome
    FROM adempimenti_cliente ac
    JOIN adempimenti a ON ac.id_adempimento=a.id
    JOIN clienti c ON ac.id_cliente=c.id
    LEFT JOIN tipologie_cliente t ON c.id_tipologia=t.id
    LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id
    WHERE ac.anno=? AND c.attivo=1
  `;
  const params = [anno];

  if (filtri.stato && filtri.stato !== "tutti") {
    sql += ` AND ac.stato=?`;
    params.push(filtri.stato);
  }
  if (filtri.categoria && filtri.categoria !== "tutti") {
    sql += ` AND a.categoria=?`;
    params.push(filtri.categoria);
  }
  if (filtri.tipologia && filtri.tipologia !== "tutti") {
    sql += ` AND t.codice=?`;
    params.push(filtri.tipologia);
  }
  if (filtri.adempimento) {
    sql += ` AND a.nome=?`;
    params.push(filtri.adempimento);
  }
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR a.nome LIKE ?)`;
    params.push(s, s, s, s);
  }

  sql += ` ORDER BY a.nome, c.nome, ac.mese, ac.trimestre, ac.semestre`;
  return queryAll(sql, params);
}

function getStats(anno) {
  const totClienti = queryOne(`SELECT COUNT(*) as c FROM clienti WHERE attivo=1`).c;
  const adpStats = queryAll(`
    SELECT 
      a.codice,
      a.nome,
      a.categoria,
      COUNT(ac.id) as totale,
      SUM(CASE WHEN ac.stato='completato' THEN 1 ELSE 0 END) as completati,
      SUM(CASE WHEN ac.stato='da_fare' THEN 1 ELSE 0 END) as da_fare
    FROM adempimenti a
    LEFT JOIN adempimenti_cliente ac ON a.id=ac.id_adempimento AND ac.anno=?
    WHERE a.attivo=1
    GROUP BY a.id
    ORDER BY a.categoria, a.nome
  `, [anno]);

  const totali = queryOne(`
    SELECT 
      COUNT(*) as totale,
      SUM(CASE WHEN stato='completato' THEN 1 ELSE 0 END) as completati,
      SUM(CASE WHEN stato='da_fare' THEN 1 ELSE 0 END) as da_fare,
      SUM(CASE WHEN stato='in_corso' THEN 1 ELSE 0 END) as in_corso,
      SUM(CASE WHEN stato='n_a' THEN 1 ELSE 0 END) as na
    FROM adempimenti_cliente WHERE anno=?
  `, [anno]);

  return {
    anno,
    totClienti,
    adempimentiStats: adpStats,
    totale: totali?.totale || 0,
    completati: totali?.completati || 0,
    da_fare: totali?.da_fare || 0,
    in_corso: totali?.in_corso || 0,
    na: totali?.na || 0,
  };
}

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const n of Object.keys(ifaces))
    for (const i of ifaces[n])
      if (i.family === "IPv4" && !i.internal) return i.address;
  return "localhost";
}

// ─── API REST ─────────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    socketConnections: io.engine.clientsCount,
    dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
  });
});

// ─── SOCKET.IO ────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✅ Client connesso: ${socket.id} (totale: ${io.engine.clientsCount})`);
  socket.emit("connected", { message: "Connesso", timestamp: new Date().toISOString() });

  // ── TIPOLOGIE ──────────────────────────────────────────────────────────────
  socket.on("get:tipologie", () => {
    try {
      const tip = queryAll(`SELECT * FROM tipologie_cliente ORDER BY id`);
      const sub = queryAll(`SELECT * FROM sottotipologie ORDER BY id_tipologia, ordine, id`);
      tip.forEach((t) => {
        t.sottotipologie = sub.filter((s) => s.id_tipologia === t.id);
      });
      socket.emit("res:tipologie", { success: true, data: tip });
    } catch (e) {
      socket.emit("res:tipologie", { success: false, error: e.message });
    }
  });

  // ── REGIMI ──────────────────────────────────────────────────────────────
  socket.on("get:regimi", () => {
    try {
      const regimi = queryAll(`SELECT * FROM regimi_contabili ORDER BY id`);
      socket.emit("res:regimi", { success: true, data: regimi });
    } catch (e) {
      socket.emit("res:regimi", { success: false, error: e.message });
    }
  });

  // ── PERIODICITA ──────────────────────────────────────────────────────────────
  socket.on("get:periodicita", () => {
    try {
      const per = queryAll(`SELECT * FROM periodicita ORDER BY id`);
      socket.emit("res:periodicita", { success: true, data: per });
    } catch (e) {
      socket.emit("res:periodicita", { success: false, error: e.message });
    }
  });

  // ── CLIENTI ────────────────────────────────────────────────────────────────
  socket.on("get:clienti", (filtri = {}) => {
    try {
      const data = getClientiConDettagli(filtri);
      socket.emit("res:clienti", { success: true, data });
    } catch (e) {
      socket.emit("res:clienti", { success: false, error: e.message });
    }
  });

  socket.on("get:cliente", ({ id }) => {
    try {
      const c = getClienteConDettagli(id);
      socket.emit("res:cliente", { success: true, data: c });
    } catch (e) {
      socket.emit("res:cliente", { success: false, error: e.message });
    }
  });

  socket.on("create:cliente", (data) => {
    try {
      const cat = JSON.stringify(data.categorie_attive || []);
      runQuery(
        `INSERT INTO clienti (nome,id_tipologia,id_sottotipologia,col2_value,col3_value,periodicita,codice_fiscale,partita_iva,email,telefono,indirizzo,citta,cap,provincia,pec,sdi,iban,note,referente,categorie_attive) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          data.nome,
          data.id_tipologia,
          data.id_sottotipologia || null,
          data.col2_value || null,
          data.col3_value || null,
          data.periodicita || null,
          data.codice_fiscale || null,
          data.partita_iva || null,
          data.email || null,
          data.telefono || null,
          data.indirizzo || null,
          data.citta || null,
          data.cap || null,
          data.provincia || null,
          data.pec || null,
          data.sdi || null,
          data.iban || null,
          data.note || null,
          data.referente || null,
          cat,
        ]
      );
      const newId = queryOne(`SELECT last_insert_rowid() as id`).id;
      io.emit("broadcast:clienti_updated");
      socket.emit("res:create:cliente", { success: true, id: newId });
      socket.emit("notify", { type: "success", msg: "Cliente creato con successo" });
    } catch (e) {
      socket.emit("res:create:cliente", { success: false, error: e.message });
      socket.emit("notify", { type: "error", msg: e.message });
    }
  });

  socket.on("update:cliente", (data) => {
    try {
      const cat = JSON.stringify(data.categorie_attive || []);
      runQuery(
        `UPDATE clienti SET nome=?,id_tipologia=?,id_sottotipologia=?,col2_value=?,col3_value=?,periodicita=?,codice_fiscale=?,partita_iva=?,email=?,telefono=?,indirizzo=?,citta=?,cap=?,provincia=?,pec=?,sdi=?,iban=?,note=?,referente=?,categorie_attive=?,updated_at=datetime('now') WHERE id=?`,
        [
          data.nome,
          data.id_tipologia,
          data.id_sottotipologia || null,
          data.col2_value || null,
          data.col3_value || null,
          data.periodicita || null,
          data.codice_fiscale || null,
          data.partita_iva || null,
          data.email || null,
          data.telefono || null,
          data.indirizzo || null,
          data.citta || null,
          data.cap || null,
          data.provincia || null,
          data.pec || null,
          data.sdi || null,
          data.iban || null,
          data.note || null,
          data.referente || null,
          cat,
          data.id,
        ]
      );
      io.emit("broadcast:clienti_updated");
      socket.emit("res:update:cliente", { success: true });
      socket.emit("notify", { type: "success", msg: "Cliente aggiornato" });
    } catch (e) {
      socket.emit("res:update:cliente", { success: false, error: e.message });
      socket.emit("notify", { type: "error", msg: e.message });
    }
  });

  socket.on("delete:cliente", ({ id }) => {
    try {
      runQuery(`UPDATE clienti SET attivo=0 WHERE id=?`, [id]);
      io.emit("broadcast:clienti_updated");
      socket.emit("res:delete:cliente", { success: true });
      socket.emit("notify", { type: "success", msg: "Cliente eliminato" });
    } catch (e) {
      socket.emit("res:delete:cliente", { success: false, error: e.message });
    }
  });

  // ── ADEMPIMENTI ────────────────────────────────────────────────────────────
  socket.on("get:adempimenti", () => {
    try {
      const data = queryAll(`SELECT * FROM adempimenti WHERE attivo=1 ORDER BY categoria, nome`);
      socket.emit("res:adempimenti", { success: true, data });
    } catch (e) {
      socket.emit("res:adempimenti", { success: false, error: e.message });
    }
  });

  socket.on("create:adempimento", (data) => {
    try {
      const rl = data.rate_labels ? JSON.stringify(data.rate_labels) : null;
      runQuery(
        `INSERT INTO adempimenti (codice,nome,descrizione,categoria,scadenza_tipo,is_contabilita,has_rate,rate_labels) VALUES (?,?,?,?,?,?,?,?)`,
        [data.codice, data.nome, data.descrizione || null, data.categoria, data.scadenza_tipo, data.is_contabilita || 0, data.has_rate || 0, rl]
      );
      const newId = queryOne(`SELECT last_insert_rowid() as id`).id;
      
      // Genera per tutti i clienti con la categoria
      const anno = new Date().getFullYear();
      const tot = generaAdempimentoPerTutti(newId, anno);
      
      io.emit("broadcast:adempimenti_updated");
      io.emit("broadcast:scadenzario_updated", { anno });
      socket.emit("res:create:adempimento", { success: true, id: newId, generati: tot });
      socket.emit("notify", { type: "success", msg: `Adempimento creato e generato per ${tot} clienti` });
    } catch (e) {
      socket.emit("res:create:adempimento", { success: false, error: e.message });
    }
  });

  socket.on("update:adempimento", (data) => {
    try {
      const rl = data.rate_labels ? JSON.stringify(data.rate_labels) : null;
      runQuery(
        `UPDATE adempimenti SET codice=?,nome=?,descrizione=?,categoria=?,scadenza_tipo=?,is_contabilita=?,has_rate=?,rate_labels=? WHERE id=?`,
        [data.codice, data.nome, data.descrizione || null, data.categoria, data.scadenza_tipo, data.is_contabilita || 0, data.has_rate || 0, rl, data.id]
      );
      io.emit("broadcast:adempimenti_updated");
      socket.emit("res:update:adempimento", { success: true });
      socket.emit("notify", { type: "success", msg: "Adempimento aggiornato" });
    } catch (e) {
      socket.emit("res:update:adempimento", { success: false, error: e.message });
    }
  });

  socket.on("delete:adempimento", ({ id }) => {
    try {
      runQuery(`UPDATE adempimenti SET attivo=0 WHERE id=?`, [id]);
      io.emit("broadcast:adempimenti_updated");
      socket.emit("res:delete:adempimento", { success: true });
      socket.emit("notify", { type: "success", msg: "Adempimento eliminato" });
    } catch (e) {
      socket.emit("res:delete:adempimento", { success: false, error: e.message });
    }
  });

  // ── SCADENZARIO CLIENTE ────────────────────────────────────────────────────
  socket.on("get:scadenzario", ({ id_cliente, anno, filtri = {} }) => {
    try {
      const data = getScadenzarioConDettagliCliente(id_cliente, anno, filtri);
      socket.emit("res:scadenzario", { success: true, data });
    } catch (e) {
      socket.emit("res:scadenzario", { success: false, error: e.message });
    }
  });

  socket.on("genera:scadenzario", ({ id_cliente, anno }) => {
    try {
      const tot = generaScadenzarioInterno(id_cliente, anno);
      io.emit("broadcast:scadenzario_updated", { id_cliente, anno });
      io.emit("broadcast:stats_updated", { anno });
      socket.emit("res:genera:scadenzario", { success: true, inseriti: tot });
      socket.emit("notify", { type: "success", msg: `Scadenzario generato: ${tot} adempimenti` });
    } catch (e) {
      socket.emit("res:genera:scadenzario", { success: false, error: e.message });
    }
  });

  socket.on("genera:tutti", ({ anno }) => {
    try {
      const tot = generaTuttiClientiAnno(anno);
      io.emit("broadcast:scadenzario_updated", { anno });
      io.emit("broadcast:globale_updated", { anno });
      io.emit("broadcast:stats_updated", { anno });
      socket.emit("res:genera:tutti", { success: true, inseriti: tot });
      socket.emit("notify", { type: "success", msg: `Generati ${tot} adempimenti per tutti i clienti` });
    } catch (e) {
      socket.emit("res:genera:tutti", { success: false, error: e.message });
    }
  });

  socket.on("copia:scadenzario", ({ id_cliente, anno_da, anno_a }) => {
    try {
      const tot = copiaScadenzarioCliente(id_cliente, anno_da, anno_a);
      io.emit("broadcast:scadenzario_updated", { id_cliente, anno: anno_a });
      socket.emit("res:copia:scadenzario", { success: true, copiati: tot });
      socket.emit("notify", { type: "success", msg: `Copiati ${tot} adempimenti da ${anno_da} a ${anno_a}` });
    } catch (e) {
      socket.emit("res:copia:scadenzario", { success: false, error: e.message });
    }
  });

  socket.on("copia:tutti", ({ anno_da, anno_a }) => {
    try {
      const tot = copiaTuttiClienti(anno_da, anno_a);
      io.emit("broadcast:scadenzario_updated", { anno: anno_a });
      io.emit("broadcast:globale_updated", { anno: anno_a });
      socket.emit("res:copia:tutti", { success: true, copiati: tot });
      socket.emit("notify", { type: "success", msg: `Copiati ${tot} adempimenti per tutti i clienti` });
    } catch (e) {
      socket.emit("res:copia:tutti", { success: false, error: e.message });
    }
  });

  // ── AGGIORNA STATO ADEMPIMENTO ─────────────────────────────────────────────
  socket.on("update:adempimento_stato", (data) => {
    try {
      runQuery(
        `UPDATE adempimenti_cliente SET stato=?,data_scadenza=?,data_completamento=?,note=?,importo=?,importo_saldo=?,importo_acconto1=?,importo_acconto2=?,importo_iva=?,importo_contabilita=? WHERE id=?`,
        [
          data.stato,
          data.data_scadenza || null,
          data.data_completamento || null,
          data.note || null,
          data.importo || null,
          data.importo_saldo || null,
          data.importo_acconto1 || null,
          data.importo_acconto2 || null,
          data.importo_iva || null,
          data.importo_contabilita || null,
          data.id,
        ]
      );
      const row = queryOne(`SELECT id_cliente, anno FROM adempimenti_cliente WHERE id=?`, [data.id]);
      io.emit("broadcast:scadenzario_updated", { id_cliente: row?.id_cliente, anno: row?.anno });
      io.emit("broadcast:globale_updated", { anno: row?.anno });
      io.emit("broadcast:stats_updated", { anno: row?.anno });
      socket.emit("res:update:adempimento_stato", { success: true });
      socket.emit("notify", { type: "success", msg: "Adempimento aggiornato" });
    } catch (e) {
      socket.emit("res:update:adempimento_stato", { success: false, error: e.message });
    }
  });

  socket.on("delete:adempimento_cliente", ({ id }) => {
    try {
      const row = queryOne(`SELECT id_cliente, anno FROM adempimenti_cliente WHERE id=?`, [id]);
      runQuery(`DELETE FROM adempimenti_cliente WHERE id=?`, [id]);
      io.emit("broadcast:scadenzario_updated", { id_cliente: row?.id_cliente, anno: row?.anno });
      io.emit("broadcast:globale_updated", { anno: row?.anno });
      socket.emit("res:delete:adempimento_cliente", { success: true });
      socket.emit("notify", { type: "success", msg: "Adempimento rimosso dallo scadenzario" });
    } catch (e) {
      socket.emit("res:delete:adempimento_cliente", { success: false, error: e.message });
    }
  });

  socket.on("add:adempimento_cliente", (data) => {
    try {
      const adp = queryOne(`SELECT * FROM adempimenti WHERE id=?`, [data.id_adempimento]);
      if (!adp) throw new Error("Adempimento non trovato");
      
      const insertData = {
        id_cliente: data.id_cliente,
        id_adempimento: data.id_adempimento,
        anno: data.anno,
        mese: data.mese || null,
        trimestre: data.trimestre || null,
        semestre: data.semestre || null,
        stato: "da_fare",
      };
      
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,trimestre,semestre,stato) VALUES (?,?,?,?,?,?,?)`,
        [insertData.id_cliente, insertData.id_adempimento, insertData.anno, insertData.mese, insertData.trimestre, insertData.semestre, insertData.stato]
      );
      
      io.emit("broadcast:scadenzario_updated", { id_cliente: data.id_cliente, anno: data.anno });
      socket.emit("res:add:adempimento_cliente", { success: true });
      socket.emit("notify", { type: "success", msg: "Adempimento aggiunto" });
    } catch (e) {
      socket.emit("res:add:adempimento_cliente", { success: false, error: e.message });
    }
  });

  // ── SCADENZARIO GLOBALE ────────────────────────────────────────────────────
  socket.on("get:scadenzario_globale", ({ anno, filtri = {} }) => {
    try {
      const data = getScadenzarioGlobale(anno, filtri);
      socket.emit("res:scadenzario_globale", { success: true, data });
    } catch (e) {
      socket.emit("res:scadenzario_globale", { success: false, error: e.message });
    }
  });

  // ── STATISTICHE ────────────────────────────────────────────────────────────
  socket.on("get:stats", ({ anno }) => {
    try {
      const data = getStats(anno);
      socket.emit("res:stats", { success: true, data });
    } catch (e) {
      socket.emit("res:stats", { success: false, error: e.message });
    }
  });

  socket.on("disconnect", () => {
    console.log(`❌ Client disconnesso: ${socket.id} (rimasti: ${io.engine.clientsCount - 1})`);
  });
});

// ─── AVVIO SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

initDB().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🚀 Server avviato!`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://${getLocalIP()}:${PORT}`);
    console.log(`   DB Path: ${DB_PATH}\n`);
  });
});
