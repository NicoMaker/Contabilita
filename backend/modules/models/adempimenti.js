const { runQuery, queryAll, queryOne } = require("../database");

function getAdempimenti() {
  return queryAll(`SELECT * FROM adempimenti WHERE attivo = 1 ORDER BY nome`);
}

function getAdempimentiCliente(id_cliente, anno) {
  return queryAll(
    `
    SELECT DISTINCT 
      a.id, a.codice, a.nome, a.descrizione, a.scadenza_tipo,
      a.is_contabilita, a.has_rate, a.is_checkbox, a.rate_labels
    FROM adempimenti a
    INNER JOIN adempimenti_cliente ac ON a.id = ac.id_adempimento
    WHERE ac.id_cliente = ? AND ac.anno = ? AND a.attivo = 1
    ORDER BY a.nome
  `,
    [id_cliente, anno],
  );
}

function createAdempimento(data) {
  const esistente = queryOne(
    `SELECT id FROM adempimenti WHERE codice = ? AND attivo = 1`,
    [data.codice],
  );
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
  const baseCodice = data.nome
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_")
    .substring(0, 10);

  let codiceUnivoco = baseCodice;
  let counter = 1;

  while (
    queryOne(`SELECT id FROM adempimenti WHERE codice = ? AND attivo = 1`, [
      codiceUnivoco,
    ])
  ) {
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

  if (data.genera_immediatamente && data.clienti_selezionati) {
    const nuovoAdempimento = queryOne(
      `SELECT * FROM adempimenti WHERE id = ?`,
      [newId],
    );
    let generati = 0;
    let clientiDaProcessare = [];

    if (data.clienti_selezionati === "tutti") {
      const tuttiClienti = queryAll(`SELECT id FROM clienti WHERE attivo = 1`);
      clientiDaProcessare = tuttiClienti.map((c) => c.id);
    } else if (
      Array.isArray(data.clienti_selezionati) &&
      data.clienti_selezionati.length > 0
    ) {
      clientiDaProcessare = data.clienti_selezionati;
    }

    clientiDaProcessare.forEach((clienteId) => {
      generati += inserisciAdempimentoSeAssente(
        clienteId,
        nuovoAdempimento,
        data.anno || new Date().getFullYear(),
      );
    });

    return {
      id: newId,
      codice: codiceUnivoco,
      generati_per_clienti: generati,
      clienti_elaborati: clientiDaProcessare.length,
      messaggio: `Adempimento "${data.nome}" creato con codice "${codiceUnivoco}" e generato per ${generati} adempimenti su ${clientiDaProcessare.length} clienti`,
    };
  }

  return {
    id: newId,
    codice: codiceUnivoco,
    messaggio: `Adempimento "${data.nome}" creato con codice "${codiceUnivoco}"`,
  };
}

function checkAdempimentiClienteEsistenti(id_cliente, anno) {
  const adp = queryAll(`SELECT * FROM adempimenti WHERE attivo = 1`);
  const esistenti = queryAll(
    `SELECT id_adempimento, mese, trimestre, semestre FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno],
  );

  const risultato = [];

  adp.forEach((a) => {
    const status = {
      id_adempimento: a.id,
      nome: a.nome,
      codice: a.codice,
      scadenza_tipo: a.scadenza_tipo,
      esistenti: [],
      mancanti: [],
      totale: 0,
    };

    if (a.scadenza_tipo === "trimestrale") {
      status.totale = 4;
      for (let t = 1; t <= 4; t++) {
        const esiste = esistenti.find(
          (e) => e.id_adempimento === a.id && e.trimestre === t,
        );
        if (esiste) {
          status.esistenti.push({ periodo: `T${t}`, id: esiste.id });
        } else {
          status.mancanti.push({ periodo: `T${t}`, mese: t });
        }
      }
    } else if (a.scadenza_tipo === "semestrale") {
      status.totale = 2;
      for (let s = 1; s <= 2; s++) {
        const esiste = esistenti.find(
          (e) => e.id_adempimento === a.id && e.semestre === s,
        );
        if (esiste) {
          status.esistenti.push({ periodo: `S${s}`, id: esiste.id });
        } else {
          status.mancanti.push({ periodo: `S${s}`, mese: s * 6 });
        }
      }
    } else if (a.scadenza_tipo === "mensile") {
      status.totale = 12;
      for (let m = 1; m <= 12; m++) {
        const esiste = esistenti.find(
          (e) => e.id_adempimento === a.id && e.mese === m,
        );
        if (esiste) {
          status.esistenti.push({ periodo: getMeseNome(m), id: esiste.id });
        } else {
          status.mancanti.push({ periodo: getMeseNome(m), mese: m });
        }
      }
    } else {
      status.totale = 1;
      const esiste = esistenti.find(
        (e) =>
          e.id_adempimento === a.id &&
          e.mese === null &&
          e.trimestre === null &&
          e.semestre === null,
      );
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
  const mesi = [
    "Gen",
    "Feb",
    "Mar",
    "Apr",
    "Mag",
    "Giu",
    "Lug",
    "Ago",
    "Set",
    "Ott",
    "Nov",
    "Dic",
  ];
  return mesi[mese - 1] || "Mese";
}

function inserisciAdempimentoSeAssente(id_cliente, adp, anno) {
  let inseriti = 0;

  const esistenti = queryAll(
    `SELECT id, mese, trimestre, semestre FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ?`,
    [id_cliente, adp.id, anno],
  );

  if (adp.scadenza_tipo === "trimestrale") {
    for (let t = 1; t <= 4; t++) {
      const esiste = esistenti.find((e) => e.trimestre === t);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, trimestre, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, t, "da_fare"],
        );
        inseriti++;
      }
    }
  } else if (adp.scadenza_tipo === "semestrale") {
    for (let s = 1; s <= 2; s++) {
      const esiste = esistenti.find((e) => e.semestre === s);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, semestre, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, s, "da_fare"],
        );
        inseriti++;
      }
    }
  } else if (adp.scadenza_tipo === "mensile") {
    for (let m = 1; m <= 12; m++) {
      const esiste = esistenti.find((e) => e.mese === m);
      if (!esiste) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, m, "da_fare"],
        );
        inseriti++;
      }
    }
  } else {
    const esiste = esistenti.find(
      (e) => e.mese === null && e.trimestre === null && e.semestre === null,
    );
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

  const esistenti = queryAll(
    `SELECT id, mese, trimestre, semestre FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ?`,
    [id_cliente, adp.id, anno],
  );

  if (adp.scadenza_tipo === "trimestrale") {
    for (let t = 1; t <= 4; t++) {
      const esiste = esistenti.find((e) => e.trimestre === t);
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
          azione: "mantenuto",
        });
      }
    }
  } else if (adp.scadenza_tipo === "semestrale") {
    for (let s = 1; s <= 2; s++) {
      const esiste = esistenti.find((e) => e.semestre === s);
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
          azione: "mantenuto",
        });
      }
    }
  } else if (adp.scadenza_tipo === "mensile") {
    for (let m = 1; m <= 12; m++) {
      const esiste = esistenti.find((e) => e.mese === m);
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
          azione: "mantenuto",
        });
      }
    }
  } else {
    const esiste = esistenti.find(
      (e) => e.mese === null && e.trimestre === null && e.semestre === null,
    );
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
        azione: "mantenuto",
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
        dettagli: risultato.dettagli,
      });
    }
  });

  return { inseriti, mantenuti, dettagli };
}

function applicaAdempimentiAClienti(adempimenti_ids, clienti_ids, anno) {
  let totaleInseriti = 0;
  let totaleSkipped = 0;

  for (const adpId of adempimenti_ids) {
    const adp = queryOne(
      `SELECT * FROM adempimenti WHERE id = ? AND attivo = 1`,
      [adpId],
    );
    if (!adp) {
      console.warn(`Adempimento ${adpId} non trovato o non attivo`);
      continue;
    }

    for (const clienteId of clienti_ids) {
      const cliente = queryOne(
        `SELECT id FROM clienti WHERE id = ? AND attivo = 1`,
        [clienteId],
      );
      if (!cliente) {
        console.warn(`Cliente ${clienteId} non trovato o non attivo`);
        continue;
      }

      const risultato = inserisciAdempimentoSeAssenteConDettagli(
        clienteId,
        adp,
        anno,
      );
      totaleInseriti += risultato.inseriti;
      totaleSkipped += risultato.mantenuti;
    }
  }

  return {
    inseriti: totaleInseriti,
    skipped: totaleSkipped,
    clienti: clienti_ids.length,
    adempimenti: adempimenti_ids.length,
  };
}

// ─── ELIMINA ADEMPIMENTI DA CLIENTI (BULK) ────────────────────
// Per ogni combinazione adempimento×cliente elimina TUTTI i record
// dell'anno (mese/trimestre/semestre). Se il cliente non ha
// quell'adempimento viene ignorato senza errori.
function eliminaAdempimentiDaClienti(adempimenti_ids, clienti_ids, anno) {
  let eliminati = 0;
  let nonTrovati = 0;

  for (const adpId of adempimenti_ids) {
    for (const clienteId of clienti_ids) {
      const esistenti = queryAll(
        `SELECT id FROM adempimenti_cliente WHERE id_adempimento = ? AND id_cliente = ? AND anno = ?`,
        [adpId, clienteId, anno],
      );
      if (esistenti.length === 0) {
        nonTrovati++;
        continue;
      }
      runQuery(
        `DELETE FROM adempimenti_cliente WHERE id_adempimento = ? AND id_cliente = ? AND anno = ?`,
        [adpId, clienteId, anno],
      );
      eliminati += esistenti.length;
    }
  }

  return { eliminati, nonTrovati };
}

// ─── ELIMINA ADEMPIMENTI BULK PER UN SINGOLO CLIENTE ──────────
// Riceve un array di id di adempimenti_cliente (le righe precise, non
// id_adempimento) e le elimina tutte in una sola operazione.
function eliminaAdempimentiClienteBulk(ids_righe) {
  let eliminati = 0;
  for (const id of ids_righe) {
    const riga = queryOne(`SELECT id FROM adempimenti_cliente WHERE id = ?`, [id]);
    if (riga) {
      runQuery(`DELETE FROM adempimenti_cliente WHERE id = ?`, [id]);
      eliminati++;
    }
  }
  return { eliminati };
}

module.exports = {
  getAdempimenti,
  getAdempimentiCliente,
  createAdempimento,
  updateAdempimento,
  deleteAdempimento,
  generaAdempimentoPerTutti,
  inserisciAdempimentoSeAssente,
  canDeleteAdempimento,
  createAdempimentoPersonalizzato,
  checkAdempimentiClienteEsistenti,
  applicaAdempimentiAClienti,
  eliminaAdempimentiDaClienti,
  eliminaAdempimentiClienteBulk,
};