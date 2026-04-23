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


  console.log("🌱 Dati seed inseriti");
}

module.exports = { createSchema, seedData };