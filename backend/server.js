const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const os = require('os');

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
app.use(express.static(path.join(__dirname, '../frontend')));

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path} da ${req.ip}`);
  }
  next();
});

const DB_PATH = path.join(__dirname, 'db', 'gestionale.db');
let db;

async function initDB() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log('✅ Database caricato da file');
    migrateDB();
  } else {
    db = new SQL.Database();
    console.log('🆕 Nuovo database creato');
    createSchema();
    seedData();
    saveDB();
  }
}

function migrateDB() {
  // Aggiungi colonne mancanti se non esistono (migrazioni sicure)
  const migrations = [
    `ALTER TABLE adempimenti ADD COLUMN is_contabilita INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti ADD COLUMN has_rate INTEGER DEFAULT 0`,
    `ALTER TABLE adempimenti ADD COLUMN rate_labels TEXT`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_saldo REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_acconto1 REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_acconto2 REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_iva REAL`,
    `ALTER TABLE adempimenti_cliente ADD COLUMN importo_contabilita REAL`,
  ];
  migrations.forEach(sql => {
    try { db.run(sql); } catch (e) { /* colonna già esistente */ }
  });
  saveDB();
}

function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, buffer);
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
  db.run(`CREATE TABLE IF NOT EXISTS tipologie_cliente (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descrizione TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sottotipologie (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_tipologia INTEGER NOT NULL,
    codice TEXT NOT NULL,
    nome TEXT NOT NULL,
    is_separator INTEGER DEFAULT 0,
    FOREIGN KEY (id_tipologia) REFERENCES tipologie_cliente(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS clienti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    id_tipologia INTEGER NOT NULL,
    id_sottotipologia INTEGER,
    codice_fiscale TEXT,
    partita_iva TEXT,
    email TEXT,
    telefono TEXT,
    indirizzo TEXT,
    note TEXT,
    categorie_attive TEXT DEFAULT '["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]',
    attivo INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (id_tipologia) REFERENCES tipologie_cliente(id),
    FOREIGN KEY (id_sottotipologia) REFERENCES sottotipologie(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS adempimenti (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codice TEXT NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    descrizione TEXT,
    categoria TEXT,
    scadenza_tipo TEXT CHECK(scadenza_tipo IN ('annuale', 'semestrale', 'trimestrale', 'mensile')),
    is_contabilita INTEGER DEFAULT 0,
    has_rate INTEGER DEFAULT 0,
    rate_labels TEXT,
    attivo INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS adempimenti_cliente (
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
  )`);

  console.log('📐 Schema creato');
}

function seedData() {
  const tipologie = [
    { codice: 'PF', nome: 'Persona Fisica', descrizione: 'Contribuente persona fisica' },
    { codice: 'SP', nome: 'Società di Persone', descrizione: 'SNC, SAS, SS' },
    { codice: 'SC', nome: 'Società di Capitali', descrizione: 'SRL, SPA, SAPA' },
    { codice: 'ASS', nome: 'Associazione', descrizione: 'Associazioni e enti non commerciali' },
  ];
  tipologie.forEach(t => db.run(`INSERT INTO tipologie_cliente (codice, nome, descrizione) VALUES (?,?,?)`, [t.codice, t.nome, t.descrizione]));

  // sottotipologie con is_separator per righe "bianche" non selezionabili
  const sottotipologie = [
    // PF (id_tipologia=1)
    { id_tipologia: 1, codice: 'PF_PRIV', nome: 'Privato', is_separator: 0 },
    { id_tipologia: 1, codice: 'PF_DITTA_SEP', nome: '— Ditta Individuale —', is_separator: 1 },
    { id_tipologia: 1, codice: 'PF_DITTA_ORD', nome: 'Ditta Ind. – Ordinario', is_separator: 0 },
    { id_tipologia: 1, codice: 'PF_DITTA_SEMP', nome: 'Ditta Ind. – Semplificato', is_separator: 0 },
    { id_tipologia: 1, codice: 'PF_DITTA_FORF', nome: 'Ditta Ind. – Forfettario', is_separator: 0 },
    { id_tipologia: 1, codice: 'PF_SOCIO', nome: 'Socio', is_separator: 0 },
    { id_tipologia: 1, codice: 'PF_PROF_SEP', nome: '— Professionista —', is_separator: 1 },
    { id_tipologia: 1, codice: 'PF_PROF_ORD', nome: 'Professionista – Ordinario', is_separator: 0 },
    { id_tipologia: 1, codice: 'PF_PROF_SEMP', nome: 'Professionista – Semplificato', is_separator: 0 },
    { id_tipologia: 1, codice: 'PF_PROF_FORF', nome: 'Professionista – Forfettario', is_separator: 0 },
    // SP (id_tipologia=2)
    { id_tipologia: 2, codice: 'SP_ORD', nome: 'SP – Ordinaria', is_separator: 0 },
    { id_tipologia: 2, codice: 'SP_SEMP', nome: 'SP – Semplificata', is_separator: 0 },
    // SC (id_tipologia=3)
    { id_tipologia: 3, codice: 'SC_ORD', nome: 'SC – Ordinaria', is_separator: 0 },
    { id_tipologia: 3, codice: 'SC_SEMP', nome: 'SC – Semplificata', is_separator: 0 },
    // ASS (id_tipologia=4)
    { id_tipologia: 4, codice: 'ASS_ORD', nome: 'ASS – Ordinaria', is_separator: 0 },
    { id_tipologia: 4, codice: 'ASS_SEMP', nome: 'ASS – Semplificata', is_separator: 0 },
  ];
  sottotipologie.forEach(s => db.run(`INSERT INTO sottotipologie (id_tipologia, codice, nome, is_separator) VALUES (?,?,?,?)`, [s.id_tipologia, s.codice, s.nome, s.is_separator || 0]));

  const adempimenti = [
    { codice: 'TASSA_NID', nome: 'Tassa NID', descrizione: 'Tassa numerazione e idoneità documenti', categoria: 'TUTTI', scadenza: 'annuale', is_contabilita: 0, has_rate: 0 },
    { codice: 'INAIL', nome: 'INAIL', descrizione: 'Dichiarazione e pagamenti INAIL', categoria: 'LAVORO', scadenza: 'annuale', is_contabilita: 0, has_rate: 0 },
    { codice: 'INPS_TRIM', nome: 'INPS Trimestrale', descrizione: 'INPS trimestrale', categoria: 'PREVIDENZA', scadenza: 'trimestrale', is_contabilita: 0, has_rate: 0 },
    { codice: 'LIPE', nome: 'LIPE', descrizione: 'Liquidazione IVA periodica trimestrale', categoria: 'IVA', scadenza: 'trimestrale', is_contabilita: 0, has_rate: 0 },
    { codice: 'ACCONTO_IVA', nome: 'Acconto IVA', descrizione: 'Acconto IVA annuale', categoria: 'IVA', scadenza: 'annuale', is_contabilita: 0, has_rate: 0 },
    { codice: 'CU', nome: 'Certificazione Unica', descrizione: 'Certificazione Unica', categoria: 'DICHIARAZIONI', scadenza: 'annuale', is_contabilita: 0, has_rate: 0 },
    { codice: '770', nome: 'Modello 770', descrizione: 'Dichiarazione sostituti di imposta', categoria: 'DICHIARAZIONI', scadenza: 'annuale', is_contabilita: 0, has_rate: 0 },
    { codice: 'DICH_IVA', nome: 'Dichiarazione IVA', descrizione: 'Dichiarazione IVA annuale', categoria: 'DICHIARAZIONI', scadenza: 'annuale', is_contabilita: 0, has_rate: 0 },
    { codice: 'BILANCIO', nome: 'Bilancio', descrizione: 'Deposito bilancio annuale', categoria: 'BILANCIO', scadenza: 'annuale', is_contabilita: 0, has_rate: 0 },
    { codice: 'DIRITTO_ANNUALE', nome: 'Diritto Annuale CCIAA', descrizione: 'Diritto annuale Camera di Commercio', categoria: 'TRIBUTI', scadenza: 'annuale', is_contabilita: 0, has_rate: 0 },
    { codice: 'IRAP', nome: 'IRAP', descrizione: 'Imposta Regionale sulle Attività Produttive', categoria: 'TRIBUTI', scadenza: 'annuale', is_contabilita: 0, has_rate: 1, rate_labels: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: 'DICH_REDDITI', nome: 'Dichiarazione Redditi', descrizione: 'Dichiarazione annuale redditi', categoria: 'DICHIARAZIONI', scadenza: 'annuale', is_contabilita: 0, has_rate: 1, rate_labels: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: '730', nome: 'Modello 730', descrizione: 'Mod. 730 persone fisiche dipendenti', categoria: 'DICHIARAZIONI', scadenza: 'annuale', is_contabilita: 0, has_rate: 1, rate_labels: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: 'IMU', nome: 'IMU', descrizione: 'Imposta Municipale Unica', categoria: 'TRIBUTI', scadenza: 'semestrale', is_contabilita: 0, has_rate: 0 },
    { codice: 'CONTABILITA', nome: 'Contabilità / F24', descrizione: 'Versamento F24 mensile con IVA e contabilità', categoria: 'TRIBUTI', scadenza: 'mensile', is_contabilita: 1, has_rate: 0 },
  ];
  adempimenti.forEach(a => db.run(
    `INSERT INTO adempimenti (codice, nome, descrizione, categoria, scadenza_tipo, is_contabilita, has_rate, rate_labels) VALUES (?,?,?,?,?,?,?,?)`,
    [a.codice, a.nome, a.descrizione, a.categoria, a.scadenza, a.is_contabilita || 0, a.has_rate || 0, a.rate_labels || null]
  ));

  const clientiEsempio = [
    { nome: 'Mario Rossi', id_tipologia: 1, id_sottotipologia: 1, cf: 'RSSMRA80A01L219K', piva: null, email: 'mario.rossi@email.it', tel: '333 1234567', indirizzo: 'Via Roma 1, Udine', note: 'Cliente storico', categorie: '["IVA","DICHIARAZIONI","TRIBUTI"]' },
    { nome: 'Anna Bianchi', id_tipologia: 1, id_sottotipologia: 2, cf: 'BNCNNA85M41F205X', piva: null, email: 'anna.bianchi@email.it', tel: '347 9876543', indirizzo: 'Via Venezia 5, Trieste', note: '', categorie: '["DICHIARAZIONI"]' },
    { nome: 'Studio Verdi SNC', id_tipologia: 2, id_sottotipologia: 11, cf: null, piva: '01234567890', email: 'info@studioverdi.it', tel: '0432 123456', indirizzo: 'Corso Vittorio 10, Udine', note: 'Contatti: dott. Verdi', categorie: '["LAVORO","PREVIDENZA","IVA","DICHIARAZIONI","BILANCIO","TRIBUTI"]' },
    { nome: 'Alfa Srl', id_tipologia: 3, id_sottotipologia: 13, cf: null, piva: '09876543210', email: 'info@alfasrl.it', tel: '040 654321', indirizzo: 'Zona Industriale, Trieste', note: '', categorie: '["LAVORO","PREVIDENZA","IVA","DICHIARAZIONI","BILANCIO","TRIBUTI"]' },
  ];
  clientiEsempio.forEach(c => db.run(
    `INSERT INTO clienti (nome, id_tipologia, id_sottotipologia, codice_fiscale, partita_iva, email, telefono, indirizzo, note, categorie_attive) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [c.nome, c.id_tipologia, c.id_sottotipologia, c.cf, c.piva, c.email, c.tel, c.indirizzo, c.note, c.categorie]
  ));

  console.log('🌱 Dati di esempio inseriti');
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERAZIONE AUTOMATICA SCADENZARIO
// ═══════════════════════════════════════════════════════════════════════════
function generaScadenzarioInterno(id_cliente, anno) {
  const cliente = queryOne(`SELECT * FROM clienti WHERE id=?`, [id_cliente]);
  if (!cliente) throw new Error('Cliente non trovato');

  const categorieAttive = JSON.parse(cliente.categorie_attive || '[]');
  const adempimenti = queryAll(`SELECT * FROM adempimenti WHERE attivo=1`);

  const applicabili = adempimenti.filter(a => {
    if (a.categoria === 'TUTTI') return true;
    return categorieAttive.includes(a.categoria);
  });

  runQuery(`DELETE FROM adempimenti_cliente WHERE id_cliente=? AND anno=? AND stato='da_fare'`, [id_cliente, anno]);

  let totaleGenerati = 0;

  applicabili.forEach(a => {
    const scadenza = a.scadenza_tipo;

    if (scadenza === 'trimestrale') {
      for (let t = 1; t <= 4; t++) {
        const exists = queryOne(`SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND trimestre=?`, [id_cliente, a.id, anno, t]);
        if (!exists) {
          runQuery(`INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, trimestre, stato) VALUES (?,?,?,?,?)`, [id_cliente, a.id, anno, t, 'da_fare']);
          totaleGenerati++;
        }
      }
    } else if (scadenza === 'semestrale') {
      for (let s = 1; s <= 2; s++) {
        const exists = queryOne(`SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND semestre=?`, [id_cliente, a.id, anno, s]);
        if (!exists) {
          runQuery(`INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, semestre, stato) VALUES (?,?,?,?,?)`, [id_cliente, a.id, anno, s, 'da_fare']);
          totaleGenerati++;
        }
      }
    } else if (scadenza === 'mensile') {
      for (let m = 1; m <= 12; m++) {
        const exists = queryOne(`SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND mese=?`, [id_cliente, a.id, anno, m]);
        if (!exists) {
          runQuery(`INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, stato) VALUES (?,?,?,?,?)`, [id_cliente, a.id, anno, m, 'da_fare']);
          totaleGenerati++;
        }
      }
    } else {
      const exists = queryOne(`SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND mese IS NULL AND trimestre IS NULL AND semestre IS NULL`, [id_cliente, a.id, anno]);
      if (!exists) {
        runQuery(`INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, stato) VALUES (?,?,?,?)`, [id_cliente, a.id, anno, 'da_fare']);
        totaleGenerati++;
      }
    }
  });

  return totaleGenerati;
}

function generaAdempimentoPerTutti(id_adempimento, anno) {
  const adempimento = queryOne(`SELECT * FROM adempimenti WHERE id=?`, [id_adempimento]);
  if (!adempimento) return 0;

  const clienti = queryAll(`SELECT * FROM clienti WHERE attivo=1`);
  let totale = 0;

  clienti.forEach(cliente => {
    const categorieAttive = JSON.parse(cliente.categorie_attive || '[]');
    const applicabile = adempimento.categoria === 'TUTTI' || categorieAttive.includes(adempimento.categoria);
    if (!applicabile) return;

    const scadenza = adempimento.scadenza_tipo;

    if (scadenza === 'trimestrale') {
      for (let t = 1; t <= 4; t++) {
        try { runQuery(`INSERT OR IGNORE INTO adempimenti_cliente (id_cliente, id_adempimento, anno, trimestre, stato) VALUES (?,?,?,?,?)`, [cliente.id, id_adempimento, anno, t, 'da_fare']); totale++; } catch (e) { }
      }
    } else if (scadenza === 'semestrale') {
      for (let s = 1; s <= 2; s++) {
        try { runQuery(`INSERT OR IGNORE INTO adempimenti_cliente (id_cliente, id_adempimento, anno, semestre, stato) VALUES (?,?,?,?,?)`, [cliente.id, id_adempimento, anno, s, 'da_fare']); totale++; } catch (e) { }
      }
    } else if (scadenza === 'mensile') {
      for (let m = 1; m <= 12; m++) {
        try { runQuery(`INSERT OR IGNORE INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, stato) VALUES (?,?,?,?,?)`, [cliente.id, id_adempimento, anno, m, 'da_fare']); totale++; } catch (e) { }
      }
    } else {
      try { runQuery(`INSERT OR IGNORE INTO adempimenti_cliente (id_cliente, id_adempimento, anno, stato) VALUES (?,?,?,?)`, [cliente.id, id_adempimento, anno, 'da_fare']); totale++; } catch (e) { }
    }
  });

  return totale;
}

// Genera scadenzario per TUTTI i clienti per un dato anno
function generaTuttiClientiAnno(anno) {
  const clienti = queryAll(`SELECT * FROM clienti WHERE attivo=1`);
  let totale = 0;
  clienti.forEach(c => {
    try { totale += generaScadenzarioInterno(c.id, anno); } catch (e) { }
  });
  return totale;
}

// Copia anno per TUTTI i clienti
function copiaTuttiClienti(anno_da, anno_a) {
  const clienti = queryAll(`SELECT * FROM clienti WHERE attivo=1`);
  let totale = 0;
  clienti.forEach(cliente => {
    const righe = queryAll(`SELECT * FROM adempimenti_cliente WHERE id_cliente=? AND anno=?`, [cliente.id, anno_da]);
    runQuery(`DELETE FROM adempimenti_cliente WHERE id_cliente=? AND anno=? AND stato='da_fare'`, [cliente.id, anno_a]);
    righe.forEach(r => {
      try {
        runQuery(`INSERT OR IGNORE INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, trimestre, semestre, stato, data_scadenza, note, importo) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [r.id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre, 'da_fare', null, null, null]);
        totale++;
      } catch (e) { }
    });
  });
  return totale;
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

async function getPublicIP() {
  try {
    const https = require('https');
    return new Promise((resolve, reject) => {
      https.get('https://api.ipify.org?format=json', (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => { try { resolve(JSON.parse(data).ip); } catch (e) { reject(e); } });
      }).on('error', reject);
    });
  } catch (error) {
    return null;
  }
}

app.get('/api/health', async (req, res) => {
  const publicIP = await getPublicIP();
  res.json({ status: 'OK', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()), socketConnections: io.engine.clientsCount, publicIP, port: PORT, dbSize: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0 });
});

// ═══════════════════════════════════════════════════════════════════════════
// SOCKET.IO
// ═══════════════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`✅ Client connesso: ${socket.id}`);
  socket.emit('connected', { message: 'Connesso al server', timestamp: new Date().toISOString() });

  socket.on('get:tipologie', () => {
    try {
      const tipologie = queryAll(`SELECT * FROM tipologie_cliente ORDER BY id`);
      const sottotipologie = queryAll(`SELECT * FROM sottotipologie ORDER BY id_tipologia, id`);
      tipologie.forEach(t => { t.sottotipologie = sottotipologie.filter(s => s.id_tipologia === t.id); });
      socket.emit('res:tipologie', { success: true, data: tipologie });
    } catch (e) { socket.emit('res:tipologie', { success: false, error: e.message }); }
  });

  socket.on('get:clienti', (filtri = {}) => {
    try {
      let sql = `
        SELECT c.*, t.codice as tipologia_codice, t.nome as tipologia_nome,
               s.codice as sottotipologia_codice, s.nome as sottotipologia_nome
        FROM clienti c
        LEFT JOIN tipologie_cliente t ON c.id_tipologia = t.id
        LEFT JOIN sottotipologie s ON c.id_sottotipologia = s.id
        WHERE c.attivo = 1
      `;
      const params = [];
      if (filtri.tipologia && filtri.tipologia !== '') { sql += ` AND t.codice = ?`; params.push(filtri.tipologia); }
      if (filtri.search && filtri.search.trim() !== '') {
        const s = `%${filtri.search.trim()}%`;
        sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.indirizzo LIKE ?)`;
        params.push(s, s, s, s, s, s);
      }
      sql += ` ORDER BY c.nome`;
      const clienti = queryAll(sql, params);
      socket.emit('res:clienti', { success: true, data: clienti });
    } catch (e) { socket.emit('res:clienti', { success: false, error: e.message }); }
  });

  socket.on('get:cliente', ({ id }) => {
    try {
      const cliente = queryOne(`
        SELECT c.*, t.codice as tipologia_codice, t.nome as tipologia_nome,
               s.codice as sottotipologia_codice, s.nome as sottotipologia_nome
        FROM clienti c
        LEFT JOIN tipologie_cliente t ON c.id_tipologia = t.id
        LEFT JOIN sottotipologie s ON c.id_sottotipologia = s.id
        WHERE c.id = ?`, [id]);
      socket.emit('res:cliente', { success: true, data: cliente });
    } catch (e) { socket.emit('res:cliente', { success: false, error: e.message }); }
  });

  socket.on('create:cliente', (data) => {
    try {
      const categorieAttive = JSON.stringify(data.categorie_attive || []);
      runQuery(`INSERT INTO clienti (nome, id_tipologia, id_sottotipologia, codice_fiscale, partita_iva, email, telefono, indirizzo, note, categorie_attive) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [data.nome, data.id_tipologia, data.id_sottotipologia || null, data.codice_fiscale || null, data.partita_iva || null, data.email || null, data.telefono || null, data.indirizzo || null, data.note || null, categorieAttive]);
      const newId = queryOne(`SELECT last_insert_rowid() as id`).id;
      const anno = new Date().getFullYear();
      const nAdp = generaScadenzarioInterno(newId, anno);
      io.emit('notify', { type: 'success', msg: `✅ Cliente "${data.nome}" creato con ${nAdp} adempimenti per ${anno}` });
      socket.emit('res:create:cliente', { success: true, id: newId });
    } catch (e) { socket.emit('res:create:cliente', { success: false, error: e.message }); }
  });

  socket.on('update:cliente', (data) => {
    try {
      const categorieAttive = JSON.stringify(data.categorie_attive || []);
      runQuery(`UPDATE clienti SET nome=?, id_tipologia=?, id_sottotipologia=?, codice_fiscale=?, partita_iva=?, email=?, telefono=?, indirizzo=?, note=?, categorie_attive=? WHERE id=?`,
        [data.nome, data.id_tipologia, data.id_sottotipologia || null, data.codice_fiscale || null, data.partita_iva || null, data.email || null, data.telefono || null, data.indirizzo || null, data.note || null, categorieAttive, data.id]);
      const annoCorrente = new Date().getFullYear();
      let totale = 0;
      for (let anno = annoCorrente; anno <= annoCorrente + 1; anno++) totale += generaScadenzarioInterno(data.id, anno);
      io.emit('notify', { type: 'success', msg: `✅ Cliente aggiornato, scadenzario rigenerato (${totale} adempimenti)` });
      socket.emit('res:update:cliente', { success: true });
    } catch (e) { socket.emit('res:update:cliente', { success: false, error: e.message }); }
  });

  socket.on('delete:cliente', ({ id }) => {
    try {
      runQuery(`UPDATE clienti SET attivo=0 WHERE id=?`, [id]);
      io.emit('notify', { type: 'info', msg: `🗑️ Cliente eliminato` });
      socket.emit('res:delete:cliente', { success: true });
    } catch (e) { socket.emit('res:delete:cliente', { success: false, error: e.message }); }
  });

  socket.on('get:adempimenti', (filtri = {}) => {
    try {
      let sql = `SELECT * FROM adempimenti WHERE attivo=1`;
      const params = [];
      if (filtri.search && filtri.search.trim() !== '') {
        const s = `%${filtri.search.trim()}%`;
        sql += ` AND (codice LIKE ? OR nome LIKE ? OR descrizione LIKE ? OR categoria LIKE ?)`;
        params.push(s, s, s, s);
      }
      sql += ` ORDER BY categoria, codice`;
      const adempimenti = queryAll(sql, params);
      socket.emit('res:adempimenti', { success: true, data: adempimenti });
    } catch (e) { socket.emit('res:adempimenti', { success: false, error: e.message }); }
  });

  socket.on('create:adempimento', (data) => {
    try {
      const existing = queryOne(`SELECT id FROM adempimenti WHERE codice=?`, [data.codice]);
      if (existing) throw new Error(`Codice "${data.codice}" già esistente`);
      const rateLabels = data.has_rate && data.rate_labels ? JSON.stringify(data.rate_labels) : null;
      runQuery(`INSERT INTO adempimenti (codice, nome, descrizione, categoria, scadenza_tipo, is_contabilita, has_rate, rate_labels) VALUES (?,?,?,?,?,?,?,?)`,
        [data.codice, data.nome, data.descrizione || null, data.categoria, data.scadenza_tipo, data.is_contabilita ? 1 : 0, data.has_rate ? 1 : 0, rateLabels]);
      const newId = queryOne(`SELECT last_insert_rowid() as id`).id;
      const annoCorrente = new Date().getFullYear();
      let totaleRighe = 0;
      for (let anno = annoCorrente; anno <= annoCorrente + 1; anno++) totaleRighe += generaAdempimentoPerTutti(newId, anno);
      io.emit('notify', { type: 'success', msg: `✅ Adempimento "${data.nome}" creato e assegnato (${totaleRighe} righe)` });
      socket.emit('res:create:adempimento', { success: true });
    } catch (e) { socket.emit('res:create:adempimento', { success: false, error: e.message }); }
  });

  socket.on('update:adempimento', (data) => {
    try {
      const rateLabels = data.has_rate && data.rate_labels ? JSON.stringify(data.rate_labels) : null;
      runQuery(`UPDATE adempimenti SET codice=?, nome=?, descrizione=?, categoria=?, scadenza_tipo=?, is_contabilita=?, has_rate=?, rate_labels=? WHERE id=?`,
        [data.codice, data.nome, data.descrizione || null, data.categoria, data.scadenza_tipo, data.is_contabilita ? 1 : 0, data.has_rate ? 1 : 0, rateLabels, data.id]);
      io.emit('notify', { type: 'success', msg: `✅ Adempimento aggiornato` });
      socket.emit('res:update:adempimento', { success: true });
    } catch (e) { socket.emit('res:update:adempimento', { success: false, error: e.message }); }
  });

  socket.on('delete:adempimento', ({ id }) => {
    try {
      runQuery(`UPDATE adempimenti SET attivo=0 WHERE id=?`, [id]);
      io.emit('notify', { type: 'info', msg: `🗑️ Adempimento eliminato` });
      socket.emit('res:delete:adempimento', { success: true });
    } catch (e) { socket.emit('res:delete:adempimento', { success: false, error: e.message }); }
  });

  socket.on('get:scadenzario', ({ id_cliente, anno, filtro_stato, filtro_adempimento }) => {
    try {
      let sql = `
        SELECT ac.*, a.codice, a.nome as adempimento_nome, a.scadenza_tipo, a.categoria,
               a.is_contabilita, a.has_rate, a.rate_labels,
               c.nome as cliente_nome
        FROM adempimenti_cliente ac
        JOIN adempimenti a ON ac.id_adempimento = a.id
        JOIN clienti c ON ac.id_cliente = c.id
        WHERE ac.id_cliente=? AND ac.anno=?
      `;
      const params = [id_cliente, anno];
      if (filtro_stato && filtro_stato !== 'tutti') { sql += ` AND ac.stato=?`; params.push(filtro_stato); }
      if (filtro_adempimento && filtro_adempimento.trim() !== '') {
        const s = `%${filtro_adempimento.trim()}%`;
        sql += ` AND (a.codice LIKE ? OR a.nome LIKE ? OR a.categoria LIKE ?)`;
        params.push(s, s, s);
      }
      sql += ` ORDER BY a.categoria, a.codice, ac.trimestre, ac.semestre, ac.mese`;
      const righe = queryAll(sql, params);
      socket.emit('res:scadenzario', { success: true, data: righe });
    } catch (e) { socket.emit('res:scadenzario', { success: false, error: e.message }); }
  });

  socket.on('get:scadenzario_globale', ({ anno, filtro_stato, filtro_categoria, search }) => {
    try {
      let sql = `
        SELECT ac.*, a.codice, a.nome as adempimento_nome, a.scadenza_tipo, a.categoria,
               a.is_contabilita, a.has_rate, a.rate_labels,
               c.nome as cliente_nome, t.codice as tipologia_codice
        FROM adempimenti_cliente ac
        JOIN adempimenti a ON ac.id_adempimento = a.id
        JOIN clienti c ON ac.id_cliente = c.id
        JOIN tipologie_cliente t ON c.id_tipologia = t.id
        WHERE ac.anno=? AND c.attivo=1
      `;
      const params = [anno];
      if (filtro_stato && filtro_stato !== 'tutti') { sql += ` AND ac.stato=?`; params.push(filtro_stato); }
      if (filtro_categoria && filtro_categoria !== 'tutti') { sql += ` AND a.categoria=?`; params.push(filtro_categoria); }
      if (search && search.trim() !== '') {
        const s = `%${search.trim()}%`;
        sql += ` AND (c.nome LIKE ? OR a.codice LIKE ? OR a.nome LIKE ? OR a.categoria LIKE ?)`;
        params.push(s, s, s, s);
      }
      sql += ` ORDER BY c.nome, a.categoria, a.codice`;
      const righe = queryAll(sql, params);
      socket.emit('res:scadenzario_globale', { success: true, data: righe });
    } catch (e) { socket.emit('res:scadenzario_globale', { success: false, error: e.message }); }
  });

  socket.on('genera:scadenzario', ({ id_cliente, anno }) => {
    try {
      runQuery(`DELETE FROM adempimenti_cliente WHERE id_cliente=? AND anno=? AND stato='da_fare'`, [id_cliente, anno]);
      const nAdp = generaScadenzarioInterno(id_cliente, anno);
      const cliente = queryOne(`SELECT nome FROM clienti WHERE id=?`, [id_cliente]);
      io.emit('notify', { type: 'success', msg: `⚡ Scadenzario ${anno} generato: ${nAdp} adempimenti per ${cliente.nome}` });
      socket.emit('res:genera:scadenzario', { success: true });
    } catch (e) { socket.emit('res:genera:scadenzario', { success: false, error: e.message }); }
  });

  // Genera scadenzario per TUTTI i clienti
  socket.on('genera:tutti', ({ anno }) => {
    try {
      const totale = generaTuttiClientiAnno(anno);
      io.emit('notify', { type: 'success', msg: `⚡ Scadenzario ${anno} generato per tutti i clienti (${totale} adempimenti)` });
      socket.emit('res:genera:tutti', { success: true, totale });
    } catch (e) { socket.emit('res:genera:tutti', { success: false, error: e.message }); }
  });

  socket.on('copia:scadenzario', ({ id_cliente, anno_da, anno_a }) => {
    try {
      const righe = queryAll(`SELECT * FROM adempimenti_cliente WHERE id_cliente=? AND anno=?`, [id_cliente, anno_da]);
      runQuery(`DELETE FROM adempimenti_cliente WHERE id_cliente=? AND anno=? AND stato='da_fare'`, [id_cliente, anno_a]);
      righe.forEach(r => runQuery(
        `INSERT OR IGNORE INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, trimestre, semestre, stato, data_scadenza, note, importo) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [r.id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre, 'da_fare', null, null, null]
      ));
      io.emit('notify', { type: 'success', msg: `📋 Scadenzario copiato da ${anno_da} a ${anno_a}` });
      socket.emit('res:copia:scadenzario', { success: true });
    } catch (e) { socket.emit('res:copia:scadenzario', { success: false, error: e.message }); }
  });

  // Copia anno per TUTTI i clienti
  socket.on('copia:tutti', ({ anno_da, anno_a }) => {
    try {
      const totale = copiaTuttiClienti(anno_da, anno_a);
      io.emit('notify', { type: 'success', msg: `📋 Anno ${anno_da} copiato → ${anno_a} per tutti i clienti (${totale} righe)` });
      socket.emit('res:copia:tutti', { success: true, totale });
    } catch (e) { socket.emit('res:copia:tutti', { success: false, error: e.message }); }
  });

  socket.on('update:adempimento_stato', ({ id, stato, data_completamento, importo, note, data_scadenza, importo_saldo, importo_acconto1, importo_acconto2, importo_iva, importo_contabilita }) => {
    try {
      runQuery(`UPDATE adempimenti_cliente SET stato=?, data_completamento=?, importo=?, note=?, data_scadenza=?, importo_saldo=?, importo_acconto1=?, importo_acconto2=?, importo_iva=?, importo_contabilita=? WHERE id=?`,
        [stato, data_completamento || null, importo || null, note || null, data_scadenza || null, importo_saldo || null, importo_acconto1 || null, importo_acconto2 || null, importo_iva || null, importo_contabilita || null, id]);
      socket.emit('res:update:adempimento_stato', { success: true });
    } catch (e) { socket.emit('res:update:adempimento_stato', { success: false, error: e.message }); }
  });

  socket.on('delete:adempimento_cliente', ({ id }) => {
    try {
      runQuery(`DELETE FROM adempimenti_cliente WHERE id=?`, [id]);
      io.emit('notify', { type: 'info', msg: `🗑️ Adempimento rimosso dallo scadenzario` });
      socket.emit('res:delete:adempimento_cliente', { success: true });
    } catch (e) { socket.emit('res:delete:adempimento_cliente', { success: false, error: e.message }); }
  });

  socket.on('add:adempimento_cliente', ({ id_cliente, id_adempimento, anno, trimestre, semestre, mese }) => {
    try {
      runQuery(`INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, trimestre, semestre, mese, stato) VALUES (?,?,?,?,?,?,?)`,
        [id_cliente, id_adempimento, anno, trimestre || null, semestre || null, mese || null, 'da_fare']);
      io.emit('notify', { type: 'success', msg: `➕ Adempimento aggiunto allo scadenzario` });
      socket.emit('res:add:adempimento_cliente', { success: true });
    } catch (e) { socket.emit('res:add:adempimento_cliente', { success: false, error: e.message }); }
  });

  socket.on('get:stats', ({ anno }) => {
    try {
      const totClienti = queryOne(`SELECT COUNT(*) as n FROM clienti c WHERE c.attivo=1`).n;
      const perTipologia = queryAll(`SELECT t.codice, t.nome, COUNT(c.id) as n FROM tipologie_cliente t LEFT JOIN clienti c ON c.id_tipologia=t.id AND c.attivo=1 GROUP BY t.id ORDER BY t.id`);
      const totAdempimenti = queryOne(`SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND c.attivo=1`, [anno]).n;
      const completati = queryOne(`SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='completato' AND c.attivo=1`, [anno]).n;
      const daFare = queryOne(`SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='da_fare' AND c.attivo=1`, [anno]).n;
      const inCorso = queryOne(`SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='in_corso' AND c.attivo=1`, [anno]).n;
      const na = queryOne(`SELECT COUNT(*) as n FROM adempimenti_cliente ac JOIN clienti c ON ac.id_cliente=c.id WHERE ac.anno=? AND ac.stato='n_a' AND c.attivo=1`, [anno]).n;

      // Statistiche per categoria
      const perCategoria = queryAll(`
        SELECT a.categoria, 
               COUNT(*) as totale,
               SUM(CASE WHEN ac.stato='completato' THEN 1 ELSE 0 END) as completati,
               SUM(CASE WHEN ac.stato='da_fare' THEN 1 ELSE 0 END) as da_fare
        FROM adempimenti_cliente ac
        JOIN adempimenti a ON ac.id_adempimento = a.id
        JOIN clienti c ON ac.id_cliente = c.id
        WHERE ac.anno=? AND c.attivo=1
        GROUP BY a.categoria
        ORDER BY a.categoria`, [anno]);

      // Clienti per categoria con dettagli
      const clientiPerCategoria = queryAll(`
        SELECT DISTINCT c.id, c.nome, c.codice_fiscale, c.partita_iva, c.email, c.telefono, 
               c.indirizzo, c.note, c.categorie_attive,
               t.codice as tipologia_codice, t.nome as tipologia_nome,
               s.nome as sottotipologia_nome,
               a.categoria
        FROM adempimenti_cliente ac
        JOIN adempimenti a ON ac.id_adempimento = a.id
        JOIN clienti c ON ac.id_cliente = c.id
        JOIN tipologie_cliente t ON c.id_tipologia = t.id
        LEFT JOIN sottotipologie s ON c.id_sottotipologia = s.id
        WHERE ac.anno=? AND c.attivo=1
        ORDER BY a.categoria, c.nome`, [anno]);

      const scadenzeAperte = queryAll(`
        SELECT c.nome, COUNT(*) as n FROM adempimenti_cliente ac
        JOIN clienti c ON ac.id_cliente=c.id
        WHERE ac.anno=? AND ac.stato='da_fare' AND c.attivo=1
        GROUP BY ac.id_cliente ORDER BY n DESC LIMIT 5`, [anno]);

      // Adempimenti stats con conteggio completati/da_fare per adempimento
      const adempimentiStats = queryAll(`
        SELECT a.id, a.codice, a.nome, a.categoria,
               COUNT(*) as totale,
               SUM(CASE WHEN ac.stato='completato' THEN 1 ELSE 0 END) as completati,
               SUM(CASE WHEN ac.stato='da_fare' THEN 1 ELSE 0 END) as da_fare
        FROM adempimenti_cliente ac
        JOIN adempimenti a ON ac.id_adempimento = a.id
        JOIN clienti c ON ac.id_cliente = c.id
        WHERE ac.anno=? AND c.attivo=1
        GROUP BY a.id
        ORDER BY a.categoria, a.codice`, [anno]);

      socket.emit('res:stats', { success: true, data: { totClienti, perTipologia, totAdempimenti, completati, daFare, inCorso, na, anno, scadenzeAperte, perCategoria, clientiPerCategoria, adempimentiStats } });
    } catch (e) { socket.emit('res:stats', { success: false, error: e.message }); }
  });

  socket.on('disconnect', () => { console.log(`❌ Client disconnesso: ${socket.id}`); });
  socket.on('error', (error) => { console.error(`⚠️ Errore Socket.IO (${socket.id}):`, error); });
  socket.on('ping', () => { socket.emit('pong', { timestamp: new Date().toISOString() }); });
});

const PORT = process.env.PORT || 3000;

const gracefulShutdown = (signal) => {
  console.log(`\nℹ️ ${signal} ricevuto. Chiusura in corso...`);
  server.close(() => {
    io.close(() => { process.exit(0); });
  });
  setTimeout(() => { process.exit(1); }, 10000);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("uncaughtException", (error) => { console.error("❌ Uncaught Exception:", error); });
process.on("unhandledRejection", (reason) => { console.error("❌ Unhandled Rejection:", reason); });

initDB().then(async () => {
  server.listen(PORT, "0.0.0.0", async () => {
    const localIP = getLocalIP();
    const publicIP = await getPublicIP();
    console.log(`✅ Backend avviato`);
    if (publicIP) console.log(`🌐 IP Pubblico: http://${publicIP}:${PORT}`);
    console.log(`🏠 IP Locale: http://${localIP}:${PORT}`);
    console.log(`📍 Localhost: http://localhost:${PORT}`);
  });
});