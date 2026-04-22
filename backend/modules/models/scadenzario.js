const { runQuery, queryAll, queryOne } = require("../database");
const { inserisciAdempimentoSeAssente } = require("./adempimenti");

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
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (a.nome LIKE ? OR a.codice LIKE ?)`;
    params.push(s, s);
  }

  sql += ` ORDER BY a.nome, ac.mese, ac.trimestre, ac.semestre`;
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

// ⭐ NUOVA LOGICA: genera per TUTTI gli adempimenti (nessun filtro categoria)
function generaScadenzarioInterno(id_cliente, anno) {
  const cliente = queryOne(`SELECT * FROM clienti WHERE id=?`, [id_cliente]);
  if (!cliente) throw new Error("Cliente non trovato");
  // ⭐ TUTTI gli adempimenti attivi
  const adps = queryAll(`SELECT * FROM adempimenti WHERE attivo=1`);
  let tot = 0;
  adps.forEach((a) => {
    tot += inserisciAdempimentoSeAssente(id_cliente, a, anno);
  });
  return tot;
}

function generaTuttiClientiAnno(anno) {
  const clienti = queryAll(`SELECT * FROM clienti WHERE attivo=1`);
  const adempimenti = queryAll(`SELECT * FROM adempimenti WHERE attivo=1`);
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
    `SELECT * FROM adempimenti_cliente WHERE id_cliente=? AND anno=?`,
    [id_cliente, anno_da],
  );
  let tot = 0;
  righe.forEach((r) => {
    const ex = queryOne(
      `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND COALESCE(mese,0)=COALESCE(?,0) AND COALESCE(trimestre,0)=COALESCE(?,0) AND COALESCE(semestre,0)=COALESCE(?,0)`,
      [id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre],
    );
    if (!ex) {
      try {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,trimestre,semestre,stato) VALUES (?,?,?,?,?,?,?)`,
          [r.id_cliente, r.id_adempimento, anno_a, r.mese, r.trimestre, r.semestre, "da_fare"],
        );
        tot++;
      } catch (e) {}
    }
  });
  return tot;
}

function copiaTuttiClienti(anno_da, anno_a) {
  let tot = 0;
  queryAll(`SELECT id FROM clienti WHERE attivo=1`).forEach((c) => {
    tot += copiaScadenzarioCliente(c.id, anno_da, anno_a);
  });
  return tot;
}

function updateAdempimentoStato(data) {
  runQuery(
    `UPDATE adempimenti_cliente SET stato=?,data_scadenza=?,data_completamento=?,note=?,importo=?,importo_saldo=?,importo_acconto1=?,importo_acconto2=?,importo_iva=?,importo_contabilita=?,cont_completata=? WHERE id=?`,
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
    `SELECT id_cliente, anno FROM adempimenti_cliente WHERE id=?`,
    [data.id],
  );
}

function deleteAdempimentoCliente(id) {
  const row = queryOne(
    `SELECT id_cliente, anno FROM adempimenti_cliente WHERE id=?`,
    [id],
  );
  runQuery(`DELETE FROM adempimenti_cliente WHERE id=?`, [id]);
  return row;
}

function addAdempimentoCliente(data) {
  const adp = queryOne(`SELECT * FROM adempimenti WHERE id=?`, [data.id_adempimento]);
  if (!adp) throw new Error("Adempimento non trovato");
  runQuery(
    `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,trimestre,semestre,stato) VALUES (?,?,?,?,?,?,?)`,
    [data.id_cliente, data.id_adempimento, data.anno, data.mese || null, data.trimestre || null, data.semestre || null, "da_fare"],
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