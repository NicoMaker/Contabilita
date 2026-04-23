const { runQuery, queryAll, queryOne } = require("../database");
const { inserisciAdempimentoSeAssente } = require("./adempimenti");

// ─── HELPER: anno dalla data_scadenza o anno corrente ─────────
function _annoFromRow(anno) {
  return anno || new Date().getFullYear();
}

function getScadenzarioConDettagliCliente(id_cliente, anno, filtri = {}) {
  // ⭐ JOIN con clienti_config_annuale per avere tipologia/col2/col3/periodicita
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
      COALESCE(cfg.id_tipologia, cfg_last.id_tipologia) as cliente_id_tipologia,
      COALESCE(t.codice, t_last.codice)   as cliente_tipologia_codice,
      COALESCE(t.colore, t_last.colore)   as cliente_tipologia_colore,
      COALESCE(s.codice, s_last.codice)   as cliente_sottotipologia_codice,
      COALESCE(s.nome,   s_last.nome)     as cliente_sottotipologia_nome,
      COALESCE(cfg.periodicita,   cfg_last.periodicita)   as cliente_periodicita,
      COALESCE(cfg.col2_value,    cfg_last.col2_value)    as cliente_col2,
      COALESCE(cfg.col3_value,    cfg_last.col3_value)    as cliente_col3
    FROM adempimenti_cliente ac
    JOIN adempimenti a ON ac.id_adempimento = a.id
    JOIN clienti c ON ac.id_cliente = c.id
    -- Config per l'anno richiesto
    LEFT JOIN clienti_config_annuale cfg 
      ON cfg.id_cliente = c.id AND cfg.anno = ?
    -- Config più recente come fallback
    LEFT JOIN clienti_config_annuale cfg_last 
      ON cfg_last.id = (
        SELECT id FROM clienti_config_annuale 
        WHERE id_cliente = c.id AND anno <= ?
        ORDER BY anno DESC LIMIT 1
      )
    LEFT JOIN tipologie_cliente t      ON t.id      = cfg.id_tipologia
    LEFT JOIN sottotipologie   s      ON s.id      = cfg.id_sottotipologia
    LEFT JOIN tipologie_cliente t_last ON t_last.id = cfg_last.id_tipologia
    LEFT JOIN sottotipologie   s_last ON s_last.id  = cfg_last.id_sottotipologia
    WHERE ac.id_cliente = ? AND ac.anno = ?
  `;
  const params = [anno, anno, id_cliente, anno];

  if (filtri.stato && filtri.stato !== "tutti") {
    sql += ` AND ac.stato = ?`;
    params.push(filtri.stato);
  }
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (a.nome LIKE ? OR a.codice LIKE ?)`;
    params.push(s, s);
  }

  sql += ` ORDER BY a.nome, ac.mese, ac.trimestre, ac.semestre`;
  return queryAll(sql, params);
}

function getScadenzarioGlobale(anno, filtri = {}) {
  // ⭐ JOIN con clienti_config_annuale per avere tipologia/col2/col3/periodicita
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
      COALESCE(cfg.id_tipologia, cfg_last.id_tipologia) as cliente_id_tipologia,
      COALESCE(t.codice, t_last.codice)   as cliente_tipologia_codice,
      COALESCE(t.colore, t_last.colore)   as cliente_tipologia_colore,
      COALESCE(s.codice, s_last.codice)   as cliente_sottotipologia_codice,
      COALESCE(s.nome,   s_last.nome)     as cliente_sottotipologia_nome,
      COALESCE(cfg.periodicita,   cfg_last.periodicita)   as cliente_periodicita,
      COALESCE(cfg.col2_value,    cfg_last.col2_value)    as cliente_col2,
      COALESCE(cfg.col3_value,    cfg_last.col3_value)    as cliente_col3
    FROM adempimenti_cliente ac
    JOIN adempimenti a ON ac.id_adempimento = a.id
    JOIN clienti c ON ac.id_cliente = c.id
    -- Config per l'anno richiesto
    LEFT JOIN clienti_config_annuale cfg 
      ON cfg.id_cliente = c.id AND cfg.anno = ?
    -- Config più recente come fallback
    LEFT JOIN clienti_config_annuale cfg_last 
      ON cfg_last.id = (
        SELECT id FROM clienti_config_annuale 
        WHERE id_cliente = c.id AND anno <= ?
        ORDER BY anno DESC LIMIT 1
      )
    LEFT JOIN tipologie_cliente t      ON t.id      = cfg.id_tipologia
    LEFT JOIN sottotipologie   s      ON s.id      = cfg.id_sottotipologia
    LEFT JOIN tipologie_cliente t_last ON t_last.id = cfg_last.id_tipologia
    LEFT JOIN sottotipologie   s_last ON s_last.id  = cfg_last.id_sottotipologia
    WHERE ac.anno = ? AND c.attivo = 1
  `;
  const params = [anno, anno, anno];

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

  sql += ` ORDER BY a.nome, c.nome, ac.mese, ac.trimestre, ac.semestre`;
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

function generaTuttiClientiAnno(anno) {
  const clienti = queryAll(`SELECT id FROM clienti WHERE attivo = 1`);
  const adempimenti = queryAll(`SELECT * FROM adempimenti WHERE attivo = 1`);
  let tot = 0;
  clienti.forEach((c) => {
    adempimenti.forEach((a) => {
      tot += inserisciAdempimentoSeAssente(c.id, a, anno);
    });
  });
  return tot;
}

function copiaScadenzarioCliente(id_cliente, anno_da, anno_a) {
  const righe = queryAll(
    `SELECT * FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno_da]
  );
  let tot = 0;
  righe.forEach((r) => {
    const ex = queryOne(
      `SELECT id FROM adempimenti_cliente WHERE id_cliente = ? AND id_adempimento = ? AND anno = ? AND COALESCE(mese,0) = COALESCE(?,0) AND COALESCE(trimestre,0) = COALESCE(?,0) AND COALESCE(semestre,0) = COALESCE(?,0)`,
      [id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre]
    );
    if (!ex) {
      try {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, trimestre, semestre, stato) VALUES (?,?,?,?,?,?,?)`,
          [r.id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre, "da_fare"]
        );
        tot++;
      } catch (e) {}
    }
  });
  return tot;
}

function copiaTuttiClienti(anno_da, anno_a) {
  let tot = 0;
  queryAll(`SELECT id FROM clienti WHERE attivo = 1`).forEach((c) => {
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
    ]
  );
  return queryOne(
    `SELECT id_cliente, anno FROM adempimenti_cliente WHERE id = ?`,
    [data.id]
  );
}

function deleteAdempimentoCliente(id) {
  const row = queryOne(
    `SELECT id_cliente, anno FROM adempimenti_cliente WHERE id = ?`,
    [id]
  );
  runQuery(`DELETE FROM adempimenti_cliente WHERE id = ?`, [id]);
  return row;
}

function addAdempimentoCliente(data) {
  const adp = queryOne(`SELECT * FROM adempimenti WHERE id = ?`, [data.id_adempimento]);
  if (!adp) throw new Error("Adempimento non trovato");
  runQuery(
    `INSERT INTO adempimenti_cliente (id_cliente, id_adempimento, anno, mese, trimestre, semestre, stato) VALUES (?,?,?,?,?,?,?)`,
    [data.id_cliente, data.id_adempimento, data.anno, data.mese || null, data.trimestre || null, data.semestre || null, "da_fare"]
  );
}

module.exports = {
  getScadenzarioConDettagliCliente,
  getScadenzarioGlobale,
  generaScadenzarioInterno,
  generaTuttiClientiAnno,
  copiaScadenzarioCliente,
  copiaTuttiClienti,
  updateAdempimentoStato,
  deleteAdempimentoCliente,
  addAdempimentoCliente,
};