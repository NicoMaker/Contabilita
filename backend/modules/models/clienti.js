const { runQuery, queryAll, queryOne } = require("../database");

function getConfigClientePerAnno(id_cliente, anno) {
  const sql = `
    SELECT 
      c.*,
      t.codice as tipologia_codice,
      t.nome as tipologia_nome,
      t.colore as tipologia_colore,
      s.codice as sottotipologia_codice,
      s.nome as sottotipologia_nome
    FROM clienti_config_annuale c
    LEFT JOIN tipologie_cliente t ON c.id_tipologia = t.id
    LEFT JOIN sottotipologie s ON c.id_sottotipologia = s.id
    WHERE c.id_cliente = ? AND c.anno = ?
  `;
  return queryOne(sql, [id_cliente, anno]);
}

function getConfigCorrente(id_cliente, anno = new Date().getFullYear()) {
  let config = getConfigClientePerAnno(id_cliente, anno);
  if (!config) {
    const lastConfig = queryOne(
      `SELECT * FROM clienti_config_annuale WHERE id_cliente = ? AND anno <= ? ORDER BY anno DESC LIMIT 1`,
      [id_cliente, anno],
    );
    if (lastConfig) {
      config = getConfigClientePerAnno(id_cliente, lastConfig.anno);
    }
  }
  return config;
}

function getClientiConDettagli(filtri = {}, anno = new Date().getFullYear()) {
  let sql = `
    SELECT 
      c.id,
      c.nome,
      c.codice_fiscale,
      c.partita_iva,
      c.email,
      c.telefono,
      c.indirizzo,
      c.citta,
      c.cap,
      c.provincia,
      c.pec,
      c.sdi,
      c.iban,
      c.note,
      c.referente,
      c.attivo,
      c.contabilita,
      c.created_at,
      c.updated_at,
      cfg.anno as config_anno,
      cfg.id_tipologia,
      cfg.id_sottotipologia,
      cfg.col2_value,
      cfg.col3_value,
      cfg.periodicita,
      t.codice as tipologia_codice,
      t.nome as tipologia_nome,
      t.colore as tipologia_colore,
      s.codice as sottotipologia_codice,
      s.nome as sottotipologia_nome
    FROM clienti c 
    INNER JOIN clienti_config_annuale cfg ON c.id = cfg.id_cliente AND cfg.anno = ?
    LEFT JOIN tipologie_cliente t ON cfg.id_tipologia = t.id
    LEFT JOIN sottotipologie s ON cfg.id_sottotipologia = s.id
    WHERE c.attivo = 1
  `;
  const params = [anno];

  if (filtri.tipologia) {
    sql += ` AND t.codice = ?`;
    params.push(filtri.tipologia);
  }
  if (filtri.col2) {
    sql += ` AND cfg.col2_value = ?`;
    params.push(filtri.col2);
  }
  if (filtri.col3) {
    sql += ` AND cfg.col3_value = ?`;
    params.push(filtri.col3);
  }
  if (filtri.periodicita) {
    sql += ` AND cfg.periodicita = ?`;
    params.push(filtri.periodicita);
  }
  
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR c.email LIKE ? OR c.telefono LIKE ?)`;
    params.push(s, s, s, s, s);
  }

  sql += ` ORDER BY c.nome`;
  const results = queryAll(sql, params);

  return results;
}

function getClienteConDettagli(id, anno = new Date().getFullYear()) {
  const sql = `
    SELECT 
      c.id, c.nome, c.codice_fiscale, c.partita_iva, c.email, c.telefono,
      c.indirizzo, c.citta, c.cap, c.provincia, c.pec, c.sdi, c.iban,
      c.note, c.referente, c.attivo, c.contabilita, c.created_at, c.updated_at,
      cfg.anno as config_anno,
      cfg.id_tipologia, cfg.id_sottotipologia,
      cfg.col2_value, cfg.col3_value, cfg.periodicita,
      t.codice as tipologia_codice, t.nome as tipologia_nome, t.colore as tipologia_colore,
      s.codice as sottotipologia_codice, s.nome as sottotipologia_nome
    FROM clienti c 
    LEFT JOIN clienti_config_annuale cfg ON c.id = cfg.id_cliente AND cfg.anno = ?
    LEFT JOIN tipologie_cliente t ON cfg.id_tipologia = t.id
    LEFT JOIN sottotipologie s ON cfg.id_sottotipologia = s.id
    WHERE c.id = ? AND c.attivo = 1
  `;
  let result = queryOne(sql, [anno, id]);

  if (!result || !result.id_tipologia) {
    const lastConfig = getConfigCorrente(id, anno);
    if (lastConfig) {
      result = { ...result, ...lastConfig };
    }
  }

  return result;
}

function getConfigStoricoCliente(id_cliente) {
  return queryAll(
    `
    SELECT 
      cfg.*,
      t.codice as tipologia_codice, t.nome as tipologia_nome, t.colore as tipologia_colore,
      s.codice as sottotipologia_codice, s.nome as sottotipologia_nome
    FROM clienti_config_annuale cfg
    LEFT JOIN tipologie_cliente t ON cfg.id_tipologia = t.id
    LEFT JOIN sottotipologie s ON cfg.id_sottotipologia = s.id
    WHERE cfg.id_cliente = ?
    ORDER BY cfg.anno DESC
  `,
    [id_cliente],
  );
}

function saveConfigCliente(data) {
  console.log("📝 saveConfigCliente chiamato con:", data);

  if (!data.id_cliente || data.id_cliente <= 0) {
    console.error("❌ id_cliente non valido:", data.id_cliente);
    throw new Error("ID cliente non valido");
  }

  const anno = parseInt(data.anno);
  if (isNaN(anno)) {
    console.error("❌ Anno non valido:", data.anno);
    throw new Error("Anno non valido");
  }

  const exists = queryOne(
    `SELECT id FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
    [data.id_cliente, anno],
  );

  if (exists) {
    console.log("📝 Aggiornamento config esistente per anno", anno);
    runQuery(
      `UPDATE clienti_config_annuale SET 
        id_tipologia = ?, id_sottotipologia = ?,
        col2_value = ?, col3_value = ?, periodicita = ?
      WHERE id_cliente = ? AND anno = ?`,
      [
        data.id_tipologia,
        data.id_sottotipologia || null,
        data.col2_value || null,
        data.col3_value || null,
        data.periodicita || null,
        data.id_cliente,
        anno,
      ],
    );
  } else {
    console.log("📝 Creazione nuova config per anno", anno);
    runQuery(
      `INSERT INTO clienti_config_annuale 
        (id_cliente, anno, id_tipologia, id_sottotipologia, col2_value, col3_value, periodicita) 
       VALUES (?,?,?,?,?,?,?)`,
      [
        data.id_cliente,
        anno,
        data.id_tipologia,
        data.id_sottotipologia || null,
        data.col2_value || null,
        data.col3_value || null,
        data.periodicita || null,
      ],
    );
  }

  const verificato = queryOne(
    `SELECT * FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
    [data.id_cliente, anno],
  );
  console.log("✅ Verifica salvataggio:", verificato);
}

// ⭐ FUNZIONE CREATE CLIENTE CORRETTA - senza created_at/updated_at nell'INSERT
function createCliente(data) {
  const anno = data.anno || new Date().getFullYear();
  console.log("📝 createCliente con anno:", anno, "data:", data);

  // Inserisci il cliente - SENZA created_at e updated_at espliciti
  runQuery(
    `INSERT INTO clienti (
      nome, codice_fiscale, partita_iva, email, telefono, 
      indirizzo, citta, cap, provincia, pec, sdi, iban, note, referente, contabilita
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.nome,
      data.codice_fiscale || null,
      data.partita_iva || null,
      data.email || null,
      data.telefono || null,
      data.indirizzo || null,
      data.citta || null,
      data.cap || null,
      data.provincia || null,
      data.pec || null,
      data.sdi || null,
      data.iban || null,
      data.note || null,
      data.referente || null,
      data.contabilita || 0,
    ],
  );

  // Ottieni l'ultimo ID inserito - metodo più affidabile
  let id = null;

  // Prova con last_insert_rowid
  const rowidResult = queryOne(`SELECT last_insert_rowid() as id`);
  if (rowidResult && rowidResult.id && rowidResult.id > 0) {
    id = rowidResult.id;
    console.log("📝 ID da last_insert_rowid:", id);
  }

  // Fallback: cerca per nome (il più recente)
  if (!id || id === 0) {
    const nuovoCliente = queryOne(
      `SELECT id FROM clienti WHERE nome = ? ORDER BY rowid DESC LIMIT 1`,
      [data.nome],
    );
    id = nuovoCliente ? nuovoCliente.id : null;
    console.log("📝 ID da query fallback:", id);
  }

  if (!id) {
    console.error("❌ Impossibile ottenere l'ID del nuovo cliente");
    throw new Error("Impossibile ottenere l'ID del nuovo cliente");
  }

  // Salva la configurazione con l'ID corretto
  saveConfigCliente({
    id_cliente: id,
    anno: anno,
    id_tipologia: data.id_tipologia,
    id_sottotipologia: data.id_sottotipologia || null,
    col2_value: data.col2_value || null,
    col3_value: data.col3_value || null,
    periodicita: data.periodicita || null,
  });

  return id;
}

function updateClienteConfig(data) {
  console.log("📝 updateClienteConfig chiamato con:", {
    id: data.id,
    anno: data.anno,
    id_tipologia: data.id_tipologia,
    col2_value: data.col2_value,
    col3_value: data.col3_value,
    periodicita: data.periodicita,
  });

  if (!data.id || data.id <= 0) {
    console.error("❌ ID cliente non valido in updateClienteConfig:", data.id);
    throw new Error("ID cliente non valido");
  }

  saveConfigCliente({
    id_cliente: data.id,
    anno: data.anno,
    id_tipologia: data.id_tipologia,
    id_sottotipologia: data.id_sottotipologia,
    col2_value: data.col2_value,
    col3_value: data.col3_value,
    periodicita: data.periodicita,
  });
}

function updateClienteAnagrafica(data) {
  runQuery(
    `UPDATE clienti SET 
      nome = ?, codice_fiscale = ?, partita_iva = ?, email = ?, telefono = ?,
      indirizzo = ?, citta = ?, cap = ?, provincia = ?, pec = ?, sdi = ?,
      iban = ?, note = ?, referente = ?, contabilita = ?, updated_at = datetime('now')
    WHERE id = ?`,
    [
      data.nome,
      data.codice_fiscale || null,
      data.partita_iva || null,
      data.email || null,
      data.telefono || null,
      data.indirizzo || null,
      data.citta || null,
      data.cap || null,
      data.provincia || null,
      data.pec || null,
      data.sdi || null,
      data.iban || null,
      data.note || null,
      data.referente || null,
      data.contabilita || 0,
      data.id,
    ],
  );
}

function deleteCliente(id, anno = null, deleteAll = false) {
  if (deleteAll) {
    // Eliminazione completa da tutti gli anni
    const count = queryOne(
      `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ?`,
      [id],
    );
    if (count.cnt > 0) {
      throw new Error(
        `Impossibile eliminare il cliente: ha ${count.cnt} adempimenti associati.`,
      );
    }
    runQuery(`UPDATE clienti SET attivo = 0 WHERE id = ?`, [id]);
  } else if (anno) {
    // Eliminazione solo per un anno specifico
    const count = queryOne(
      `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`,
      [id, anno],
    );
    if (count.cnt > 0) {
      throw new Error(
        `Impossibile eliminare il cliente per l'anno ${anno}: ha ${count.cnt} adempimenti associati.`,
      );
    }
    // Elimina solo la configurazione per quell'anno
    runQuery(`DELETE FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`, [id, anno]);
    
    // Verifica se il cliente ha configurazioni per altri anni
    const remainingConfigs = queryOne(
      `SELECT COUNT(*) as cnt FROM clienti_config_annuale WHERE id_cliente = ?`,
      [id],
    );
    
    // Se non ha più configurazioni, disattiva il cliente
    if (remainingConfigs.cnt === 0) {
      runQuery(`UPDATE clienti SET attivo = 0 WHERE id = ?`, [id]);
    }
  } else {
    // Comportamento di default (vecchia logica)
    const count = queryOne(
      `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ?`,
      [id],
    );
    if (count.cnt > 0) {
      throw new Error(
        `Impossibile eliminare il cliente: ha ${count.cnt} adempimenti associati.`,
      );
    }
    runQuery(`UPDATE clienti SET attivo = 0 WHERE id = ?`, [id]);
  }
}

function canDeleteCliente(id, anno = null) {
  let sql, params;
  if (anno) {
    sql = `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`;
    params = [id, anno];
  } else {
    sql = `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ?`;
    params = [id];
  }
  const count = queryOne(sql, params);
  return { canDelete: count.cnt === 0, adempimentiCount: count.cnt };
}

function checkAdempimentiClienteAnno(id_cliente, anno) {
  const count = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno],
  );
  return { hasAdempimenti: count.cnt > 0, count: count.cnt };
}

function copiaConfigClienteAnno(id_cliente, anno_da, anno_a) {
  const configDa = queryOne(
    `SELECT * FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno_da],
  );

  if (!configDa) {
    throw new Error(`Nessuna configurazione trovata per l'anno ${anno_da}`);
  }

  const esiste = queryOne(
    `SELECT id FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
    [id_cliente, anno_a],
  );

  if (esiste) {
    runQuery(
      `UPDATE clienti_config_annuale SET 
        id_tipologia = ?, id_sottotipologia = ?,
        col2_value = ?, col3_value = ?, periodicita = ?
      WHERE id_cliente = ? AND anno = ?`,
      [
        configDa.id_tipologia,
        configDa.id_sottotipologia,
        configDa.col2_value,
        configDa.col3_value,
        configDa.periodicita,
        id_cliente,
        anno_a,
      ],
    );
  } else {
    runQuery(
      `INSERT INTO clienti_config_annuale 
        (id_cliente, anno, id_tipologia, id_sottotipologia, col2_value, col3_value, periodicita) 
       VALUES (?,?,?,?,?,?,?)`,
      [
        id_cliente,
        anno_a,
        configDa.id_tipologia,
        configDa.id_sottotipologia,
        configDa.col2_value,
        configDa.col3_value,
        configDa.periodicita,
      ],
    );
  }

  return getConfigClientePerAnno(id_cliente, anno_a);
}

function copiaTuttiClientiAnno(anno_da, anno_a) {
  const clienti = queryAll(`SELECT id FROM clienti WHERE attivo = 1`);
  const risultati = [];

  for (const cliente of clienti) {
    try {
      const configDa = queryOne(
        `SELECT * FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
        [cliente.id, anno_da],
      );

      if (configDa) {
        const esiste = queryOne(
          `SELECT id FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
          [cliente.id, anno_a],
        );

        if (esiste) {
          runQuery(
            `UPDATE clienti_config_annuale SET 
              id_tipologia = ?, id_sottotipologia = ?,
              col2_value = ?, col3_value = ?, periodicita = ?
            WHERE id_cliente = ? AND anno = ?`,
            [
              configDa.id_tipologia,
              configDa.id_sottotipologia,
              configDa.col2_value,
              configDa.col3_value,
              configDa.periodicita,
              cliente.id,
              anno_a,
            ],
          );
        } else {
          runQuery(
            `INSERT INTO clienti_config_annuale 
              (id_cliente, anno, id_tipologia, id_sottotipologia, col2_value, col3_value, periodicita) 
             VALUES (?,?,?,?,?,?,?)`,
            [
              cliente.id,
              anno_a,
              configDa.id_tipologia,
              configDa.id_sottotipologia,
              configDa.col2_value,
              configDa.col3_value,
              configDa.periodicita,
            ],
          );
        }
        risultati.push({ id: cliente.id, success: true });
      } else {
        risultati.push({
          id: cliente.id,
          success: false,
          error: `Nessuna config per ${anno_da}`,
        });
      }
    } catch (e) {
      risultati.push({ id: cliente.id, success: false, error: e.message });
    }
  }

  return risultati;
}

module.exports = {
  getClientiConDettagli,
  getClienteConDettagli,
  getConfigCorrente,
  getConfigStoricoCliente,
  createCliente,
  updateClienteAnagrafica,
  updateClienteConfig,
  deleteCliente,
  canDeleteCliente,
  checkAdempimentiClienteAnno,
  copiaConfigClienteAnno,
  copiaTuttiClientiAnno,
};
