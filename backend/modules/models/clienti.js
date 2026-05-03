const { runQuery, runQueryAndGetId, queryAll, queryOne } = require("../database");

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
  // ── FIX: se nessuno=true, ritorna subito array vuoto ──────
  if (filtri.nessuno === true) {
    return [];
  }

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
    LEFT JOIN clienti_config_annuale cfg ON c.id = cfg.id_cliente AND cfg.anno = ?
    LEFT JOIN tipologie_cliente t ON cfg.id_tipologia = t.id
    LEFT JOIN sottotipologie s ON cfg.id_sottotipologia = s.id
    WHERE c.attivo = 1
  `;
  const params = [anno];

  // ── FIX: usa filtri_tipologie se presenti (nuova struttura) ──
  const ft = filtri.filtri_tipologie;

  if (ft && !ft.nessuno) {
    // ── FIX: applica IN (...) invece di = ? per valori multipli ──
    if (ft.tipologie && ft.tipologie.length > 0) {
      const placeholders = ft.tipologie.map(() => '?').join(',');
      sql += ` AND t.codice IN (${placeholders})`;
      params.push(...ft.tipologie);
    }
    if (ft.col2_values && ft.col2_values.length > 0) {
      const placeholders = ft.col2_values.map(() => '?').join(',');
      // col2_value può essere NULL per tipologie senza col2 (SP, SC, ASS)
      // Se nella lista ci sono tipologie senza col2, dobbiamo includere anche NULL
      const hasNullCol2 = ft.tipologie && ft.tipologie.some(t => ['SP','SC','ASS'].includes(t));
      if (hasNullCol2) {
        sql += ` AND (cfg.col2_value IN (${placeholders}) OR cfg.col2_value IS NULL)`;
      } else {
        sql += ` AND cfg.col2_value IN (${placeholders})`;
      }
      params.push(...ft.col2_values);
    }
    if (ft.col3_values && ft.col3_values.length > 0) {
      const placeholders = ft.col3_values.map(() => '?').join(',');
      sql += ` AND cfg.col3_value IN (${placeholders})`;
      params.push(...ft.col3_values);
    }
    if (ft.periodicita_values && ft.periodicita_values.length > 0) {
      const placeholders = ft.periodicita_values.map(() => '?').join(',');
      // periodicita può essere NULL per annuali forfettari che non hanno il campo
      const hasAnnuale = ft.periodicita_values.includes('annuale');
      if (hasAnnuale) {
        sql += ` AND (cfg.periodicita IN (${placeholders}) OR cfg.periodicita IS NULL)`;
      } else {
        sql += ` AND cfg.periodicita IN (${placeholders})`;
      }
      params.push(...ft.periodicita_values);
    }
  } else if (!ft) {
    // Fallback legacy: usa i singoli valori stringa (compatibilità vecchio formato)
    if (filtri.tipologia && filtri.tipologia.trim()) {
      const tipoList = filtri.tipologia.split(',').map(s => s.trim()).filter(Boolean);
      if (tipoList.length === 1) {
        sql += ` AND t.codice = ?`;
        params.push(tipoList[0]);
      } else if (tipoList.length > 1) {
        const placeholders = tipoList.map(() => '?').join(',');
        sql += ` AND t.codice IN (${placeholders})`;
        params.push(...tipoList);
      }
    }
    if (filtri.col2 && filtri.col2.trim()) {
      const col2List = filtri.col2.split(',').map(s => s.trim()).filter(Boolean);
      if (col2List.length === 1) {
        sql += ` AND cfg.col2_value = ?`;
        params.push(col2List[0]);
      } else if (col2List.length > 1) {
        const placeholders = col2List.map(() => '?').join(',');
        sql += ` AND cfg.col2_value IN (${placeholders})`;
        params.push(...col2List);
      }
    }
    if (filtri.col3 && filtri.col3.trim()) {
      const col3List = filtri.col3.split(',').map(s => s.trim()).filter(Boolean);
      if (col3List.length === 1) {
        sql += ` AND cfg.col3_value = ?`;
        params.push(col3List[0]);
      } else if (col3List.length > 1) {
        const placeholders = col3List.map(() => '?').join(',');
        sql += ` AND cfg.col3_value IN (${placeholders})`;
        params.push(...col3List);
      }
    }
    if (filtri.periodicita && filtri.periodicita.trim()) {
      const perList = filtri.periodicita.split(',').map(s => s.trim()).filter(Boolean);
      if (perList.length === 1) {
        sql += ` AND cfg.periodicita = ?`;
        params.push(perList[0]);
      } else if (perList.length > 1) {
        const placeholders = perList.map(() => '?').join(',');
        sql += ` AND cfg.periodicita IN (${placeholders})`;
        params.push(...perList);
      }
    }
  }

  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR c.email LIKE ? OR c.telefono LIKE ?)`;
    params.push(s, s, s, s, s);
  }

  sql += ` ORDER BY c.nome`;
  const results = queryAll(sql, params);

  // Per i clienti senza config per l'anno richiesto, eredita la più recente
  // MA solo se non stiamo filtrando per tipologia (altrimenti il fallback
  // potrebbe portare clienti che non soddisfano il filtro)
  const hasTipologiaFiltro = (ft && !ft.nessuno && ft.tipologie && ft.tipologie.length > 0)
    || (filtri.tipologia && filtri.tipologia.trim());

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

function createCliente(data) {
  const anno = data.anno || new Date().getFullYear();
  console.log("📝 createCliente con anno:", anno, "data:", data);

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
        data.nome, data.codice_fiscale || null, data.partita_iva || null,
        data.email || null, data.telefono || null, data.indirizzo || null,
        data.citta || null, data.cap || null, data.provincia || null,
        data.pec || null, data.sdi || null, data.iban || null,
        data.note || null, data.referente || null, data.contabilita || 0,
        clienteInattivo.id,
      ],
    );

    saveConfigCliente({
      id_cliente: clienteInattivo.id, anno,
      id_tipologia: data.id_tipologia,
      id_sottotipologia: data.id_sottotipologia || null,
      col2_value: data.col2_value || null,
      col3_value: data.col3_value || null,
      periodicita: data.periodicita || null,
    });

    return clienteInattivo.id;
  }

  let id = runQueryAndGetId(
    `INSERT INTO clienti (
      nome, codice_fiscale, partita_iva, email, telefono, 
      indirizzo, citta, cap, provincia, pec, sdi, iban, note, referente, contabilita
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.nome, data.codice_fiscale || null, data.partita_iva || null,
      data.email || null, data.telefono || null, data.indirizzo || null,
      data.citta || null, data.cap || null, data.provincia || null,
      data.pec || null, data.sdi || null, data.iban || null,
      data.note || null, data.referente || null, data.contabilita || 0,
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

  saveConfigCliente({
    id_cliente: id, anno,
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
    id: data.id, anno: data.anno,
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
    id_cliente: data.id, anno: data.anno,
    id_tipologia: data.id_tipologia,
    id_sottotipologia: data.id_sottotipologia,
    col2_value: data.col2_value,
    col3_value: data.col3_value,
    periodicita: data.periodicita,
  });
}

function updateClienteAnagrafica(data) {
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
      data.nome, data.codice_fiscale || null, data.partita_iva || null,
      data.email || null, data.telefono || null, data.indirizzo || null,
      data.citta || null, data.cap || null, data.provincia || null,
      data.pec || null, data.sdi || null, data.iban || null,
      data.note || null, data.referente || null, data.contabilita || 0,
      data.id,
    ],
  );
}

function deleteCliente(id) {
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
        configDa.id_tipologia, configDa.id_sottotipologia,
        configDa.col2_value, configDa.col3_value, configDa.periodicita,
        id_cliente, anno_a,
      ],
    );
  } else {
    runQuery(
      `INSERT INTO clienti_config_annuale 
        (id_cliente, anno, id_tipologia, id_sottotipologia, col2_value, col3_value, periodicita) 
       VALUES (?,?,?,?,?,?,?)`,
      [
        id_cliente, anno_a,
        configDa.id_tipologia, configDa.id_sottotipologia,
        configDa.col2_value, configDa.col3_value, configDa.periodicita,
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
              configDa.id_tipologia, configDa.id_sottotipologia,
              configDa.col2_value, configDa.col3_value, configDa.periodicita,
              cliente.id, anno_a,
            ],
          );
        } else {
          runQuery(
            `INSERT INTO clienti_config_annuale 
              (id_cliente, anno, id_tipologia, id_sottotipologia, col2_value, col3_value, periodicita) 
             VALUES (?,?,?,?,?,?,?)`,
            [
              cliente.id, anno_a,
              configDa.id_tipologia, configDa.id_sottotipologia,
              configDa.col2_value, configDa.col3_value, configDa.periodicita,
            ],
          );
        }
        risultati.push({ id: cliente.id, success: true });
      } else {
        risultati.push({ id: cliente.id, success: false, error: `Nessuna config per ${anno_da}` });
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
  copiaConfigClienteAnno,
  copiaTuttiClientiAnno,
  checkNomeExists,
};