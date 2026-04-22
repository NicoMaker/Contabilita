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
  if (state.page === "clienti") socket.emit("get:clienti");
});

socket.on("broadcast:adempimenti_updated", () => {
  if (state.page === "adempimenti") socket.emit("get:adempimenti");
  socket.emit("get:adempimenti");
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

// ─── RISPOSTA CRUD CLIENTI ────────────────────────────────────
socket.on("res:create:cliente", ({ success }) => {
  if (success) {
    closeModal("modal-cliente");
    state._pending = "clienti";
    socket.emit("get:clienti");
  }
});

socket.on("res:update:cliente", ({ success }) => {
  if (success) {
    closeModal("modal-cliente");
    refreshPage();
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

// ─── RISPOSTA SCADENZARIO ────────────────────────────────────
socket.on("res:genera:scadenzario", ({ success }) => {
  if (success && state.selectedCliente) loadScadenzario();
});

socket.on("res:genera:tutti", ({ success }) => {
  if (success) closeModal("modal-genera-tutti");
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
