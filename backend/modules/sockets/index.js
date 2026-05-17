const clientiModel = require("../models/clienti");
const adempimentiModel = require("../models/adempimenti");
const scadenzarioModel = require("../models/scadenzario");
const statsModel = require("../models/stats");
const { queryAll, queryOne } = require("../database");

module.exports = function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`✅ Client connesso: ${socket.id}`);

    // ── TIPOLOGIE ──
    socket.on("get:tipologie", () => {
      try {
        const tip = queryAll(`SELECT * FROM tipologie_cliente ORDER BY id`);
        const sub = queryAll(
          `SELECT * FROM sottotipologie ORDER BY id_tipologia, ordine, id`,
        );
        tip.forEach((t) => {
          t.sottotipologie = sub.filter((s) => s.id_tipologia === t.id);
        });
        socket.emit("res:tipologie", { success: true, data: tip });
      } catch (e) {
        socket.emit("res:tipologie", { success: false, error: e.message });
      }
    });

    // ── CLIENTI (con filtro anno) ──
    socket.on("get:clienti", (filtri = {}) => {
      try {
        const anno = filtri.anno || new Date().getFullYear();
        const data = clientiModel.getClientiConDettagli(filtri, anno);
        socket.emit("res:clienti", { success: true, data, anno });
      } catch (e) {
        socket.emit("res:clienti", { success: false, error: e.message });
      }
    });

    socket.on("get:cliente", ({ id, anno }) => {
      try {
        const a = anno || new Date().getFullYear();
        const c = clientiModel.getClienteConDettagli(id, a);
        socket.emit("res:cliente", { success: true, data: c, anno: a });
      } catch (e) {
        socket.emit("res:cliente", { success: false, error: e.message });
      }
    });

    socket.on("get:cliente_storico", ({ id }) => {
      try {
        const storico = clientiModel.getConfigStoricoCliente(id);
        socket.emit("res:cliente_storico", { success: true, data: storico });
      } catch (e) {
        socket.emit("res:cliente_storico", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("create:cliente", (data) => {
      try {
        const newId = clientiModel.createCliente(data);
        io.emit("broadcast:clienti_updated");
        socket.emit("res:create:cliente", { success: true, id: newId });
        socket.emit("notify", {
          type: "success",
          msg: "Cliente creato con successo",
        });
      } catch (e) {
        socket.emit("res:create:cliente", { success: false, error: e.message });
      }
    });

    socket.on("update:cliente", (data) => {
      try {
        clientiModel.updateClienteAnagrafica(data);
        clientiModel.updateClienteConfig(data);
        io.emit("broadcast:clienti_updated");
        socket.emit("res:update:cliente", { success: true });
        socket.emit("notify", { type: "success", msg: "Cliente aggiornato" });
      } catch (e) {
        socket.emit("res:update:cliente", { success: false, error: e.message });
      }
    });

    socket.on("delete:cliente", ({ id }) => {
      try {
        clientiModel.deleteCliente(id);
        io.emit("broadcast:clienti_updated");
        socket.emit("res:delete:cliente", { success: true });
        socket.emit("notify", {
          type: "success",
          msg: "Cliente eliminato con successo",
        });
      } catch (e) {
        socket.emit("res:delete:cliente", { success: false, error: e.message });
        socket.emit("notify", { type: "error", msg: e.message });
      }
    });

    // ⭐ NUOVI HANDLER PER COPIA CONFIGURAZIONE CLIENTE
    socket.on("copia:config_cliente", ({ id_cliente, anno_da, anno_a }) => {
      try {
        const config = clientiModel.copiaConfigClienteAnno(
          id_cliente,
          anno_da,
          anno_a,
        );
        io.emit("broadcast:clienti_updated");
        socket.emit("res:copia:config_cliente", { success: true, config });
        socket.emit("notify", {
          type: "success",
          msg: `Configurazione cliente copiata dall'anno ${anno_da} al ${anno_a}`,
        });
      } catch (e) {
        socket.emit("res:copia:config_cliente", {
          success: false,
          error: e.message,
        });
        socket.emit("notify", { type: "error", msg: e.message });
      }
    });

    socket.on("copia:config_tutti_clienti", ({ anno_da, anno_a }) => {
      try {
        const risultati = clientiModel.copiaTuttiClientiAnno(anno_da, anno_a);
        const successCount = risultati.filter((r) => r.success).length;
        const errorCount = risultati.filter((r) => !r.success).length;

        io.emit("broadcast:clienti_updated");
        socket.emit("res:copia:config_tutti_clienti", {
          success: true,
          risultati,
        });

        if (errorCount === 0) {
          socket.emit("notify", {
            type: "success",
            msg: `Configurazione copiata con successo per tutti ${successCount} clienti`,
          });
        } else {
          socket.emit("notify", {
            type: "warning",
            msg: `Configurazione copiata per ${successCount} clienti, ${errorCount} errori`,
          });
        }
      } catch (e) {
        socket.emit("res:copia:config_tutti_clienti", {
          success: false,
          error: e.message,
        });
        socket.emit("notify", { type: "error", msg: e.message });
      }
    });

    // ── ADEMPIMENTI ──
    socket.on("get:adempimenti", () => {
      try {
        const data = adempimentiModel.getAdempimenti();
        socket.emit("res:adempimenti", { success: true, data });
      } catch (e) {
        socket.emit("res:adempimenti", { success: false, error: e.message });
      }
    });

    socket.on("get:adempimenti_cliente", ({ id_cliente, anno }) => {
      try {
        const data = adempimentiModel.getAdempimentiCliente(id_cliente, anno);
        socket.emit("res:adempimenti_cliente", { success: true, data });
      } catch (e) {
        socket.emit("res:adempimenti_cliente", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("create:adempimento", (data) => {
      try {
        const newId = adempimentiModel.createAdempimento(data);
        const anno = new Date().getFullYear();
        const tot = adempimentiModel.generaAdempimentoPerTutti(newId, anno);
        io.emit("broadcast:adempimenti_updated");
        io.emit("broadcast:scadenzario_updated", { anno });
        socket.emit("res:create:adempimento", {
          success: true,
          id: newId,
          generati: tot,
        });
      } catch (e) {
        socket.emit("res:create:adempimento", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("update:adempimento", (data) => {
      try {
        adempimentiModel.updateAdempimento(data);
        io.emit("broadcast:adempimenti_updated");
        socket.emit("res:update:adempimento", { success: true });
      } catch (e) {
        socket.emit("res:update:adempimento", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("delete:adempimento", ({ id }) => {
      try {
        adempimentiModel.deleteAdempimento(id);
        io.emit("broadcast:adempimenti_updated");
        socket.emit("res:delete:adempimento", { success: true });
        socket.emit("notify", {
          type: "success",
          msg: "Adempimento eliminato con successo",
        });
      } catch (e) {
        socket.emit("res:delete:adempimento", {
          success: false,
          error: e.message,
        });
        socket.emit("notify", { type: "error", msg: e.message });
      }
    });

    // ── SCADENZARIO ──
    socket.on("get:scadenzario", ({ id_cliente, anno, filtri = {} }) => {
      try {
        const data = scadenzarioModel.getScadenzarioConDettagliCliente(
          id_cliente,
          anno,
          filtri,
        );
        socket.emit("res:scadenzario", { success: true, data });
      } catch (e) {
        socket.emit("res:scadenzario", { success: false, error: e.message });
      }
    });

    socket.on("genera:scadenzario", ({ id_cliente, anno }) => {
      try {
        const tot = scadenzarioModel.generaScadenzarioInterno(id_cliente, anno);
        io.emit("broadcast:scadenzario_updated", { id_cliente, anno });
        io.emit("broadcast:stats_updated", { anno });
        socket.emit("res:genera:scadenzario", { success: true, inseriti: tot });
      } catch (e) {
        socket.emit("res:genera:scadenzario", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("genera:tutti", ({ anno, adempimenti }) => {
      try {
        const risultato = scadenzarioModel.generaTuttiClientiAnno(
          anno,
          adempimenti,
        );
        io.emit("broadcast:scadenzario_updated", { anno });
        io.emit("broadcast:globale_updated", { anno });
        io.emit("broadcast:stats_updated", { anno });
        socket.emit("res:genera:tutti", {
          success: true,
          ...risultato,
        });
      } catch (e) {
        socket.emit("res:genera:tutti", { success: false, error: e.message });
      }
    });

    socket.on("rigenera:tutti", ({ anno, adempimenti }) => {
      try {
        const tot = scadenzarioModel.rigeneraTuttiClientiAnno(
          anno,
          adempimenti,
        );
        io.emit("broadcast:scadenzario_updated", { anno });
        io.emit("broadcast:globale_updated", { anno });
        io.emit("broadcast:stats_updated", { anno });
        socket.emit("res:rigenera:tutti", { success: true, inseriti: tot });
      } catch (e) {
        socket.emit("res:rigenera:tutti", { success: false, error: e.message });
      }
    });

    socket.on("create:adempimento_personalizzato", (data) => {
      try {
        const risultato =
          adempimentiModel.createAdempimentoPersonalizzato(data);
        io.emit("broadcast:adempimenti_updated");

        // Se sono stati generati adempimenti per clienti, aggiorna anche lo scadenzario
        if (risultato.generati_per_clienti > 0) {
          io.emit("broadcast:scadenzario_updated", {
            anno: data.anno || new Date().getFullYear(),
          });
          io.emit("broadcast:globale_updated", {
            anno: data.anno || new Date().getFullYear(),
          });
          io.emit("broadcast:stats_updated", {
            anno: data.anno || new Date().getFullYear(),
          });
        }

        socket.emit("res:create:adempimento_personalizzato", {
          success: true,
          ...risultato,
        });
      } catch (e) {
        socket.emit("res:create:adempimento_personalizzato", {
          success: false,
          error: e.message,
        });
      }
    });
    socket.on("check:adempimenti_cliente", ({ id_cliente, anno }) => {
      try {
        const risultato = adempimentiModel.checkAdempimentiClienteEsistenti(
          id_cliente,
          anno,
        );
        socket.emit("res:check:adempimenti_cliente", {
          success: true,
          data: risultato,
        });
      } catch (e) {
        socket.emit("res:check:adempimenti_cliente", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("copia:scadenzario", ({ id_cliente, anno_da, anno_a }) => {
      try {
        const tot = scadenzarioModel.copiaScadenzarioCliente(
          id_cliente,
          anno_da,
          anno_a,
        );
        io.emit("broadcast:scadenzario_updated", { id_cliente, anno: anno_a });
        socket.emit("res:copia:scadenzario", { success: true, copiati: tot });
      } catch (e) {
        socket.emit("res:copia:scadenzario", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("copia:tutti", ({ anno_da, anno_a }) => {
      try {
        const tot = scadenzarioModel.copiaTuttiClienti(anno_da, anno_a);
        io.emit("broadcast:scadenzario_updated", { anno: anno_a });
        io.emit("broadcast:globale_updated", { anno: anno_a });
        socket.emit("res:copia:tutti", { success: true, copiati: tot });
      } catch (e) {
        socket.emit("res:copia:tutti", { success: false, error: e.message });
      }
    });

    socket.on("update:adempimento_stato", (data) => {
      try {
        const result = scadenzarioModel.updateAdempimentoStato(data);
        io.emit("broadcast:scadenzario_updated", {
          id_cliente: result.id_cliente,
          anno: result.anno,
        });
        io.emit("broadcast:globale_updated", { anno: result.anno });
        io.emit("broadcast:stats_updated", { anno: result.anno });
        socket.emit("res:update:adempimento_stato", { success: true });
      } catch (e) {
        socket.emit("res:update:adempimento_stato", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("delete:adempimento_cliente", ({ id }) => {
      try {
        const result = scadenzarioModel.deleteAdempimentoCliente(id);
        io.emit("broadcast:scadenzario_updated", {
          id_cliente: result.id_cliente,
          anno: result.anno,
        });
        io.emit("broadcast:globale_updated", { anno: result.anno });
        socket.emit("res:delete:adempimento_cliente", { success: true });
      } catch (e) {
        socket.emit("res:delete:adempimento_cliente", {
          success: false,
          error: e.message,
        });
      }
    });

    socket.on("add:adempimento_cliente", (data) => {
      try {
        scadenzarioModel.addAdempimentoCliente(data);
        io.emit("broadcast:scadenzario_updated", {
          id_cliente: data.id_cliente,
          anno: data.anno,
        });
        socket.emit("res:add:adempimento_cliente", { success: true });
      } catch (e) {
        socket.emit("res:add:adempimento_cliente", {
          success: false,
          error: e.message,
        });
      }
    });

    // ── SCADENZARIO GLOBALE ──
    socket.on("get:scadenzario_globale", ({ anno, filtri = {} }) => {
      try {
        const data = scadenzarioModel.getScadenzarioGlobale(anno, filtri);
        socket.emit("res:scadenzario_globale", { success: true, data });
      } catch (e) {
        socket.emit("res:scadenzario_globale", {
          success: false,
          error: e.message,
        });
      }
    });

    // ── STATISTICHE ──
    socket.on("get:stats", ({ anno }) => {
      try {
        const data = statsModel.getStats(anno);
        socket.emit("res:stats", { success: true, data });
      } catch (e) {
        socket.emit("res:stats", { success: false, error: e.message });
      }
    });

    // ⭐ NUOVO HANDLER: Applica adempimenti esistenti a clienti multipli
    socket.on(
      "applica:adempimenti_a_clienti",
      ({ adempimenti_ids, clienti_ids, anno }) => {
        try {
          const risultato = adempimentiModel.applicaAdempimentiAClienti(
            adempimenti_ids,
            clienti_ids,
            anno,
          );

          // Broadcast degli aggiornamenti
          io.emit("broadcast:adempimenti_updated");
          io.emit("broadcast:scadenzario_updated", { anno });
          io.emit("broadcast:globale_updated", { anno });
          io.emit("broadcast:stats_updated", { anno });

          socket.emit("res:applica:adempimenti_a_clienti", {
            success: true,
            inseriti: risultato.inseriti,
            clienti: risultato.clienti,
            adempimenti: adempimenti_ids.length,
            dettagli: { skipped: risultato.skipped },
          });
        } catch (e) {
          console.error("Errore in applica:adempimenti_a_clienti:", e);
          socket.emit("res:applica:adempimenti_a_clienti", {
            success: false,
            error: e.message,
          });
        }
      },
    );

    // ⭐ NUOVO HANDLER: Clienti senza adempimenti per l'anno
    socket.on("get:clienti_senza_adempimenti", ({ anno }) => {
      try {
        const clientiSenzaAdp = clientiModel.getClientiSenzaAdempimenti(anno);
        socket.emit("res:clienti_senza_adempimenti", {
          success: true,
          data: clientiSenzaAdp,
        });
      } catch (e) {
        console.error("Errore in get:clienti_senza_adempimenti:", e);
        socket.emit("res:clienti_senza_adempimenti", {
          success: false,
          error: e.message,
        });
      }
    });

    // ⭐ NUOVO HANDLER: Applica adempimenti esistenti a clienti multipli
    socket.on(
      "applica:adempimenti_a_clienti",
      ({ adempimenti_ids, clienti_ids, anno }) => {
        try {
          const risultato = adempimentiModel.applicaAdempimentiAClienti(
            adempimenti_ids,
            clienti_ids,
            anno,
          );

          // Broadcast degli aggiornamenti
          io.emit("broadcast:adempimenti_updated");
          io.emit("broadcast:scadenzario_updated", { anno });
          io.emit("broadcast:globale_updated", { anno });
          io.emit("broadcast:stats_updated", { anno });

          socket.emit("res:applica:adempimenti_a_clienti", {
            success: true,
            inseriti: risultato.inseriti,
            clienti: clienti_ids.length,
            adempimenti: adempimenti_ids.length,
            dettagli: { skipped: risultato.skipped },
          });
        } catch (e) {
          console.error("Errore in applica:adempimenti_a_clienti:", e);
          socket.emit("res:applica:adempimenti_a_clienti", {
            success: false,
            error: e.message,
          });
        }
      },
    );

    // ⭐ CLIENTI SENZA ADEMPIMENTI
    socket.on("get:clienti_senza_adempimenti", ({ anno }) => {
      try {
        console.log(`🔍 Cerco clienti senza adempimenti per anno ${anno}`);
        const clientiSenzaAdp = clientiModel.getClientiSenzaAdempimenti(anno);
        console.log(
          `✅ Trovati ${clientiSenzaAdp.length} clienti senza adempimenti`,
        );
        socket.emit("res:clienti_senza_adempimenti", {
          success: true,
          data: clientiSenzaAdp,
        });
      } catch (e) {
        console.error("❌ Errore in get:clienti_senza_adempimenti:", e);
        socket.emit("res:clienti_senza_adempimenti", {
          success: false,
          error: e.message,
        });
      }
    });

    // ⭐ APPLICA ADEMPIMENTI A CLIENTI (MULTIPLI)
    socket.on(
      "applica:adempimenti_a_clienti",
      ({ adempimenti_ids, clienti_ids, anno }) => {
        try {
          console.log(
            `📋 Applicazione adempimenti: ${adempimenti_ids.length} adempimenti a ${clienti_ids.length} clienti per anno ${anno}`,
          );
          const risultato = adempimentiModel.applicaAdempimentiAClienti(
            adempimenti_ids,
            clienti_ids,
            anno,
          );

          // Broadcast degli aggiornamenti
          io.emit("broadcast:adempimenti_updated");
          io.emit("broadcast:scadenzario_updated", { anno });
          io.emit("broadcast:globale_updated", { anno });
          io.emit("broadcast:stats_updated", { anno });

          socket.emit("res:applica:adempimenti_a_clienti", {
            success: true,
            inseriti: risultato.inseriti,
            clienti: clienti_ids.length,
            adempimenti: adempimenti_ids.length,
            dettagli: { skipped: risultato.skipped },
          });
        } catch (e) {
          console.error("❌ Errore in applica:adempimenti_a_clienti:", e);
          socket.emit("res:applica:adempimenti_a_clienti", {
            success: false,
            error: e.message,
          });
        }
      },
    );

    // ⭐ ELIMINA ADEMPIMENTI DA CLIENTI (MULTIPLI)
    socket.on(
      "elimina:adempimenti_a_clienti",
      ({ adempimenti_ids, clienti_ids, anno }) => {
        try {
          console.log(
            `🗑️ Eliminazione adempimenti: ${adempimenti_ids.length} adempimenti da ${clienti_ids.length} clienti per anno ${anno}`,
          );
          const risultato = adempimentiModel.eliminaAdempimentiDaClienti(
            adempimenti_ids,
            clienti_ids,
            anno,
          );

          io.emit("broadcast:scadenzario_updated", { anno });
          io.emit("broadcast:globale_updated", { anno });
          io.emit("broadcast:stats_updated", { anno });

          socket.emit("res:elimina:adempimenti_a_clienti", {
            success: true,
            eliminati: risultato.eliminati,
            nonTrovati: risultato.nonTrovati,
            clienti: clienti_ids.length,
            adempimenti: adempimenti_ids.length,
          });
        } catch (e) {
          console.error("❌ Errore in elimina:adempimenti_a_clienti:", e);
          socket.emit("res:elimina:adempimenti_a_clienti", {
            success: false,
            error: e.message,
          });
        }
      },
    );

    // ⭐ ELIMINA ADEMPIMENTI BULK PER SINGOLO CLIENTE (dalla pagina scadenzario)
    socket.on(
      "elimina:adempimenti_cliente_bulk",
      ({ ids_righe, id_cliente, anno }) => {
        try {
          console.log(`🗑️ Bulk delete scadenzario cliente ${id_cliente}: ${ids_righe.length} righe`);
          const risultato = adempimentiModel.eliminaAdempimentiClienteBulk(ids_righe);

          io.emit("broadcast:scadenzario_updated", { id_cliente, anno });
          io.emit("broadcast:globale_updated", { anno });
          io.emit("broadcast:stats_updated", { anno });

          socket.emit("res:elimina:adempimenti_cliente_bulk", {
            success: true,
            eliminati: risultato.eliminati,
          });
        } catch (e) {
          console.error("❌ Errore in elimina:adempimenti_cliente_bulk:", e);
          socket.emit("res:elimina:adempimenti_cliente_bulk", {
            success: false,
            error: e.message,
          });
        }
      },
    );

    socket.on("disconnect", () => {
      console.log(`❌ Client disconnesso: ${socket.id}`);
    });
  });
};