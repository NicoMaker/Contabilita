const { queryAll, queryOne } = require("../database");

function getStats(anno) {
  const totClienti = queryOne(
    `SELECT COUNT(*) as c FROM clienti WHERE attivo=1`,
  ).c;
  const adpStats = queryAll(
    `
    SELECT 
      a.codice,
      a.nome,
      COUNT(ac.id) as totale,
      SUM(CASE WHEN ac.stato='completato' THEN 1 ELSE 0 END) as completati,
      SUM(CASE WHEN ac.stato='da_fare' THEN 1 ELSE 0 END) as da_fare,
      SUM(CASE WHEN ac.stato='n_a' THEN 1 ELSE 0 END) as na
    FROM adempimenti a
    LEFT JOIN adempimenti_cliente ac ON a.id=ac.id_adempimento AND ac.anno=?
    WHERE a.attivo=1
    GROUP BY a.id
    ORDER BY a.nome
  `,
    [anno],
  );

  const totali = queryOne(
    `
    SELECT 
      COUNT(*) as totale,
      SUM(CASE WHEN stato='completato' THEN 1 ELSE 0 END) as completati,
      SUM(CASE WHEN stato='da_fare' THEN 1 ELSE 0 END) as da_fare,
      SUM(CASE WHEN stato='in_corso' THEN 1 ELSE 0 END) as in_corso,
      SUM(CASE WHEN stato='n_a' THEN 1 ELSE 0 END) as na
    FROM adempimenti_cliente WHERE anno=?
  `,
    [anno],
  );

  return {
    anno,
    totClienti,
    adempimentiStats: adpStats,
    totale: totali?.totale || 0,
    completati: totali?.completati || 0,
    da_fare: totali?.da_fare || 0,
    in_corso: totali?.in_corso || 0,
    na: totali?.na || 0,
  };
}

module.exports = { getStats };