const {
  runQuery,
  runQueryAndGetId,
  queryAll,
  queryOne,
} = require("../database");

function getPaginaBianca(filtri = {}) {
  let sql = `
    SELECT pb.*, c.nome as cliente_nome
    FROM pagina_bianca pb
    LEFT JOIN clienti c ON pb.id_cliente = c.id
    WHERE 1=1
  `;
  const params = [];

  if (filtri.tipo) {
    sql += ` AND pb.tipo = ?`;
    params.push(filtri.tipo);
  }

  if (filtri.id_cliente && filtri.id_cliente !== "") {
    sql += ` AND pb.id_cliente = ?`;
    params.push(parseInt(filtri.id_cliente));
  }

  if (filtri.search && filtri.search.trim()) {
    const s = `%${filtri.search.trim()}%`;
    sql += ` AND (pb.titolo LIKE ? OR pb.contenuto LIKE ? OR pb.allegati LIKE ?)`;
    params.push(s, s, s);
  }

  sql += ` ORDER BY pb.data_creazione DESC`;
  return queryAll(sql, params);
}

function getPaginaBiancaSingolo(id) {
  return queryOne(
    `
    SELECT pb.*, c.nome as cliente_nome
    FROM pagina_bianca pb
    LEFT JOIN clienti c ON pb.id_cliente = c.id
    WHERE pb.id = ?
  `,
    [id],
  );
}

function createPaginaBianca(data) {
  return runQueryAndGetId(
    `
    INSERT INTO pagina_bianca (tipo, titolo, contenuto, allegati, id_cliente)
    VALUES (?,?,?,?,?)
  `,
    [
      data.tipo,
      data.titolo,
      data.contenuto || null,
      data.allegati || null,
      data.id_cliente || null,
    ],
  );
}

function updatePaginaBianca(data) {
  runQuery(
    `
    UPDATE pagina_bianca SET
      tipo = ?, titolo = ?, contenuto = ?, allegati = ?, id_cliente = ?
    WHERE id = ?
  `,
    [
      data.tipo,
      data.titolo,
      data.contenuto || null,
      data.allegati || null,
      data.id_cliente || null,
      data.id,
    ],
  );
}

function deletePaginaBianca(id) {
  runQuery(`DELETE FROM pagina_bianca WHERE id = ?`, [id]);
}

module.exports = {
  getPaginaBianca,
  getPaginaBiancaSingolo,
  createPaginaBianca,
  updatePaginaBianca,
  deletePaginaBianca,
};
