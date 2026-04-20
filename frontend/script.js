const socket = io();

const MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
const MESI_SHORT = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];
const STATI = {
  da_fare: "⭕ Da fare",
  in_corso: "🔄 In corso",
  completato: "✅ Completato",
  n_a: "➖ N/A",
};
const CATEGORIE = [
  { codice: "IVA", nome: "💰 IVA", icona: "💰", color: "#fbbf24" },
  {
    codice: "DICHIARAZIONI",
    nome: "📄 Dichiarazioni",
    icona: "📄",
    color: "#5b8df6",
  },
  {
    codice: "PREVIDENZA",
    nome: "🏦 Previdenza",
    icona: "🏦",
    color: "#34d399",
  },
  { codice: "LAVORO", nome: "👔 Lavoro", icona: "👔", color: "#a78bfa" },
  { codice: "TRIBUTI", nome: "🏛️ Tributi", icona: "🏛️", color: "#f87171" },
  { codice: "BILANCIO", nome: "📊 Bilancio", icona: "📊", color: "#22d3ee" },
];

const SOTTOTIPO_LABEL_MAP = {
  PF_PRIV: "Privato",
  PF_DITTA_ORD: "Ditta Ind. – Ordinario",
  PF_DITTA_SEM: "Ditta Ind. – Semplificato",
  PF_DITTA_FOR: "Ditta Ind. – Forfettario",
  PF_SOCIO: "Socio",
  PF_PROF_ORD: "Professionista – Ordinario",
  PF_PROF_SEM: "Professionista – Semplificato",
  PF_PROF_FOR: "Professionista – Forfettario",
  SP_ORD: "Soc. Persone – Ordinaria",
  SP_SEMP: "Soc. Persone – Semplificata",
  SC_ORD: "Soc. Capitali – Ordinaria",
  ASS_ORD: "Associazione – Ordinaria",
  ASS_SEMP: "Associazione – Semplificata",
};

const COL2_OPTIONS = {
  PF: [
    { value: "privato", label: "Privato" },
    { value: "ditta", label: "Ditta Individuale" },
    { value: "socio", label: "Socio" },
    { value: "professionista", label: "Professionista" },
  ],
  SP: null,
  SC: null,
  ASS: null,
};

function getCol3Options(tipCodice, col2Value) {
  if (tipCodice === "SP" || tipCodice === "ASS")
    return [
      { value: "ordinaria", label: "Ordinaria" },
      { value: "semplificata", label: "Semplificata" },
    ];
  if (tipCodice === "SC") return [{ value: "ordinaria", label: "Ordinaria" }];
  if (tipCodice === "PF") {
    if (!col2Value || col2Value === "privato" || col2Value === "socio")
      return null;
    return [
      { value: "ordinario", label: "Ordinario" },
      { value: "semplificato", label: "Semplificato" },
      { value: "forfettario", label: "Forfettario" },
    ];
  }
  return null;
}

const SOTTOTIPO_MAP = {
  "PF|privato|": "PF_PRIV",
  "PF|ditta|ordinario": "PF_DITTA_ORD",
  "PF|ditta|semplificato": "PF_DITTA_SEM",
  "PF|ditta|forfettario": "PF_DITTA_FOR",
  "PF|socio|": "PF_SOCIO",
  "PF|professionista|ordinario": "PF_PROF_ORD",
  "PF|professionista|semplificato": "PF_PROF_SEM",
  "PF|professionista|forfettario": "PF_PROF_FOR",
  "SP||ordinaria": "SP_ORD",
  "SP||semplificata": "SP_SEMP",
  "SC||ordinaria": "SC_ORD",
  "ASS||ordinaria": "ASS_ORD",
  "ASS||semplificata": "ASS_SEMP",
};

function getSottotipoCode(tipCodice, col2, col3) {
  const key = `${tipCodice}|${col2 || ""}|${col3 || ""}`;
  return SOTTOTIPO_MAP[key] || null;
}

let _rowStore = {};
function storeRow(r) {
  _rowStore[r.id] = r;
  return r.id;
}
function openAdpById(id) {
  const r = _rowStore[id];
  if (!r) {
    console.warn("Row not found:", id);
    return;
  }
  openAdpModal(r);
}

let state = {
  page: "dashboard",
  tipologie: [],
  clienti: [],
  adempimenti: [],
  selectedCliente: null,
  anno: new Date().getFullYear(),
  filtri: { stato: "tutti", categoria: "tutti" },
  scadenzario: [],
  scadGlobale: [],
  dashStats: null,
  dashSearch: "",
  dashFiltroCategoria: "tutti",
  globalePreFiltroAdp: "",
  globaleStats: null,
  _dashRendered: false,
  adpInseriti: [],
  _currentClienteDettaglio: null,
};

function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}
function escAttr(s) {
  return (s || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── SOCKET ───────────────────────────────────────────────────
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
socket.on("notify", ({ type, msg }) => showNotif(msg, type));
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
    renderScadenzarioPage();
  } else if (state.page === "clienti") renderClientiPage();
});
socket.on("res:adempimenti", ({ success, data }) => {
  if (success) state.adempimenti = data;
  if (state._pending === "adempimenti") {
    state._pending = null;
    renderAdempimentiPage();
  } else if (state.page === "adempimenti") renderAdempimentiPage();
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

// ─── SCARICA DATABASE ─────────────────────────────────────────
function scaricaDatabase() {
  showNotif("⏳ Download in corso...", "info");
  fetch("/api/download-db", { method: "GET" })
    .then((response) => {
      if (!response.ok)
        return response.json().then((err) => {
          throw new Error(err.error || "Download fallito");
        });
      return response.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gestionale_${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotif("✅ Database scaricato!", "success");
    })
    .catch((error) => showNotif(`❌ Errore: ${error.message}`, "error"));
}

// ─── NAV ──────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach((el) => {
  if (el.dataset.page)
    el.addEventListener("click", () => {
      document
        .querySelectorAll(".nav-item")
        .forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      renderPage(el.dataset.page);
    });
});
document.getElementById("btn-scarica-db")?.addEventListener("click", (e) => {
  e.stopPropagation();
  scaricaDatabase();
});

function renderPage(page) {
  state.page = page;
  state._dashRendered = false;
  const titles = {
    dashboard: "Dashboard",
    clienti: "Clienti",
    scadenzario: "Scadenzario Cliente",
    scadenzario_globale: "Vista Globale",
    adempimenti: "Adempimenti Fiscali",
    tipologie: "Tipologie Clienti",
  };
  document.getElementById("page-title").textContent = titles[page] || page;

  if (page === "dashboard") {
    document.getElementById("topbar-actions").innerHTML = `
      <div class="year-sel"><button onclick="changeAnno(-1)">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnno(1)">&#9654;</button></div>
      <button class="btn btn-orange btn-sm no-print" onclick="openGeneraTutti()">⚡ Genera Tutti</button>
      <button class="btn btn-cyan btn-sm no-print" onclick="openCopiaTutti()">📋 Copia Anno</button>
      <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>`;
    socket.emit("get:stats", { anno: state.anno });
  } else if (page === "clienti") {
    state._pending = "clienti";
    document.getElementById("topbar-actions").innerHTML = `
      <div class="search-wrap" style="width:260px"><span class="search-icon">🔍</span><input class="input" id="global-search-clienti" placeholder="Cerca nome, CF, P.IVA, email..." oninput="applyClientiFiltri()"></div>
      <select class="select" id="filter-tipo" style="width:120px" onchange="applyClientiFiltri()">
        <option value="">Tutte tipologie</option><option value="PF">PF</option><option value="SP">SP</option><option value="SC">SC</option><option value="ASS">ASS</option>
      </select>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
      <button class="btn btn-primary no-print" onclick="openNuovoCliente()">+ Nuovo Cliente</button>`;
    socket.emit("get:clienti");
  } else if (page === "scadenzario") {
    state._pending = "scadenzario";
    document.getElementById("topbar-actions").innerHTML = "";
    socket.emit("get:clienti");
  } else if (page === "scadenzario_globale") {
    renderGlobalePage();
  } else if (page === "adempimenti") {
    state._pending = "adempimenti";
    document.getElementById("topbar-actions").innerHTML = `
      <div class="search-wrap" style="width:260px"><span class="search-icon">🔍</span><input class="input" id="global-search-adempimenti" placeholder="Cerca codice, nome, categoria..." oninput="applyAdempimentiFiltriSearch()"></div>
      <select class="select" id="filter-adp-cat" style="width:160px" onchange="applyAdempimentiFiltriSearch()">
        <option value="">Tutte le categorie</option>
        ${CATEGORIE.map((c) => `<option value="${c.codice}">${c.nome}</option>`).join("")}
      </select>
      <button class="btn btn-primary no-print" onclick="openNuovoAdpDef()">+ Nuovo</button>`;
    socket.emit("get:adempimenti");
  } else if (page === "tipologie") {
    document.getElementById("topbar-actions").innerHTML = "";
    renderTipologiePage();
  }
}

function refreshPage() {
  renderPage(state.page);
}
function changeAnno(d) {
  state.anno += d;
  document
    .querySelectorAll(".year-num")
    .forEach((el) => (el.textContent = state.anno));
  if (state.page === "dashboard") {
    state._dashRendered = false;
    socket.emit("get:stats", { anno: state.anno });
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER: badge tipo cliente completo
// ═══════════════════════════════════════════════════════════════
function getLabelSottotipologia(cliente) {
  if (
    cliente.sottotipologia_codice &&
    SOTTOTIPO_LABEL_MAP[cliente.sottotipologia_codice]
  )
    return SOTTOTIPO_LABEL_MAP[cliente.sottotipologia_codice];
  return cliente.sottotipologia_nome || null;
}

// Restituisce una stringa leggibile con tutte le classificazioni del cliente
function getClassificazioneCompleta(c) {
  const parts = [];
  if (c.tipologia_codice) parts.push(c.tipologia_codice);
  if (c.col2_value) {
    const labels = {
      privato: "Privato",
      ditta: "Ditta Ind.",
      socio: "Socio",
      professionista: "Professionista",
    };
    parts.push(labels[c.col2_value] || c.col2_value);
  }
  if (c.col3_value) {
    const labels = {
      ordinario: "Ord.",
      semplificato: "Sempl.",
      forfettario: "Forf.",
      ordinaria: "Ord.",
      semplificata: "Sempl.",
    };
    parts.push(labels[c.col3_value] || c.col3_value);
  }
  if (c.periodicita)
    parts.push(
      c.periodicita === "mensile"
        ? "Mensile"
        : c.periodicita === "trimestrale"
          ? "Trimestrale"
          : c.periodicita,
    );
  return parts.join(" · ");
}

function getTipologiaColor(tipCodice) {
  const colors = {
    PF: "#5b8df6",
    SP: "#a78bfa",
    SC: "#34d399",
    ASS: "#fbbf24",
  };
  return colors[tipCodice] || "var(--accent)";
}

function renderClienteInfoBox(cliente) {
  if (!cliente) return "";
  const avatar = (cliente.nome || "?").charAt(0).toUpperCase();
  const tipColor = getTipologiaColor(cliente.tipologia_codice);
  const tipBadge = cliente.tipologia_codice
    ? `<span class="badge b-${(cliente.tipologia_codice || "").toLowerCase()}">${cliente.tipologia_codice}</span>`
    : "";
  const sottotipoLabel = getLabelSottotipologia(cliente);
  const subBadge = sottotipoLabel
    ? `<span class="badge b-categoria">📋 ${sottotipoLabel}</span>`
    : "";

  let classCols = "";
  if (cliente.col2_value || cliente.col3_value || cliente.periodicita) {
    classCols = `<div class="cliente-class-pills">`;
    if (cliente.col2_value)
      classCols += `<span class="class-pill"><span class="cp-num">2</span>${{ privato: "Privato", ditta: "Ditta Ind.", socio: "Socio", professionista: "Professionista" }[cliente.col2_value] || cliente.col2_value}</span>`;
    if (cliente.col3_value)
      classCols += `<span class="class-pill"><span class="cp-num">3</span>${{ ordinario: "Ordinario", semplificato: "Semplificato", forfettario: "Forfettario", ordinaria: "Ordinaria", semplificata: "Semplificata" }[cliente.col3_value] || cliente.col3_value}</span>`;
    if (cliente.periodicita)
      classCols += `<span class="class-pill per-pill"><span class="cp-num">4</span>${cliente.periodicita === "mensile" ? "📅 Mensile" : "📆 Trimestrale"}</span>`;
    classCols += `</div>`;
  }

  let metaChips = [];
  if (cliente.codice_fiscale)
    metaChips.push(
      `<span class="meta-chip">CF: <strong>${cliente.codice_fiscale}</strong></span>`,
    );
  if (cliente.partita_iva)
    metaChips.push(
      `<span class="meta-chip">P.IVA: <strong>${cliente.partita_iva}</strong></span>`,
    );
  if (cliente.email)
    metaChips.push(`<span class="meta-chip">📧 ${cliente.email}</span>`);
  if (cliente.telefono)
    metaChips.push(`<span class="meta-chip">📞 ${cliente.telefono}</span>`);

  return `
    <div class="cliente-info-header">
      <div class="cliente-info-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}22">${avatar}</div>
      <div style="flex:1">
        <div class="cliente-info-nome">${escAttr(cliente.nome)}</div>
        <div class="cliente-info-badges">${tipBadge} ${subBadge}</div>
        ${classCols}
      </div>
    </div>
    ${metaChips.length ? `<div class="cliente-info-meta">${metaChips.join("")}</div>` : ""}
  `;
}

function renderClienteDatiRiferimento(cliente) {
  if (!cliente) return "";
  let items = [];
  if (cliente.codice_fiscale)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">🆔</span><span class="ref-label">CF:</span><span class="ref-value">${cliente.codice_fiscale}</span></div>`,
    );
  if (cliente.partita_iva)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">🏢</span><span class="ref-label">P.IVA:</span><span class="ref-value">${cliente.partita_iva}</span></div>`,
    );
  if (cliente.email)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">📧</span><span class="ref-label">Email:</span><span class="ref-value">${cliente.email}</span></div>`,
    );
  if (cliente.telefono)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">📞</span><span class="ref-label">Tel:</span><span class="ref-value">${cliente.telefono}</span></div>`,
    );
  if (cliente.pec)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">📨</span><span class="ref-label">PEC:</span><span class="ref-value">${cliente.pec}</span></div>`,
    );
  if (cliente.sdi)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">📋</span><span class="ref-label">SDI:</span><span class="ref-value">${cliente.sdi}</span></div>`,
    );
  if (cliente.referente)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">👤</span><span class="ref-label">Ref.:</span><span class="ref-value">${cliente.referente}</span></div>`,
    );
  if (cliente.iban)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">🏦</span><span class="ref-label">IBAN:</span><span class="ref-value">${cliente.iban}</span></div>`,
    );
  if (cliente.indirizzo)
    items.push(
      `<div class="dati-ref-item"><span class="ref-icon">📍</span><span class="ref-label">Indirizzo:</span><span class="ref-value">${cliente.indirizzo}${cliente.citta ? `, ${cliente.citta}` : ""}</span></div>`,
    );
  if (!items.length) return "";
  return `<div class="cpc-dati-riferimento"><div class="dati-ref-title">📋 Dati di Riferimento</div><div class="dati-ref-grid">${items.join("")}</div></div>`;
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function buildDashboardShell(stats) {
  document.getElementById("content").innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr));margin-bottom:20px">
      <div class="stat-card"><div class="stat-label">Clienti Attivi</div><div class="stat-value v-blue">${stats.totClienti}</div></div>
      <div class="stat-card"><div class="stat-label" id="ds-lbl-tot">Adempimenti ${stats.anno}</div><div class="stat-value" id="ds-tot">-</div></div>
      <div class="stat-card"><div class="stat-label">Completati</div><div class="stat-value v-green" id="ds-comp">-</div><div class="prog-bar"><div class="prog-fill green" id="ds-prog" style="width:0%"></div></div><div class="stat-sub" id="ds-perc">0%</div></div>
      <div class="stat-card"><div class="stat-label">Da Fare</div><div class="stat-value v-yellow" id="ds-dafare">-</div></div>
      <div class="stat-card"><div class="stat-label">In Corso</div><div class="stat-value v-purple" id="ds-incorso">-</div></div>
      <div class="stat-card"><div class="stat-label">N/A</div><div class="stat-value" style="color:var(--text3)" id="ds-na">${stats.na || 0}</div></div>
    </div>
    <div class="table-wrap">
      <div class="table-header no-print" style="flex-wrap:wrap;gap:10px">
        <h3 id="dash-adp-count-title">Adempimenti ${stats.anno}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1">
          <div id="dash-cat-tabs" style="display:flex;gap:4px;flex-wrap:wrap"></div>
          <div class="search-wrap" style="width:210px;margin-left:auto">
            <span class="search-icon">🔍</span>
            <input class="input" id="dash-adp-search" placeholder="Cerca nome, codice..." value="${escAttr(state.dashSearch)}" oninput="onDashAdpSearch(this.value)">
          </div>
        </div>
      </div>
      <table>
        <thead><tr>
          <th style="width:90px">Codice</th><th>Nome adempimento</th><th>Categoria</th>
          <th style="text-align:right;width:65px">Totale</th>
          <th style="text-align:right;width:75px;color:var(--green)">✓ Comp.</th>
          <th style="text-align:right;width:75px;color:var(--red)">⭕ Da fare</th>
          <th style="text-align:right;width:65px;color:var(--yellow)">🔄 Corso</th>
          <th style="width:150px">Avanzamento</th>
        </tr></thead>
        <tbody id="dash-adp-tbody"></tbody>
      </table>
    </div>`;
  state._dashRendered = true;
}

function updateDashboardContent(stats) {
  const allAdp = stats.adempimentiStats || [];
  const sq = (state.dashSearch || "").toLowerCase().trim();
  const sc = state.dashFiltroCategoria || "tutti";
  const catColor = {};
  CATEGORIE.forEach((c) => (catColor[c.codice] = c.color));
  const adpVis = allAdp.filter((a) => {
    if (sc !== "tutti" && a.categoria !== sc) return false;
    if (
      sq &&
      !a.nome.toLowerCase().includes(sq) &&
      !a.codice.toLowerCase().includes(sq) &&
      !a.categoria.toLowerCase().includes(sq)
    )
      return false;
    return true;
  });
  const fT = adpVis.reduce((s, a) => s + a.totale, 0),
    fC = adpVis.reduce((s, a) => s + a.completati, 0);
  const fD = adpVis.reduce((s, a) => s + a.da_fare, 0),
    fI = adpVis.reduce(
      (s, a) => s + Math.max(0, a.totale - a.completati - a.da_fare),
      0,
    );
  const fP = fT > 0 ? Math.round((fC / fT) * 100) : 0;
  const isF = sc !== "tutti" || sq !== "";
  const se = (id, v) => {
    const e = document.getElementById(id);
    if (e) e.textContent = v;
  };
  const si = (id, v) => {
    const e = document.getElementById(id);
    if (e) e.innerHTML = v;
  };
  si(
    "ds-lbl-tot",
    `Adempimenti ${stats.anno}${isF ? ` <span style="font-size:9px;color:var(--yellow)">(filtro)</span>` : ""}`,
  );
  se("ds-tot", fT);
  se("ds-comp", fC);
  se("ds-dafare", fD);
  se("ds-incorso", fI);
  se("ds-na", stats.na || 0);
  se("ds-perc", fP + "%");
  const dp = document.getElementById("ds-prog");
  if (dp) dp.style.width = fP + "%";
  const title = document.getElementById("dash-adp-count-title");
  if (title)
    title.innerHTML = `Adempimenti ${stats.anno} <span style="font-size:11px;font-weight:400;color:var(--text3);margin-left:6px">${adpVis.length}/${allAdp.length} — clicca riga per Vista Globale</span>`;
  const tabsEl = document.getElementById("dash-cat-tabs");
  if (tabsEl)
    tabsEl.innerHTML = [
      { codice: "tutti", nome: "Tutti", color: "var(--text2)" },
      ...CATEGORIE,
    ]
      .map((c) => {
        const active = state.dashFiltroCategoria === c.codice;
        const col = c.color || "var(--text2)";
        return `<button class="cat-tab${active ? " cat-tab-active" : ""}" style="${active ? `background:${col}22;border-color:${col};color:${col}` : ""}" onclick="setDashCat('${c.codice}')">${c.nome || c.codice}</button>`;
      })
      .join("");
  const tbody = document.getElementById("dash-adp-tbody");
  if (!tbody) return;
  if (!adpVis.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text3)">Nessun adempimento</td></tr>`;
    return;
  }
  tbody.innerHTML = adpVis
    .map((a) => {
      const p = a.totale > 0 ? Math.round((a.completati / a.totale) * 100) : 0;
      const iC = Math.max(0, a.totale - a.completati - a.da_fare);
      const dot = catColor[a.categoria]
        ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${catColor[a.categoria]};margin-right:5px;vertical-align:middle"></span>`
        : "";
      return `<tr class="adp-dash-row" onclick="goVistaGlobaleAdp('${escAttr(a.nome)}')" title="Clicca per Vista Globale">
      <td><span style="font-family:var(--mono);font-size:10px;color:var(--accent);font-weight:700">${a.codice}</span></td>
      <td style="font-weight:700">${a.nome}</td>
      <td>${dot}<span class="badge b-categoria">${a.categoria}</span></td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;text-align:right">${a.totale}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--green);text-align:right">${a.completati}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--red);text-align:right">${a.da_fare}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--yellow);text-align:right">${iC > 0 ? iC : "-"}</td>
      <td><div style="display:flex;align-items:center;gap:6px;min-width:110px"><div class="mini-bar" style="flex:1;height:7px"><div class="mini-fill" style="width:${p}%"></div></div><span style="font-size:10px;font-family:var(--mono);color:var(--text3);min-width:30px;text-align:right">${p}%</span></div></td>
    </tr>`;
    })
    .join("");
}

function renderDashboard(stats) {
  if (!state._dashRendered) buildDashboardShell(stats);
  updateDashboardContent(stats);
}
function setDashCat(c) {
  state.dashFiltroCategoria = c;
  if (state.dashStats) updateDashboardContent(state.dashStats);
}
function onDashAdpSearch(val) {
  state.dashSearch = val;
  if (state.dashStats) updateDashboardContent(state.dashStats);
}
function goVistaGlobaleAdp(nome) {
  state.globalePreFiltroAdp = nome;
  document
    .querySelectorAll(".nav-item")
    .forEach((x) => x.classList.remove("active"));
  document
    .querySelector('[data-page="scadenzario_globale"]')
    .classList.add("active");
  renderPage("scadenzario_globale");
}

// ═══════════════════════════════════════════════════════════════
// CLIENTI con filtri avanzati
// ═══════════════════════════════════════════════════════════════
const applyClientiFiltriDB = debounce(() => {
  const search = document.getElementById("global-search-clienti")?.value || "";
  const tipologia = document.getElementById("filter-tipo")?.value || "";
  const col2 = document.getElementById("filter-col2")?.value || "";
  const col3 = document.getElementById("filter-col3")?.value || "";
  const periodicita =
    document.getElementById("filter-periodicita")?.value || "";
  socket.emit("get:clienti", { search, tipologia, col2, col3, periodicita });
}, 300);

function applyClientiFiltri() {
  applyClientiFiltriDB();
}

function resetClientiFiltri() {
  [
    "global-search-clienti",
    "filter-tipo",
    "filter-col2",
    "filter-col3",
    "filter-periodicita",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  socket.emit("get:clienti", {});
}

function renderClientiPage() {
  renderClientiTabella(state.clienti);
}

function renderClientiTabella(clienti) {
  const tbody = clienti.length
    ? clienti
        .map((c) => {
          const tipColor = getTipologiaColor(c.tipologia_codice);
          const sottotipoLabel = getLabelSottotipologia(c);
          const classificazioneShort = getClassificazioneCompleta(c);

          // Badge colorati per le info principali
          let infoBadges = `<span class="badge b-${(c.tipologia_codice || "").toLowerCase()}">${c.tipologia_codice || "-"}</span>`;
          if (c.col2_value)
            infoBadges += ` <span class="badge-info">${{ privato: "Privato", ditta: "Ditta Ind.", socio: "Socio", professionista: "Prof." }[c.col2_value] || c.col2_value}</span>`;
          if (c.col3_value)
            infoBadges += ` <span class="badge-info">${{ ordinario: "Ord.", semplificato: "Sempl.", forfettario: "Forf.", ordinaria: "Ord.", semplificata: "Sempl." }[c.col3_value] || c.col3_value}</span>`;
          if (c.periodicita)
            infoBadges += ` <span class="badge-per">${c.periodicita === "mensile" ? "📅" : "📆"} ${c.periodicita === "mensile" ? "Mens." : "Trim."}</span>`;

          const categorie = (() => {
            try {
              return JSON.parse(c.categorie_attive || "[]");
            } catch (e) {
              return [];
            }
          })();
          const catBadges = categorie
            .map((cat) => {
              const found = CATEGORIE.find((x) => x.codice === cat);
              return found
                ? `<span class="cat-mini-badge" style="color:${found.color};border-color:${found.color}22;background:${found.color}11">${found.icona}</span>`
                : "";
            })
            .join("");

          return `<tr class="clickable" onclick="showClienteDettaglio(${c.id})">
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="cliente-avatar-sm" style="background:${tipColor}22;border-color:${tipColor};color:${tipColor}">${(c.nome || "?").charAt(0).toUpperCase()}</div>
          <div>
            <div style="font-weight:700;font-size:13px">${escAttr(c.nome)}</div>
            <div style="font-size:10px;color:var(--text3);margin-top:2px;font-family:var(--mono)">${c.codice_fiscale || c.partita_iva || ""}</div>
          </div>
        </div>
      </td>
      <td><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">${infoBadges}</div>${sottotipoLabel ? `<div style="font-size:10px;color:var(--text3);margin-top:3px">${sottotipoLabel}</div>` : ""}</td>
      <td class="td-dim" style="font-size:12px">${c.email || "-"}</td>
      <td><div style="display:flex;flex-wrap:wrap;gap:3px">${catBadges}</div></td>
      <td class="col-actions no-print"><div style="display:flex;gap:5px" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-secondary" onclick="editCliente(${c.id})">✏️</button>
        <button class="btn btn-sm btn-success" onclick="goScadenzario(${c.id})">📅</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCliente(${c.id})">🗑️</button>
      </div></td>
    </tr>`;
        })
        .join("")
    : `<tr><td colspan="5"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato</p></div></td></tr>`;

  document.getElementById("content").innerHTML = `
    <div class="filtri-avanzati no-print" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:var(--surface2);border-radius:var(--r-sm);">
      <span style="font-size:11px;color:var(--text3);font-weight:700;">🔍 Filtri:</span>
      <select id="filter-col2" class="select" style="width:160px" onchange="applyClientiFiltri()">
        <option value="">Sottocategoria</option>
        <option value="privato">Privato</option><option value="ditta">Ditta Individuale</option>
        <option value="socio">Socio</option><option value="professionista">Professionista</option>
      </select>
      <select id="filter-col3" class="select" style="width:140px" onchange="applyClientiFiltri()">
        <option value="">Regime</option>
        <option value="ordinario">Ordinario</option><option value="semplificato">Semplificato</option>
        <option value="forfettario">Forfettario</option><option value="ordinaria">Ordinaria</option><option value="semplificata">Semplificata</option>
      </select>
      <select id="filter-periodicita" class="select" style="width:140px" onchange="applyClientiFiltri()">
        <option value="">Periodicità</option>
        <option value="mensile">📅 Mensile</option><option value="trimestrale">📆 Trimestrale</option>
      </select>
      <button class="btn btn-sm btn-secondary" onclick="resetClientiFiltri()" style="margin-left:auto">⟳ Reset</button>
    </div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Clienti (${clienti.length})</h3></div>
      <table><thead><tr><th>Cliente</th><th>Classificazione</th><th>Email</th><th>Categorie</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>`;
}

function showClienteDettaglio(id) {
  const c = state.clienti.find((x) => x.id === id);
  if (!c) return;
  state._currentClienteDettaglio = c;
  const sottotipoLabel = getLabelSottotipologia(c);
  const tipColor = getTipologiaColor(c.tipologia_codice);

  const categorie = (() => {
    try {
      return JSON.parse(c.categorie_attive || "[]");
    } catch (e) {
      return [];
    }
  })();
  const catHtml = categorie
    .map((cat) => {
      const found = CATEGORIE.find((x) => x.codice === cat);
      return found
        ? `<span class="cat-det-badge" style="color:${found.color};border-color:${found.color}33;background:${found.color}11">${found.icona} ${found.codice}</span>`
        : "";
    })
    .join("");

  const classificazioneHtml = `
    <div class="det-class-grid">
      <div class="det-class-item"><div class="det-class-num">1</div><div><div class="det-class-label">Tipologia</div><div class="det-class-val"><span class="badge b-${(c.tipologia_codice || "").toLowerCase()}">${c.tipologia_codice || "-"}</span> ${c.tipologia_nome || ""}</div></div></div>
      ${c.col2_value ? `<div class="det-class-item"><div class="det-class-num">2</div><div><div class="det-class-label">Sottocategoria</div><div class="det-class-val">${{ privato: "Privato", ditta: "Ditta Individuale", socio: "Socio", professionista: "Professionista" }[c.col2_value] || c.col2_value}</div></div></div>` : ""}
      ${c.col3_value ? `<div class="det-class-item"><div class="det-class-num">3</div><div><div class="det-class-label">Regime</div><div class="det-class-val">${{ ordinario: "Ordinario", semplificato: "Semplificato", forfettario: "Forfettario", ordinaria: "Ordinaria", semplificata: "Semplificata" }[c.col3_value] || c.col3_value}</div></div></div>` : ""}
      ${c.periodicita ? `<div class="det-class-item"><div class="det-class-num">4</div><div><div class="det-class-label">Periodicità</div><div class="det-class-val">${c.periodicita === "mensile" ? "📅 Mensile" : "📆 Trimestrale"}</div></div></div>` : ""}
    </div>
    ${sottotipoLabel ? `<div class="sottotipo-badge-full">🏷️ ${sottotipoLabel}</div>` : ""}
  `;

  document.getElementById("modal-cliente-det-title").textContent = c.nome;
  document.getElementById("cliente-dettaglio-content").innerHTML = `
    <div class="det-header" style="border-left:4px solid ${tipColor}">
      <div class="det-avatar" style="background:${tipColor}22;border-color:${tipColor};color:${tipColor}">${(c.nome || "?").charAt(0).toUpperCase()}</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800">${escAttr(c.nome)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">${getClassificazioneCompleta(c)}</div>
      </div>
    </div>
    <div style="margin:16px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--accent)">📊 Classificazione</div>
    ${classificazioneHtml}
    ${catHtml ? `<div style="margin:12px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3)">📋 Categorie attive</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${catHtml}</div>` : ""}
    ${renderClienteDatiRiferimento(c)}
  `;
  openModal("modal-cliente-dettaglio");
}

function goToClienteScadenzario() {
  if (state._currentClienteDettaglio) {
    closeModal("modal-cliente-dettaglio");
    goScadenzario(state._currentClienteDettaglio.id);
  }
}

// ═══════════════════════════════════════════════════════════════
// MODAL CLIENTE — LOGICA 4 COLONNE
// ═══════════════════════════════════════════════════════════════
function aggiornaColonneCliente() {
  const tipCodice = _getTipologiaCodice();
  const col2Wrap = document.getElementById("wrap-col2");
  const col2Sel = document.getElementById("c-col2");
  const col2Opts = COL2_OPTIONS[tipCodice];
  if (!col2Opts) {
    col2Wrap.style.display = "none";
    col2Sel.value = "";
    _aggiornaCol3(tipCodice, "");
  } else {
    col2Wrap.style.display = "";
    const col2Current = col2Sel.value;
    col2Sel.innerHTML =
      `<option value="">-- Seleziona --</option>` +
      col2Opts
        .map(
          (o) =>
            `<option value="${o.value}" ${col2Current === o.value ? "selected" : ""}>${o.label}</option>`,
        )
        .join("");
    if (!col2Current) col2Sel.value = "";
    _aggiornaCol3(tipCodice, col2Sel.value);
  }
  aggiornaRiepilogoClassificazione();
}

function _aggiornaCol3(tipCodice, col2Val) {
  const col3Opts = getCol3Options(tipCodice, col2Val);
  const col3Wrap = document.getElementById("wrap-col3");
  const col3Sel = document.getElementById("c-col3");
  if (!col3Opts) {
    _nascondiCol3();
    return;
  }
  col3Wrap.style.display = "";
  const col3Current = col3Sel.value;
  col3Sel.innerHTML =
    `<option value="">-- Seleziona --</option>` +
    col3Opts
      .map(
        (o) =>
          `<option value="${o.value}" ${col3Current === o.value ? "selected" : ""}>${o.label}</option>`,
      )
      .join("");
  if (!col3Current) col3Sel.value = "";
  if (col3Sel.value) document.getElementById("wrap-col4").style.display = "";
  else _nascondiCol4();
  aggiornaRiepilogoClassificazione();
}

function _nascondiCol3() {
  const w = document.getElementById("wrap-col3"),
    s = document.getElementById("c-col3");
  if (w) w.style.display = "none";
  if (s) s.value = "";
  _nascondiCol4();
  aggiornaRiepilogoClassificazione();
}
function _nascondiCol4() {
  const w = document.getElementById("wrap-col4"),
    s = document.getElementById("c-col4");
  if (w) w.style.display = "none";
  if (s) s.value = "";
  aggiornaRiepilogoClassificazione();
}
function _getTipologiaCodice() {
  const sel = document.getElementById("c-tipologia");
  if (!sel || !sel.value) return "";
  const tip = state.tipologie.find((t) => String(t.id) === String(sel.value));
  return tip ? tip.codice : "";
}
function _calcolaSottotipologiaId() {
  const tipCodice = _getTipologiaCodice();
  const col2 = document.getElementById("c-col2")?.value || "";
  const col3 = document.getElementById("c-col3")?.value || "";
  const stCode = getSottotipoCode(tipCodice, col2, col3);
  if (!stCode) return null;
  for (const t of state.tipologie) {
    const sub = (t.sottotipologie || []).find((s) => s.codice === stCode);
    if (sub) return sub.id;
  }
  return null;
}
function aggiornaRiepilogoClassificazione() {
  const box = document.getElementById("cliente-riepilogo-box");
  const content = document.getElementById("riepilogo-classificazione");
  if (!box || !content) return;
  const tipCodice = _getTipologiaCodice();
  const tip = state.tipologie.find((t) => t.codice === tipCodice);
  const col2 = document.getElementById("c-col2")?.value || "";
  const col3 = document.getElementById("c-col3")?.value || "";
  const col4 = document.getElementById("c-col4")?.value || "";
  let chips = [];
  if (tip)
    chips.push(
      `<div class="riepilogo-chip"><span class="chip-label">Tipologia:</span><span class="chip-value">${tip.codice} — ${tip.nome}</span></div>`,
    );
  if (col2) {
    const col2Opt = COL2_OPTIONS[tipCodice]?.find((o) => o.value === col2);
    if (col2Opt)
      chips.push(
        `<div class="riepilogo-chip"><span class="chip-label">Sottocategoria:</span><span class="chip-value">${col2Opt.label}</span></div>`,
      );
  }
  if (col3)
    chips.push(
      `<div class="riepilogo-chip"><span class="chip-label">Regime:</span><span class="chip-value">${col3}</span></div>`,
    );
  if (col4)
    chips.push(
      `<div class="riepilogo-chip"><span class="chip-label">Periodicità:</span><span class="chip-value">${col4 === "mensile" ? "📅 Mensile" : "📆 Trimestrale"}</span></div>`,
    );
  if (chips.length > 0) {
    content.innerHTML = chips.join("");
    box.style.display = "";
  } else box.style.display = "none";
}

function populateTipologiaSelect(selectedId) {
  const sel = document.getElementById("c-tipologia");
  if (!sel) return;
  sel.innerHTML = state.tipologie
    .map(
      (t) =>
        `<option value="${t.id}" ${String(t.id) === String(selectedId) ? "selected" : ""}>${t.codice} — ${t.nome}</option>`,
    )
    .join("");
}
function onTipologiaChange() {
  const col2Sel = document.getElementById("c-col2");
  if (col2Sel) col2Sel.value = "";
  const col3Sel = document.getElementById("c-col3");
  if (col3Sel) col3Sel.value = "";
  _nascondiCol4();
  aggiornaColonneCliente();
}
function onCol2Change() {
  const col3Sel = document.getElementById("c-col3");
  if (col3Sel) col3Sel.value = "";
  _nascondiCol4();
  aggiornaColonneCliente();
}
function onCol3Change() {
  const tipCodice = _getTipologiaCodice();
  const col2Val = document.getElementById("c-col2")?.value || "";
  _aggiornaCol3(tipCodice, col2Val);
  if (document.getElementById("c-col3")?.value)
    document.getElementById("wrap-col4").style.display = "";
  aggiornaRiepilogoClassificazione();
}
function renderCategorieSelect(attuali = []) {
  const container = document.getElementById("categorie-attive");
  if (!container) return;
  container.innerHTML = CATEGORIE.map(
    (cat) =>
      `<label style="display:inline-flex;align-items:center;gap:8px;margin:4px 8px 4px 0;padding:8px 12px;background:var(--surface2);border-radius:var(--r-sm);cursor:pointer;border:1px solid ${attuali.includes(cat.codice) ? "var(--accent)" : "var(--border)"};transition:all 0.12s"><input type="checkbox" value="${cat.codice}" ${attuali.includes(cat.codice) ? "checked" : ""} style="accent-color:var(--accent)" onchange="this.parentElement.style.borderColor=this.checked?'var(--accent)':'var(--border)'"><span>${cat.icona} ${cat.nome}</span></label>`,
  ).join("");
}
function getSelectedCategorie() {
  return Array.from(document.querySelectorAll("#categorie-attive input"))
    .filter((cb) => cb.checked)
    .map((cb) => cb.value);
}
function openNuovoCliente() {
  document.getElementById("modal-cliente-title").textContent = "Nuovo Cliente";
  document.getElementById("cliente-id").value = "";
  [
    "c-nome",
    "c-cf",
    "c-piva",
    "c-email",
    "c-tel",
    "c-indirizzo",
    "c-note",
    "c-pec",
    "c-sdi",
    "c-citta",
    "c-cap",
    "c-prov",
    "c-referente",
    "c-iban",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (document.getElementById("c-col2"))
    document.getElementById("c-col2").value = "";
  if (document.getElementById("c-col3"))
    document.getElementById("c-col3").value = "";
  if (document.getElementById("c-col4"))
    document.getElementById("c-col4").value = "";
  renderCategorieSelect([
    "IVA",
    "DICHIARAZIONI",
    "PREVIDENZA",
    "LAVORO",
    "TRIBUTI",
    "BILANCIO",
  ]);
  populateTipologiaSelect(state.tipologie[0]?.id);
  aggiornaColonneCliente();
  openModal("modal-cliente");
}
function editCliente(id) {
  socket.once("res:cliente", ({ success, data }) => {
    if (!success || !data) return;
    document.getElementById("modal-cliente-title").textContent =
      "Modifica Cliente";
    document.getElementById("cliente-id").value = data.id;
    document.getElementById("c-nome").value = data.nome || "";
    document.getElementById("c-cf").value = data.codice_fiscale || "";
    document.getElementById("c-piva").value = data.partita_iva || "";
    document.getElementById("c-email").value = data.email || "";
    document.getElementById("c-tel").value = data.telefono || "";
    document.getElementById("c-indirizzo").value = data.indirizzo || "";
    document.getElementById("c-note").value = data.note || "";
    document.getElementById("c-pec").value = data.pec || "";
    document.getElementById("c-sdi").value = data.sdi || "";
    document.getElementById("c-citta").value = data.citta || "";
    document.getElementById("c-cap").value = data.cap || "";
    document.getElementById("c-prov").value = data.provincia || "";
    document.getElementById("c-referente").value = data.referente || "";
    document.getElementById("c-iban").value = data.iban || "";
    const cat = JSON.parse(
      data.categorie_attive ||
        '["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]',
    );
    renderCategorieSelect(cat);
    populateTipologiaSelect(data.id_tipologia);
    const col2Val = data.col2_value || "",
      col3Val = data.col3_value || "",
      col4Val = data.periodicita || "";
    setTimeout(() => {
      if (document.getElementById("c-col2"))
        document.getElementById("c-col2").value = col2Val;
      if (document.getElementById("c-col3"))
        document.getElementById("c-col3").value = col3Val;
      aggiornaColonneCliente();
      setTimeout(() => {
        if (document.getElementById("c-col4"))
          document.getElementById("c-col4").value = col4Val;
        aggiornaRiepilogoClassificazione();
      }, 50);
    }, 60);
    openModal("modal-cliente");
  });
  socket.emit("get:cliente", { id });
}
function saveCliente() {
  const id = document.getElementById("cliente-id").value;
  const nome = document.getElementById("c-nome").value.trim();
  if (!nome) {
    showNotif("Il nome è obbligatorio", "error");
    return;
  }
  const categorie = getSelectedCategorie();
  if (!categorie.length) {
    showNotif("Seleziona almeno una categoria", "error");
    return;
  }
  const id_sottotipologia = _calcolaSottotipologiaId();
  const col2Val = document.getElementById("c-col2")?.value || "";
  const col3Val = document.getElementById("c-col3")?.value || "";
  const col4Val = document.getElementById("c-col4")?.value || "";
  const data = {
    nome,
    id_tipologia: parseInt(document.getElementById("c-tipologia").value),
    id_sottotipologia: id_sottotipologia || null,
    col2_value: col2Val || null,
    col3_value: col3Val || null,
    periodicita: col4Val || null,
    codice_fiscale:
      document.getElementById("c-cf").value.trim().toUpperCase() || null,
    partita_iva: document.getElementById("c-piva").value.trim() || null,
    email: document.getElementById("c-email").value.trim() || null,
    telefono: document.getElementById("c-tel").value.trim() || null,
    indirizzo: document.getElementById("c-indirizzo").value.trim() || null,
    citta: document.getElementById("c-citta")?.value.trim() || null,
    cap: document.getElementById("c-cap")?.value.trim() || null,
    provincia:
      document.getElementById("c-prov")?.value.trim().toUpperCase() || null,
    pec: document.getElementById("c-pec")?.value.trim() || null,
    sdi: document.getElementById("c-sdi")?.value.trim().toUpperCase() || null,
    iban: document.getElementById("c-iban")?.value.trim().toUpperCase() || null,
    referente: document.getElementById("c-referente")?.value.trim() || null,
    note: document.getElementById("c-note").value.trim() || null,
    categorie_attive: categorie,
  };
  if (id) {
    data.id = parseInt(id);
    socket.emit("update:cliente", data);
  } else socket.emit("create:cliente", data);
}
function deleteCliente(id) {
  if (confirm("Eliminare questo cliente?"))
    socket.emit("delete:cliente", { id });
}
function goScadenzario(id) {
  const c = state.clienti.find((x) => x.id === id);
  if (c) {
    state.selectedCliente = c;
    document
      .querySelectorAll(".nav-item")
      .forEach((x) => x.classList.remove("active"));
    document.querySelector('[data-page="scadenzario"]').classList.add("active");
    renderPage("scadenzario");
  } else {
    state._gotoClienteId = id;
    state._pending = "scadenzario";
    socket.emit("get:clienti");
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER: label e importo
// ═══════════════════════════════════════════════════════════════
function getPeriodoLabel(r) {
  if (r.scadenza_tipo === "trimestrale") {
    const m = { 1: "Gen-Mar", 2: "Apr-Giu", 3: "Lug-Set", 4: "Ott-Dic" };
    return `${r.trimestre}° Trim. (${m[r.trimestre] || ""})`;
  }
  if (r.scadenza_tipo === "semestrale")
    return r.semestre === 1 ? "1° Sem. (Gen-Giu)" : "2° Sem. (Lug-Dic)";
  if (r.scadenza_tipo === "mensile") return MESI[(r.mese || 1) - 1] || "-";
  return "Annuale";
}
function getPeriodoShort(r) {
  if (r.scadenza_tipo === "trimestrale") return `T${r.trimestre}`;
  if (r.scadenza_tipo === "semestrale") return r.semestre === 1 ? "S1" : "S2";
  if (r.scadenza_tipo === "mensile") return MESI_SHORT[(r.mese || 1) - 1];
  return "Ann.";
}
function isContabilita(r) {
  return (
    parseInt(r.is_contabilita) === 1 ||
    r.is_contabilita === true ||
    r.is_contabilita === 1
  );
}
function hasRate(r) {
  return parseInt(r.has_rate) === 1 || r.has_rate === true || r.has_rate === 1;
}

function renderImportoCellCompact(r) {
  if (isContabilita(r)) {
    const iva = r.importo_iva
      ? `€${parseFloat(r.importo_iva).toFixed(2)}`
      : null;
    const cont = r.importo_contabilita
      ? `€${parseFloat(r.importo_contabilita).toFixed(2)}`
      : null;
    if (!iva && !cont) return `<span class="imp-empty">—</span>`;
    return `<div class="importi-cell">${iva ? `<div class="imp-row"><span class="imp-lbl">💰 IVA</span><span class="imp-val">${iva}</span></div>` : ""}${cont ? `<div class="imp-row"><span class="imp-lbl">📊 Cont.</span><span class="imp-val">${cont}</span></div>` : ""}</div>`;
  }
  if (hasRate(r)) {
    let lb = ["Saldo", "1°Acc.", "2°Acc."];
    try {
      if (r.rate_labels) lb = JSON.parse(r.rate_labels);
    } catch (e) {}
    const s = r.importo_saldo
      ? `€${parseFloat(r.importo_saldo).toFixed(2)}`
      : null;
    const a1 = r.importo_acconto1
      ? `€${parseFloat(r.importo_acconto1).toFixed(2)}`
      : null;
    const a2 = r.importo_acconto2
      ? `€${parseFloat(r.importo_acconto2).toFixed(2)}`
      : null;
    if (!s && !a1 && !a2) return `<span class="imp-empty">—</span>`;
    return `<div class="importi-cell">${s ? `<div class="imp-row"><span class="imp-lbl">💰 ${lb[0]}</span><span class="imp-val">${s}</span></div>` : ""}${a1 ? `<div class="imp-row"><span class="imp-lbl">📥 ${lb[1]}</span><span class="imp-val">${a1}</span></div>` : ""}${a2 ? `<div class="imp-row"><span class="imp-lbl">📥 ${lb[2]}</span><span class="imp-val">${a2}</span></div>` : ""}</div>`;
  }
  return r.importo
    ? `<div class="importi-cell"><div class="imp-row"><span class="imp-lbl">💶 Imp.</span><span class="imp-val">€${parseFloat(r.importo).toFixed(2)}</span></div></div>`
    : `<span class="imp-empty">—</span>`;
}

// Render di un singolo periodo come "pill" colorato compatto
function renderPeriodoPill(r) {
  const stato = r.stato || "da_fare";
  const ps = getPeriodoShort(r);
  const statoColors = {
    da_fare: "var(--red)",
    in_corso: "var(--yellow)",
    completato: "var(--green)",
    n_a: "var(--text3)",
  };
  const statoColor = statoColors[stato] || "var(--text3)";
  const impHtml = renderImportoCellCompact(r);
  const hasImp = impHtml !== `<span class="imp-empty">—</span>`;

  return `<div class="periodo-pill s-${stato}" onclick="openAdpById(${r.id})" title="${escAttr(getPeriodoLabel(r))} — ${escAttr(STATI[stato] || stato)}\nClicca per modificare">
    <div class="pp-header">
      <span class="pp-tag" style="border-color:${statoColor};color:${statoColor}">${ps}</span>
      <span class="pp-stato" style="color:${statoColor}">${stato === "da_fare" ? "⭕" : stato === "in_corso" ? "🔄" : stato === "completato" ? "✅" : "➖"}</span>
      ${r.data_scadenza ? `<span class="pp-date">📅${r.data_scadenza}</span>` : ""}
      ${r.data_completamento ? `<span class="pp-date" style="color:var(--green)">✅${r.data_completamento}</span>` : ""}
    </div>
    ${hasImp || r.note ? `<div class="pp-body">${hasImp ? impHtml : ""}${r.note ? `<div class="pp-note">📝 ${r.note}</div>` : ""}</div>` : ""}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// SCADENZARIO SINGOLO
// ═══════════════════════════════════════════════════════════════
function getAdempimentiMancanti() {
  if (!state.selectedCliente) return [];
  const cat = JSON.parse(state.selectedCliente.categorie_attive || "[]");
  const compatibili = state.adempimenti.filter(
    (a) => a.categoria === "TUTTI" || cat.includes(a.categoria),
  );
  return compatibili.filter((a) => !state.adpInseriti.includes(a.id));
}
function renderBtnAddAdp(id_cliente) {
  const mancanti = getAdempimentiMancanti();
  if (!mancanti.length)
    return `<button class="btn btn-sm btn-purple" disabled style="opacity:0.4;cursor:not-allowed">✓ Tutti inseriti</button>`;
  return `<button class="btn btn-sm btn-purple" onclick="openAddAdp(${id_cliente})" title="${mancanti.length} adempimenti da aggiungere">+ Adempimento <span style="font-size:10px;background:rgba(255,255,255,0.2);border-radius:10px;padding:1px 6px;margin-left:2px">${mancanti.length}</span></button>`;
}

function renderScadenzarioPage() {
  const opts = state.clienti
    .map(
      (c) =>
        `<option value="${c.id}" ${state.selectedCliente?.id === c.id ? "selected" : ""}>[${c.tipologia_codice}] ${c.nome}</option>`,
    )
    .join("");
  document.getElementById("topbar-actions").innerHTML = `
    <select class="select" id="sel-cliente" style="width:260px" onchange="onClienteChange()"><option value="">-- Seleziona Cliente --</option>${opts}</select>
    <div class="year-sel"><button onclick="changeAnnoScad(-1)">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnnoScad(1)">&#9654;</button></div>
    <div class="search-wrap" style="width:200px"><span class="search-icon">🔍</span><input class="input" id="scad-search" placeholder="Cerca adempimento..." oninput="applyScadSearch()"></div>`;
  if (state.selectedCliente) loadScadenzario();
  else
    document.getElementById("content").innerHTML =
      `<div class="empty"><div class="empty-icon">📅</div><p>Seleziona un cliente dalla lista in alto</p></div>`;
}
function onClienteChange() {
  const id = parseInt(document.getElementById("sel-cliente").value);
  state.selectedCliente = state.clienti.find((c) => c.id === id) || null;
  state.adpInseriti = [];
  if (state.selectedCliente) loadScadenzario();
}
function changeAnnoScad(d) {
  state.anno += d;
  document
    .querySelectorAll(".year-num")
    .forEach((el) => (el.textContent = state.anno));
  if (state.selectedCliente) loadScadenzario();
}
function loadScadenzario() {
  const sv = document.getElementById("scad-search")?.value || "";
  socket.emit("get:scadenzario", {
    id_cliente: state.selectedCliente.id,
    anno: state.anno,
    filtri: { search: sv, ...state.filtri },
  });
}
const applyScadSearch = debounce(() => {
  if (state.selectedCliente) loadScadenzario();
}, 300);

function renderScadenzarioTabella(data) {
  const c = state.selectedCliente;
  if (!c) return;
  const totale = data.length,
    comp = data.filter((r) => r.stato === "completato").length;
  const daF = data.filter((r) => r.stato === "da_fare").length,
    inC = data.filter((r) => r.stato === "in_corso").length;
  const perc = totale > 0 ? Math.round((comp / totale) * 100) : 0;
  const avatar = (c.nome || "?").charAt(0).toUpperCase();
  const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
  const sottotipoLabel = getLabelSottotipologia(c);

  // Card cliente migliorata con tutti i dati
  const categorie = (() => {
    try {
      return JSON.parse(c.categorie_attive || "[]");
    } catch (e) {
      return [];
    }
  })();
  const catBadges = categorie
    .map((cat) => {
      const found = CATEGORIE.find((x) => x.codice === cat);
      return found
        ? `<span class="cat-mini-badge" style="color:${found.color};border-color:${found.color}22;background:${found.color}11">${found.icona} ${found.codice}</span>`
        : "";
    })
    .join("");

  const clienteCard = `<div class="cliente-preview-card" style="border-left-color:${tipColor}">
    <div style="display:flex;align-items:flex-start;gap:16px;width:100%">
      <div class="cpc-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}22">${avatar}</div>
      <div style="flex:1;min-width:0">
        <div class="cpc-nome">${escAttr(c.nome)}</div>
        <div class="cpc-sub" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">
          <span class="badge b-${(c.tipologia_codice || "").toLowerCase()}">${c.tipologia_codice || "-"}</span>
          ${sottotipoLabel ? `<span class="badge b-categoria">📋 ${sottotipoLabel}</span>` : ""}
          ${c.col2_value ? `<span class="badge-info">${{ privato: "Privato", ditta: "Ditta Ind.", socio: "Socio", professionista: "Prof." }[c.col2_value] || c.col2_value}</span>` : ""}
          ${c.col3_value ? `<span class="badge-info">${{ ordinario: "Ord.", semplificato: "Sempl.", forfettario: "Forf.", ordinaria: "Ord.", semplificata: "Sempl." }[c.col3_value] || c.col3_value}</span>` : ""}
          ${c.periodicita ? `<span class="badge-per">${c.periodicita === "mensile" ? "📅 Mensile" : "📆 Trimestrale"}</span>` : ""}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${catBadges}</div>
        ${
          c.codice_fiscale || c.partita_iva || c.email
            ? `<div class="cpc-meta-row" style="margin-top:8px">
          ${c.codice_fiscale ? `<span class="cpc-meta-chip">CF: <strong>${c.codice_fiscale}</strong></span>` : ""}
          ${c.partita_iva ? `<span class="cpc-meta-chip">P.IVA: <strong>${c.partita_iva}</strong></span>` : ""}
          ${c.email ? `<span class="cpc-meta-chip">📧 ${c.email}</span>` : ""}
          ${c.telefono ? `<span class="cpc-meta-chip">📞 ${c.telefono}</span>` : ""}
        </div>`
            : ""
        }
      </div>
      <div class="cpc-stats">
        <div class="cpc-stat-item"><div class="cpc-stat-num">${totale}</div><div class="cpc-stat-lbl">Totale</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${comp}</div><div class="cpc-stat-lbl">Comp.</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--red)">${daF}</div><div class="cpc-stat-lbl">Da fare</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--yellow)">${inC}</div><div class="cpc-stat-lbl">Corso</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${perc}%</div><div class="cpc-stat-lbl">Progresso</div><div class="mini-bar" style="margin-top:4px;width:50px"><div class="mini-fill" style="width:${perc}%"></div></div></div>
      </div>
    </div>
    <div class="cpc-actions no-print" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-sm btn-orange" onclick="generaScadenzario()">⚡ Genera</button>
      <button class="btn btn-sm btn-cyan" onclick="openCopia()">📋 Copia</button>
      ${renderBtnAddAdp(c.id)}
      <button class="btn btn-print btn-sm" style="margin-left:auto" onclick="window.print()">🖨️ Stampa</button>
    </div>
    ${renderClienteDatiRiferimento(c)}
  </div>`;

  // Raggruppa per categoria, poi per adempimento
  const grouped = {};
  data.forEach((r) => {
    storeRow(r);
    const cat = r.categoria || "ALTRI";
    if (!grouped[cat]) grouped[cat] = {};
    const key = r.id_adempimento;
    if (!grouped[cat][key])
      grouped[cat][key] = {
        nome: r.adempimento_nome,
        codice: r.adempimento_codice,
        categoria: r.categoria,
        scadenza_tipo: r.scadenza_tipo,
        rows: [],
      };
    grouped[cat][key].rows.push(r);
  });

  let content = "";
  Object.entries(grouped).forEach(([catCode, adpMap]) => {
    const catInfo = CATEGORIE.find((x) => x.codice === catCode);
    const catColor = catInfo?.color || "var(--accent)";

    let adpHtml = "";
    Object.values(adpMap).forEach((g) => {
      const compG = g.rows.filter((r) => r.stato === "completato").length;
      const totG = g.rows.length;
      const pG = totG > 0 ? Math.round((compG / totG) * 100) : 0;
      const pgColor =
        pG === 100 ? "var(--green)" : pG > 50 ? "var(--yellow)" : "var(--red)";

      // Periodi come pills orizzontali
      const periodiHtml = g.rows.map((r) => renderPeriodoPill(r)).join("");

      adpHtml += `<div class="adp-card">
        <div class="adp-card-header">
          <span class="adp-codice">${g.codice}</span>
          <span class="adp-nome">${g.nome}</span>
          <span class="adp-tipo-badge">${g.scadenza_tipo}</span>
          <div style="margin-left:auto;display:flex;align-items:center;gap:8px">
            <div class="mini-bar" style="width:60px"><div class="mini-fill" style="width:${pG}%;background:${pgColor}"></div></div>
            <span style="font-size:10px;font-family:var(--mono);color:${pgColor}">${compG}/${totG}</span>
          </div>
        </div>
        <div class="adp-card-periodi">${periodiHtml}</div>
      </div>`;
    });

    content += `<div class="cat-section">
      <div class="cat-section-header" style="border-left:3px solid ${catColor}">
        <span class="cat-section-icon" style="color:${catColor}">${catInfo?.icona || "📋"}</span>
        <span class="cat-section-nome" style="color:${catColor}">${catCode}</span>
        <span class="cat-section-count">${Object.keys(adpMap).length} adempimenti</span>
      </div>
      <div class="cat-section-body">${adpHtml}</div>
    </div>`;
  });

  if (!content)
    content = `<div class="empty"><div class="empty-icon">📅</div><p>Nessun adempimento per ${state.anno}</p><button class="btn btn-primary" onclick="generaScadenzario()">⚡ Genera Scadenzario</button></div>`;

  document.getElementById("content").innerHTML =
    `${clienteCard}<div id="scad-content">${content}</div>`;
}

function generaScadenzario() {
  if (!state.selectedCliente) return;
  socket.emit("genera:scadenzario", {
    id_cliente: state.selectedCliente.id,
    anno: state.anno,
  });
}
function openCopia() {
  if (!state.selectedCliente) return;
  document.getElementById("copia-cliente-id").value = state.selectedCliente.id;
  document.getElementById("copia-modalita").value = "singolo";
  document.getElementById("copia-da").value = state.anno - 1;
  document.getElementById("copia-a").value = state.anno;
  document.getElementById("copia-info").innerHTML =
    `Copia adempimenti per <strong>${state.selectedCliente.nome}</strong>`;
  openModal("modal-copia");
}
function openCopiaTutti() {
  document.getElementById("copia-cliente-id").value = "";
  document.getElementById("copia-modalita").value = "tutti";
  document.getElementById("copia-da").value = state.anno - 1;
  document.getElementById("copia-a").value = state.anno;
  document.getElementById("copia-info").innerHTML =
    `Copia adempimenti per <strong>tutti i clienti</strong>`;
  openModal("modal-copia");
}
function eseguiCopia() {
  const modalita = document.getElementById("copia-modalita").value;
  const da = parseInt(document.getElementById("copia-da").value);
  const a = parseInt(document.getElementById("copia-a").value);
  if (modalita === "singolo") {
    const id = parseInt(document.getElementById("copia-cliente-id").value);
    socket.emit("copia:scadenzario", {
      id_cliente: id,
      anno_da: da,
      anno_a: a,
    });
  } else socket.emit("copia:tutti", { anno_da: da, anno_a: a });
}
function openGeneraTutti() {
  document.getElementById("genera-tutti-anno").value = state.anno;
  openModal("modal-genera-tutti");
}
function eseguiGeneraTutti() {
  const anno = parseInt(document.getElementById("genera-tutti-anno").value);
  socket.emit("genera:tutti", { anno });
}
function openAddAdp(id_cliente) {
  document.getElementById("add-adp-cliente-id").value = id_cliente;
  document.getElementById("add-adp-anno").value = state.anno;
  const c = state.selectedCliente;
  if (c)
    document.getElementById("add-adp-cliente-info").innerHTML =
      renderClienteInfoBox(c);
  refreshAddAdpSelect();
  openModal("modal-add-adp");
}
function refreshAddAdpSelect() {
  const mancanti = getAdempimentiMancanti();
  const sel = document.getElementById("add-adp-select");
  sel.innerHTML = mancanti
    .map(
      (a) =>
        `<option value="${a.id}" data-scadenza="${a.scadenza_tipo}">${a.codice} — ${a.nome}</option>`,
    )
    .join("");
  updatePeriodoOptions();
}
function updatePeriodoOptions() {
  const sel = document.getElementById("add-adp-select");
  const perSel = document.getElementById("add-adp-periodo");
  if (!sel || !perSel) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt) {
    perSel.innerHTML = "";
    return;
  }
  const tipo = opt.dataset.scadenza;
  let opts = "";
  if (tipo === "mensile")
    opts = MESI.map(
      (m, i) => `<option value="mese:${i + 1}">${m}</option>`,
    ).join("");
  else if (tipo === "trimestrale")
    opts = [1, 2, 3, 4]
      .map((t) => `<option value="trim:${t}">${t}° Trimestre</option>`)
      .join("");
  else if (tipo === "semestrale")
    opts = `<option value="sem:1">1° Semestre</option><option value="sem:2">2° Semestre</option>`;
  else opts = `<option value="annuale">Annuale</option>`;
  perSel.innerHTML = opts;
}
function eseguiAddAdp() {
  const id_cliente = parseInt(
    document.getElementById("add-adp-cliente-id").value,
  );
  const id_adempimento = parseInt(
    document.getElementById("add-adp-select").value,
  );
  const anno = parseInt(document.getElementById("add-adp-anno").value);
  const periodo = document.getElementById("add-adp-periodo").value;
  const data = { id_cliente, id_adempimento, anno };
  if (periodo.startsWith("mese:")) data.mese = parseInt(periodo.split(":")[1]);
  else if (periodo.startsWith("trim:"))
    data.trimestre = parseInt(periodo.split(":")[1]);
  else if (periodo.startsWith("sem:"))
    data.semestre = parseInt(periodo.split(":")[1]);
  socket.emit("add:adempimento_cliente", data);
}

// ═══════════════════════════════════════════════════════════════
// SCADENZARIO GLOBALE
// ═══════════════════════════════════════════════════════════════
function renderGlobalePage() {
  document.getElementById("topbar-actions").innerHTML = `
    <div class="year-sel"><button onclick="changeAnnoGlobale(-1)">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnnoGlobale(1)">&#9654;</button></div>
    <select class="select" id="glob-filtro-adp" style="width:190px" onchange="applyGlobaleFiltri()"><option value="">Tutti adempimenti</option></select>
    <select class="select" id="glob-filtro-stato" style="width:135px" onchange="applyGlobaleFiltri()">
      <option value="">Tutti stati</option><option value="da_fare">⭕ Da fare</option><option value="in_corso">🔄 In corso</option><option value="completato">✅ Completato</option><option value="n_a">➖ N/A</option>
    </select>
    <select class="select" id="glob-filtro-tipo" style="width:110px" onchange="applyGlobaleFiltri()">
      <option value="">Tutti tipi</option><option value="PF">PF</option><option value="SP">SP</option><option value="SC">SC</option><option value="ASS">ASS</option>
    </select>
    <select class="select" id="glob-filtro-periodicita" style="width:130px" onchange="applyGlobaleFiltri()">
      <option value="">Periodicità</option><option value="mensile">📅 Mensile</option><option value="trimestrale">📆 Trimestrale</option>
    </select>
    <div class="search-wrap" style="width:190px"><span class="search-icon">🔍</span><input class="input" id="glob-search" placeholder="Cerca cliente..." oninput="applyGlobaleFiltriDebounced()"></div>
    <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>`;
  loadGlobale();
}
function changeAnnoGlobale(d) {
  state.anno += d;
  document
    .querySelectorAll(".year-num")
    .forEach((el) => (el.textContent = state.anno));
  loadGlobale();
}
function loadGlobale() {
  const filtri = {};
  const adpSel = document.getElementById("glob-filtro-adp")?.value;
  const statoSel = document.getElementById("glob-filtro-stato")?.value;
  const search = document.getElementById("glob-search")?.value;
  if (adpSel) filtri.adempimento = adpSel;
  if (statoSel) filtri.stato = statoSel;
  if (search) filtri.search = search;
  if (state.globalePreFiltroAdp) filtri.adempimento = state.globalePreFiltroAdp;
  socket.emit("get:scadenzario_globale", { anno: state.anno, filtri });
}
const applyGlobaleFiltriDebounced = debounce(() => {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}, 300);
function applyGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}

function calcolaGlobaleStats(data) {
  const totale = data.length;
  const comp = data.filter((r) => r.stato === "completato").length;
  const daF = data.filter((r) => r.stato === "da_fare").length;
  const inC = data.filter((r) => r.stato === "in_corso").length;
  const clientiSet = new Set(data.map((r) => r.cliente_id));
  const adpSet = new Set(data.map((r) => r.adempimento_nome));
  return {
    totale,
    comp,
    daF,
    inC,
    clienti: clientiSet.size,
    adempimenti: adpSet,
  };
}

function renderGlobaleHeader() {
  const st = state.globaleStats;
  if (!st) return;
  const adpSel = document.getElementById("glob-filtro-adp");
  if (adpSel) {
    const current = state.globalePreFiltroAdp || adpSel.value;
    adpSel.innerHTML =
      `<option value="">Tutti adempimenti</option>` +
      Array.from(st.adempimenti)
        .sort()
        .map(
          (a) =>
            `<option value="${escAttr(a)}" ${current === a ? "selected" : ""}>${a}</option>`,
        )
        .join("");
    if (state.globalePreFiltroAdp) state.globalePreFiltroAdp = "";
  }
}

function renderGlobaleTabella(rawData) {
  const st = state.globaleStats;
  // Applica filtri lato client per tipo e periodicita
  const filtroTipo = document.getElementById("glob-filtro-tipo")?.value || "";
  const filtroPer =
    document.getElementById("glob-filtro-periodicita")?.value || "";
  const data = rawData.filter((r) => {
    if (filtroTipo && r.cliente_tipologia_codice !== filtroTipo) return false;
    if (filtroPer && r.cliente_periodicita !== filtroPer) return false;
    return true;
  });

  const perc = st.totale > 0 ? Math.round((st.comp / st.totale) * 100) : 0;
  const headerCard = `<div class="globale-preview-card">
    <div class="gpc-left">
      <div class="gpc-globe">🌐</div>
      <div>
        <div class="gpc-title">Vista Globale ${state.anno}</div>
        <div class="gpc-sub">${st.clienti} clienti · ${st.adempimenti.size} tipi adempimenti</div>
      </div>
    </div>
    <div class="gpc-stats">
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--accent)">${st.totale}</div><div class="cpc-stat-lbl">Totale</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${st.comp}</div><div class="cpc-stat-lbl">Comp.</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--red)">${st.daF}</div><div class="cpc-stat-lbl">Da fare</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--yellow)">${st.inC}</div><div class="cpc-stat-lbl">In corso</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${perc}%</div><div class="cpc-stat-lbl">Progresso</div><div class="mini-bar" style="margin-top:4px;width:60px"><div class="mini-fill" style="width:${perc}%"></div></div></div>
    </div>
  </div>`;

  const grouped = {};
  data.forEach((r) => {
    storeRow(r);
    const key = r.adempimento_nome;
    if (!grouped[key])
      grouped[key] = {
        nome: r.adempimento_nome,
        codice: r.adempimento_codice,
        categoria: r.categoria,
        rows: [],
      };
    grouped[key].rows.push(r);
  });

  let content = "";
  Object.values(grouped).forEach((g) => {
    const compG = g.rows.filter((r) => r.stato === "completato").length;
    const totG = g.rows.length;
    const pG = totG > 0 ? Math.round((compG / totG) * 100) : 0;
    const catInfo = CATEGORIE.find((x) => x.codice === g.categoria);
    const catColor = catInfo?.color || "var(--accent)";
    content += `<div class="table-wrap" style="margin-bottom:14px">
      <div class="table-header">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          <span style="font-size:16px">${catInfo?.icona || "📋"}</span>
          <div>
            <span style="font-family:var(--mono);font-size:11px;color:${catColor};font-weight:700">${g.codice}</span>
            <strong style="margin-left:8px">${g.nome}</strong>
            <span class="badge b-categoria" style="margin-left:8px;color:${catColor};background:${catColor}15">${g.categoria}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="mini-bar" style="width:80px"><div class="mini-fill" style="width:${pG}%"></div></div>
          <span style="font-size:11px;font-family:var(--mono);color:var(--text2)">${compG}/${totG} (${pG}%)</span>
        </div>
      </div>
      <div style="padding:10px;display:flex;flex-direction:column;gap:4px">${g.rows.map((r) => renderGlobaleClienteRow(r)).join("")}</div>
    </div>`;
  });

  if (!content)
    content = `<div class="empty"><div class="empty-icon">🌐</div><p>Nessun adempimento trovato per ${state.anno}</p></div>`;
  document.getElementById("content").innerHTML = headerCard + content;
}

function renderGlobaleClienteRow(r) {
  const avatar = (r.cliente_nome || "?").charAt(0).toUpperCase();
  const tipColor =
    r.cliente_tipologia_colore || getTipologiaColor(r.cliente_tipologia_codice);
  const sottotipoLabel = r.cliente_sottotipologia_nome || "";
  // Mostra classificazione completa del cliente
  let classInfo = "";
  if (r.cliente_col2 || r.cliente_col3 || r.cliente_periodicita) {
    const parts = [];
    if (r.cliente_col2)
      parts.push(
        {
          privato: "Privato",
          ditta: "Ditta Ind.",
          socio: "Socio",
          professionista: "Prof.",
        }[r.cliente_col2] || r.cliente_col2,
      );
    if (r.cliente_col3)
      parts.push(
        {
          ordinario: "Ord.",
          semplificato: "Sempl.",
          forfettario: "Forf.",
          ordinaria: "Ord.",
          semplificata: "Sempl.",
        }[r.cliente_col3] || r.cliente_col3,
      );
    if (r.cliente_periodicita)
      parts.push(r.cliente_periodicita === "mensile" ? "Mens." : "Trim.");
    classInfo = `<div style="font-size:9px;color:var(--text3);margin-top:2px;font-family:var(--mono)">${parts.join(" · ")}</div>`;
  }

  return `<div class="globale-cliente-row s-${r.stato}" onclick="openAdpById(${r.id})" title="Clicca per modificare">
    <div class="gcr-cliente">
      <div class="gcr-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}15">${avatar}</div>
      <div>
        <div class="gcr-nome">${escAttr(r.cliente_nome)}</div>
        <div class="gcr-cf">${r.cliente_cf || r.cliente_piva || "-"}</div>
        ${classInfo}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:3px">
      <span class="badge b-${(r.cliente_tipologia_codice || "").toLowerCase()}">${r.cliente_tipologia_codice || "-"}</span>
      ${r.cliente_periodicita ? `<span class="badge-per" style="font-size:9px">${r.cliente_periodicita === "mensile" ? "📅" : "📆"} ${r.cliente_periodicita === "mensile" ? "Mens." : "Trim."}</span>` : ""}
    </div>
    <div><span class="periodo-tag-sm">${getPeriodoShort(r)}</span><span class="badge b-${r.stato}" style="margin-left:4px">${STATI[r.stato] || r.stato}</span></div>
    <div style="font-size:11px">
      ${r.data_scadenza ? `<div class="pga-date-chip">📅 ${r.data_scadenza}</div>` : ""}
      ${r.data_completamento ? `<div class="pga-date-chip" style="color:var(--green)">✅ ${r.data_completamento}</div>` : ""}
    </div>
    <div style="text-align:right">${renderImportoCellCompact(r)}</div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// MODAL ADEMPIMENTO
// ═══════════════════════════════════════════════════════════════
function openAdpModal(r) {
  document.getElementById("adp-id").value = r.id;
  document.getElementById("adp-nome-label").textContent =
    `${r.adempimento_nome} — ${getPeriodoLabel(r)}`;
  document.getElementById("adp-stato").value = r.stato || "da_fare";
  document.getElementById("adp-scadenza").value = r.data_scadenza || "";
  document.getElementById("adp-data").value = r.data_completamento || "";
  document.getElementById("adp-note").value = r.note || "";
  document.getElementById("adp-is-contabilita").value = r.is_contabilita || 0;
  document.getElementById("adp-has-rate").value = r.has_rate || 0;
  document.getElementById("adp-rate-labels-json").value = r.rate_labels || "";
  const clienteInfo = document.getElementById("adp-cliente-info");
  if (clienteInfo) {
    const clienteData = {
      nome: r.cliente_nome,
      tipologia_codice: r.cliente_tipologia_codice,
      sottotipologia_nome: r.cliente_sottotipologia_nome,
      codice_fiscale: r.cliente_cf,
      partita_iva: r.cliente_piva,
      periodicita: r.cliente_periodicita,
      col2_value: r.cliente_col2,
      col3_value: r.cliente_col3,
    };
    clienteInfo.innerHTML = renderClienteInfoBox(clienteData);
  }
  const isCont = isContabilita(r),
    isRate = hasRate(r);
  document.getElementById("sect-importo-normale").style.display =
    !isCont && !isRate ? "" : "none";
  document.getElementById("sect-importo-cont").style.display = isCont
    ? ""
    : "none";
  document.getElementById("sect-importo-rate").style.display =
    !isCont && isRate ? "" : "none";
  document.getElementById("adp-importo").value = r.importo || "";
  document.getElementById("adp-imp-iva").value = r.importo_iva || "";
  document.getElementById("adp-imp-cont").value = r.importo_contabilita || "";
  document.getElementById("adp-imp-saldo").value = r.importo_saldo || "";
  document.getElementById("adp-imp-acc1").value = r.importo_acconto1 || "";
  document.getElementById("adp-imp-acc2").value = r.importo_acconto2 || "";
  if (isRate) {
    let lb = ["Saldo", "1° Acconto", "2° Acconto"];
    try {
      if (r.rate_labels) lb = JSON.parse(r.rate_labels);
    } catch (e) {}
    document.getElementById("rate-l0").textContent = `💰 ${lb[0]} (€)`;
    document.getElementById("rate-l1").textContent = `📥 ${lb[1]} (€)`;
    document.getElementById("rate-l2").textContent = `📥 ${lb[2]} (€)`;
  }
  openModal("modal-adempimento");
}
function saveAdpStato() {
  const id = parseInt(document.getElementById("adp-id").value);
  const isCont = document.getElementById("adp-is-contabilita").value === "1";
  const isRate = document.getElementById("adp-has-rate").value === "1";
  const data = {
    id,
    stato: document.getElementById("adp-stato").value,
    data_scadenza: document.getElementById("adp-scadenza").value || null,
    data_completamento: document.getElementById("adp-data").value || null,
    note: document.getElementById("adp-note").value || null,
  };
  if (isCont) {
    data.importo_iva =
      parseFloat(document.getElementById("adp-imp-iva").value) || null;
    data.importo_contabilita =
      parseFloat(document.getElementById("adp-imp-cont").value) || null;
  } else if (isRate) {
    data.importo_saldo =
      parseFloat(document.getElementById("adp-imp-saldo").value) || null;
    data.importo_acconto1 =
      parseFloat(document.getElementById("adp-imp-acc1").value) || null;
    data.importo_acconto2 =
      parseFloat(document.getElementById("adp-imp-acc2").value) || null;
  } else {
    data.importo =
      parseFloat(document.getElementById("adp-importo").value) || null;
  }
  socket.emit("update:adempimento_stato", data);
}
function deleteAdpCliente() {
  if (!confirm("Rimuovere questo adempimento dallo scadenzario?")) return;
  const id = parseInt(document.getElementById("adp-id").value);
  socket.emit("delete:adempimento_cliente", { id });
}

// ═══════════════════════════════════════════════════════════════
// ADEMPIMENTI — Sezione migliorata
// ═══════════════════════════════════════════════════════════════
const applyAdempimentiFiltriSearch = debounce(() => {
  const q =
    document
      .getElementById("global-search-adempimenti")
      ?.value?.toLowerCase() || "";
  const cat = document.getElementById("filter-adp-cat")?.value || "";
  const filtered = state.adempimenti.filter((a) => {
    if (cat && a.categoria !== cat) return false;
    if (
      q &&
      !a.codice.toLowerCase().includes(q) &&
      !a.nome.toLowerCase().includes(q) &&
      !(a.categoria || "").toLowerCase().includes(q)
    )
      return false;
    return true;
  });
  renderAdempimentiTabella(filtered);
}, 300);

function renderAdempimentiPage() {
  renderAdempimentiTabella(state.adempimenti);
}

function renderAdempimentiTabella(adempimenti) {
  // Raggruppa per categoria
  const grouped = {};
  adempimenti.forEach((a) => {
    const cat = a.categoria || "ALTRI";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });

  let html = `<div class="adp-def-grid">`;

  Object.entries(grouped).forEach(([catCode, items]) => {
    const catInfo = CATEGORIE.find((x) => x.codice === catCode);
    const catColor = catInfo?.color || "#7c85a2";

    const cards = items
      .map((a) => {
        const flagsBadges = [];
        if (a.is_contabilita)
          flagsBadges.push(
            `<span class="adp-flag-badge" style="color:#22d3ee;background:#22d3ee15;border-color:#22d3ee33">📊 Cont.</span>`,
          );
        if (a.has_rate)
          flagsBadges.push(
            `<span class="adp-flag-badge" style="color:#34d399;background:#34d39915;border-color:#34d39933">💰 Rate</span>`,
          );

        const scadIcons = {
          annuale: "1×/anno",
          semestrale: "2×/anno",
          trimestrale: "4×/anno",
          mensile: "12×/anno",
        };

        return `<div class="adp-def-card">
        <div class="adp-def-card-top">
          <div class="adp-def-codice">${a.codice}</div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-xs btn-secondary" onclick="editAdpDef(${a.id})" title="Modifica">✏️</button>
            <button class="btn btn-xs btn-danger" onclick="deleteAdpDef(${a.id})" title="Elimina">🗑️</button>
          </div>
        </div>
        <div class="adp-def-nome">${a.nome}</div>
        ${a.descrizione ? `<div class="adp-def-desc">${a.descrizione}</div>` : ""}
        <div class="adp-def-meta">
          <span class="adp-scad-badge"><span style="font-size:12px">${{ annuale: "📅", semestrale: "📆", trimestrale: "📊", mensile: "🗓️" }[a.scadenza_tipo] || "📅"}</span> ${a.scadenza_tipo} <span style="color:var(--text3);font-size:9px">(${scadIcons[a.scadenza_tipo] || ""})</span></span>
          ${flagsBadges.join("")}
        </div>
      </div>`;
      })
      .join("");

    html += `<div class="adp-cat-group">
      <div class="adp-cat-header" style="border-left:3px solid ${catColor}">
        <span style="font-size:18px">${catInfo?.icona || "📋"}</span>
        <span style="color:${catColor};font-weight:800;font-size:14px">${catCode}</span>
        ${catCode !== "TUTTI" ? `<span style="color:var(--text3);font-size:11px">${items.length} adempimient${items.length === 1 ? "o" : "i"}</span>` : ""}
      </div>
      <div class="adp-cat-cards">${cards}</div>
    </div>`;
  });

  html += `</div>`;

  if (!adempimenti.length)
    html = `<div class="empty"><div class="empty-icon">📋</div><p>Nessun adempimento trovato</p></div>`;

  document.getElementById("content").innerHTML = html;
}

function openNuovoAdpDef() {
  document.getElementById("modal-adp-def-title").textContent =
    "Nuovo Adempimento";
  document.getElementById("adp-def-id").value = "";
  document.getElementById("adp-def-codice").value = "";
  document.getElementById("adp-def-nome").value = "";
  document.getElementById("adp-def-desc").value = "";
  document.getElementById("adp-def-categoria").value = "TUTTI";
  document.getElementById("adp-def-scadenza").value = "annuale";
  document.getElementById("adp-def-contabilita").checked = false;
  document.getElementById("adp-def-rate").checked = false;
  document.getElementById("sect-rate-labels").style.display = "none";
  document.getElementById("adp-rate-l1").value = "Saldo";
  document.getElementById("adp-rate-l2").value = "1° Acconto";
  document.getElementById("adp-rate-l3").value = "2° Acconto";
  openModal("modal-adp-def");
}
function editAdpDef(id) {
  const a = state.adempimenti.find((x) => x.id === id);
  if (!a) return;
  document.getElementById("modal-adp-def-title").textContent =
    "Modifica Adempimento";
  document.getElementById("adp-def-id").value = a.id;
  document.getElementById("adp-def-codice").value = a.codice;
  document.getElementById("adp-def-nome").value = a.nome;
  document.getElementById("adp-def-desc").value = a.descrizione || "";
  document.getElementById("adp-def-categoria").value = a.categoria || "TUTTI";
  document.getElementById("adp-def-scadenza").value =
    a.scadenza_tipo || "annuale";
  document.getElementById("adp-def-contabilita").checked = !!a.is_contabilita;
  document.getElementById("adp-def-rate").checked = !!a.has_rate;
  let lb = ["Saldo", "1° Acconto", "2° Acconto"];
  try {
    if (a.rate_labels) lb = JSON.parse(a.rate_labels);
  } catch (e) {}
  document.getElementById("adp-rate-l1").value = lb[0] || "Saldo";
  document.getElementById("adp-rate-l2").value = lb[1] || "1° Acconto";
  document.getElementById("adp-rate-l3").value = lb[2] || "2° Acconto";
  onAdpFlagsChange();
  openModal("modal-adp-def");
}
function onAdpFlagsChange() {
  const isCont = document.getElementById("adp-def-contabilita").checked;
  const hasRate = document.getElementById("adp-def-rate").checked;
  if (isCont) document.getElementById("adp-def-rate").checked = false;
  if (hasRate) document.getElementById("adp-def-contabilita").checked = false;
  document.getElementById("sect-rate-labels").style.display = hasRate
    ? ""
    : "none";
}
function saveAdpDef() {
  const id = document.getElementById("adp-def-id").value;
  const codice = document
    .getElementById("adp-def-codice")
    .value.trim()
    .toUpperCase();
  const nome = document.getElementById("adp-def-nome").value.trim();
  if (!codice || !nome) {
    showNotif("Codice e nome sono obbligatori", "error");
    return;
  }
  const data = {
    codice,
    nome,
    descrizione: document.getElementById("adp-def-desc").value.trim() || null,
    categoria: document.getElementById("adp-def-categoria").value,
    scadenza_tipo: document.getElementById("adp-def-scadenza").value,
    is_contabilita: document.getElementById("adp-def-contabilita").checked
      ? 1
      : 0,
    has_rate: document.getElementById("adp-def-rate").checked ? 1 : 0,
  };
  if (data.has_rate)
    data.rate_labels = [
      document.getElementById("adp-rate-l1").value,
      document.getElementById("adp-rate-l2").value,
      document.getElementById("adp-rate-l3").value,
    ];
  if (id) {
    data.id = parseInt(id);
    socket.emit("update:adempimento", data);
  } else socket.emit("create:adempimento", data);
}
function deleteAdpDef(id) {
  if (confirm("Eliminare questo adempimento?"))
    socket.emit("delete:adempimento", { id });
}

// ═══════════════════════════════════════════════════════════════
// TIPOLOGIE
// ═══════════════════════════════════════════════════════════════
function renderTipologiePage() {
  const content = state.tipologie
    .map((t) => {
      const subs = (t.sottotipologie || [])
        .map((s) => {
          if (s.is_separator)
            return `<div class="sottotipologia-chip is-separator">${s.nome}</div>`;
          return `<div class="sottotipologia-chip"><span class="sottotipologia-codice">${s.codice}</span>${s.nome}</div>`;
        })
        .join("");
      return `<div class="tipologia-card"><div class="tipologia-header" style="border-left:4px solid ${t.colore || "var(--accent)"}"><div class="tipologia-badge" style="background:${t.colore || "var(--accent)"}22;color:${t.colore || "var(--accent)"}">${t.codice}</div><div class="tipologia-info"><div class="tipologia-nome">${t.nome}</div><div class="tipologia-desc">${t.descrizione || ""}</div></div><div class="tipologia-count">${(t.sottotipologie || []).filter((s) => !s.is_separator).length} sottotipi</div></div><div class="sottotipologie-grid">${subs || '<div style="color:var(--text3);padding:10px">Nessuna sottotipologia</div>'}</div></div>`;
    })
    .join("");
  document.getElementById("content").innerHTML =
    `<div class="infobox" style="margin-bottom:20px">🗂️ Le tipologie definiscono la classificazione principale dei clienti (PF, SP, SC, ASS). Le sottotipologie permettono una classificazione più dettagliata basata su regime contabile e caratteristiche specifiche.</div><div class="tipologie-grid">${content}</div>`;
}

// ═══════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════
function openModal(id) {
  document.getElementById(id)?.classList.add("open");
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}
function showNotif(msg, type = "info") {
  const container = document.getElementById("notif-container");
  const div = document.createElement("div");
  div.className = `notif ${type}`;
  div.innerHTML = `${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"} ${msg}`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape")
    document
      .querySelectorAll(".modal-overlay.open")
      .forEach((m) => m.classList.remove("open"));
});


// ═══════════════════════════════════════════════════════════════
// SOSTITUISCI renderGlobaleTabella e renderGlobaleClienteRow
// nel tuo script.js con queste versioni
// ═══════════════════════════════════════════════════════════════

function renderGlobaleTabella(rawData) {
  const st = state.globaleStats;
  const filtroTipo = document.getElementById("glob-filtro-tipo")?.value || "";
  const filtroPer = document.getElementById("glob-filtro-periodicita")?.value || "";
  const data = rawData.filter((r) => {
    if (filtroTipo && r.cliente_tipologia_codice !== filtroTipo) return false;
    if (filtroPer && r.cliente_periodicita !== filtroPer) return false;
    return true;
  });

  const perc = st.totale > 0 ? Math.round((st.comp / st.totale) * 100) : 0;
  const headerCard = `<div class="globale-preview-card">
    <div class="gpc-left">
      <div class="gpc-globe">🌐</div>
      <div>
        <div class="gpc-title">Vista Globale ${state.anno}</div>
        <div class="gpc-sub">${st.clienti} clienti · ${st.adempimenti.size} tipi adempimenti</div>
      </div>
    </div>
    <div class="gpc-stats">
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--accent)">${st.totale}</div><div class="cpc-stat-lbl">Totale</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${st.comp}</div><div class="cpc-stat-lbl">Comp.</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--red)">${st.daF}</div><div class="cpc-stat-lbl">Da fare</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--yellow)">${st.inC}</div><div class="cpc-stat-lbl">In corso</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${perc}%</div><div class="cpc-stat-lbl">Progresso</div><div class="mini-bar" style="margin-top:4px;width:60px"><div class="mini-fill" style="width:${perc}%"></div></div></div>
    </div>
  </div>`;

  // Raggruppa per adempimento → poi per cliente, con tutti i periodi
  const grouped = {};
  data.forEach((r) => {
    storeRow(r);
    const adpKey = r.adempimento_nome;
    if (!grouped[adpKey]) grouped[adpKey] = {
      nome: r.adempimento_nome,
      codice: r.adempimento_codice,
      categoria: r.categoria,
      clienti: {}
    };
    const cliKey = r.cliente_id;
    if (!grouped[adpKey].clienti[cliKey]) {
      grouped[adpKey].clienti[cliKey] = {
        id: r.cliente_id,
        nome: r.cliente_nome,
        cf: r.cliente_cf,
        piva: r.cliente_piva,
        tipologia_codice: r.cliente_tipologia_codice,
        tipologia_colore: r.cliente_tipologia_colore,
        sottotipologia_nome: r.cliente_sottotipologia_nome,
        periodicita: r.cliente_periodicita,
        col2: r.cliente_col2,
        col3: r.cliente_col3,
        periodi: []
      };
    }
    grouped[adpKey].clienti[cliKey].periodi.push(r);
  });

  let content = "";
  Object.values(grouped).forEach((g) => {
    const allRows = Object.values(g.clienti).flatMap(c => c.periodi);
    const compG = allRows.filter(r => r.stato === "completato").length;
    const totG = allRows.length;
    const pG = totG > 0 ? Math.round((compG / totG) * 100) : 0;
    const catInfo = CATEGORIE.find(x => x.codice === g.categoria);
    const catColor = catInfo?.color || "var(--accent)";

    const clientiHtml = Object.values(g.clienti).map(c => {
      const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
      const avatar = (c.nome || "?").charAt(0).toUpperCase();
      const compC = c.periodi.filter(r => r.stato === "completato").length;
      const totC = c.periodi.length;
      const pC = totC > 0 ? Math.round((compC / totC) * 100) : 0;
      const pgColor = pC === 100 ? "var(--green)" : pC > 50 ? "var(--yellow)" : "var(--red)";

      let classInfo = "";
      const parts = [];
      if (c.col2) parts.push({ privato:"Privato", ditta:"Ditta Ind.", socio:"Socio", professionista:"Prof." }[c.col2] || c.col2);
      if (c.col3) parts.push({ ordinario:"Ord.", semplificato:"Sempl.", forfettario:"Forf.", ordinaria:"Ord.", semplificata:"Sempl." }[c.col3] || c.col3);
      if (c.periodicita) parts.push(c.periodicita === "mensile" ? "Mens." : "Trim.");
      if (parts.length) classInfo = `<div style="font-size:9px;color:var(--text3);margin-top:2px;font-family:var(--mono)">${parts.join(" · ")}</div>`;

      const periodiHtml = c.periodi.map(r => renderPeriodoPill(r)).join("");

      return `<div class="glob-cliente-card">
        <div class="glob-cliente-header">
          <div class="gcr-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}15">${avatar}</div>
          <div style="flex:1;min-width:0">
            <div class="gcr-nome">${escAttr(c.nome)}</div>
            <div class="gcr-cf">${c.cf || c.piva || "-"}</div>
            ${classInfo}
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">
            <span class="badge b-${(c.tipologia_codice||"").toLowerCase()}">${c.tipologia_codice||"-"}</span>
            ${c.periodicita ? `<span class="badge-per" style="font-size:9px">${c.periodicita==="mensile"?"📅":"📆"} ${c.periodicita==="mensile"?"Mens.":"Trim."}</span>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-left:12px">
            <div class="mini-bar" style="width:50px"><div class="mini-fill" style="width:${pC}%;background:${pgColor}"></div></div>
            <span style="font-size:10px;font-family:var(--mono);color:${pgColor}">${compC}/${totC}</span>
          </div>
        </div>
        <div class="glob-cliente-periodi">${periodiHtml}</div>
      </div>`;
    }).join("");

    content += `<div class="table-wrap" style="margin-bottom:14px">
      <div class="table-header">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          <span style="font-size:16px">${catInfo?.icona || "📋"}</span>
          <div>
            <span style="font-family:var(--mono);font-size:11px;color:${catColor};font-weight:700">${g.codice}</span>
            <strong style="margin-left:8px">${g.nome}</strong>
            <span class="badge b-categoria" style="margin-left:8px;color:${catColor};background:${catColor}15">${g.categoria}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="mini-bar" style="width:80px"><div class="mini-fill" style="width:${pG}%"></div></div>
          <span style="font-size:11px;font-family:var(--mono);color:var(--text2)">${compG}/${totG} (${pG}%)</span>
        </div>
      </div>
      <div style="padding:10px;display:flex;flex-direction:column;gap:6px">${clientiHtml}</div>
    </div>`;
  });

  if (!content)
    content = `<div class="empty"><div class="empty-icon">🌐</div><p>Nessun adempimento trovato per ${state.anno}</p></div>`;

  document.getElementById("content").innerHTML = headerCard + content;
}