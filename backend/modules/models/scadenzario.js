const { runQuery, queryAll, queryOne } = require("../database");
const { inserisciAdempimentoSeAssente, inserisciAdempimentoSeAssenteConDettagli } = require("./adempimenti");
const ANNO_DELETE_MARKER = "__ANNO_ELIMINATO__";

// ─── HELPER: anno dalla data_scadenza o anno corrente ─────────
function _annoFromRow(anno) {
  return anno || new Date().getFullYear();
}

function getScadenzarioConDettagliCliente(id_cliente, anno, filtri = {}) {
  let sql = `
    SELECT 
      ac.*,
      a.codice as adempimento_codice,
      a.nome as adempimento_nome,
      a.scadenza_tipo,
      a.is_contabilita,
      a.has_rate,
      a.rate_labels,
      a.is_checkbox,
      c.id as cliente_id,
      c.nome as cliente_nome,
      c.codice_fiscale as cliente_cf,
      c.partita_iva as cliente_piva,
      c.email as cliente_email,
      c.telefono as cliente_tel,
      cfg.id_tipologia as cliente_id_tipologia,
      t.codice as cliente_tipologia_codice,
      t.colore as cliente_tipologia_colore,
      s.codice as cliente_sottotipologia_codice,
      s.nome as cliente_sottotipologia_nome,
      cfg.periodicita as cliente_periodicita,
      cfg.col2_value as cliente_col2,
      cfg.col3_value as cliente_col3
    FROM adempimenti_cliente ac
    JOIN adempimenti a ON ac.id_adempimento = a.id
    JOIN clienti c ON ac.id_cliente = c.id
    INNER JOIN clienti_config_annuale cfg
      ON cfg.id = (
        SELECT c2.id
        FROM clienti_config_annuale c2
        WHERE c2.id_cliente = c.id AND c2.anno <= ?
        ORDER BY c2.anno DESC
        LIMIT 1
      )
    LEFT JOIN tipologie_cliente t      ON t.id      = cfg.id_tipologia
    LEFT JOIN sottotipologie   s      ON s.id      = cfg.id_sottotipologia
    WHERE ac.id_cliente = ? AND ac.anno = ? AND IFNULL(cfg.col2_value, '') != ?
  `;
  const params = [anno, id_cliente, anno, ANNO_DELETE_MARKER];

  if (filtri.stato && filtri.stato !== "tutti") {
    sql += ` AND ac.stato = ?`;
    params.push(filtri.stato);
  }
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (a.nome LIKE ? OR a.codice LIKE ?)`;
    params.push(s, s);
  }

  // Adempimenti in ordine alfabetico, poi cliente alfabetico, poi periodo
  sql += ` ORDER BY a.nome COLLATE NOCASE, c.nome COLLATE NOCASE, ac.mese, ac.trimestre, ac.semestre`;
  return queryAll(sql, params);
}

function getScadenzarioGlobale(anno, filtri = {}) {
  let sql = `
    SELECT 
      ac.*,
      a.codice as adempimento_codice,
      a.nome as adempimento_nome,
      a.scadenza_tipo,
      a.is_contabilita,
      a.has_rate,
      a.rate_labels,
      a.is_checkbox,
      c.id as cliente_id,
      c.nome as cliente_nome,
      c.codice_fiscale as cliente_cf,
      c.partita_iva as cliente_piva,
      c.email as cliente_email,
      c.telefono as cliente_tel,
      cfg.id_tipologia as cliente_id_tipologia,
      t.codice as cliente_tipologia_codice,
      t.colore as cliente_tipologia_colore,
      s.codice as cliente_sottotipologia_codice,
      s.nome as cliente_sottotipologia_nome,
      cfg.periodicita as cliente_periodicita,
      cfg.col2_value as cliente_col2,
      cfg.col3_value as cliente_col3
    FROM adempimenti_cliente ac
    JOIN adempimenti a ON ac.id_adempimento = a.id
    JOIN clienti c ON ac.id_cliente = c.id
    LEFT JOIN clienti_config_annuale cfg
      ON cfg.id = (
        SELECT c2.id
        FROM clienti_config_annuale c2
        WHERE c2.id_cliente = c.id AND c2.anno <= ?
        ORDER BY c2.anno DESC
        LIMIT 1
      )
    LEFT JOIN tipologie_cliente t      ON t.id      = cfg.id_tipologia
    LEFT JOIN sottotipologie   s      ON s.id      = cfg.id_sottotipologia
    WHERE ac.anno = ? AND c.attivo = 1 AND (cfg.id IS NULL OR IFNULL(cfg.col2_value, '') != ?)
  `;
  const params = [anno, anno, ANNO_DELETE_MARKER];

  if (filtri.stato && filtri.stato !== "tutti") {
    sql += ` AND ac.stato = ?`;
    params.push(filtri.stato);
  }
  if (filtri.adempimento) {
    sql += ` AND a.nome = ?`;
    params.push(filtri.adempimento);
  }
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR a.nome LIKE ?)`;
    params.push(s, s, s, s);
  }

  // Adempimenti in ordine alfabetico, poi clienti in ordine alfabetico, poi periodo
  sql += ` ORDER BY a.nome COLLATE NOCASE, c.nome COLLATE NOCASE, ac.mese, ac.trimestre, ac.semestre`;
  return queryAll(sql, params);
}

function generaScadenzarioInterno(id_cliente, anno) {
  const adps = queryAll(`SELECT * FROM adempimenti WHERE attivo = 1`);
  let tot = 0;
  adps.forEach((a) => {
    tot += inserisciAdempimentoSeAssente(id_cliente, a, anno);
  });
  return tot;
}

function generaTuttiClientiAnno(anno, adempimentiSelezionati = null) {
  const clienti = queryAll(
    `SELECT c.id, c.nome
     FROM clienti c
     INNER JOIN clienti_config_annuale cfg
       ON cfg.id = (
         SELECT c2.id
         FROM clienti_config_annuale c2
         WHERE c2.id_cliente = c.id AND c2.anno <= ?
         ORDER BY c2.anno DESC
         LIMIT 1
       )
     WHERE c.attivo = 1 AND IFNULL(cfg.col2_value, '') != ?`,
    [anno, ANNO_DELETE_MARKER],
  );
  let adempimenti;
  
  if (adempimentiSelezionati && adempimentiSelezionati.length > 0) {
    const placeholders = adempimentiSelezionati.map(() => '?').join(',');
    adempimenti = queryAll(
      `SELECT * FROM adempimenti WHERE attivo = 1 AND id IN (${placeholders})`,
      adempimentiSelezionati
    );
  } else {
    adempimenti = queryAll(`SELECT * FROM adempimenti WHERE attivo = 1`);
  }
  
  let totaleInseriti = 0;
  let totaleMantenuti = 0;
  const dettagliCompleti = [];
  
  clienti.forEach((c) => {
    adempimenti.forEach((a) => {
      const risultato = inserisciAdempimentoSeAssenteConDettagli(c.id, a, anno);
      totaleInseriti += risultato.inseriti;
      totaleMantenuti += risultato.mantenuti;
      
      if (risultato.dettagli.length > 0) {
        dettagliCompleti.push({
          cliente: c.nome,
          cliente_id: c.id,
          adempimento: a.nome,
          adempimento_id: a.id,
          dettagli: risultato.dettagli
        });
      }
    });
  });
  
  return {
    inseriti: totaleInseriti,
    mantenuti: totaleMantenuti,
    dettagli: dettagliCompleti,
    riepilogo: `Generati ${totaleInseriti} nuovi adempimenti, mantenuti ${totaleMantenuti} adempimenti esistenti`
  };
}

function rigeneraTuttiClientiAnno(anno, adempimentiSelezionati = null) {
  const clienti = queryAll(
    `SELECT c.id
     FROM clienti c
     INNER JOIN clienti_config_annuale cfg
       ON cfg.id = (
         SELECT c2.id
         FROM clienti_config_annuale c2
         WHERE c2.id_cliente = c.id AND c2.anno <= ?
         ORDER BY c2.anno DESC
         LIMIT 1
       )
     WHERE c.attivo = 1 AND IFNULL(cfg.col2_value, '') != ?`,
    [anno, ANNO_DELETE_MARKER],
  );
  let adempimenti;
  
  if (adempimentiSelezionati && adempimentiSelezionati.length > 0) {
    const placeholders = adempimentiSelezionati.map(() => '?').join(',');
    adempimenti = queryAll(
      `SELECT * FROM adempimenti WHERE attivo = 1 AND id IN (${placeholders})`,
      adempimentiSelezionati
    );
  } else {
    adempimenti = queryAll(`SELECT * FROM adempimenti WHERE attivo = 1`);
  }
  
  let tot = 0;
  clienti.forEach((c) => {
    adempimenti.forEach((a) => {
      tot += inserisciAdempimentoForzato(c.id, a, anno);
    });
  });
  return tot;
}

function copiaScadenzarioCliente(id_cliente, anno_da, anno_a) {
  const righe = queryAll(
    `SELECT * FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno_da],
  );
  let tot = 0;
  righe.forEach((r) => {
    const ex = queryOne(
      `SELECT id FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ? AND COALESCE(mese,0) = COALESCE(?,0) AND COALESCE(trimestre,0) = COALESCE(?,0) AND COALESCE(semestre,0) = COALESCE(?,0)`,
      [id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre],
    );
    if (!ex) {
      try {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, trimestre, semestre, stato) VALUES (?,?,?,?,?,?,?)`,
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
    }
  });
  return tot;
}

function copiaTuttiClienti(anno_da, anno_a) {
  let tot = 0;
  queryAll(
    `SELECT c.id
     FROM clienti c
     INNER JOIN clienti_config_annuale cfg
       ON cfg.id = (
         SELECT c2.id
         FROM clienti_config_annuale c2
         WHERE c2.id_cliente = c.id AND c2.anno <= ?
         ORDER BY c2.anno DESC
         LIMIT 1
       )
     WHERE c.attivo = 1 AND IFNULL(cfg.col2_value, '') != ?`,
    [anno_da, ANNO_DELETE_MARKER],
  ).forEach((c) => {
    tot += copiaScadenzarioCliente(c.id, anno_da, anno_a);
  });
  return tot;
}

function updateAdempimentoStato(data) {
  runQuery(
    `UPDATE adempimenti_cliente SET 
      stato = ?, data_scadenza = ?, data_completamento = ?, note = ?,
      importo = ?, importo_saldo = ?, importo_acconto1 = ?, importo_acconto2 = ?,
      importo_iva = ?, importo_contabilita = ?, cont_completata = ? 
    WHERE id = ?`,
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
      data.cont_completata ? 1 : 0,
      data.id,
    ],
  );
  return queryOne(
    `SELECT id_cliente, anno FROM adempimenti_cliente WHERE id = ?`,
    [data.id],
  );
}

function deleteAdempimentoCliente(id) {
  const row = queryOne(
    `SELECT id_cliente, anno FROM adempimenti_cliente WHERE id = ?`,
    [id],
  );
  runQuery(`DELETE FROM adempimenti_cliente WHERE id = ?`, [id]);
  return row;
}

function addAdempimentoCliente(data) {
  const adp = queryOne(`SELECT * FROM adempimenti WHERE id = ?`, [
    data.id_adempimento,
  ]);
  if (!adp) throw new Error("Adempimento non trovato");
  
  return inserisciAdempimentoSeAssente(data.id_cliente, adp, data.anno);
}

module.exports = {
  getScadenzarioConDettagliCliente,
  getScadenzarioGlobale,
  generaScadenzarioInterno,
  generaTuttiClientiAnno,
  rigeneraTuttiClientiAnno,
  copiaScadenzarioCliente,
  copiaTuttiClienti,
  updateAdempimentoStato,
  deleteAdempimentoCliente,
  addAdempimentoCliente,
};