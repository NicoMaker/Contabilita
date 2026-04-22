const { runQuery, queryAll, queryOne } = require("../database");

// ⭐ Ottiene la configurazione di un cliente per un anno specifico
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

// ⭐ Ottiene la configurazione corrente (ultimo anno disponibile o anno specificato)
function getConfigCorrente(id_cliente, anno = new Date().getFullYear()) {
  let config = getConfigClientePerAnno(id_cliente, anno);
  if (!config) {
    // Cerca l'anno più recente disponibile
    const lastConfig = queryOne(
      `SELECT * FROM clienti_config_annuale WHERE id_cliente = ? ORDER BY anno DESC LIMIT 1`,
      [id_cliente]
    );
    if (lastConfig) {
      config = getConfigClientePerAnno(id_cliente, lastConfig.anno);
    }
  }
  return config;
}

// ⭐ Ottiene tutti i clienti con la loro configurazione per l'anno specificato
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
    LEFT JOIN clienti_config_annuale cfg ON c.id = cfg.id_cliente AND cfg.anno = ?
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

  // Per i clienti senza configurazione per l'anno, cerca la più recente
  for (const c of results) {
    if (!c.id_tipologia) {
      const lastConfig = getConfigCorrente(c.id, anno);
      if (lastConfig) {
        c.id_tipologia = lastConfig.id_tipologia;
        c.tipologia_codice = lastConfig.tipologia_codice;
        c.tipologia_nome = lastConfig.tipologia_nome;
        c.tipologia_colore = lastConfig.tipologia_colore;
        c.id_sottotipologia = lastConfig.id_sottotipologia;
        c.sottotipologia_codice = lastConfig.sottotipologia_codice;
        c.sottotipologia_nome = lastConfig.sottotipologia_nome;
        c.col2_value = lastConfig.col2_value;
        c.col3_value = lastConfig.col3_value;
        c.periodicita = lastConfig.periodicita;
        c.config_anno = lastConfig.anno;
      }
    }
  }

  return results;
}

// ⭐ Ottiene un cliente con la sua configurazione per un anno specifico
function getClienteConDettagli(id, anno = new Date().getFullYear()) {
  const sql = `
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

// ⭐ Ottiene tutte le configurazioni annuali di un cliente
function getConfigStoricoCliente(id_cliente) {
  return queryAll(`
    SELECT 
      cfg.*,
      t.codice as tipologia_codice,
      t.nome as tipologia_nome,
      t.colore as tipologia_colore,
      s.codice as sottotipologia_codice,
      s.nome as sottotipologia_nome
    FROM clienti_config_annuale cfg
    LEFT JOIN tipologie_cliente t ON cfg.id_tipologia = t.id
    LEFT JOIN sottotipologie s ON cfg.id_sottotipologia = s.id
    WHERE cfg.id_cliente = ?
    ORDER BY cfg.anno DESC
  `, [id_cliente]);
}

// ⭐ Salva o aggiorna una configurazione annuale per un cliente
function saveConfigCliente(data) {
  const exists = queryOne(
    `SELECT id FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`,
    [data.id_cliente, data.anno]
  );

  if (exists) {
    runQuery(
      `UPDATE clienti_config_annuale SET 
        id_tipologia = ?,
        id_sottotipologia = ?,
        col2_value = ?,
        col3_value = ?,
        periodicita = ?
      WHERE id_cliente = ? AND anno = ?`,
      [
        data.id_tipologia,
        data.id_sottotipologia || null,
        data.col2_value || null,
        data.col3_value || null,
        data.periodicita || null,
        data.id_cliente,
        data.anno
      ]
    );
  } else {
    runQuery(
      `INSERT INTO clienti_config_annuale 
        (id_cliente, anno, id_tipologia, id_sottotipologia, col2_value, col3_value, periodicita) 
       VALUES (?,?,?,?,?,?,?)`,
      [
        data.id_cliente,
        data.anno,
        data.id_tipologia,
        data.id_sottotipologia || null,
        data.col2_value || null,
        data.col3_value || null,
        data.periodicita || null
      ]
    );
  }
}

// ⭐ Crea un nuovo cliente (configurazione base per l'anno corrente)
function createCliente(data) {
  const anno = new Date().getFullYear();

  runQuery(
    `INSERT INTO clienti (nome, codice_fiscale, partita_iva, email, telefono, indirizzo, citta, cap, provincia, pec, sdi, iban, note, referente) 
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
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
    ]
  );

  const id = queryOne(`SELECT last_insert_rowid() as id`).id;

  // Salva configurazione per l'anno corrente
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

// ⭐ Aggiorna la configurazione per un anno specifico
function updateClienteConfig(data) {
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

// ⭐ Aggiorna i dati anagrafici del cliente (indipendenti dall'anno)
function updateClienteAnagrafica(data) {
  runQuery(
    `UPDATE clienti SET 
      nome = ?,
      codice_fiscale = ?,
      partita_iva = ?,
      email = ?,
      telefono = ?,
      indirizzo = ?,
      citta = ?,
      cap = ?,
      provincia = ?,
      pec = ?,
      sdi = ?,
      iban = ?,
      note = ?,
      referente = ?,
      updated_at = datetime('now')
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
      data.id,
    ]
  );
}

function deleteCliente(id) {
  const count = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ?`,
    [id]
  );

  if (count.cnt > 0) {
    throw new Error(
      `Impossibile eliminare il cliente: ha ${count.cnt} adempimenti associati. Elimina prima gli adempimenti dal cliente.`
    );
  }

  runQuery(`UPDATE clienti SET attivo = 0 WHERE id = ?`, [id]);
}

function canDeleteCliente(id) {
  const count = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ?`,
    [id]
  );
  return { canDelete: count.cnt === 0, adempimentiCount: count.cnt };
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
};