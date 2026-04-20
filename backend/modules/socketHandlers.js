const {
  getClientiConDettagli,
  getClienteConDettagli,
  createCliente,
  updateCliente,
  deleteCliente
} = require('./clientiQueries');

const {
  getAdempimenti,
  createAdempimento,
  updateAdempimento,
  deleteAdempimento,
  generaAdempimentoPerTutti
} = require('./adempimentiQueries');

const {
  getScadenzarioConDettagliCliente,
  getScadenzarioGlobale,
  generaScadenzarioInterno,
  generaTuttiClientiAnno,
  copiaScadenzarioCliente,
  copiaTuttiClienti,
  updateAdempimentoStato,
  deleteAdempimentoCliente,
  addAdempimentoCliente
} = require('./scadenzarioQueries');

const { getStats } = require('./statsQueries');
const { queryAll, queryOne } = require('./database');

module.exports = function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`✅ Client connesso: ${socket.id}`);

    // ── TIPOLOGIE ──
    socket.on("get:tipologie", () => {
      try {
        const tip = queryAll(`SELECT * FROM tipologie_cliente ORDER BY id`);
        const sub = queryAll(`SELECT * FROM sottotipologie ORDER BY id_tipologia, ordine, id`);
        tip.forEach((t) => {
          t.sottotipologie = sub.filter((s) => s.id_tipologia === t.id);
        });
        socket.emit("res:tipologie", { success: true, data: tip });
      } catch (e) {
        socket.emit("res:tipologie", { success: false, error: e.message });
      }
    });

    // ── CLIENTI ──
    socket.on("get:clienti", (filtri = {}) => {
      try {
        const data = getClientiConDettagli(filtri);
        socket.emit("res:clienti", { success: true, data });
      } catch (e) {
        socket.emit("res:clienti", { success: false, error: e.message });
      }
    });

    socket.on("get:cliente", ({ id }) => {
      try {
        const c = getClienteConDettagli(id);
        socket.emit("res:cliente", { success: true, data: c });
      } catch (e) {
        socket.emit("res:cliente", { success: false, error: e.message });
      }
    });

    socket.on("create:cliente", (data) => {
      try {
        const newId = createCliente(data);
        io.emit("broadcast:clienti_updated");
        socket.emit("res:create:cliente", { success: true, id: newId });
        socket.emit("notify", { type: "success", msg: "Cliente creato con successo" });
      } catch (e) {
        socket.emit("res:create:cliente", { success: false, error: e.message });
      }
    });

    socket.on("update:cliente", (data) => {
      try {
        updateCliente(data);
        io.emit("broadcast:clienti_updated");
        socket.emit("res:update:cliente", { success: true });
        socket.emit("notify", { type: "success", msg: "Cliente aggiornato" });
      } catch (e) {
        socket.emit("res:update:cliente", { success: false, error: e.message });
      }
    });

    socket.on("delete:cliente", ({ id }) => {
      try {
        deleteCliente(id);
        io.emit("broadcast:clienti_updated");
        socket.emit("res:delete:cliente", { success: true });
        socket.emit("notify", { type: "success", msg: "Cliente eliminato" });
      } catch (e) {
        socket.emit("res:delete:cliente", { success: false, error: e.message });
      }
    });

    // ── ADEMPIMENTI ──
    socket.on("get:adempimenti", () => {
      try {
        const data = getAdempimenti();
        socket.emit("res:adempimenti", { success: true, data });
      } catch (e) {
        socket.emit("res:adempimenti", { success: false, error: e.message });
      }
    });

    socket.on("create:adempimento", (data) => {
      try {
        const newId = createAdempimento(data);
        const anno = new Date().getFullYear();
        const tot = generaAdempimentoPerTutti(newId, anno);
        io.emit("broadcast:adempimenti_updated");
        io.emit("broadcast:scadenzario_updated", { anno });
        socket.emit("res:create:adempimento", { success: true, id: newId, generati: tot });
      } catch (e) {
        socket.emit("res:create:adempimento", { success: false, error: e.message });
      }
    });

    socket.on("update:adempimento", (data) => {
      try {
        updateAdempimento(data);
        io.emit("broadcast:adempimenti_updated");
        socket.emit("res:update:adempimento", { success: true });
      } catch (e) {
        socket.emit("res:update:adempimento", { success: false, error: e.message });
      }
    });

    socket.on("delete:adempimento", ({ id }) => {
      try {
        deleteAdempimento(id);
        io.emit("broadcast:adempimenti_updated");
        socket.emit("res:delete:adempimento", { success: true });
      } catch (e) {
        socket.emit("res:delete:adempimento", { success: false, error: e.message });
      }
    });

    // ── SCADENZARIO ──
    socket.on("get:scadenzario", ({ id_cliente, anno, filtri = {} }) => {
      try {
        const data = getScadenzarioConDettagliCliente(id_cliente, anno, filtri);
        socket.emit("res:scadenzario", { success: true, data });
      } catch (e) {
        socket.emit("res:scadenzario", { success: false, error: e.message });
      }
    });

    socket.on("genera:scadenzario", ({ id_cliente, anno }) => {
      try {
        const tot = generaScadenzarioInterno(id_cliente, anno);
        io.emit("broadcast:scadenzario_updated", { id_cliente, anno });
        io.emit("broadcast:stats_updated", { anno });
        socket.emit("res:genera:scadenzario", { success: true, inseriti: tot });
      } catch (e) {
        socket.emit("res:genera:scadenzario", { success: false, error: e.message });
      }
    });

    socket.on("genera:tutti", ({ anno }) => {
      try {
        const tot = generaTuttiClientiAnno(anno);
        io.emit("broadcast:scadenzario_updated", { anno });
        io.emit("broadcast:globale_updated", { anno });
        io.emit("broadcast:stats_updated", { anno });
        socket.emit("res:genera:tutti", { success: true, inseriti: tot });
      } catch (e) {
        socket.emit("res:genera:tutti", { success: false, error: e.message });
      }
    });

    socket.on("copia:scadenzario", ({ id_cliente, anno_da, anno_a }) => {
      try {
        const tot = copiaScadenzarioCliente(id_cliente, anno_da, anno_a);
        io.emit("broadcast:scadenzario_updated", { id_cliente, anno: anno_a });
        socket.emit("res:copia:scadenzario", { success: true, copiati: tot });
      } catch (e) {
        socket.emit("res:copia:scadenzario", { success: false, error: e.message });
      }
    });

    socket.on("copia:tutti", ({ anno_da, anno_a }) => {
      try {
        const tot = copiaTuttiClienti(anno_da, anno_a);
        io.emit("broadcast:scadenzario_updated", { anno: anno_a });
        io.emit("broadcast:globale_updated", { anno: anno_a });
        socket.emit("res:copia:tutti", { success: true, copiati: tot });
      } catch (e) {
        socket.emit("res:copia:tutti", { success: false, error: e.message });
      }
    });

    socket.on("update:adempimento_stato", (data) => {
      try {
        const result = updateAdempimentoStato(data);
        io.emit("broadcast:scadenzario_updated", { id_cliente: result.id_cliente, anno: result.anno });
        io.emit("broadcast:globale_updated", { anno: result.anno });
        io.emit("broadcast:stats_updated", { anno: result.anno });
        socket.emit("res:update:adempimento_stato", { success: true });
      } catch (e) {
        socket.emit("res:update:adempimento_stato", { success: false, error: e.message });
      }
    });

    socket.on("delete:adempimento_cliente", ({ id }) => {
      try {
        const result = deleteAdempimentoCliente(id);
        io.emit("broadcast:scadenzario_updated", { id_cliente: result.id_cliente, anno: result.anno });
        io.emit("broadcast:globale_updated", { anno: result.anno });
        socket.emit("res:delete:adempimento_cliente", { success: true });
      } catch (e) {
        socket.emit("res:delete:adempimento_cliente", { success: false, error: e.message });
      }
    });

    socket.on("add:adempimento_cliente", (data) => {
      try {
        addAdempimentoCliente(data);
        io.emit("broadcast:scadenzario_updated", { id_cliente: data.id_cliente, anno: data.anno });
        socket.emit("res:add:adempimento_cliente", { success: true });
      } catch (e) {
        socket.emit("res:add:adempimento_cliente", { success: false, error: e.message });
      }
    });

    // ── SCADENZARIO GLOBALE ──
    socket.on("get:scadenzario_globale", ({ anno, filtri = {} }) => {
      try {
        const data = getScadenzarioGlobale(anno, filtri);
        socket.emit("res:scadenzario_globale", { success: true, data });
      } catch (e) {
        socket.emit("res:scadenzario_globale", { success: false, error: e.message });
      }
    });

    // ── STATISTICHE ──
    socket.on("get:stats", ({ anno }) => {
      try {
        const data = getStats(anno);
        socket.emit("res:stats", { success: true, data });
      } catch (e) {
        socket.emit("res:stats", { success: false, error: e.message });
      }
    });

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnesso: ${socket.id}`);
    });
  });
};