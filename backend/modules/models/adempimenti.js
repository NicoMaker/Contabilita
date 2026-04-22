const { runQuery, queryAll, queryOne } = require("../database");

function getAdempimenti() {
  return queryAll(
    `SELECT * FROM adempimenti WHERE attivo=1 ORDER BY nome`,
  );
}

function createAdempimento(data) {
  const rl = data.rate_labels ? JSON.stringify(data.rate_labels) : null;
  runQuery(
    `INSERT INTO adempimenti (codice,nome,descrizione,scadenza_tipo,is_contabilita,has_rate,is_checkbox,rate_labels) VALUES (?,?,?,?,?,?,?,?)`,
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
    `UPDATE adempimenti SET codice=?,nome=?,descrizione=?,scadenza_tipo=?,is_contabilita=?,has_rate=?,is_checkbox=?,rate_labels=? WHERE id=?`,
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
  runQuery(`UPDATE adempimenti SET attivo=0 WHERE id=?`, [id]);
}

function canDeleteAdempimento(id) {
  const count = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_adempimento = ?`,
    [id],
  );
  return { canDelete: count.cnt === 0, clientiCount: count.cnt };
}

// ⭐ NUOVA LOGICA: genera per TUTTI i clienti (nessun filtro categoria)
function inserisciAdempimentoSeAssente(id_cliente, adp, anno) {
  let inseriti = 0;
  if (adp.scadenza_tipo === "trimestrale") {
    for (let t = 1; t <= 4; t++) {
      const ex = queryOne(
        `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND trimestre=?`,
        [id_cliente, adp.id, anno, t],
      );
      if (!ex) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,trimestre,stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, t, "da_fare"],
        );
        inseriti++;
      }
    }
  } else if (adp.scadenza_tipo === "semestrale") {
    for (let s = 1; s <= 2; s++) {
      const ex = queryOne(
        `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND semestre=?`,
        [id_cliente, adp.id, anno, s],
      );
      if (!ex) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,semestre,stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, s, "da_fare"],
        );
        inseriti++;
      }
    }
  } else if (adp.scadenza_tipo === "mensile") {
    for (let m = 1; m <= 12; m++) {
      const ex = queryOne(
        `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND mese=?`,
        [id_cliente, adp.id, anno, m],
      );
      if (!ex) {
        runQuery(
          `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,mese,stato) VALUES (?,?,?,?,?)`,
          [id_cliente, adp.id, anno, m, "da_fare"],
        );
        inseriti++;
      }
    }
  } else {
    const ex = queryOne(
      `SELECT id FROM adempimenti_cliente WHERE id_cliente=? AND id_adempimento=? AND anno=? AND mese IS NULL AND trimestre IS NULL AND semestre IS NULL`,
      [id_cliente, adp.id, anno],
    );
    if (!ex) {
      runQuery(
        `INSERT INTO adempimenti_cliente (id_cliente,id_adempimento,anno,stato) VALUES (?,?,?,?)`,
        [id_cliente, adp.id, anno, "da_fare"],
      );
      inseriti++;
    }
  }
  return inseriti;
}

function generaAdempimentoPerTutti(id_adp, anno) {
  const a = queryOne(`SELECT * FROM adempimenti WHERE id=?`, [id_adp]);
  if (!a) return 0;
  let tot = 0;
  // ⭐ TUTTI i clienti attivi (nessun filtro categoria)
  queryAll(`SELECT * FROM clienti WHERE attivo=1`).forEach((c) => {
    tot += inserisciAdempimentoSeAssente(c.id, a, anno);
  });
  return tot;
}

module.exports = {
  getAdempimenti,
  createAdempimento,
  updateAdempimento,
  deleteAdempimento,
  generaAdempimentoPerTutti,
  inserisciAdempimentoSeAssente,
  canDeleteAdempimento,
};