const { runQuery, runQueryAndGetId, queryAll, queryOne } = require("../database");
const ANNO_MIN_GESTIONE = 2026;
const ANNO_DELETE_MARKER = "__ANNO_ELIMINATO__";

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
  const lastConfig = queryOne(
    `SELECT anno, col2_value
     FROM clienti_config_annuale
     WHERE id_cliente = ? AND anno <= ?
     ORDER BY anno DESC
     LIMIT 1`,
    [id_cliente, anno],
  );
  if (!lastConfig || lastConfig.col2_value === ANNO_DELETE_MARKER) {
    return null;
  }
  return getConfigClientePerAnno(id_cliente, lastConfig.anno);
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
    LEFT JOIN clienti_config_annuale cfg
      ON cfg.id = (
        SELECT c2.id
        FROM clienti_config_annuale c2
        WHERE c2.id_cliente = c.id AND c2.anno <= ?
        ORDER BY c2.anno DESC
        LIMIT 1
      )
    LEFT JOIN tipologie_cliente t ON cfg.id_tipologia = t.id
    LEFT JOIN sottotipologie s ON cfg.id_sottotipologia = s.id
    WHERE c.attivo = 1 AND (cfg.id IS NULL OR IFNULL(cfg.col2_value, '') != ?)
  `;
  const params = [anno, ANNO_DELETE_MARKER];

  const toArray = (v) => {
    if (!v) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === "string") {
      return v
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);
    }
    return [];
  };

  const tipologie = toArray(filtri.tipologia);
  const col2Values = toArray(filtri.col2);
  const col3Values = toArray(filtri.col3);
  const periodicitaValues = toArray(filtri.periodicita);

  // Apply filters only if we have configurations, otherwise show all clients
  if (tipologie.length > 0) {
    sql += ` AND (t.codice IS NULL OR t.codice IN (${tipologie.map(() => "?").join(",")}))`;
    params.push(...tipologie);
  }
  if (col2Values.length > 0) {
    sql += ` AND (cfg.col2_value IS NULL OR cfg.col2_value IN (${col2Values.map(() => "?").join(",")}))`;
    params.push(...col2Values);
  }
  if (col3Values.length > 0) {
    sql += ` AND (cfg.col3_value IS NULL OR cfg.col3_value IN (${col3Values.map(() => "?").join(",")}))`;
    params.push(...col3Values);
  }
  if (periodicitaValues.length > 0) {
    sql += ` AND (cfg.periodicita IS NULL OR cfg.periodicita IN (${periodicitaValues.map(() => "?").join(",")}))`;
    params.push(...periodicitaValues);
  }
  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR c.email LIKE ? OR c.telefono LIKE ?)`;
    params.push(s, s, s, s, s);
  }

  sql += ` ORDER BY c.nome`;
  return queryAll(sql, params);
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
    INNER JOIN clienti_config_annuale cfg
      ON cfg.id = (
        SELECT c2.id
        FROM clienti_config_annuale c2
        WHERE c2.id_cliente = c.id AND c2.anno <= ?
        ORDER BY c2.anno DESC
        LIMIT 1
      )
    LEFT JOIN tipologie_cliente t ON cfg.id_tipologia = t.id
    LEFT JOIN sottotipologie s ON cfg.id_sottotipologia = s.id
    WHERE c.id = ? AND c.attivo = 1 AND IFNULL(cfg.col2_value, '') != ?
  `;
  return queryOne(sql, [anno, id, ANNO_DELETE_MARKER]);
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
  if (anno < ANNO_MIN_GESTIONE) {
    throw new Error(`Anno non valido: minimo ${ANNO_MIN_GESTIONE}`);
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

// ⭐ NUOVA FUNZIONE: Verifica se un nome esiste già
function checkNomeExists(nome, excludeId = null) {
  const nomeNorm = (nome || "").trim().toLowerCase();
  let sql = `SELECT id, nome FROM clienti WHERE LOWER(TRIM(nome)) = ? AND attivo = 1`;
  const params = [nomeNorm];
  
  if (excludeId) {
    sql += ` AND id != ?`;
    params.push(excludeId);
  }
  
  return queryOne(sql, params);
}

function getClienteInattivoByNome(nome) {
  const nomeNorm = (nome || "").trim().toLowerCase();
  return queryOne(
    `SELECT id, nome
     FROM clienti
     WHERE LOWER(TRIM(nome)) = ? AND attivo = 0
     ORDER BY id DESC
     LIMIT 1`,
    [nomeNorm],
  );
}

function getClienteAttivoByNome(nome) {
  const nomeNorm = (nome || "").trim().toLowerCase();
  return queryOne(
    `SELECT id, nome
     FROM clienti
     WHERE LOWER(TRIM(nome)) = ? AND attivo = 1
     ORDER BY id DESC
     LIMIT 1`,
    [nomeNorm],
  );
}

// ⭐ MODIFICATA: createCliente con controllo nome duplicato
function createCliente(data) {
  const anno = data.anno || new Date().getFullYear();
  if (anno < ANNO_MIN_GESTIONE) {
    throw new Error(
      `ANNO_NON_VALIDO: Il primo anno disponibile per i clienti è ${ANNO_MIN_GESTIONE}`,
    );
  }
  console.log("📝 createCliente con anno:", anno, "data:", data);

  // Controllo nome duplicato
  const nomeEsistente = checkNomeExists(data.nome);
  if (nomeEsistente) {
    throw new Error(`NOME_DUPLICATO: Esiste già un cliente con nome "${data.nome}"`);
  }

  const clienteInattivo = getClienteInattivoByNome(data.nome);
  if (clienteInattivo) {
    runQuery(
      `UPDATE clienti SET
        nome = ?, codice_fiscale = ?, partita_iva = ?, email = ?, telefono = ?,
        indirizzo = ?, citta = ?, cap = ?, provincia = ?, pec = ?, sdi = ?,
        iban = ?, note = ?, referente = ?, contabilita = ?, attivo = 1,
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
        data.contabilita || 0,
        clienteInattivo.id,
      ],
    );

    saveConfigCliente({
      id_cliente: clienteInattivo.id,
      anno: anno,
      id_tipologia: data.id_tipologia,
      id_sottotipologia: data.id_sottotipologia || null,
      col2_value: data.col2_value || null,
      col3_value: data.col3_value || null,
      periodicita: data.periodicita || null,
    });

    return clienteInattivo.id;
  }

  // Inserisci il cliente
  let id = runQueryAndGetId(
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

  id = Number(id);
  if (!Number.isFinite(id) || id <= 0) {
    const createdCliente = getClienteAttivoByNome(data.nome);
    if (createdCliente && createdCliente.id) {
      id = Number(createdCliente.id);
    }
  }

  if (!id) {
    console.error("❌ Impossibile ottenere l'ID del nuovo cliente");
    throw new Error("Impossibile ottenere l'ID del nuovo cliente");
  }

  // Salva la configurazione
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

// ⭐ MODIFICATA: updateClienteAnagrafica con controllo nome duplicato
function updateClienteAnagrafica(data) {
  // Controllo nome duplicato (escludendo il cliente corrente)
  const nomeEsistente = checkNomeExists(data.nome, data.id);
  if (nomeEsistente) {
    throw new Error(`NOME_DUPLICATO: Esiste già un cliente con nome "${data.nome}"`);
  }

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
  if (deleteAll || !anno) {
    // Se è una cancellazione completa, controlla se ci sono adempimenti in QUALSIASI anno
    const count = queryOne(
      `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ?`,
      [id],
    );
    if (count.cnt > 0) {
      throw new Error(
        `Impossibile eliminare il cliente: ha ${count.cnt} adempimenti associati. Prima elimina tutti gli adempimenti.`,
      );
    }
    runQuery(`DELETE FROM clienti_config_annuale WHERE id_cliente = ?`, [id]);
    runQuery(`UPDATE clienti SET attivo = 0 WHERE id = ?`, [id]);
    return;
  }

  // Per cancellazione anno-specifica, controlla solo gli adempimenti di quell'anno
  const countAnno = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`,
    [id, anno],
  );
  if (countAnno.cnt > 0) {
    throw new Error(
      `Impossibile eliminare il cliente dal ${anno}: ha ${countAnno.cnt} adempimenti associati per questo anno.`,
    );
  }

  // Elimina la configurazione per l'anno specifico
  runQuery(`DELETE FROM clienti_config_annuale WHERE id_cliente = ? AND anno = ?`, [
    id,
    anno,
  ]);
  runQuery(`DELETE FROM adempimenti_cliente WHERE id_cliente = ? AND anno = ?`, [
    id,
    anno,
  ]);
  
  // Inserisci un marker di eliminazione per quell'anno
  runQuery(
    `INSERT INTO clienti_config_annuale 
      (id_cliente, anno, id_tipologia, id_sottotipologia, col2_value, col3_value, periodicita)
     VALUES (?,?,?,?,?,?,?)`,
    [id, anno, null, null, ANNO_DELETE_MARKER, null, null],
  );

  // Verifica se ci sono ancora configurazioni per questo cliente
  const configResidue = queryOne(
    `SELECT COUNT(*) as cnt FROM clienti_config_annuale WHERE id_cliente = ? AND IFNULL(col2_value, '') != ?`,
    [id, ANNO_DELETE_MARKER],
  );
  if (!configResidue || configResidue.cnt === 0) {
    runQuery(`UPDATE clienti SET attivo = 0 WHERE id = ?`, [id]);
  }
}

function canDeleteCliente(id) {
  const count = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ?`,
    [id],
  );
  return { canDelete: count.cnt === 0, adempimentiCount: count.cnt };
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

// ⭐ NUOVA FUNZIONE: Copia tutti i clienti da un anno all'altro
function copiaClientiDaAnno(anno_da, anno_a) {
  // Verifica che ci siano clienti da copiare
  const clientida = queryAll(
    `SELECT DISTINCT c.id, c.nome FROM clienti c 
     INNER JOIN clienti_config_annuale cfg ON c.id = cfg.id_cliente 
     WHERE c.attivo = 1 AND cfg.anno = ? AND IFNULL(cfg.col2_value, '') != ?`,
    [anno_da, ANNO_DELETE_MARKER]
  );
  
  if (clientida.length === 0) {
    throw new Error(`Nessun cliente trovato con configurazione per l'anno ${anno_da}`);
  }
  
  return copiaTuttiClientiAnno(anno_da, anno_a);
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
  copiaConfigClienteAnno,
  copiaTuttiClientiAnno,
  copiaClientiDaAnno,
  checkNomeExists,
};