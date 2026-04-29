const { runQuery, queryAll, queryOne } = require("../database");

function getAdempimenti() {
  return queryAll(`SELECT * FROM adempimenti WHERE attivo = 1 ORDER BY nome`);
}

function getAdempimentiCliente(id_cliente, anno) {
  return queryAll(`
    SELECT DISTINCT 
      a.id, a.codice, a.nome, a.descrizione, a.scadenza_tipo,
      a.is_contabilita, a.has_rate, a.is_checkbox, a.rate_labels
    FROM adempimenti a
    INNER JOIN adempimenti_cliente ac ON a.id = ac.id_adempimento
    WHERE ac.id_cliente = ? AND ac.anno = ? AND a.attivo = 1
    ORDER BY a.nome
  `, [id_cliente, anno]);
}

function createAdempimento(data) {
  // Verifica se il codice esiste già
  const esistente = queryOne(`SELECT id FROM adempimenti WHERE codice = ? AND attivo = 1`, [data.codice]);
  if (esistente) {
    throw new Error(`Codice adempimento "${data.codice}" già esistente`);
  }
  
  const rl = data.rate_labels ? JSON.stringify(data.rate_labels) : null;
  runQuery(
    `INSERT INTO adempimenti (codice, nome, descrizione, scadenza_tipo, is_contabilita, has_rate, is_checkbox, rate_labels) 
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      data.codice,
      data.nome,
      data.descrizione || null,
      data.scadenza_tipo,
      data.is_contabilita || 0,
      data.has_rate || 0,
      data.is_checkbox || 0,
      rl,
    ],
  );
  return queryOne(`SELECT last_insert_rowid() as id`).id;
}

function updateAdempimento(data) {
  const rl = data.rate_labels ? JSON.stringify(data.rate_labels) : null;
  runQuery(
    `UPDATE adempimenti SET 
      codice = ?, nome = ?, descrizione = ?, scadenza_tipo = ?, 
      is_contabilita = ?, has_rate = ?, is_checkbox = ?, rate_labels = ? 
     WHERE id = ?`,
    [
      data.codice,
      data.nome,
      data.descrizione || null,
      data.scadenza_tipo,
      data.is_contabilita || 0,
      data.has_rate || 0,
      data.is_checkbox || 0,
      rl,
      data.id,
    ],
  );
}

function deleteAdempimento(id) {
  const count = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_adempimento = ?`,
    [id],
  );
  if (count.cnt > 0) {
    throw new Error(
      `Impossibile eliminare l'adempimento: è assegnato a ${count.cnt} clienti. Elimina prima gli adempimenti dai clienti.`,
    );
  }
  runQuery(`UPDATE adempimenti SET attivo = 0 WHERE id = ?`, [id]);
}

function canDeleteAdempimento(id) {
  const count = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_adempimento = ?`,
    [id],
  );
  return { canDelete: count.cnt === 0, clientiCount: count.cnt };
}

function createAdempimentoPersonalizzato(data) {
  // Genera un codice univoco basato sul nome
  const baseCodice = data.nome.toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .substring(0, 10);
  
  let codiceUnivoco = baseCodice;
  let counter = 1;
  
  // Controlla se il codice esiste già e genera uno univoco
  while (queryOne(`SELECT id FROM adempimenti WHERE codice = ? AND attivo = 1`, [codiceUnivoco])) {
    codiceUnivoco = `${baseCodice}_${counter}`;
    counter++;
  }
  
  const rl = data.rate_labels ? JSON.stringify(data.rate_labels) : null;
  runQuery(
    `INSERT INTO adempimenti (codice, nome, descrizione, scadenza_tipo, is_contabilita, has_rate, is_checkbox, rate_labels) 
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      codiceUnivoco,
      data.nome,
      data.descrizione || `Adempimento personalizzato: ${data.nome}`,
      data.scadenza_tipo || "annuale",
      data.is_contabilita || 0,
      data.has_rate || 0,
      data.is_checkbox || 0,
      rl,
    ],
  );
  
  const newId = queryOne(`SELECT last_insert_rowid() as id`).id;
  
  // Se specificato, genera immediatamente l'adempimento per i clienti selezionati
  if (data.genera_immediatamente && data.clienti_selezionati && data.clienti_selezionati.length > 0) {
    const nuovoAdempimento = queryOne(`SELECT * FROM adempimenti WHERE id = ?`, [newId]);
    let generati = 0;
    
    data.clienti_selezionati.forEach(clienteId => {
      generati += inserisciAdempimentoSeAssente(clienteId, nuovoAdempimento, data.anno || new Date().getFullYear());
    });
    
    return { 
      id: newId, 
      codice: codiceUnivoco,
      generati_per_clienti: generati,
      messaggio: `Adempimento "${data.nome}" creato con codice "${codiceUnivoco}" e generato per ${generati} clienti`
    };
  }
  
  return { 
    id: newId, 
    codice: codiceUnivoco,
    messaggio: `Adempimento "${data.nome}" creato con codice "${codiceUnivoco}"`
  };
}

function checkAdempimentiClienteEsistenti(id_cliente, anno) {
  const adp = queryAll(`SELECT * FROM adempimenti WHERE attivo = 1`);
  const esistenti = queryAll(
    `SELECT id_adempimento, mese, trimestre, semestre FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno]
  );
  
  const risultato = [];
  
  adp.forEach(a => {
    const status = {
      id_adempimento: a.id,
      nome: a.nome,
      codice: a.codice,
      scadenza_tipo: a.scadenza_tipo,
      esistenti: [],
      mancanti: [],
      totale: 0
    };
    
    if (a.scadenza_tipo === "trimestrale") {
      status.totale = 4;
      for (let t = 1; t <= 4; t++) {
        const esiste = esistenti.find(e => e.id_adempimento === a.id && e.trimestre === t);
        if (esiste) {
          status.esistenti.push({ periodo: `T${t}`, id: esiste.id });
        } else {
          status.mancanti.push({ periodo: `T${t}`, mese: t });
        }
      }
    } else if (a.scadenza_tipo === "semestrale") {
      status.totale = 2;
      for (let s = 1; s <= 2; s++) {
        const esiste = esistenti.find(e => e.id_adempimento === a.id && e.semestre === s);
        if (esiste) {
          status.esistenti.push({ periodo: `S${s}`, id: esiste.id });
        } else {
          status.mancanti.push({ periodo: `S${s}`, mese: s * 6 });
        }
      }
    } else if (a.scadenza_tipo === "mensile") {
      // Per i mensili crea 12 mesi da Gen a Dic
      status.totale = 12;
      for (let m = 1; m <= 12; m++) {
        const esiste = esistenti.find(e => e.id_adempimento === a.id && e.mese === m);
        if (esiste) {
          status.esistenti.push({ periodo: getMeseNome(m), id: esiste.id });
        } else {
          status.mancanti.push({ periodo: getMeseNome(m), mese: m });
        }
      }
    } else if (a.scadenza_tipo === "annuale") {
      // Per gli annuali crea 1 solo record
      status.totale = 1;
      const esiste = esistenti.find(e => e.id_adempimento === a.id && e.mese === null && e.trimestre === null && e.semestre === null);
      if (esiste) {
        status.esistenti.push({ periodo: "Ann", id: esiste.id });
      } else {
        status.mancanti.push({ periodo: "Ann", mese: null });
      }
    } else {
      // Annuale semplice
      status.totale = 1;
      const esiste = esistenti.find(e => e.id_adempimento === a.id && e.mese === null && e.trimestre === null && e.semestre === null);
      if (esiste) {
        status.esistenti.push({ periodo: "Ann", id: esiste.id });
      } else {
        status.mancanti.push({ periodo: "Ann", mese: null });
      }
    }
    
    risultato.push(status);
  });
  
  return risultato;
}

function getMeseNome(mese) {
  const mesi = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
  return mesi[mese - 1] || "Mese";
}

function inserisciAdempimentoSeAssente(id_cliente, adp, anno) {
  let inseriti = 0;
  
  // Ottieni la periodicita del cliente
  const clienteConfig = queryOne(
    `SELECT periodicita FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno]
  );
  
  // Prima controlla se esistono già record per questo cliente/adempimento/anno
  const esistenti = queryAll(
    `SELECT id, mese, trimestre, semestre FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ?`,
    [id_cliente, adp.id, anno]
  );
  
  if (adp.scadenza_tipo === "trimestrale") {
    console.log(`DEBUG: Creazione trimestrale per cliente ${id_cliente}, adp ${adp.id}, anno ${anno}`);
    console.log(`DEBUG: Record esistenti trovati:`, esistenti);
    
    for (let t = 1; t <= 4; t++) {
      const esiste = esistenti.find(e => e.trimestre === t);
      console.log(`DEBUG: Trimestre ${t} - esiste:`, !!esiste);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, trimestre, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, t, "da_fare"],
        );
        inseriti++;
        console.log(`DEBUG: Inserito trimestre ${t}`);
      }
    }
    console.log(`DEBUG: Totale inseriti trimestrali: ${inseriti}`);
  } else if (adp.scadenza_tipo === "semestrale") {
    console.log(`DEBUG: Creazione semestrale per cliente ${id_cliente}, adp ${adp.id}, anno ${anno}`);
    console.log(`DEBUG: Record esistenti trovati:`, esistenti);
    
    for (let s = 1; s <= 2; s++) {
      const esiste = esistenti.find(e => e.semestre === s);
      console.log(`DEBUG: Semestre ${s} - esiste:`, !!esiste);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, semestre, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, s, "da_fare"],
        );
        inseriti++;
        console.log(`DEBUG: Inserito semestre ${s}`);
      }
    }
    console.log(`DEBUG: Totale inseriti semestrali: ${inseriti}`);
  } else if (adp.scadenza_tipo === "mensile") {
    // Crea sempre 12 mesi da Gen a Dic
    console.log(`DEBUG: Creazione mensile per cliente ${id_cliente}, adp ${adp.id}, anno ${anno}`);
    console.log(`DEBUG: Record esistenti trovati:`, esistenti);
    
    for (let m = 1; m <= 12; m++) {
      const esiste = esistenti.find(e => e.mese === m);
      console.log(`DEBUG: Mese ${m} - esiste:`, !!esiste);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, m, "da_fare"],
        );
        inseriti++;
        console.log(`DEBUG: Inserito mese ${m}`);
      }
    }
    console.log(`DEBUG: Totale inseriti mensili: ${inseriti}`);
  } else if (adp.scadenza_tipo === "annuale") {
    // Gli adempimenti annuali creano 1 solo record
    const esiste = esistenti.find(e => e.mese === null && e.trimestre === null && e.semestre === null);
    if (!esiste) {
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, stato) VALUES (?,?,?,?)`,
        [id_cliente, adp.id, anno, "da_fare"],
      );
      inseriti++;
    }
  } else {
    const esiste = esistenti.find(e => e.mese === null && e.trimestre === null && e.semestre === null);
    if (!esiste) {
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, stato) VALUES (?,?,?,?)`,
        [id_cliente, adp.id, anno, "da_fare"],
      );
      inseriti++;
    }
  }
  return inseriti;
}

function inserisciAdempimentoSeAssenteConDettagli(id_cliente, adp, anno) {
  let inseriti = 0;
  let mantenuti = 0;
  const dettagli = [];
  
  // Ottieni la periodicita del cliente
  const clienteConfig = queryOne(
    `SELECT periodicita FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno]
  );
  
  // Prima controlla se esistono già record per questo cliente/adempimento/anno
  const esistenti = queryAll(
    `SELECT id, mese, trimestre, semestre FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ?`,
    [id_cliente, adp.id, anno]
  );
  
  if (adp.scadenza_tipo === "trimestrale") {
    for (let t = 1; t <= 4; t++) {
      const esiste = esistenti.find(e => e.trimestre === t);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, trimestre, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, t, "da_fare"],
        );
        inseriti++;
      } else {
        mantenuti++;
        dettagli.push({
          tipo: "trimestre",
          valore: t,
          id_esistente: esiste.id,
          azione: "mantenuto"
        });
      }
    }
  } else if (adp.scadenza_tipo === "semestrale") {
    for (let s = 1; s <= 2; s++) {
      const esiste = esistenti.find(e => e.semestre === s);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, semestre, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, s, "da_fare"],
        );
        inseriti++;
      } else {
        mantenuti++;
        dettagli.push({
          tipo: "semestre",
          valore: s,
          id_esistente: esiste.id,
          azione: "mantenuto"
        });
      }
    }
  } else if (adp.scadenza_tipo === "mensile") {
    // Crea sempre 12 mesi da Gen a Dic
    for (let m = 1; m <= 12; m++) {
      const esiste = esistenti.find(e => e.mese === m);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, m, "da_fare"],
        );
        inseriti++;
      } else {
        mantenuti++;
        dettagli.push({
          tipo: "mese",
          valore: m,
          id_esistente: esiste.id,
          azione: "mantenuto"
        });
      }
    }
  } else if (adp.scadenza_tipo === "annuale") {
    // Gli adempimenti annuali creano 1 solo record
    const esiste = esistenti.find(e => e.mese === null && e.trimestre === null && e.semestre === null);
    if (!esiste) {
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, stato) VALUES (?,?,?,?)`,
        [id_cliente, adp.id, anno, "da_fare"],
      );
      inseriti++;
    } else {
      mantenuti++;
      dettagli.push({
        tipo: "annuale",
        valore: null,
        id_esistente: esiste.id,
        azione: "mantenuto (annuale)"
      });
    }
  } else {
    const esiste = esistenti.find(e => e.mese === null && e.trimestre === null && e.semestre === null);
    if (!esiste) {
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, stato) VALUES (?,?,?,?)`,
        [id_cliente, adp.id, anno, "da_fare"],
      );
      inseriti++;
    } else {
      mantenuti++;
      dettagli.push({
        tipo: "annuale",
        valore: null,
        id_esistente: esiste.id,
        azione: "mantenuto"
      });
    }
  }
  return { inseriti, mantenuti, dettagli };
}

function generaAdempimentoPerTutti(id_adp, anno) {
  const a = queryOne(`SELECT * FROM adempimenti WHERE id = ?`, [id_adp]);
  if (!a) return { inseriti: 0, mantenuti: 0, dettagli: [] };
  
  let inseriti = 0;
  let mantenuti = 0;
  const dettagli = [];
  
  const clienti = queryAll(`SELECT id, nome FROM clienti WHERE attivo = 1`);
  clienti.forEach((c) => {
    const risultato = inserisciAdempimentoSeAssenteConDettagli(c.id, a, anno);
    inseriti += risultato.inseriti;
    mantenuti += risultato.mantenuti;
    if (risultato.dettagli.length > 0) {
      dettagli.push({
        cliente: c.nome,
        cliente_id: c.id,
        dettagli: risultato.dettagli
      });
    }
  });
  
  return { inseriti, mantenuti, dettagli };
}

function rigeneraAdempimentoPerTutti(id_adp, anno) {
  const a = queryOne(`SELECT * FROM adempimenti WHERE id = ?`, [id_adp]);
  if (!a) return 0;
  let tot = 0;
  queryAll(`SELECT id FROM clienti WHERE attivo = 1`).forEach((c) => {
    tot += inserisciAdempimentoForzato(c.id, a, anno);
  });
  return tot;
}

function inserisciAdempimentoForzato(id_cliente, adp, anno) {
  let inseriti = 0;
  
  // Prima elimina gli adempimenti esistenti per questo cliente/adempimento/anno
  if (adp.scadenza_tipo === "trimestrale") {
    runQuery(
      `DELETE FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ?`,
      [id_cliente, adp.id, anno]
    );
    for (let t = 1; t <= 4; t++) {
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, trimestre, stato) VALUES (?,?,?,?,?)`,
        [id_cliente, adp.id, anno, t, "da_fare"],
      );
      inseriti++;
    }
  } else if (adp.scadenza_tipo === "semestrale") {
    runQuery(
      `DELETE FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ?`,
      [id_cliente, adp.id, anno]
    );
    for (let s = 1; s <= 2; s++) {
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, semestre, stato) VALUES (?,?,?,?,?)`,
        [id_cliente, adp.id, anno, s, "da_fare"],
      );
      inseriti++;
    }
  } else if (adp.scadenza_tipo === "mensile") {
    runQuery(
      `DELETE FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ?`,
      [id_cliente, adp.id, anno]
    );
    for (let m = 1; m <= 12; m++) {
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, stato) VALUES (?,?,?,?,?)`,
        [id_cliente, adp.id, anno, m, "da_fare"],
      );
      inseriti++;
    }
  } else {
    runQuery(
      `DELETE FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ? AND mese IS NULL AND trimestre IS NULL AND semestre IS NULL`,
      [id_cliente, adp.id, anno]
    );
    runQuery(
      `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, stato) VALUES (?,?,?,?)`,
      [id_cliente, adp.id, anno, "da_fare"],
    );
    inseriti++;
  }
  return inseriti;
}

module.exports = {
  getAdempimenti,
  getAdempimentiCliente,
  createAdempimento,
  updateAdempimento,
  deleteAdempimento,
  generaAdempimentoPerTutti,
  rigeneraAdempimentoPerTutti,
  inserisciAdempimentoSeAssente,
  canDeleteAdempimento,
  createAdempimentoPersonalizzato,
  checkAdempimentiClienteEsistenti,
};
