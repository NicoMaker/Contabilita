function createSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS tipologie_cliente (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      descrizione TEXT,
      colore TEXT DEFAULT '#5b8df6'
    )
  `);

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

  db.run(`
    CREATE TABLE IF NOT EXISTS clienti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
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
      attivo INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // ⭐ NUOVA TABELLA: configurazioni annuali del cliente
  db.run(`
    CREATE TABLE IF NOT EXISTS clienti_config_annuale (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_cliente INTEGER NOT NULL,
      anno INTEGER NOT NULL,
      id_tipologia INTEGER NOT NULL,
      id_sottotipologia INTEGER,
      col2_value TEXT,
      col3_value TEXT,
      periodicita TEXT,
      UNIQUE(id_cliente, anno),
      FOREIGN KEY (id_cliente) REFERENCES clienti(id),
      FOREIGN KEY (id_tipologia) REFERENCES tipologie_cliente(id),
      FOREIGN KEY (id_sottotipologia) REFERENCES sottotipologie(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS adempimenti (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codice TEXT NOT NULL UNIQUE,
      nome TEXT NOT NULL,
      descrizione TEXT,
      scadenza_tipo TEXT CHECK(scadenza_tipo IN ('annuale','semestrale','trimestrale','mensile')),
      is_contabilita INTEGER DEFAULT 0,
      has_rate INTEGER DEFAULT 0,
      is_checkbox INTEGER DEFAULT 0,
      rate_labels TEXT,
      attivo INTEGER DEFAULT 1
    )
  `);

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
      cont_completata INTEGER DEFAULT 0,
      UNIQUE(id_cliente, id_adempimento, anno, mese, trimestre, semestre),
      FOREIGN KEY (id_cliente) REFERENCES clienti(id),
      FOREIGN KEY (id_adempimento) REFERENCES adempimenti(id)
    )
  `);
  console.log("📐 Schema creato");
}

function seedData(db) {
  // Tipologie
  const tipologie = [
    { codice: "PF", nome: "Persona Fisica", descrizione: "Contribuente persona fisica", colore: "#5b8df6" },
    { codice: "SP", nome: "Società di Persone", descrizione: "SNC, SAS, SS", colore: "#fbbf24" },
    { codice: "SC", nome: "Società di Capitali", descrizione: "SRL, SPA, SAPA", colore: "#34d399" },
    { codice: "ASS", nome: "Associazione", descrizione: "Associazioni e enti non commerciali", colore: "#f472b6" },
  ];
  tipologie.forEach(t =>
    db.run(`INSERT INTO tipologie_cliente (codice,nome,descrizione,colore) VALUES (?,?,?,?)`,
      [t.codice, t.nome, t.descrizione, t.colore])
  );

  // Sottotipologie
  const sottotipologie = [
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
    { it: 2, c: "SP_ORD", n: "SP – Ordinaria", sep: 0, ord: 1 },
    { it: 2, c: "SP_SEMP", n: "SP – Semplificata", sep: 0, ord: 2 },
    { it: 3, c: "SC_ORD", n: "SC – Ordinaria", sep: 0, ord: 1 },
    { it: 4, c: "ASS_ORD", n: "ASS – Ordinaria", sep: 0, ord: 1 },
    { it: 4, c: "ASS_SEMP", n: "ASS – Semplificata", sep: 0, ord: 2 },
  ];
  sottotipologie.forEach(s =>
    db.run(`INSERT INTO sottotipologie (id_tipologia,codice,nome,is_separator,ordine) VALUES (?,?,?,?,?)`,
      [s.it, s.c, s.n, s.sep, s.ord])
  );

  // Adempimenti
  const adempimenti = [
    { codice: "TASSA_NID", nome: "Tassa NID", scad: "annuale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "INAIL", nome: "INAIL", scad: "annuale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "INPS_TRIM", nome: "INPS Trimestrale", scad: "trimestrale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "LIPE", nome: "LIPE", scad: "trimestrale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "ACCONTO_IVA", nome: "Acconto IVA", scad: "annuale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "CU", nome: "Certificazione Unica", scad: "annuale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "770", nome: "Modello 770", scad: "annuale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "DICH_IVA", nome: "Dichiarazione IVA", scad: "annuale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "BILANCIO", nome: "Bilancio", scad: "annuale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "DIR_ANNUALE", nome: "Diritto Annuale CCIAA", scad: "annuale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "IRAP", nome: "IRAP", scad: "annuale", ic: 0, hr: 1, cb: 0, rl: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: "DICH_REDDITI", nome: "Dichiarazione Redditi", scad: "annuale", ic: 0, hr: 1, cb: 0, rl: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: "MOD730", nome: "Modello 730", scad: "annuale", ic: 0, hr: 1, cb: 0, rl: '["Saldo","1° Acconto","2° Acconto"]' },
    { codice: "IMU", nome: "IMU", scad: "semestrale", ic: 0, hr: 0, cb: 0, rl: null },
    { codice: "CONTABILITA", nome: "Contabilità / F24", scad: "mensile", ic: 1, hr: 0, cb: 0, rl: null },
    { codice: "CHECK_SIMPLE", nome: "Checklist Semplice", scad: "annuale", ic: 0, hr: 0, cb: 1, rl: null },
  ];
  adempimenti.forEach(a =>
    db.run(`INSERT INTO adempimenti (codice,nome,descrizione,scadenza_tipo,is_contabilita,has_rate,is_checkbox,rate_labels) VALUES (?,?,?,?,?,?,?,?)`,
      [a.codice, a.nome, null, a.scad, a.ic, a.hr, a.cb, a.rl])
  );

  // Clienti base
  const clienti = [
    {
      nome: "Mario Rossi",
      cf: "RSSMRA80A01L219K", piva: "12345678901", email: "mario.rossi@email.it", tel: "333 1234567",
      indirizzo: "Via Roma 1", citta: "Udine", cap: "33100", prov: "UD",
      pec: "mario.rossi@pec.it", sdi: "XXXXXXX", note: "Cliente storico", referente: "Mario Rossi",
    },
    {
      nome: "Anna Bianchi",
      cf: "BNCNNA85M41F205X", piva: null, email: "anna.bianchi@email.it", tel: "347 9876543",
      indirizzo: "Via Venezia 5", citta: "Trieste", cap: "34100", prov: "TS",
      pec: null, sdi: null, note: "", referente: "",
    },
    {
      nome: "Studio Verdi SNC",
      cf: null, piva: "01234567890", email: "info@studioverdi.it", tel: "0432 123456",
      indirizzo: "Corso Vittorio 10", citta: "Udine", cap: "33100", prov: "UD",
      pec: "studioverdi@pec.it", sdi: "KRRH6B9", note: "Ref: dott. Verdi", referente: "Dott. Verdi",
    },
    {
      nome: "Alfa Srl",
      cf: null, piva: "09876543210", email: "info@alfasrl.it", tel: "040 654321",
      indirizzo: "Zona Industriale", citta: "Trieste", cap: "34100", prov: "TS",
      pec: "alfa@pec.it", sdi: "M5UXCR1", note: "", referente: "Dott. Alfa",
    },
  ];

  clienti.forEach(c => {
    db.run(`INSERT INTO clienti (nome,codice_fiscale,partita_iva,email,telefono,indirizzo,citta,cap,provincia,pec,sdi,note,referente) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [c.nome, c.cf, c.piva, c.email, c.tel, c.indirizzo, c.citta, c.cap, c.prov, c.pec, c.sdi, c.note, c.referente]);
  });

  // Configurazioni annuali per i clienti (anno corrente)
  const configs = [
    { id_cliente: 1, anno: 2025, id_tipologia: 1, id_sottotipologia: 3, col2: "ditta", col3: "ordinario", per: "mensile" },      // Mario Rossi - Ditta Ordinario
    { id_cliente: 2, anno: 2025, id_tipologia: 1, id_sottotipologia: 1, col2: "privato", col3: null, per: null },               // Anna Bianchi - Privato
    { id_cliente: 3, anno: 2025, id_tipologia: 2, id_sottotipologia: 11, col2: null, col3: "ordinaria", per: "mensile" },        // Studio Verdi - SP Ordinaria
    { id_cliente: 4, anno: 2025, id_tipologia: 3, id_sottotipologia: 13, col2: null, col3: "ordinaria", per: "trimestrale" },    // Alfa Srl - SC Ordinaria
  ];

  configs.forEach(c =>
    db.run(`INSERT INTO clienti_config_annuale (id_cliente,anno,id_tipologia,id_sottotipologia,col2_value,col3_value,periodicita) VALUES (?,?,?,?,?,?,?)`,
      [c.id_cliente, c.anno, c.id_tipologia, c.id_sottotipologia, c.col2, c.col3, c.per])
  );

  console.log("🌱 Dati seed inseriti");
}

module.exports = { createSchema, seedData };