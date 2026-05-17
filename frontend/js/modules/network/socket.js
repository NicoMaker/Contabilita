// ═══════════════════════════════════════════════════════════════
// SOCKET.JS — Gestione connessione e tutti gli eventi Socket.IO
// ═══════════════════════════════════════════════════════════════

const socket = io();

// ─── CONNESSIONE ──────────────────────────────────────────────
socket.on("connect", () => {
  document.getElementById("conn-status").textContent = "● Online";
  document.getElementById("conn-status").style.color = "var(--green)";
  socket.emit("get:tipologie");
  renderPage("dashboard");
});

socket.on("disconnect", () => {
  document.getElementById("conn-status").textContent = "● Offline";
  document.getElementById("conn-status").style.color = "var(--red)";
});

// ─── NOTIFICHE ────────────────────────────────────────────────
socket.on("notify", ({ type, msg }) => showNotif(msg, type));

// ─── BROADCAST ────────────────────────────────────────────────
socket.on("broadcast:scadenzario_updated", ({ id_cliente, anno }) => {
  if (state.page === "scadenzario" && state.selectedCliente) {
    if (!id_cliente || state.selectedCliente.id === id_cliente)
      if (!anno || state.anno === anno) loadScadenzario();
  }
});

socket.on("broadcast:globale_updated", ({ anno }) => {
  if (state.page === "scadenzario_globale")
    if (!anno || state.anno === anno) loadGlobale();
});

socket.on("broadcast:stats_updated", ({ anno }) => {
  if (state.page === "dashboard")
    if (!anno || state.anno === anno)
      socket.emit("get:stats", { anno: state.anno });
});

socket.on("broadcast:clienti_updated", () => {
  if (state.page === "clienti") {
    // Apply all current filters to ensure complete data loading
    setTimeout(() => {
      if (typeof applyClientiFiltriImmediate === 'function') {
        applyClientiFiltriImmediate();
      } else {
        // Fallback: at least include year and search
        const search = document.getElementById("global-search-clienti")?.value || "";
        const annoFiltro = parseInt(document.getElementById("filter-anno")?.value) || state.anno;
        socket.emit("get:clienti", { search, anno: annoFiltro });
      }
    }, 100);
  }
});

// ─── RISPOSTA DATI ────────────────────────────────────────────
socket.on("res:tipologie", ({ success, data }) => {
  if (success) state.tipologie = data;
});

socket.on("res:clienti", ({ success, data }) => {
  if (!success) return;
  state.clienti = data;
  if (state._pending === "clienti") {
    state._pending = null;
    renderClientiPage();
  } else if (state._pending === "scadenzario") {
    state._pending = null;
    if (state._gotoClienteId) {
      state.selectedCliente =
        state.clienti.find((c) => c.id === state._gotoClienteId) || null;
      state._gotoClienteId = null;
    }
    renderScadenzarioPage();
  } else if (state.page === "clienti") {
    renderClientiPage();
  }
});

socket.on("res:adempimenti", ({ success, data }) => {
  if (success) state.adempimenti = data;
  if (state._pending === "adempimenti") {
    state._pending = null;
    renderAdempimentiPage();
  } else if (state.page === "adempimenti") {
    renderAdempimentiPage();
  }
  const sel = document.getElementById("add-adp-select");
  if (sel && success) {
    const modalOpen = document
      .getElementById("modal-add-adp")
      ?.classList.contains("open");
    if (modalOpen) refreshAddAdpSelect();
    updatePeriodoOptions();
  }
});

socket.on("res:stats", ({ success, data }) => {
  if (success) {
    state.dashStats = data;
    renderDashboard(data);
  }
});

socket.on("res:scadenzario", ({ success, data }) => {
  if (success) {
    state.scadenzario = data;
    const inseriti = new Set();
    data.forEach((r) => inseriti.add(r.id_adempimento));
    state.adpInseriti = Array.from(inseriti);
    renderScadenzarioTabella(data);
    // ⭐ Inietta la barra bulk dopo il render
    setTimeout(function () {
      if (typeof patchScadBulk === "function") patchScadBulk();
    }, 50);
  }
});

socket.on("res:scadenzario_globale", ({ success, data }) => {
  if (success) {
    state.scadGlobale = data;
    state.globaleStats = calcolaGlobaleStats(data);
    renderGlobaleHeader();
    renderGlobaleTabella(data);
  }
});

// ─── RISPOSTA ELIMINA BULK SCADENZARIO CLIENTE ───────────────
socket.on("res:elimina:adempimenti_cliente_bulk", ({ success, eliminati, error }) => {
  if (success) {
    showNotif(
      "🗑️ Eliminat" + (eliminati === 1 ? "o" : "i") + " " + eliminati +
      " adempiment" + (eliminati === 1 ? "o" : "i"),
      "success"
    );
    if (typeof _scadBulkMode !== "undefined") {
      window._scadBulkMode = false;
      if (typeof _aggiornaUIBulkMode === "function") _aggiornaUIBulkMode();
    }
    if (state.page === "scadenzario") loadScadenzario();
    if (state.page === "scadenzario_globale") loadGlobale();
    if (state.page === "dashboard") socket.emit("get:stats", { anno: state.anno });
  } else {
    showNotif("❌ Errore eliminazione: " + (error || "Operazione fallita"), "error");
  }
});
function getClienteSaveErrorMessage(error) {
  if (!error) return "Errore durante il salvataggio del cliente";
  if (error.includes("NOME_DUPLICATO")) return "Nome gia esistente";
  return error;
}

socket.on("res:create:cliente", ({ success, error }) => {
  if (success) {
    closeModal("modal-cliente");
    // ⭐ Dopo creazione ricarica con l'anno del filtro attivo (non solo l'anno corrente)
    const annoFiltro =
      parseInt(document.getElementById("filter-anno")?.value) || state.anno;
    state._pending = "clienti";
    socket.emit("get:clienti", { anno: annoFiltro });
  } else {
    showNotif(getClienteSaveErrorMessage(error), "error");
  }
});

socket.on("res:update:cliente", ({ success, error }) => {
  if (success) {
    closeModal("modal-cliente");
    refreshPage();
  } else {
    showNotif(getClienteSaveErrorMessage(error), "error");
  }
});

socket.on("res:delete:cliente", ({ success }) => {
  if (success) refreshPage();
});

// ─── RISPOSTA CRUD ADEMPIMENTI DEF ────────────────────────────
socket.on("res:create:adempimento", ({ success, error }) => {
  if (success) {
    closeModal("modal-adp-def");
    state._pending = "adempimenti";
    socket.emit("get:adempimenti");
  } else showNotif(error, "error");
});

socket.on("res:update:adempimento", ({ success, error }) => {
  if (success) {
    closeModal("modal-adp-def");
    state._pending = "adempimenti";
    socket.emit("get:adempimenti");
  } else showNotif(error, "error");
});

socket.on("res:delete:adempimento", ({ success }) => {
  if (success) {
    state._pending = "adempimenti";
    socket.emit("get:adempimenti");
  }
});

// ─── RISPOSTA SCADENZARIO ─────────────────────────────────────
socket.on("res:genera:scadenzario", ({ success }) => {
  if (success && state.selectedCliente) loadScadenzario();
});

socket.on(
  "res:genera:tutti",
  ({ success, inseriti, mantenuti, riepilogo, dettagli }) => {
    if (success) {
      closeModal("modal-genera-tutti");
      // Mostra un messaggio dettagliato
      alert(
        riepilogo ||
          `Generati ${inseriti} nuovi adempimenti, mantenuti ${mantenuti} adempimenti esistenti`,
      );
      // Ricarica lo scadenzario globale e quello del cliente selezionato
      if (state.page === "scadenzario_globale") {
        loadGlobale();
      }
      if (state.selectedCliente) {
        loadScadenzario();
      }
    }
  },
);

socket.on("res:rigenera:tutti", ({ success }) => {
  if (success) {
    closeModal("modal-genera-tutti");
    // Ricarica lo scadenzario globale e quello del cliente selezionato
    if (state.page === "scadenzario_globale") {
      loadGlobale();
    } else if (state.page === "scadenzario" && state.selectedCliente) {
      loadScadenzario();
    }
  }
});

socket.on("res:copia:scadenzario", ({ success }) => {
  if (success) {
    closeModal("modal-copia");
    loadScadenzario();
  }
});

socket.on("res:copia:tutti", ({ success }) => {
  if (success) closeModal("modal-copia");
});

socket.on("res:update:adempimento_stato", ({ success }) => {
  if (success) {
    closeModal("modal-adempimento");
    if (state.page === "scadenzario") loadScadenzario();
    if (state.page === "scadenzario_globale") loadGlobale();
    if (state.page === "dashboard")
      socket.emit("get:stats", { anno: state.anno });
  }
});

socket.on("res:delete:adempimento_cliente", ({ success }) => {
  if (success) {
    closeModal("modal-adempimento");
    if (state.page === "scadenzario") loadScadenzario();
    if (state.page === "scadenzario_globale") loadGlobale();
  }
});

socket.on("res:add:adempimento_cliente", ({ success }) => {
  if (success) {
    closeModal("modal-add-adp");
    loadScadenzario();
  }
});

socket.on(
  "res:create:adempimento_personalizzato",
  ({ success, id, codice, generati_per_clienti, messaggio }) => {
    if (success) {
      closeModal("modal-adempimento-personalizzato");
      alert(messaggio || `Adempimento personalizzato creato con successo!`);

      // Ricarica la lista degli adempimenti
      if (typeof socket !== "undefined") {
        socket.emit("get:adempimenti");
      }

      // Se sono stati generati adempimenti, ricarica anche lo scadenzario
      if (generati_per_clienti > 0) {
        if (state.page === "scadenzario_globale") {
          loadGlobale();
        } else if (state.page === "scadenzario" && state.selectedCliente) {
          loadScadenzario();
        }
      }
    } else {
      alert("Errore nella creazione dell'adempimento personalizzato");
    }
  },
);

socket.on("res:adempimenti_cliente", ({ success, data }) => {
  if (success) {
    state.adempimentiCliente = data;
    // Re-render the scadenzario table to include adempimenti buttons
    if (state.scadenzario) {
      renderScadenzarioTabella(state.scadenzario);
    }
  }
});

// ─── RISPOSTA APPLICA ADEMPIMENTI A CLIENTI ───────────────────
socket.on(
  "res:applica:adempimenti_a_clienti",
  ({ success, inseriti, clienti, adempimenti, dettagli, error }) => {
    if (success) {
      let msg = `✅ Applicati ${inseriti} adempimenti a ${clienti} clienti (${adempimenti} adempimenti diversi)`;
      if (dettagli && dettagli.skipped > 0) {
        msg += ` — ${dettagli.skipped} già esistenti (mantenuti)`;
      }
      showNotif(msg, "success");

      // Aggiorna le viste
      if (state.page === "dashboard") {
        socket.emit("get:stats", { anno: state.anno });
      }
      if (state.page === "scadenzario_globale") {
        loadGlobale();
      }
      if (state.selectedCliente) {
        loadScadenzario();
      }
    } else {
      showNotif(`❌ Errore: ${error || "Applicazione fallita"}`, "error");
    }
  },
);

// ─── CLIENTI SENZA ADEMPIMENTI ────────────────────────────────
socket.on("res:clienti_senza_adempimenti", ({ success, data }) => {
  console.log("📨 res:clienti_senza_adempimenti", success, data?.length);
  if (success && window.renderClientiSenzaAdempimenti) {
    window.renderClientiSenzaAdempimenti(data);
  }
});

// ─── APPLICA ADEMPIMENTI A CLIENTI ────────────────────────────
socket.on(
  "res:applica:adempimenti_a_clienti",
  ({ success, inseriti, clienti, adempimenti, dettagli, error }) => {
    if (success) {
      let msg = `✅ Applicati ${inseriti} adempimenti a ${clienti} clienti`;
      if (dettagli?.skipped > 0) msg += ` — ${dettagli.skipped} già esistenti`;
      showNotif(msg, "success");
      if (state.page === "dashboard") {
        socket.emit("get:stats", { anno: state.anno });
        if (window.caricaClientiSenzaAdempimenti)
          window.caricaClientiSenzaAdempimenti();
      }
    } else {
      showNotif(`❌ Errore: ${error}`, "error");
    }
  },
);