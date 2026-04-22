const { runQuery, queryAll, queryOne } = require("../database");

function getClientiConDettagli(filtri = {}) {
  let sql = `
    SELECT 
      c.*,
      t.codice as tipologia_codice,
      t.nome as tipologia_nome,
      t.colore as tipologia_colore,
      s.codice as sottotipologia_codice,
      s.nome as sottotipologia_nome
    FROM clienti c 
    LEFT JOIN tipologie_cliente t ON c.id_tipologia=t.id 
    LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id 
    WHERE c.attivo=1
  `;
  const params = [];

  if (filtri.tipologia) {
    sql += ` AND t.codice=?`;
    params.push(filtri.tipologia);
  }

  if (filtri.col2) {
    sql += ` AND c.col2_value=?`;
    params.push(filtri.col2);
  }

  if (filtri.col3) {
    sql += ` AND c.col3_value=?`;
    params.push(filtri.col3);
  }

  if (filtri.periodicita) {
    sql += ` AND c.periodicita=?`;
    params.push(filtri.periodicita);
  }

  if (filtri.search?.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (c.nome LIKE ? OR c.codice_fiscale LIKE ? OR c.partita_iva LIKE ? OR c.email LIKE ? OR c.telefono LIKE ? OR c.indirizzo LIKE ? OR c.pec LIKE ? OR c.sdi LIKE ?)`;
    params.push(s, s, s, s, s, s, s, s);
  }

  sql += ` ORDER BY c.nome`;
  return queryAll(sql, params);
}

function getClienteConDettagli(id) {
  const sql = `
    SELECT 
      c.*,
      t.codice as tipologia_codice,
      t.nome as tipologia_nome,
      t.colore as tipologia_colore,
      s.codice as sottotipologia_codice,
      s.nome as sottotipologia_nome
    FROM clienti c 
    LEFT JOIN tipologie_cliente t ON c.id_tipologia=t.id 
    LEFT JOIN sottotipologie s ON c.id_sottotipologia=s.id 
    WHERE c.id=?
  `;
  return queryOne(sql, [id]);
}

function createCliente(data) {
  const cat = JSON.stringify(data.categorie_attive || []);
  runQuery(
    `INSERT INTO clienti (nome,id_tipologia,id_sottotipologia,col2_value,col3_value,periodicita,codice_fiscale,partita_iva,email,telefono,indirizzo,citta,cap,provincia,pec,sdi,iban,note,referente,categorie_attive) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      data.nome,
      data.id_tipologia,
      data.id_sottotipologia || null,
      data.col2_value || null,
      data.col3_value || null,
      data.periodicita || null,
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
      cat,
    ],
  );
  return queryOne(`SELECT last_insert_rowid() as id`).id;
}

function updateCliente(data) {
  const cat = JSON.stringify(data.categorie_attive || []);
  runQuery(
    `UPDATE clienti SET nome=?,id_tipologia=?,id_sottotipologia=?,col2_value=?,col3_value=?,periodicita=?,codice_fiscale=?,partita_iva=?,email=?,telefono=?,indirizzo=?,citta=?,cap=?,provincia=?,pec=?,sdi=?,iban=?,note=?,referente=?,categorie_attive=?,updated_at=datetime('now') WHERE id=?`,
    [
      data.nome,
      data.id_tipologia,
      data.id_sottotipologia || null,
      data.col2_value || null,
      data.col3_value || null,
      data.periodicita || null,
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
      cat,
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
      `Impossibile eliminare il cliente: ha ${count.cnt} adempimenti associati. Elimina prima gli adempimenti dal cliente.`,
    );
  }

  runQuery(`UPDATE clienti SET attivo=0 WHERE id=?`, [id]);
}

function canDeleteCliente(id) {
  const count = queryOne(
    `SELECT COUNT(*) as cnt FROM adempimenti_cliente WHERE id_cliente = ?`,
    [id],
  );
  return { canDelete: count.cnt === 0, adempimentiCount: count.cnt };
}

module.exports = {
  getClientiConDettagli,
  getClienteConDettagli,
  createCliente,
  updateCliente,
  deleteCliente,
  canDeleteCliente,
};
