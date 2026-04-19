const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");
const os = require("os");

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
  [
    `ALTER TABLE sottotipologie ADD COLUMN is_separator INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti ADD COLUMN is_contabilita INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti ADD COLUMN has_rate INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti ADD COLUMN rate_labels TEXT`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_saldo REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_acconto1 REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_acconto2 REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_iva REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_contabilita REAL`,
  ].forEach((sql) => {
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
  db.run(
    `CREATE TABLE IF NOT EXISTS tipologie_cliente (id INTEGER PRIMARY KEY AUTOINCREMENT, codice TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, descrizione TEXT)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS sottotipologie (id INTEGER PRIMARY KEY AUTOINCREMENT, id_tipologia INTEGER NOT NULL, codice TEXT NOT NULL, nome TEXT NOT NULL, is_separator INTEGER DEFAULT 0, FOREIGN KEY (id_tipologia) REFERENCES tipologie_cliente(id))`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS clienti (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, id_tipologia INTEGER NOT NULL, id_sottotipologia INTEGER, codice_fiscale TEXT, partita_iva TEXT, email TEXT, telefono TEXT, indirizzo TEXT, note TEXT, categorie_attive TEXT DEFAULT '["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]', attivo INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (id_tipologia) REFERENCES tipologie_cliente(id), FOREIGN KEY (id_sottotipologia) REFERENCES sottotipologie(id))`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS adempimenti (id INTEGER PRIMARY KEY AUTOINCREMENT, codice TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, descrizione TEXT, categoria TEXT, scadenza_tipo TEXT CHECK(scadenza_tipo IN ('annuale','semestrale','trimestrale','mensile')), is_contabilita INTEGER DEFAULT 0, has_rate INTEGER DEFAULT 0, rate_labels TEXT, attivo INTEGER DEFAULT 1)`,
  );
  db.run(
    `CREATE TABLE IF NOT EXISTS adempimenti_cliente (id INTEGER PRIMARY KEY AUTOINCREMENT, id_cliente INTEGER NOT NULL, id_adempimento INTEGER NOT NULL, anno INTEGER NOT NULL, mese INTEGER CHECK(mese BETWEEN 1 AND 12), trimestre INTEGER CHECK(trimestre BETWEEN 1 AND 4), semestre INTEGER CHECK(semestre BETWEEN 1 AND 2), stato TEXT DEFAULT 'da_fare', data_scadenza TEXT, data_completamento TEXT, note TEXT, importo REAL, importo_saldo REAL, importo_acconto1 REAL, importo_acconto2 REAL, importo_iva REAL, importo_contabilita REAL, UNIQUE(id_cliente, id_adempimento, anno, mese, trimestre, semestre), FOREIGN KEY (id_cliente) REFERENCES clienti(id), FOREIGN KEY (id_adempimento) REFERENCES adempimenti(id))`,
  );
  console.log("📐 Schema creato");
}

function seedData() {
  [
    {
      codice: "PF",
      nome: "Persona Fisica",
      descrizione: "Contribuente persona fisica",
    },
    { codice: "SP", nome: "Società di Persone", descrizione: "SNC, SAS, SS" },
    {
      codice: "SC",
      nome: "Società di Capitali",
      descrizione: "SRL, SPA, SAPA",
    },
    {
      codice: "ASS",
      nome: "Associazione",
      descrizione: "Associazioni e enti non commerciali",
    },
  ].forEach((t) =>
    db.run(
      `INSERT INTO tipologie_cliente (codice,nome,descrizione) VALUES (?,?,?)`,
      [t.codice, t.nome, t.descrizione],
    ),
  );

  [
    { it: 1, c: "PF_PRIV", n: "Privato", sep: 0 },
    { it: 1, c: "PF_DITTA_SEP", n: "— Ditta Individuale —", sep: 1 },
    { it: 1, c: "PF_DITTA_ORD", n: "Ditta Ind. – Ordinario", sep: 0 },
    { it: 1, c: "PF_DITTA_SEP2", n: "Ditta Ind. – Semplificato", sep: 0 },
    { it: 1, c: "PF_DITTA_FOR", n: "Ditta Ind. – Forfettario", sep: 0 },
    { it: 1, c: "PF_SOCIO", n: "Socio", sep: 0 },
    { it: 1, c: "PF_PROF_SEP", n: "— Professionista —", sep: 1 },
    { it: 1, c: "PF_PROF_ORD", n: "Professionista – Ordinario", sep: 0 },
    { it: 1, c: "PF_PROF_SEM", n: "Professionista – Sempl.", sep: 0 },
    { it: 1, c: "PF_PROF_FOR", n: "Professionista – Forf.", sep: 0 },
    { it: 2, c: "SP_ORD", n: "SP – Ordinaria", sep: 0 },
    { it: 2, c: "SP_SEMP", n: "SP – Semplificata", sep: 0 },
    { it: 3, c: "SC_ORD", n: "SC – Ordinaria", sep: 0 },
    { it: 3, c: "SC_SEMP", n: "SC – Semplificata", sep: 0 },
    { it: 4, c: "ASS_ORD", n: "ASS – Ordinaria", sep: 0 },
    { it: 4, c: "ASS_SEMP", n: "ASS – Semplificata", sep: 0 },
  ].forEach((s) =>
    db.run(
      `INSERT INTO sottotipologie (id_tipologia,codice,nome,is_separator) VALUES (?,?,?,?)`,
      [s.it, s.c, s.n, s.sep],
    ),
  );

  [
    {
      codice: "TASSA_NID",
      nome: "Tassa NID",
      cat: "TUTTI",
      scad: "annuale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "INAIL",
      nome: "INAIL",
      cat: "LAVORO",
      scad: "annuale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "INPS_TRIM",
      nome: "INPS Trimestrale",
      cat: "PREVIDENZA",
      scad: "trimestrale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "LIPE",
      nome: "LIPE",
      cat: "IVA",
      scad: "trimestrale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "ACCONTO_IVA",
      nome: "Acconto IVA",
      cat: "IVA",
      scad: "annuale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "CU",
      nome: "Certificazione Unica",
      cat: "DICHIARAZIONI",
      scad: "annuale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "770",
      nome: "Modello 770",
      cat: "DICHIARAZIONI",
      scad: "annuale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "DICH_IVA",
      nome: "Dichiarazione IVA",
      cat: "DICHIARAZIONI",
      scad: "annuale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "BILANCIO",
      nome: "Bilancio",
      cat: "BILANCIO",
      scad: "annuale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "DIR_ANNUALE",
      nome: "Diritto Annuale CCIAA",
      cat: "TRIBUTI",
      scad: "annuale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "IRAP",
      nome: "IRAP",
      cat: "TRIBUTI",
      scad: "annuale",
      ic: 0,
      hr: 1,
      rl: '["Saldo","1° Acconto","2° Acconto"]',
    },
    {
      codice: "DICH_REDDITI",
      nome: "Dichiarazione Redditi",
      cat: "DICHIARAZIONI",
      scad: "annuale",
      ic: 0,
      hr: 1,
      rl: '["Saldo","1° Acconto","2° Acconto"]',
    },
    {
      codice: "MOD730",
      nome: "Modello 730",
      cat: "DICHIARAZIONI",
      scad: "annuale",
      ic: 0,
      hr: 1,
      rl: '["Saldo","1° Acconto","2° Acconto"]',
    },
    {
      codice: "IMU",
      nome: "IMU",
      cat: "TRIBUTI",
      scad: "semestrale",
      ic: 0,
      hr: 0,
      rl: null,
    },
    {
      codice: "CONTABILITA",
      nome: "Contabilità / F24",
      cat: "TRIBUTI",
      scad: "mensile",
      ic: 1,
      hr: 0,
      rl: null,
    },
  ].forEach((a) =>
    db.run(
      `INSERT INTO adempimenti (codice,nome,categoria,scadenza_tipo,is_contabilita,has_rate,rate_labels) VALUES (?,?,?,?,?,?,?)`,
      [a.codice, a.nome, a.cat, a.scad, a.ic, a.hr, a.rl],
    ),
  );

  [
    {
      nome: "Mario Rossi",
      it: 1,
      ist: 3,
      cf: "RSSMRA80A01L219K",
      piva: null,
      email: "mario.rossi@email.it",
      tel: "333 1234567",
      indirizzo: "Via Roma 1, Udine",
      note: "Cliente storico",
      cat: '["IVA","DICHIARAZIONI","TRIBUTI"]',
    },
    {
      nome: "Anna Bianchi",
      it: 1,
      ist: 1,
      cf: "BNCNNA85M41F205X",
      piva: null,
      email: "anna.bianchi@email.it",
      tel: "347 9876543",
      indirizzo: "Via Venezia 5, Trieste",
      note: "",
      cat: '["DICHIARAZIONI"]',
    },
    {
      nome: "Studio Verdi SNC",
      it: 2,
      ist: 11,
      cf: null,
      piva: "01234567890",
      email: "info@studioverdi.it",
      tel: "0432 123456",
      indirizzo: "Corso Vittorio 10, Udine",
      note: "Ref: dott. Verdi",
      cat: '["LAVORO","PREVIDENZA","IVA","DICHIARAZIONI","BILANCIO","TRIBUTI"]',
    },
    {
      nome: "Alfa Srl",
      it: 3,
      ist: 13,
      cf: null,
      piva: "09876543210",
      email: "info@alfasrl.it",
      tel: "040 654321",
      indirizzo: "Zona Industriale, Trieste",
      note: "",
      cat: '["LAVORO","PREVIDENZA","IVA","DICHIARAZIONI","BILANCIO","TRIBUTI"]',
    },
  ].forEach((c) =>
    db.run(
      `INSERT INTO clienti (nome,id_tipologia,id_sottotipologia,codice_fiscale,partita_iva,email,telefono,indirizzo,note,categorie_attive) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        c.nome,
        c.it,
        c.ist,
        c.cf,
        c.piva,
        c.email,
        c.tel,
        c.indirizzo,
        c.note,
        c.cat,
      ],
    ),
  );

  console.log("🌱 Dati seed inseriti");
}

// ─── GENERAZIONE SCADENZARIO ─────────────────────────────────────────────
function generaScadenzarioInterno(id_cliente, anno) {
  const cliente = queryOne(`SELECT * FROM clienti WHERE id=?`, [id_cliente]);
  if (!cliente) throw new Error("Cliente non trovato");
  const cat = JSON.parse(cliente.categorie_attive || "[]");
  const adps = queryAll(`SELECT * FROM adempimenti WHERE attivo=1`).filter(
    (a) => a.categoria === "TUTTI" || cat.includes(a.categoria),
  );
  runQuery(
    `DELETE FROM adempimenti_cliente WHERE id_cliente=? AND anno=? AND stato='da_fare'`,
    [id_cliente, anno],
  );
  let tot = 0;
  adps.forEach((a) => {
    if (a.scadenza_tipo === "trimestrale") {
      for (let t = 1; t <= 4; t++) {
        const ex = queryOne(
          `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND trimestre=?`,
          [id_cliente, a.id, anno, t],
        );
        if (!ex) {
          runQuery(
            `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,trimestre,stato) VALUES (?,?,?,?,?)`,
            [id_cliente, a.id, anno, t, "da_fare"],
          );
          tot++;
        }
      }
    } else if (a.scadenza_tipo === "semestrale") {
      for (let s = 1; s <= 2; s++) {
        const ex = queryOne(
          `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND semestre=?`,
          [id_cliente, a.id, anno, s],
        );
        if (!ex) {
          runQuery(
            `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,semestre,stato) VALUES (?,?,?,?,?)`,
            [id_cliente, a.id, anno, s, "da_fare"],
          );
          tot++;
        }
      }
    } else if (a.scadenza_tipo === "mensile") {
      for (let m = 1; m <= 12; m++) {
        const ex = queryOne(
          `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND mese=?`,
          [id_cliente, a.id, anno, m],
        );
        if (!ex) {
          runQuery(
            `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,stato) VALUES (?,?,?,?,?)`,
            [id_cliente, a.id, anno, m, "da_fare"],
          );
          tot++;
        }
      }
    } else {
      const ex = queryOne(
        `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND mese IS NULL AND trimestre IS NULL AND semestre IS NULL`,
        [id_cliente, a.id, anno],
      );
      if (!ex) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,stato) VALUES (?,?,?,?)`,
          [id_cliente, a.id, anno, "da_fare"],
        );
        tot++;
      }
    }
  });
  return tot;
}

function generaAdempimentoPerTutti(id_adp, anno) {
  const a = queryOne(`SELECT * FROM adempimenti WHERE id=?`, [id_adp]);
  if (!a) return 0;
  let tot = 0;
  queryAll(`SELECT * FROM clienti WHERE attivo=1`).forEach((c) => {
    const cat = JSON.parse(c.categorie_attive || "[]");
    if (a.categoria !== "TUTTI" && !cat.includes(a.categoria)) return;
    if (a.scadenza_tipo === "trimestrale") {
      for (let t = 1; t <= 4; t++) {
        try {
          runQuery(
            `INSERT OR IGNORE INTO adempimenti_cliente (id_cliente,id_adempimento,anno,trimestre,stato) VALUES (?,?,?,?,?)`,
            [c.id, id_adp, anno, t, "da_fare"],
          );
          tot++;
        } catch (e) {}
      }
    } else if (a.scadenza_tipo === "semestrale") {
      for (let s = 1; s <= 2; s++) {
        try {
          runQuery(
            `INSERT OR IGNORE INTO adempimenti_cliente (id_cliente,id_adempimento,anno,semestre,stato) VALUES (?,?,?,?,?)`,
            [c.id, id_adp, anno, s, "da_fare"],
          );
          tot++;
        } catch (e) {}
      }
    } else if (a.scadenza_tipo === "mensile") {
      for (let m = 1; m <= 12; m++) {
        try {
          runQuery(
            `INSERT OR IGNORE INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,stato) VALUES (?,?,?,?,?)`,
            [c.id, id_adp, anno, m, "da_fare"],
          );
          tot++;
        } catch (e) {}
      }
    } else {
      try {
        runQuery(
          `INSERT OR IGNORE INTO adempimenti_cliente (id_cliente,id_adempimento,anno,stato) VALUES (?,?,?,?)`,
          [c.id, id_adp, anno, "da_fare"],
        );
        tot++;
      } catch (e) {}
    }
  });
  return tot;
}

function generaTuttiClientiAnno(anno) {
  let tot = 0;
  queryAll(`SELECT * FROM clienti WHERE attivo=1`).forEach((c) => {
    try {
      tot += generaScadenzarioInterno(c.id, anno);
    } catch (e) {}
  });
  return tot;
}

function copiaTuttiClienti(anno_da, anno_a) {
  let tot = 0;
  queryAll(`SELECT * FROM clienti WHERE attivo=1`).forEach((c) => {
    const righe = queryAll(
      `SELECT * FROM adempimenti_cliente WHERE id_cliente=? AND anno=?`,
      [c.id, anno_da],
    );
    runQuery(
      `DELETE FROM adempimenti_cliente WHERE id_cliente=? AND anno=? AND stato='da_fare'`,
      [c.id, anno_a],
    );
    righe.forEach((r) => {
      try {
        runQuery(
          `INSERT OR IGNORE INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,trimestre,semestre,stato) VALUES (?,?,?,?,?,?,?)`,
          [
            r.id_cliente,
            r.id_adempimento,
            anno_a,
            r.mese,
            r.trimestre,
            r.semestre,
            "da_fare",
          ],
        );
        tot++;
      } catch (e) {}
    });
  });
  return tot;
}

function getLocalIP() {
  const ifaces = os.networkInterfaces();
  for (const n of Object.keys(ifaces))
    for (const i of ifaces[n])
      if (i.family === "IPv4" && !i.internal) return i.address;
  return "localhost";
}
async function getPublicIP() {
  try {
    const https = require("https");
    return new Promise((res, rej) => {
      https
        .get("https://api.ipify.org?format=json", (r) => {
          let d = "";
          r.on("data", (c) => (d += c));
          r.on("end", () => {
            try {
              res(JSON.parse(d).ip);
            } catch (e) {
              rej(e);
            }
          });
        })
        .on("error", rej);
    });
  } catch {
    return null;
  }
}

app.get("/api/health", async (req, res) => {
  const publicIP = await getPublicIP();
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    socketConnections: io.engine.clientsCount,
    publicIP,
    port: PORT,
    dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
  });
});

// ─── SOCKET.IO ───────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`✅ Client connesso: ${socket.id}`);
  socket.emit("connected", {
    message: "Connesso",
    timestamp: new Date().toISOString(),
  });

  socket.on("get:tipologie", () => {
    try {
      const tip = queryAll(`SELECT * FROM tipologie_cliente ORDER BY id`);
      const sub = queryAll(
        `SELECT * FROM sottotipologie ORDER BY id_tipologia,id`,
      );
      tip.forEach((t) => {
        t.sottotipologie = sub.filter((s) => s.id_tipologia === t.id);
      });
      socket.emit("res:tipologie", { success: true, data: tip });
    } catch (e) {
      socket.emit("res:tipologie", { success: false, error: e.message });
    }
  });

  socket.on("get:clienti", (filtri = {}) => {
    try {
      let sql = `SELECT c.*,t.codice as tipologia_codice,t.nome as tipologia_nome,s.codice as sottotipologia_codice,s.nome as sottotipologia_nome FROM clienti c LEFT JOIN tipologie_cliente t ON c.id_tipologia=t.id LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id WHERE c.attivo=1`;
      const p = [];
      if (filtri.tipologia) {
        sql += ` AND t.codice=?`;
        p.push(filtri.tipologia);
      }
      if (filtri.search?.trim()) {
        const s = `%${filtri.search.trim()}%`;
        sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.indirizzo LIKE ?)`;
        p.push(s, s, s, s, s, s);
      }
      sql += ` ORDER BY c.nome`;
      socket.emit("res:clienti", { success: true, data: queryAll(sql, p) });
    } catch (e) {
      socket.emit("res:clienti", { success: false, error: e.message });
    }
  });

  socket.on("get:cliente", ({ id }) => {
    try {
      const c = queryOne(
        `SELECT c.*,t.codice as tipologia_codice,t.nome as tipologia_nome,s.codice as sottotipologia_codice,s.nome as sottotipologia_nome FROM clienti c LEFT JOIN tipologie_cliente t ON c.id_tipologia=t.id LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id WHERE c.id=?`,
        [id],
      );
      socket.emit("res:cliente", { success: true, data: c });
    } catch (e) {
      socket.emit("res:cliente", { success: false, error: e.message });
    }
  });

  socket.on("create:cliente", (data) => {
    try {
      const cat = JSON.stringify(data.categorie_attive || []);
      runQuery(
        `INSERT INTO clienti (nome,id_tipologia,id_sottotipologia,codice_fiscale,partita_iva,email,telefono,indirizzo,note,categorie_attive) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          data.nome,
          data.id_tipologia,
          data.id_sottotipologia || null,
          data.codice_fiscale || null,
          data.partita_iva || null,
          data.email || null,
          data.telefono || null,
          data.indirizzo || null,
          data.note || null,
          cat,
        ],
      );
      const newId = queryOne(`SELECT last_insert_rowid() as id`).id;
      const anno = new Date().getFullYear();
      const n = generaScadenzarioInterno(newId, anno);
      io.emit("notify", {
        type: "success",
        msg: `✅ Cliente "${data.nome}" creato con ${n} adempimenti`,
      });
      socket.emit("res:create:cliente", { success: true, id: newId });
    } catch (e) {
      socket.emit("res:create:cliente", { success: false, error: e.message });
    }
  });

  socket.on("update:cliente", (data) => {
    try {
      const cat = JSON.stringify(data.categorie_attive || []);
      runQuery(
        `UPDATE clienti SET nome=?,id_tipologia=?,id_sottotipologia=?,codice_fiscale=?,partita_iva=?,email=?,telefono=?,indirizzo=?,note=?,categorie_attive=? WHERE id=?`,
        [
          data.nome,
          data.id_tipologia,
          data.id_sottotipologia || null,
          data.codice_fiscale || null,
          data.partita_iva || null,
          data.email || null,
          data.telefono || null,
          data.indirizzo || null,
          data.note || null,
          cat,
          data.id,
        ],
      );
      const ac = new Date().getFullYear();
      let tot = 0;
      for (let y = ac; y <= ac + 1; y++)
        tot += generaScadenzarioInterno(data.id, y);
      io.emit("notify", {
        type: "success",
        msg: `✅ Cliente aggiornato (${tot} adempimenti)`,
      });
      socket.emit("res:update:cliente", { success: true });
    } catch (e) {
      socket.emit("res:update:cliente", { success: false, error: e.message });
    }
  });

  socket.on("delete:cliente", ({ id }) => {
    try {
      runQuery(`UPDATE clienti SET attivo=0 WHERE id=?`, [id]);
      io.emit("notify", { type: "info", msg: `🗑️ Cliente eliminato` });
      socket.emit("res:delete:cliente", { success: true });
    } catch (e) {
      socket.emit("res:delete:cliente", { success: false, error: e.message });
    }
  });

  socket.on("get:adempimenti", (filtri = {}) => {
    try {
      let sql = `SELECT * FROM adempimenti WHERE attivo=1`;
      const p = [];
      if (filtri.search?.trim()) {
        const s = `%${filtri.search.trim()}%`;
        sql += ` AND (codice LIKE ? OR nome LIKE ? OR descrizione LIKE ? OR categoria LIKE ?)`;
        p.push(s, s, s, s);
      }
      sql += ` ORDER BY categoria,codice`;
      socket.emit("res:adempimenti", { success: true, data: queryAll(sql, p) });
    } catch (e) {
      socket.emit("res:adempimenti", { success: false, error: e.message });
    }
  });

  socket.on("create:adempimento", (data) => {
    try {
      if (queryOne(`SELECT id FROM adempimenti WHERE codice=?`, [data.codice]))
        throw new Error(`Codice "${data.codice}" già esistente`);
      const rl =
        data.has_rate && data.rate_labels
          ? JSON.stringify(data.rate_labels)
          : null;
      runQuery(
        `INSERT INTO adempimenti (codice,nome,descrizione,categoria,scadenza_tipo,is_contabilita,has_rate,rate_labels) VALUES (?,?,?,?,?,?,?,?)`,
        [
          data.codice,
          data.nome,
          data.descrizione || null,
          data.categoria,
          data.scadenza_tipo,
          data.is_contabilita ? 1 : 0,
          data.has_rate ? 1 : 0,
          rl,
        ],
      );
      const newId = queryOne(`SELECT last_insert_rowid() as id`).id;
      const ac = new Date().getFullYear();
      let tot = 0;
      for (let y = ac; y <= ac + 1; y++)
        tot += generaAdempimentoPerTutti(newId, y);
      io.emit("notify", {
        type: "success",
        msg: `✅ Adempimento "${data.nome}" creato (${tot} righe)`,
      });
      socket.emit("res:create:adempimento", { success: true });
    } catch (e) {
      socket.emit("res:create:adempimento", {
        success: false,
        error: e.message,
      });
    }
  });

  socket.on("update:adempimento", (data) => {
    try {
      const rl =
        data.has_rate && data.rate_labels
          ? JSON.stringify(data.rate_labels)
          : null;
      runQuery(
        `UPDATE adempimenti SET codice=?,nome=?,descrizione=?,categoria=?,scadenza_tipo=?,is_contabilita=?,has_rate=?,rate_labels=? WHERE id=?`,
        [
          data.codice,
          data.nome,
          data.descrizione || null,
          data.categoria,
          data.scadenza_tipo,
          data.is_contabilita ? 1 : 0,
          data.has_rate ? 1 : 0,
          rl,
          data.id,
        ],
      );
      io.emit("notify", { type: "success", msg: `✅ Adempimento aggiornato` });
      socket.emit("res:update:adempimento", { success: true });
    } catch (e) {
      socket.emit("res:update:adempimento", {
        success: false,
        error: e.message,
      });
    }
  });

  socket.on("delete:adempimento", ({ id }) => {
    try {
      runQuery(`UPDATE adempimenti SET attivo=0 WHERE id=?`, [id]);
      io.emit("notify", { type: "info", msg: `🗑️ Adempimento eliminato` });
      socket.emit("res:delete:adempimento", { success: true });
    } catch (e) {
      socket.emit("res:delete:adempimento", {
        success: false,
        error: e.message,
      });
    }
  });

  socket.on(
    "get:scadenzario",
    ({ id_cliente, anno, filtro_stato, filtro_adempimento }) => {
      try {
        let sql = `SELECT ac.*,a.codice,a.nome as adempimento_nome,a.scadenza_tipo,a.categoria,a.is_contabilita,a.has_rate,a.rate_labels,c.nome as cliente_nome FROM adempimenti_cliente ac JOIN adempimenti a ON ac.id_adempimento=a.id JOIN clienti c ON ac.id_cliente=c.id WHERE ac.id_cliente=? AND ac.anno=?`;
        const p = [id_cliente, anno];
        if (filtro_stato && filtro_stato !== "tutti") {
          sql += ` AND ac.stato=?`;
          p.push(filtro_stato);
        }
        if (filtro_adempimento?.trim()) {
          const s = `%${filtro_adempimento.trim()}%`;
          sql += ` AND (a.codice LIKE ? OR a.nome LIKE ? OR a.categoria LIKE ?)`;
          p.push(s, s, s);
        }
        sql += ` ORDER BY a.categoria,a.codice,ac.trimestre,ac.semestre,ac.mese`;
        socket.emit("res:scadenzario", {
          success: true,
          data: queryAll(sql, p),
        });
      } catch (e) {
        socket.emit("res:scadenzario", { success: false, error: e.message });
      }
    },
  );

  socket.on(
    "get:scadenzario_globale",
    ({ anno, filtro_stato, filtro_categoria, search }) => {
      try {
        let sql = `SELECT ac.*,a.codice,a.nome as adempimento_nome,a.scadenza_tipo,a.categoria,a.is_contabilita,a.has_rate,a.rate_labels,c.nome as cliente_nome,t.codice as tipologia_codice FROM adempimenti_cliente ac JOIN adempimenti a ON ac.id_adempimento=a.id JOIN clienti c ON ac.id_cliente=c.id JOIN tipologie_cliente t ON c.id_tipologia=t.id WHERE ac.anno=? AND c.attivo=1`;
        const p = [anno];
        if (filtro_stato && filtro_stato !== "tutti") {
          sql += ` AND ac.stato=?`;
          p.push(filtro_stato);
        }
        if (filtro_categoria && filtro_categoria !== "tutti") {
          sql += ` AND a.categoria=?`;
          p.push(filtro_categoria);
        }
        if (search?.trim()) {
          const s = `%${search.trim()}%`;
          sql += ` AND (c.nome LIKE ? OR a.codice LIKE ? OR a.nome LIKE ? OR a.categoria LIKE ?)`;
          p.push(s, s, s, s);
        }
        sql += ` ORDER BY c.nome,a.categoria,a.codice`;
        socket.emit("res:scadenzario_globale", {
          success: true,
          data: queryAll(sql, p),
        });
      } catch (e) {
        socket.emit("res:scadenzario_globale", {
          success: false,
          error: e.message,
        });
      }
    },
  );

  socket.on("genera:scadenzario", ({ id_cliente, anno }) => {
    try {
      runQuery(
        `DELETE FROM adempimenti_cliente WHERE id_cliente=? AND anno=? AND stato='da_fare'`,
        [id_cliente, anno],
      );
      const n = generaScadenzarioInterno(id_cliente, anno);
      const c = queryOne(`SELECT nome FROM clienti WHERE id=?`, [id_cliente]);
      io.emit("notify", {
        type: "success",
        msg: `⚡ Scadenzario ${anno}: ${n} adempimenti per ${c.nome}`,
      });
      socket.emit("res:genera:scadenzario", { success: true });
    } catch (e) {
      socket.emit("res:genera:scadenzario", {
        success: false,
        error: e.message,
      });
    }
  });

  socket.on("genera:tutti", ({ anno }) => {
    try {
      const tot = generaTuttiClientiAnno(anno);
      io.emit("notify", {
        type: "success",
        msg: `⚡ Scadenzario ${anno} generato per tutti (${tot} adempimenti)`,
      });
      socket.emit("res:genera:tutti", { success: true, totale: tot });
    } catch (e) {
      socket.emit("res:genera:tutti", { success: false, error: e.message });
    }
  });

  socket.on("copia:scadenzario", ({ id_cliente, anno_da, anno_a }) => {
    try {
      const righe = queryAll(
        `SELECT * FROM adempimenti_cliente WHERE id_cliente=? AND anno=?`,
        [id_cliente, anno_da],
      );
      runQuery(
        `DELETE FROM adempimenti_cliente WHERE id_cliente=? AND anno=? AND stato='da_fare'`,
        [id_cliente, anno_a],
      );
      righe.forEach((r) => {
        try {
          runQuery(
            `INSERT OR IGNORE INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,trimestre,semestre,stato) VALUES (?,?,?,?,?,?,?)`,
            [
              r.id_cliente,
              r.id_adempimento,
              anno_a,
              r.mese,
              r.trimestre,
              r.semestre,
              "da_fare",
            ],
          );
        } catch (e) {}
      });
      io.emit("notify", {
        type: "success",
        msg: `📋 Scadenzario copiato da ${anno_da} a ${anno_a}`,
      });
      socket.emit("res:copia:scadenzario", { success: true });
    } catch (e) {
      socket.emit("res:copia:scadenzario", {
        success: false,
        error: e.message,
      });
    }
  });

  socket.on("copia:tutti", ({ anno_da, anno_a }) => {
    try {
      const tot = copiaTuttiClienti(anno_da, anno_a);
      io.emit("notify", {
        type: "success",
        msg: `📋 Anno ${anno_da}→${anno_a} copiato per tutti (${tot} righe)`,
      });
      socket.emit("res:copia:tutti", { success: true, totale: tot });
    } catch (e) {
      socket.emit("res:copia:tutti", { success: false, error: e.message });
    }
  });

  socket.on(
    "update:adempimento_stato",
    ({
      id,
      stato,
      data_completamento,
      importo,
      note,
      data_scadenza,
      importo_saldo,
      importo_acconto1,
      importo_acconto2,
      importo_iva,
      importo_contabilita,
    }) => {
      try {
        runQuery(
          `UPDATE adempimenti_cliente SET stato=?,data_completamento=?,importo=?,note=?,data_scadenza=?,importo_saldo=?,importo_acconto1=?,importo_acconto2=?,importo_iva=?,importo_contabilita=? WHERE id=?`,
          [
            stato,
            data_completamento || null,
            importo || null,
            note || null,
            data_scadenza || null,
            importo_saldo || null,
            importo_acconto1 || null,
            importo_acconto2 || null,
            importo_iva || null,
            importo_contabilita || null,
            id,
          ],
        );
        socket.emit("res:update:adempimento_stato", { success: true });
      } catch (e) {
        socket.emit("res:update:adempimento_stato", {
          success: false,
          error: e.message,
        });
      }
    },
  );

  socket.on("delete:adempimento_cliente", ({ id }) => {
    try {
      runQuery(`DELETE FROM adempimenti_cliente WHERE id=?`, [id]);
      io.emit("notify", { type: "info", msg: `🗑️ Adempimento rimosso` });
      socket.emit("res:delete:adempimento_cliente", { success: true });
    } catch (e) {
      socket.emit("res:delete:adempimento_cliente", {
        success: false,
        error: e.message,
      });
    }
  });

  socket.on(
    "add:adempimento_cliente",
    ({ id_cliente, id_adempimento, anno, trimestre, semestre, mese }) => {
      try {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,trimestre,semestre,mese,stato) VALUES (?,?,?,?,?,?,?)`,
          [
            id_cliente,
            id_adempimento,
            anno,
            trimestre || null,
            semestre || null,
            mese || null,
            "da_fare",
          ],
        );
        io.emit("notify", { type: "success", msg: `➕ Adempimento aggiunto` });
        socket.emit("res:add:adempimento_cliente", { success: true });
      } catch (e) {
        socket.emit("res:add:adempimento_cliente", {
          success: false,
          error: e.message,
        });
      }
    },
  );

  socket.on("get:stats", ({ anno }) => {
    try {
      const totClienti = queryOne(
        `SELECT COUNT(*) as n FROM clienti WHERE attivo=1`,
      ).n;
      const perTipologia = queryAll(
        `SELECT t.codice,t.nome,COUNT(c.id) as n FROM tipologie_cliente t LEFT JOIN clienti c ON c.id_tipologia=t.id AND c.attivo=1 GROUP BY t.id ORDER BY t.id`,
      );
      const totAdempimenti = queryOne(
        `SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND c.attivo=1`,
        [anno],
      ).n;
      const completati = queryOne(
        `SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='completato' AND c.attivo=1`,
        [anno],
      ).n;
      const daFare = queryOne(
        `SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='da_fare' AND c.attivo=1`,
        [anno],
      ).n;
      const inCorso = queryOne(
        `SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='in_corso' AND c.attivo=1`,
        [anno],
      ).n;
      const na = queryOne(
        `SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='n_a' AND c.attivo=1`,
        [anno],
      ).n;
      const perCategoria = queryAll(
        `SELECT a.categoria,COUNT(*) as totale,SUM(CASE WHEN ac.stato='completato' THEN 1 ELSE 0 END) as completati,SUM(CASE WHEN ac.stato='da_fare' THEN 1 ELSE 0 END) as da_fare FROM adempimenti_cliente ac JOIN adempimenti a ON ac.id_adempimento=a.id JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND c.attivo=1 GROUP BY a.categoria ORDER BY a.categoria`,
        [anno],
      );
      const adempimentiStats = queryAll(
        `SELECT a.id,a.codice,a.nome,a.categoria,COUNT(*) as totale,SUM(CASE WHEN ac.stato='completato' THEN 1 ELSE 0 END) as completati,SUM(CASE WHEN ac.stato='da_fare' THEN 1 ELSE 0 END) as da_fare FROM adempimenti_cliente ac JOIN adempimenti a ON ac.id_adempimento=a.id JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND c.attivo=1 GROUP BY a.id ORDER BY a.categoria,a.codice`,
        [anno],
      );
      const clientiPerCategoria = queryAll(
        `SELECT DISTINCT c.id,c.nome,c.codice_fiscale,c.partita_iva,c.email,c.telefono,c.indirizzo,c.note,c.categorie_attive,t.codice as tipologia_codice,t.nome as tipologia_nome,s.nome as sottotipologia_nome,a.categoria FROM adempimenti_cliente ac JOIN adempimenti a ON ac.id_adempimento=a.id JOIN clienti c ON ac.id_cliente=c.id JOIN tipologie_cliente t ON c.id_tipologia=t.id LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id WHERE ac.anno=? AND c.attivo=1 ORDER BY a.categoria,c.nome`,
        [anno],
      );
      const scadenzeAperte = queryAll(
        `SELECT c.nome,COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='da_fare' AND c.attivo=1 GROUP BY ac.id_cliente ORDER BY n DESC LIMIT 5`,
        [anno],
      );
      socket.emit("res:stats", {
        success: true,
        data: {
          totClienti,
          perTipologia,
          totAdempimenti,
          completati,
          daFare,
          inCorso,
          na,
          anno,
          scadenzeAperte,
          perCategoria,
          adempimentiStats,
          clientiPerCategoria,
        },
      });
    } catch (e) {
      socket.emit("res:stats", { success: false, error: e.message });
    }
  });

  socket.on("disconnect", () =>
    console.log(`❌ Client disconnesso: ${socket.id}`),
  );
  socket.on("error", (err) => console.error(`⚠️ Errore Socket:`, err));
  socket.on("ping", () =>
    socket.emit("pong", { timestamp: new Date().toISOString() }),
  );
});

const PORT = process.env.PORT || 3000;
const gracefulShutdown = (sig) => {
  console.log(`\nℹ️ ${sig}`);
  server.close(() => {
    io.close(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10000);
};
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (err) => console.error("❌", err));
process.on("unhandledRejection", (err) => console.error("❌", err));

initDB().then(async () => {
  server.listen(PORT, "0.0.0.0", async () => {
    const localIP = getLocalIP(),
      publicIP = await getPublicIP();
    console.log(`✅ Server avviato`);
    if (publicIP) console.log(`🌐 http://${publicIP}:${PORT}`);
    console.log(`🏠 http://${localIP}:${PORT}`);
  });
});
