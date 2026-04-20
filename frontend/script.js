const socket = io();

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_SHORT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const STATI = {
  da_fare: "⭕ Da fare",
  in_corso: "🔄 In corso",
  completato: "✅ Completato",
  n_a: "➖ N/A",
};
const CATEGORIE = [
  { codice: "IVA", nome: "💰 IVA", icona: "💰", color: "#fbbf24" },
  { codice: "DICHIARAZIONI", nome: "📄 Dichiarazioni", icona: "📄", color: "#5b8df6" },
  { codice: "PREVIDENZA", nome: "🏦 Previdenza", icona: "🏦", color: "#34d399" },
  { codice: "LAVORO", nome: "👔 Lavoro", icona: "👔", color: "#a78bfa" },
  { codice: "TRIBUTI", nome: "🏛️ Tributi", icona: "🏛️", color: "#f87171" },
  { codice: "BILANCIO", nome: "📊 Bilancio", icona: "📊", color: "#22d3ee" },
];

// ─── LOGICA 4 COLONNE ─────────────────────────────────────────
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
  if (tipCodice === "SP" || tipCodice === "ASS") {
    return [
      { value: "ordinaria", label: "Ordinaria" },
      { value: "semplificata", label: "Semplificata" },
    ];
  }
  if (tipCodice === "SC") {
    return [{ value: "ordinaria", label: "Ordinaria" }];
  }
  if (tipCodice === "PF") {
    if (!col2Value || col2Value === "privato" || col2Value === "socio") return null;
    return [
      { value: "ordinario", label: "Ordinario" },
      { value: "semplificato", label: "Semplificato" },
      { value: "forfettario", label: "Forfettario" },
    ];
  }
  return null;
}

function col4Visible(col3Value) {
  return !!col3Value;
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

// ─── ROW STORE ────────────────────────────────────────────────
let _rowStore = {};
function storeRow(r) {
  _rowStore[r.id] = r;
  return r.id;
}

function openAdpById(id) {
  const r = _rowStore[id];
  if (!r) { console.warn("Row not found:", id); return; }
  openAdpModal(r);
}

// ─── STATE ────────────────────────────────────────────────────
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
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function escAttr(s) {
  return (s || "").toString().replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    if (!id_cliente || state.selectedCliente.id === id_cliente) {
      if (!anno || state.anno === anno) loadScadenzario();
    }
  }
});

socket.on("broadcast:globale_updated", ({ anno }) => {
  if (state.page === "scadenzario_globale") {
    if (!anno || state.anno === anno) loadGlobale();
  }
});

socket.on("broadcast:stats_updated", ({ anno }) => {
  if (state.page === "dashboard") {
    if (!anno || state.anno === anno) socket.emit("get:stats", { anno: state.anno });
  }
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
    const modalOpen = document.getElementById("modal-add-adp")?.classList.contains("open");
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
    if (state.page === "dashboard") socket.emit("get:stats", { anno: state.anno });
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

// ─── NAV ──────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach((x) => x.classList.remove("active"));
    el.classList.add("active");
    renderPage(el.dataset.page);
  });
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
      <div class="search-wrap" style="width:280px"><span class="search-icon">🔍</span><input class="input" id="global-search-clienti" placeholder="Cerca nome, CF, P.IVA, email..." oninput="applyClientiFiltri()"></div>
      <select class="select" id="filter-tipo" style="width:150px" onchange="applyClientiFiltri()">
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
      <div class="search-wrap" style="width:280px"><span class="search-icon">🔍</span><input class="input" id="global-search-adempimenti" placeholder="Cerca codice, nome, categoria..." oninput="applyAdempimentiFiltri()"></div>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
      <button class="btn btn-primary no-print" onclick="openNuovoAdpDef()">+ Nuovo</button>`;
    socket.emit("get:adempimenti");
  } else if (page === "tipologie") {
    document.getElementById("topbar-actions").innerHTML = "";
    renderTipologiePage();
  }
}

function refreshPage() { renderPage(state.page); }

function changeAnno(d) {
  state.anno += d;
  document.querySelectorAll(".year-num").forEach((el) => (el.textContent = state.anno));
  if (state.page === "dashboard") {
    state._dashRendered = false;
    socket.emit("get:stats", { anno: state.anno });
  }
}

// ═══════════════════════════════════════════════════════════════
// HELPER: Render Info Cliente (usato ovunque)
// ═══════════════════════════════════════════════════════════════
function renderClienteInfoBox(cliente) {
  if (!cliente) return "";
  const avatar = (cliente.nome || "?").charAt(0).toUpperCase();
  const tipBadge = cliente.tipologia_codice 
    ? `<span class="badge b-${(cliente.tipologia_codice || "").toLowerCase()}">${cliente.tipologia_codice}</span>` 
    : "";
  const subBadge = cliente.sottotipologia_nome 
    ? `<span class="badge b-categoria">${cliente.sottotipologia_nome}</span>` 
    : "";
  
  let metaChips = [];
  if (cliente.codice_fiscale) metaChips.push(`<span class="meta-chip">CF: <strong>${cliente.codice_fiscale}</strong></span>`);
  if (cliente.partita_iva) metaChips.push(`<span class="meta-chip">P.IVA: <strong>${cliente.partita_iva}</strong></span>`);
  if (cliente.periodicita) metaChips.push(`<span class="meta-chip">📅 <strong>${cliente.periodicita}</strong></span>`);
  if (cliente.col2_value) metaChips.push(`<span class="meta-chip">Tipo: <strong>${cliente.col2_value}</strong></span>`);
  if (cliente.col3_value) metaChips.push(`<span class="meta-chip">Regime: <strong>${cliente.col3_value}</strong></span>`);

  return `
    <div class="cliente-info-header">
      <div class="cliente-info-avatar">${avatar}</div>
      <div class="cliente-info-nome">${escAttr(cliente.nome)}</div>
      <div class="cliente-info-badges">${tipBadge} ${subBadge}</div>
    </div>
    ${metaChips.length ? `<div class="cliente-info-meta">${metaChips.join("")}</div>` : ""}
  `;
}

function renderClienteDatiRiferimento(cliente) {
  if (!cliente) return "";
  let items = [];
  if (cliente.codice_fiscale) items.push(`<div class="dati-ref-item"><span class="ref-icon">🆔</span><span class="ref-label">CF:</span><span class="ref-value">${cliente.codice_fiscale}</span></div>`);
  if (cliente.partita_iva) items.push(`<div class="dati-ref-item"><span class="ref-icon">🏢</span><span class="ref-label">P.IVA:</span><span class="ref-value">${cliente.partita_iva}</span></div>`);
  if (cliente.email) items.push(`<div class="dati-ref-item"><span class="ref-icon">📧</span><span class="ref-label">Email:</span><span class="ref-value">${cliente.email}</span></div>`);
  if (cliente.telefono) items.push(`<div class="dati-ref-item"><span class="ref-icon">📞</span><span class="ref-label">Tel:</span><span class="ref-value">${cliente.telefono}</span></div>`);
  if (cliente.pec) items.push(`<div class="dati-ref-item"><span class="ref-icon">📨</span><span class="ref-label">PEC:</span><span class="ref-value">${cliente.pec}</span></div>`);
  if (cliente.sdi) items.push(`<div class="dati-ref-item"><span class="ref-icon">📋</span><span class="ref-label">SDI:</span><span class="ref-value">${cliente.sdi}</span></div>`);
  if (cliente.periodicita) items.push(`<div class="dati-ref-item"><span class="ref-icon">📅</span><span class="ref-label">Period.:</span><span class="ref-value">${cliente.periodicita}</span></div>`);
  if (cliente.col2_value) items.push(`<div class="dati-ref-item"><span class="ref-icon">📂</span><span class="ref-label">Sottoc.:</span><span class="ref-value">${cliente.col2_value}</span></div>`);
  if (cliente.col3_value) items.push(`<div class="dati-ref-item"><span class="ref-icon">📊</span><span class="ref-label">Regime:</span><span class="ref-value">${cliente.col3_value}</span></div>`);
  if (cliente.referente) items.push(`<div class="dati-ref-item"><span class="ref-icon">👤</span><span class="ref-label">Ref.:</span><span class="ref-value">${cliente.referente}</span></div>`);
  
  if (!items.length) return "";
  return `
    <div class="cpc-dati-riferimento">
      <div class="dati-ref-title">📋 Dati di Riferimento</div>
      <div class="dati-ref-grid">${items.join("")}</div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════
function buildDashboardShell(stats) {
  document.getElementById("content").innerHTML = `
    <div class="print-header"><strong>Studio Commerciale - Dashboard ${stats.anno}</strong><br>Stampa: ${new Date().toLocaleDateString("it-IT")}</div>
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
            <input class="input" id="dash-adp-search" placeholder="Cerca nome, codice..."
              value="${escAttr(state.dashSearch)}" oninput="onDashAdpSearch(this.value)">
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
    if (sq && !a.nome.toLowerCase().includes(sq) && !a.codice.toLowerCase().includes(sq) && !a.categoria.toLowerCase().includes(sq)) return false;
    return true;
  });
  
  const fT = adpVis.reduce((s, a) => s + a.totale, 0);
  const fC = adpVis.reduce((s, a) => s + a.completati, 0);
  const fD = adpVis.reduce((s, a) => s + a.da_fare, 0);
  const fI = adpVis.reduce((s, a) => s + Math.max(0, a.totale - a.completati - a.da_fare), 0);
  const fP = fT > 0 ? Math.round((fC / fT) * 100) : 0;
  const isF = sc !== "tutti" || sq !== "";
  
  const se = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const si = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };
  
  si("ds-lbl-tot", `Adempimenti ${stats.anno}${isF ? ` <span style="font-size:9px;color:var(--yellow)">(filtro)</span>` : ""}`);
  se("ds-tot", fT);
  se("ds-comp", fC);
  se("ds-dafare", fD);
  se("ds-incorso", fI);
  se("ds-na", stats.na || 0);
  se("ds-perc", fP + "%");
  
  const dp = document.getElementById("ds-prog");
  if (dp) dp.style.width = fP + "%";
  
  const title = document.getElementById("dash-adp-count-title");
  if (title) title.innerHTML = `Adempimenti ${stats.anno} <span style="font-size:11px;font-weight:400;color:var(--text3);margin-left:6px">${adpVis.length}/${allAdp.length} — clicca riga per Vista Globale</span>`;
  
  const tabsEl = document.getElementById("dash-cat-tabs");
  if (tabsEl) tabsEl.innerHTML = [{ codice: "tutti", nome: "Tutti", color: "var(--text2)" }, ...CATEGORIE]
    .map((c) => {
      const active = state.dashFiltroCategoria === c.codice;
      const col = c.color || "var(--text2)";
      return `<button class="cat-tab${active ? " cat-tab-active" : ""}" style="${active ? `background:${col}22;border-color:${col};color:${col}` : ""}" onclick="setDashCat('${c.codice}')">${c.nome || c.codice}</button>`;
    }).join("");
  
  const tbody = document.getElementById("dash-adp-tbody");
  if (!tbody) return;
  
  if (!adpVis.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text3)">Nessun adempimento</td></tr>`;
    return;
  }
  
  tbody.innerHTML = adpVis.map((a) => {
    const p = a.totale > 0 ? Math.round((a.completati / a.totale) * 100) : 0;
    const iC = Math.max(0, a.totale - a.completati - a.da_fare);
    const dot = catColor[a.categoria] ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${catColor[a.categoria]};margin-right:5px;vertical-align:middle"></span>` : "";
    return `<tr class="adp-dash-row" onclick="goVistaGlobaleAdp('${escAttr(a.nome)}')" title="Clicca per Vista Globale">
      <td><span style="font-family:var(--mono);font-size:10px;color:var(--accent);font-weight:700">${a.codice}</span></td>
      <td style="font-weight:700">${a.nome}</td>
      <td>${dot}<span class="badge b-categoria">${a.categoria}</span></td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;text-align:right">${a.totale}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--green);text-align:right">${a.completati}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--red);text-align:right">${a.da_fare}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--yellow);text-align:right">${iC > 0 ? iC : "-"}</td>
      <td><div style="display:flex;align-items:center;gap:6px;min-width:110px">
        <div class="mini-bar" style="flex:1;height:7px"><div class="mini-fill" style="width:${p}%"></div></div>
        <span style="font-size:10px;font-family:var(--mono);color:var(--text3);min-width:30px;text-align:right">${p}%</span>
      </div></td>
    </tr>`;
  }).join("");
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
  document.querySelectorAll(".nav-item").forEach((x) => x.classList.remove("active"));
  document.querySelector('[data-page="scadenzario_globale"]').classList.add("active");
  renderPage("scadenzario_globale");
}

// ═══════════════════════════════════════════════════════════════
// CLIENTI
// ═══════════════════════════════════════════════════════════════
const applyClientiFiltriDB = debounce(() => {
  const q = document.getElementById("global-search-clienti")?.value || "";
  const t = document.getElementById("filter-tipo")?.value || "";
  socket.emit("get:clienti", { search: q, tipologia: t });
}, 300);

function applyClientiFiltri() { applyClientiFiltriDB(); }

function renderClientiPage() { renderClientiTabella(state.clienti); }

function renderClientiTabella(clienti) {
  const tbody = clienti.length
    ? clienti.map((c) => `<tr class="clickable" onclick="showClienteDettaglio(${c.id})">
        <td><strong>${c.nome}</strong></td>
        <td><span class="badge b-${(c.tipologia_codice || "").toLowerCase()}">${c.tipologia_codice || "-"}</span></td>
        <td class="td-dim">${c.sottotipologia_nome || "-"}</td>
        <td class="td-mono td-dim">${c.codice_fiscale || c.partita_iva || "-"}</td>
        <td class="td-dim">${c.periodicita || "-"}</td>
        <td class="td-dim">${c.email || "-"}</td>
        <td class="col-actions no-print"><div style="display:flex;gap:5px" onclick="event.stopPropagation()">
          <button class="btn btn-sm btn-secondary" onclick="editCliente(${c.id})">✏️</button>
          <button class="btn btn-sm btn-success" onclick="goScadenzario(${c.id})">📅</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCliente(${c.id})">🗑️</button>
        </div></td>
      </tr>`).join("")
    : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato</p></div></td></tr>`;
  
  document.getElementById("content").innerHTML = `
    <div class="print-header"><strong>Studio Commerciale - Elenco Clienti</strong><br>Stampa: ${new Date().toLocaleDateString("it-IT")} - Tot: ${clienti.length}</div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Clienti (${clienti.length})</h3></div>
      <table><thead><tr><th>Nome</th><th>Tipo</th><th>Sottotipo</th><th>CF / P.IVA</th><th>Periodicità</th><th>Email</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>`;
}

function showClienteDettaglio(id) {
  const c = state.clienti.find((x) => x.id === id);
  if (!c) return;
  state._currentClienteDettaglio = c;
  
  document.getElementById("modal-cliente-det-title").textContent = c.nome;
  document.getElementById("cliente-dettaglio-content").innerHTML = `
    ${renderClienteInfoBox(c)}
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
// MODAL CLIENTE — LOGICA 4 COLONNE (CASCADE)
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
    col2Sel.innerHTML = `<option value="">-- Seleziona --</option>` + col2Opts.map((o) => `<option value="${o.value}" ${col2Current === o.value ? "selected" : ""}>${o.label}</option>`).join("");
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
  col3Sel.innerHTML = `<option value="">-- Seleziona --</option>` + col3Opts.map((o) => `<option value="${o.value}" ${col3Current === o.value ? "selected" : ""}>${o.label}</option>`).join("");
  if (!col3Current) col3Sel.value = "";
  
  if (col3Sel.value) {
    document.getElementById("wrap-col4").style.display = "";
  } else {
    _nascondiCol4();
  }
  
  aggiornaRiepilogoClassificazione();
}

function _nascondiCol3() {
  const w = document.getElementById("wrap-col3");
  const s = document.getElementById("c-col3");
  if (w) w.style.display = "none";
  if (s) s.value = "";
  _nascondiCol4();
  aggiornaRiepilogoClassificazione();
}

function _nascondiCol4() {
  const w = document.getElementById("wrap-col4");
  const s = document.getElementById("c-col4");
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
  if (tip) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Tipologia:</span><span class="chip-value">${tip.codice} — ${tip.nome}</span></div>`);
  if (col2) {
    const col2Opt = COL2_OPTIONS[tipCodice]?.find((o) => o.value === col2);
    if (col2Opt) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Sottocategoria:</span><span class="chip-value">${col2Opt.label}</span></div>`);
  }
  if (col3) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Regime:</span><span class="chip-value">${col3}</span></div>`);
  if (col4) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Periodicità:</span><span class="chip-value">${col4 === "mensile" ? "📅 Mensile" : "📆 Trimestrale"}</span></div>`);
  
  if (chips.length > 0) {
    content.innerHTML = chips.join("");
    box.style.display = "";
  } else {
    box.style.display = "none";
  }
}

function populateTipologiaSelect(selectedId) {
  const sel = document.getElementById("c-tipologia");
  if (!sel) return;
  sel.innerHTML = state.tipologie.map((t) => `<option value="${t.id}" ${String(t.id) === String(selectedId) ? "selected" : ""}>${t.codice} — ${t.nome}</option>`).join("");
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
  if (document.getElementById("c-col3")?.value) {
    document.getElementById("wrap-col4").style.display = "";
  }
  aggiornaRiepilogoClassificazione();
}

function renderCategorieSelect(attuali = []) {
  const container = document.getElementById("categorie-attive");
  if (!container) return;
  container.innerHTML = CATEGORIE.map((cat) => `<label style="display:inline-flex;align-items:center;gap:8px;margin:4px 8px 4px 0;padding:8px 12px;background:var(--surface2);border-radius:var(--r-sm);cursor:pointer;border:1px solid ${attuali.includes(cat.codice) ? "var(--accent)" : "var(--border)"};transition:all 0.12s"><input type="checkbox" value="${cat.codice}" ${attuali.includes(cat.codice) ? "checked" : ""} style="accent-color:var(--accent)" onchange="this.parentElement.style.borderColor=this.checked?'var(--accent)':'var(--border)'"><span>${cat.icona} ${cat.nome}</span></label>`).join("");
}

function getSelectedCategorie() {
  return Array.from(document.querySelectorAll("#categorie-attive input")).filter((cb) => cb.checked).map((cb) => cb.value);
}

function openNuovoCliente() {
  document.getElementById("modal-cliente-title").textContent = "Nuovo Cliente";
  document.getElementById("cliente-id").value = "";
  ["c-nome","c-cf","c-piva","c-email","c-tel","c-indirizzo","c-note","c-pec","c-sdi","c-citta","c-cap","c-prov","c-referente","c-iban"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (document.getElementById("c-col2")) document.getElementById("c-col2").value = "";
  if (document.getElementById("c-col3")) document.getElementById("c-col3").value = "";
  if (document.getElementById("c-col4")) document.getElementById("c-col4").value = "";
  
  renderCategorieSelect(["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]);
  populateTipologiaSelect(state.tipologie[0]?.id);
  aggiornaColonneCliente();
  openModal("modal-cliente");
}

function editCliente(id) {
  socket.once("res:cliente", ({ success, data }) => {
    if (!success || !data) return;
    document.getElementById("modal-cliente-title").textContent = "Modifica Cliente";
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
    
    const cat = JSON.parse(data.categorie_attive || '["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]');
    renderCategorieSelect(cat);
    populateTipologiaSelect(data.id_tipologia);
    
    const col2Val = data.col2_value || "";
    const col3Val = data.col3_value || "";
    const col4Val = data.periodicita || "";
    
    setTimeout(() => {
      if (document.getElementById("c-col2")) document.getElementById("c-col2").value = col2Val;
      if (document.getElementById("c-col3")) document.getElementById("c-col3").value = col3Val;
      aggiornaColonneCliente();
      setTimeout(() => {
        if (document.getElementById("c-col4")) document.getElementById("c-col4").value = col4Val;
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
  if (!nome) { showNotif("Il nome è obbligatorio", "error"); return; }
  
  const categorie = getSelectedCategorie();
  if (!categorie.length) { showNotif("Seleziona almeno una categoria", "error"); return; }
  
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
    codice_fiscale: document.getElementById("c-cf").value.trim().toUpperCase() || null,
    partita_iva: document.getElementById("c-piva").value.trim() || null,
    email: document.getElementById("c-email").value.trim() || null,
    telefono: document.getElementById("c-tel").value.trim() || null,
    indirizzo: document.getElementById("c-indirizzo").value.trim() || null,
    citta: document.getElementById("c-citta")?.value.trim() || null,
    cap: document.getElementById("c-cap")?.value.trim() || null,
    provincia: document.getElementById("c-prov")?.value.trim().toUpperCase() || null,
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
  } else {
    socket.emit("create:cliente", data);
  }
}

function deleteCliente(id) {
  if (confirm("Eliminare questo cliente?")) socket.emit("delete:cliente", { id });
}

function goScadenzario(id) {
  const c = state.clienti.find((x) => x.id === id);
  if (c) {
    state.selectedCliente = c;
    document.querySelectorAll(".nav-item").forEach((x) => x.classList.remove("active"));
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
  if (r.scadenza_tipo === "semestrale") return r.semestre === 1 ? "1° Sem. (Gen-Giu)" : "2° Sem. (Lug-Dic)";
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
  return parseInt(r.is_contabilita) === 1 || r.is_contabilita === true || r.is_contabilita === 1;
}

function hasRate(r) {
  return parseInt(r.has_rate) === 1 || r.has_rate === true || r.has_rate === 1;
}

function renderImportoCellCompact(r) {
  if (isContabilita(r)) {
    const iva = r.importo_iva ? `€${parseFloat(r.importo_iva).toFixed(2)}` : null;
    const cont = r.importo_contabilita ? `€${parseFloat(r.importo_contabilita).toFixed(2)}` : null;
    if (!iva && !cont) return `<span class="imp-empty">—</span>`;
    return `<div class="importi-cell">${iva ? `<div class="imp-row"><span class="imp-lbl">💰 IVA</span><span class="imp-val">${iva}</span></div>` : ""}${cont ? `<div class="imp-row"><span class="imp-lbl">📊 Cont.</span><span class="imp-val">${cont}</span></div>` : ""}</div>`;
  }
  if (hasRate(r)) {
    let lb = ["Saldo", "1°Acc.", "2°Acc."];
    try { if (r.rate_labels) lb = JSON.parse(r.rate_labels); } catch (e) {}
    const s = r.importo_saldo ? `€${parseFloat(r.importo_saldo).toFixed(2)}` : null;
    const a1 = r.importo_acconto1 ? `€${parseFloat(r.importo_acconto1).toFixed(2)}` : null;
    const a2 = r.importo_acconto2 ? `€${parseFloat(r.importo_acconto2).toFixed(2)}` : null;
    if (!s && !a1 && !a2) return `<span class="imp-empty">—</span>`;
    return `<div class="importi-cell">${s ? `<div class="imp-row"><span class="imp-lbl">💰 ${lb[0]}</span><span class="imp-val">${s}</span></div>` : ""}${a1 ? `<div class="imp-row"><span class="imp-lbl">📥 ${lb[1]}</span><span class="imp-val">${a1}</span></div>` : ""}${a2 ? `<div class="imp-row"><span class="imp-lbl">📥 ${lb[2]}</span><span class="imp-val">${a2}</span></div>` : ""}</div>`;
  }
  return r.importo ? `<div class="importi-cell"><div class="imp-row"><span class="imp-lbl">💶 Imp.</span><span class="imp-val">€${parseFloat(r.importo).toFixed(2)}</span></div></div>` : `<span class="imp-empty">—</span>`;
}

function renderPeriodoRigaCompleta(r) {
  const stato = r.stato || "da_fare";
  const pl = getPeriodoLabel(r), ps = getPeriodoShort(r);
  const imp = renderImportoCellCompact(r);
  return `<div class="periodo-row-full s-${stato}" onclick="openAdpById(${r.id})" title="${escAttr(r.adempimento_nome)} — ${escAttr(pl)}: clicca per modificare">
    <div class="periodo-row-header">
      <span class="periodo-tag">${ps}</span>
      <span class="badge b-${stato}" style="font-size:9px">${STATI[stato] || stato}</span>
      ${r.data_scadenza ? `<span class="prf-chip" title="Data scadenza">📅 Scad. <strong>${r.data_scadenza}</strong></span>` : ""}
      ${r.data_completamento ? `<span class="prf-chip prf-chip-green">✅ Compl. <strong>${r.data_completamento}</strong></span>` : ""}
    </div>
    ${imp !== `<span class="imp-empty">—</span>` || r.note ? `
    <div class="periodo-row-body">
      <div class="periodo-importo-wrap">${imp}</div>
      ${r.note ? `<div class="periodo-note-full">📝 <em>${r.note}</em></div>` : ""}
    </div>` : ""}
  </div>`;
}

// ═══════════════════════════════════════════════════════════════
// SCADENZARIO SINGOLO
// ═══════════════════════════════════════════════════════════════
function getAdempimentiMancanti() {
  if (!state.selectedCliente) return [];
  const cat = JSON.parse(state.selectedCliente.categorie_attive || "[]");
  const compatibili = state.adempimenti.filter((a) => a.categoria === "TUTTI" || cat.includes(a.categoria));
  return compatibili.filter((a) => !state.adpInseriti.includes(a.id));
}

function renderBtnAddAdp(id_cliente) {
  const mancanti = getAdempimentiMancanti();
  if (!mancanti.length) return `<button class="btn btn-sm btn-purple" disabled style="opacity:0.4;cursor:not-allowed">✓ Tutti inseriti</button>`;
  return `<button class="btn btn-sm btn-purple" onclick="openAddAdp(${id_cliente})" title="${mancanti.length} adempimenti da aggiungere">+ Adempimento <span style="font-size:10px;background:rgba(255,255,255,0.2);border-radius:10px;padding:1px 6px;margin-left:2px">${mancanti.length}</span></button>`;
}

function renderScadenzarioPage() {
  const opts = state.clienti.map((c) => `<option value="${c.id}" ${state.selectedCliente?.id === c.id ? "selected" : ""}>[${c.tipologia_codice}] ${c.nome}</option>`).join("");
  document.getElementById("topbar-actions").innerHTML = `
    <select class="select" id="sel-cliente" style="width:260px" onchange="onClienteChange()">
      <option value="">-- Seleziona Cliente --</option>${opts}
    </select>
    <div class="year-sel"><button onclick="changeAnnoScad(-1)">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnnoScad(1)">&#9654;</button></div>
    <div class="search-wrap" style="width:200px"><span class="search-icon">🔍</span><input class="input" id="scad-search" placeholder="Cerca adempimento..." oninput="applyScadSearch()"></div>`;
  if (state.selectedCliente) loadScadenzario();
  else document.getElementById("content").innerHTML = `<div class="empty"><div class="empty-icon">📅</div><p>Seleziona un cliente dalla lista in alto</p></div>`;
}

function onClienteChange() {
  const id = parseInt(document.getElementById("sel-cliente").value);
  state.selectedCliente = state.clienti.find((c) => c.id === id) || null;
  state.adpInseriti = [];
  if (state.selectedCliente) loadScadenzario();
}

function changeAnnoScad(d) {
  state.anno += d;
  document.querySelectorAll(".year-num").forEach((el) => (el.textContent = state.anno));
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

const applyScadSearch = debounce(() => { if (state.selectedCliente) loadScadenzario(); }, 300);

function renderScadenzarioTabella(data) {
  const c = state.selectedCliente;
  if (!c) return;
  
  const totale = data.length;
  const comp = data.filter((r) => r.stato === "completato").length;
  const daF = data.filter((r) => r.stato === "da_fare").length;
  const inC = data.filter((r) => r.stato === "in_corso").length;
  const perc = totale > 0 ? Math.round((comp / totale) * 100) : 0;
  
  const avatar = (c.nome || "?").charAt(0).toUpperCase();
  const tipColor = c.tipologia_colore || "var(--accent)";
  
  // Card cliente con tutti i dati di riferimento
  const clienteCard = `
    <div class="cliente-preview-card" style="border-left-color:${tipColor}">
      <div class="cpc-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}22">${avatar}</div>
      <div class="cpc-info">
        <div class="cpc-nome">${escAttr(c.nome)}</div>
        <div class="cpc-sub">
          <span class="badge b-${(c.tipologia_codice || "").toLowerCase()}">${c.tipologia_codice}</span>
          ${c.sottotipologia_nome ? `<span class="badge b-categoria">${c.sottotipologia_nome}</span>` : ""}
        </div>
        <div class="cpc-meta-row">
          ${c.codice_fiscale ? `<span class="cpc-meta-chip">CF: <strong>${c.codice_fiscale}</strong></span>` : ""}
          ${c.partita_iva ? `<span class="cpc-meta-chip">P.IVA: <strong>${c.partita_iva}</strong></span>` : ""}
          ${c.periodicita ? `<span class="cpc-meta-chip">📅 <strong>${c.periodicita}</strong></span>` : ""}
          ${c.col2_value ? `<span class="cpc-meta-chip">📂 <strong>${c.col2_value}</strong></span>` : ""}
          ${c.col3_value ? `<span class="cpc-meta-chip">📊 <strong>${c.col3_value}</strong></span>` : ""}
        </div>
      </div>
      <div class="cpc-stats">
        <div class="cpc-stat-item"><div class="cpc-stat-num">${totale}</div><div class="cpc-stat-lbl">Totale</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${comp}</div><div class="cpc-stat-lbl">Completati</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--red)">${daF}</div><div class="cpc-stat-lbl">Da fare</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--yellow)">${inC}</div><div class="cpc-stat-lbl">In corso</div></div>
        <div class="cpc-stat-item">
          <div class="cpc-stat-num" style="color:var(--green)">${perc}%</div>
          <div class="cpc-stat-lbl">Progresso</div>
          <div class="mini-bar" style="margin-top:4px;width:50px"><div class="mini-fill" style="width:${perc}%"></div></div>
        </div>
      </div>
      <div class="cpc-actions no-print">
        <button class="btn btn-sm btn-orange" onclick="generaScadenzario()">⚡ Genera</button>
        <button class="btn btn-sm btn-cyan" onclick="openCopia()">📋 Copia</button>
        ${renderBtnAddAdp(c.id)}
      </div>
      ${renderClienteDatiRiferimento(c)}
    </div>`;
  
  // Raggruppa per adempimento
  const grouped = {};
  data.forEach((r) => {
    storeRow(r);
    const key = r.id_adempimento;
    if (!grouped[key]) grouped[key] = { nome: r.adempimento_nome, codice: r.adempimento_codice, categoria: r.categoria, rows: [] };
    grouped[key].rows.push(r);
  });
  
  let tbody = "";
  Object.values(grouped).forEach((g) => {
    const compG = g.rows.filter((r) => r.stato === "completato").length;
    const totG = g.rows.length;
    const pG = totG > 0 ? Math.round((compG / totG) * 100) : 0;
    
    tbody += `<tr>
      <td class="adp-label-td" rowspan="${g.rows.length || 1}">
        <span class="adp-codice">${g.codice}</span>
        <span class="adp-nome">${g.nome}</span>
        <div style="margin-top:6px"><span class="badge b-categoria">${g.categoria}</span></div>
        <div style="margin-top:8px;display:flex;align-items:center;gap:6px">
          <div class="mini-bar" style="width:50px"><div class="mini-fill" style="width:${pG}%"></div></div>
          <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">${compG}/${totG}</span>
        </div>
      </td>
      <td><div class="periodi-lista">${g.rows.map((r) => renderPeriodoRigaCompleta(r)).join("")}</div></td>
    </tr>`;
  });
  
  if (!tbody) {
    tbody = `<tr><td colspan="2"><div class="empty"><div class="empty-icon">📅</div><p>Nessun adempimento per ${state.anno}</p><button class="btn btn-primary" onclick="generaScadenzario()">⚡ Genera Scadenzario</button></div></td></tr>`;
  }
  
  document.getElementById("content").innerHTML = `
    ${clienteCard}
    <div class="table-wrap">
      <div class="table-header no-print">
        <h3>Scadenzario ${state.anno}</h3>
        <div style="flex:1"></div>
        <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>
      </div>
      <table>
        <thead><tr><th style="width:200px">Adempimento</th><th>Periodi</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

function generaScadenzario() {
  if (!state.selectedCliente) return;
  socket.emit("genera:scadenzario", { id_cliente: state.selectedCliente.id, anno: state.anno });
}

function openCopia() {
  if (!state.selectedCliente) return;
  document.getElementById("copia-cliente-id").value = state.selectedCliente.id;
  document.getElementById("copia-modalita").value = "singolo";
  document.getElementById("copia-da").value = state.anno - 1;
  document.getElementById("copia-a").value = state.anno;
  document.getElementById("copia-info").innerHTML = `Copia adempimenti per <strong>${state.selectedCliente.nome}</strong>`;
  openModal("modal-copia");
}

function openCopiaTutti() {
  document.getElementById("copia-cliente-id").value = "";
  document.getElementById("copia-modalita").value = "tutti";
  document.getElementById("copia-da").value = state.anno - 1;
  document.getElementById("copia-a").value = state.anno;
  document.getElementById("copia-info").innerHTML = `Copia adempimenti per <strong>tutti i clienti</strong>`;
  openModal("modal-copia");
}

function eseguiCopia() {
  const modalita = document.getElementById("copia-modalita").value;
  const da = parseInt(document.getElementById("copia-da").value);
  const a = parseInt(document.getElementById("copia-a").value);
  if (modalita === "singolo") {
    const id = parseInt(document.getElementById("copia-cliente-id").value);
    socket.emit("copia:scadenzario", { id_cliente: id, anno_da: da, anno_a: a });
  } else {
    socket.emit("copia:tutti", { anno_da: da, anno_a: a });
  }
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
  
  // Mostra info cliente
  const c = state.selectedCliente;
  if (c) {
    document.getElementById("add-adp-cliente-info").innerHTML = renderClienteInfoBox(c);
  }
  
  refreshAddAdpSelect();
  openModal("modal-add-adp");
}

function refreshAddAdpSelect() {
  const mancanti = getAdempimentiMancanti();
  const sel = document.getElementById("add-adp-select");
  sel.innerHTML = mancanti.map((a) => `<option value="${a.id}" data-scadenza="${a.scadenza_tipo}">${a.codice} — ${a.nome}</option>`).join("");
  updatePeriodoOptions();
}

function updatePeriodoOptions() {
  const sel = document.getElementById("add-adp-select");
  const perSel = document.getElementById("add-adp-periodo");
  if (!sel || !perSel) return;
  const opt = sel.options[sel.selectedIndex];
  if (!opt) { perSel.innerHTML = ""; return; }
  const tipo = opt.dataset.scadenza;
  let opts = "";
  if (tipo === "mensile") {
    opts = MESI.map((m, i) => `<option value="mese:${i + 1}">${m}</option>`).join("");
  } else if (tipo === "trimestrale") {
    opts = [1,2,3,4].map((t) => `<option value="trim:${t}">${t}° Trimestre</option>`).join("");
  } else if (tipo === "semestrale") {
    opts = `<option value="sem:1">1° Semestre</option><option value="sem:2">2° Semestre</option>`;
  } else {
    opts = `<option value="annuale">Annuale</option>`;
  }
  perSel.innerHTML = opts;
}

function eseguiAddAdp() {
  const id_cliente = parseInt(document.getElementById("add-adp-cliente-id").value);
  const id_adempimento = parseInt(document.getElementById("add-adp-select").value);
  const anno = parseInt(document.getElementById("add-adp-anno").value);
  const periodo = document.getElementById("add-adp-periodo").value;
  
  const data = { id_cliente, id_adempimento, anno };
  if (periodo.startsWith("mese:")) data.mese = parseInt(periodo.split(":")[1]);
  else if (periodo.startsWith("trim:")) data.trimestre = parseInt(periodo.split(":")[1]);
  else if (periodo.startsWith("sem:")) data.semestre = parseInt(periodo.split(":")[1]);
  
  socket.emit("add:adempimento_cliente", data);
}

// ═══════════════════════════════════════════════════════════════
// SCADENZARIO GLOBALE
// ═══════════════════════════════════════════════════════════════
function renderGlobalePage() {
  document.getElementById("topbar-actions").innerHTML = `
    <div class="year-sel"><button onclick="changeAnnoGlobale(-1)">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnnoGlobale(1)">&#9654;</button></div>
    <select class="select" id="glob-filtro-adp" style="width:200px" onchange="applyGlobaleFiltri()">
      <option value="">Tutti adempimenti</option>
    </select>
    <select class="select" id="glob-filtro-stato" style="width:140px" onchange="applyGlobaleFiltri()">
      <option value="">Tutti gli stati</option>
      <option value="da_fare">⭕ Da fare</option>
      <option value="in_corso">🔄 In corso</option>
      <option value="completato">✅ Completato</option>
      <option value="n_a">➖ N/A</option>
    </select>
    <div class="search-wrap" style="width:200px"><span class="search-icon">🔍</span><input class="input" id="glob-search" placeholder="Cerca cliente..." oninput="applyGlobaleFiltriDebounced()"></div>
    <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>`;
  loadGlobale();
}

function changeAnnoGlobale(d) {
  state.anno += d;
  document.querySelectorAll(".year-num").forEach((el) => (el.textContent = state.anno));
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
  if (state.globalePreFiltroAdp) {
    filtri.adempimento = state.globalePreFiltroAdp;
  }
  
  socket.emit("get:scadenzario_globale", { anno: state.anno, filtri });
}

const applyGlobaleFiltriDebounced = debounce(() => { state.globalePreFiltroAdp = ""; loadGlobale(); }, 300);

function applyGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}

function calcolaGlobaleStats(data) {
  const totale = data.length;
  const comp = data.filter((r) => r.stato === "completato").length;
  const daF = data.filter((r) => r.stato === "da_fare").length;
  const inC = data.filter((r) => r.stato === "in_corso").length;
  const clienti = new Set(data.map((r) => r.cliente_id)).size;
  const adpSet = new Set(data.map((r) => r.adempimento_nome));
  return { totale, comp, daF, inC, clienti, adempimenti: adpSet };
}

function renderGlobaleHeader() {
  const st = state.globaleStats;
  if (!st) return;
  
  // Popola select adempimenti
  const adpSel = document.getElementById("glob-filtro-adp");
  if (adpSel) {
    const current = state.globalePreFiltroAdp || adpSel.value;
    adpSel.innerHTML = `<option value="">Tutti adempimenti</option>` + Array.from(st.adempimenti).sort().map((a) => `<option value="${escAttr(a)}" ${current === a ? "selected" : ""}>${a}</option>`).join("");
    if (state.globalePreFiltroAdp) {
      state.globalePreFiltroAdp = "";
    }
  }
}

function renderGlobaleTabella(data) {
  const st = state.globaleStats;
  const perc = st.totale > 0 ? Math.round((st.comp / st.totale) * 100) : 0;
  
  const headerCard = `
    <div class="globale-preview-card">
      <div class="gpc-left">
        <div class="gpc-globe">🌐</div>
        <div>
          <div class="gpc-title">Vista Globale ${state.anno}</div>
          <div class="gpc-sub">${st.clienti} clienti · ${st.adempimenti.size} tipi adempimenti</div>
          <div class="gpc-ctx-tags">
            <span class="ctx-tag ctx-tag-anno">${state.anno}</span>
            <span class="ctx-tag">${st.totale} totale</span>
          </div>
        </div>
      </div>
      <div class="gpc-stats">
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${st.comp}</div><div class="cpc-stat-lbl">Completati</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--red)">${st.daF}</div><div class="cpc-stat-lbl">Da fare</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--yellow)">${st.inC}</div><div class="cpc-stat-lbl">In corso</div></div>
        <div class="cpc-stat-item">
          <div class="cpc-stat-num" style="color:var(--green)">${perc}%</div>
          <div class="cpc-stat-lbl">Progresso</div>
          <div class="mini-bar" style="margin-top:4px;width:60px"><div class="mini-fill" style="width:${perc}%"></div></div>
        </div>
      </div>
    </div>`;
  
  // Raggruppa per adempimento
  const grouped = {};
  data.forEach((r) => {
    storeRow(r);
    const key = r.adempimento_nome;
    if (!grouped[key]) grouped[key] = { nome: r.adempimento_nome, codice: r.adempimento_codice, categoria: r.categoria, rows: [] };
    grouped[key].rows.push(r);
  });
  
  let content = "";
  Object.values(grouped).forEach((g) => {
    const compG = g.rows.filter((r) => r.stato === "completato").length;
    const totG = g.rows.length;
    const pG = totG > 0 ? Math.round((compG / totG) * 100) : 0;
    
    content += `
      <div class="table-wrap" style="margin-bottom:12px">
        <div class="table-header">
          <h3>
            <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">${g.codice}</span>
            ${g.nome}
            <span class="badge b-categoria" style="margin-left:8px">${g.categoria}</span>
          </h3>
          <div style="display:flex;align-items:center;gap:8px">
            <div class="mini-bar" style="width:80px"><div class="mini-fill" style="width:${pG}%"></div></div>
            <span style="font-size:11px;font-family:var(--mono);color:var(--text2)">${compG}/${totG} (${pG}%)</span>
          </div>
        </div>
        <div style="padding:10px">
          ${g.rows.map((r) => renderGlobaleClienteRow(r)).join("")}
        </div>
      </div>`;
  });
  
  if (!content) {
    content = `<div class="empty"><div class="empty-icon">🌐</div><p>Nessun adempimento trovato per ${state.anno}</p></div>`;
  }
  
  document.getElementById("content").innerHTML = headerCard + content;
}

function renderGlobaleClienteRow(r) {
  const avatar = (r.cliente_nome || "?").charAt(0).toUpperCase();
  const tipColor = r.cliente_tipologia_colore || "var(--accent)";
  
  return `
    <div class="globale-cliente-row s-${r.stato}" onclick="openAdpById(${r.id})" title="Clicca per modificare">
      <div class="gcr-cliente">
        <div class="gcr-avatar" style="border-color:${tipColor};color:${tipColor}">${avatar}</div>
        <div>
          <div class="gcr-nome">${escAttr(r.cliente_nome)}</div>
          <div class="gcr-cf">${r.cliente_cf || r.cliente_piva || "-"}</div>
        </div>
      </div>
      <div>
        <span class="badge b-${(r.cliente_tipologia_codice || "").toLowerCase()}">${r.cliente_tipologia_codice || "-"}</span>
        ${r.cliente_periodicita ? `<span class="meta-chip" style="margin-left:4px">📅 ${r.cliente_periodicita}</span>` : ""}
      </div>
      <div>
        <span class="periodo-tag-sm">${getPeriodoShort(r)}</span>
        <span class="badge b-${r.stato}" style="margin-left:4px">${STATI[r.stato] || r.stato}</span>
      </div>
      <div style="font-size:11px">
        ${r.data_scadenza ? `<div class="pga-date-chip">📅 ${r.data_scadenza}</div>` : ""}
        ${r.data_completamento ? `<div class="pga-date-chip" style="color:var(--green)">✅ ${r.data_completamento}</div>` : ""}
      </div>
      <div style="text-align:right">
        ${renderImportoCellCompact(r)}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// MODAL ADEMPIMENTO
// ═══════════════════════════════════════════════════════════════
function openAdpModal(r) {
  document.getElementById("adp-id").value = r.id;
  document.getElementById("adp-nome-label").textContent = `${r.adempimento_nome} — ${getPeriodoLabel(r)}`;
  document.getElementById("adp-stato").value = r.stato || "da_fare";
  document.getElementById("adp-scadenza").value = r.data_scadenza || "";
  document.getElementById("adp-data").value = r.data_completamento || "";
  document.getElementById("adp-note").value = r.note || "";
  
  document.getElementById("adp-is-contabilita").value = r.is_contabilita || 0;
  document.getElementById("adp-has-rate").value = r.has_rate || 0;
  document.getElementById("adp-rate-labels-json").value = r.rate_labels || "";
  
  // Mostra info cliente
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
  
  const isCont = isContabilita(r);
  const isRate = hasRate(r);
  
  document.getElementById("sect-importo-normale").style.display = (!isCont && !isRate) ? "" : "none";
  document.getElementById("sect-importo-cont").style.display = isCont ? "" : "none";
  document.getElementById("sect-importo-rate").style.display = (!isCont && isRate) ? "" : "none";
  
  document.getElementById("adp-importo").value = r.importo || "";
  document.getElementById("adp-imp-iva").value = r.importo_iva || "";
  document.getElementById("adp-imp-cont").value = r.importo_contabilita || "";
  document.getElementById("adp-imp-saldo").value = r.importo_saldo || "";
  document.getElementById("adp-imp-acc1").value = r.importo_acconto1 || "";
  document.getElementById("adp-imp-acc2").value = r.importo_acconto2 || "";
  
  if (isRate) {
    let lb = ["Saldo", "1° Acconto", "2° Acconto"];
    try { if (r.rate_labels) lb = JSON.parse(r.rate_labels); } catch (e) {}
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
    data.importo_iva = parseFloat(document.getElementById("adp-imp-iva").value) || null;
    data.importo_contabilita = parseFloat(document.getElementById("adp-imp-cont").value) || null;
  } else if (isRate) {
    data.importo_saldo = parseFloat(document.getElementById("adp-imp-saldo").value) || null;
    data.importo_acconto1 = parseFloat(document.getElementById("adp-imp-acc1").value) || null;
    data.importo_acconto2 = parseFloat(document.getElementById("adp-imp-acc2").value) || null;
  } else {
    data.importo = parseFloat(document.getElementById("adp-importo").value) || null;
  }
  
  socket.emit("update:adempimento_stato", data);
}

function deleteAdpCliente() {
  if (!confirm("Rimuovere questo adempimento dallo scadenzario?")) return;
  const id = parseInt(document.getElementById("adp-id").value);
  socket.emit("delete:adempimento_cliente", { id });
}

// ═══════════════════════════════════════════════════════════════
// ADEMPIMENTI
// ═══════════════════════════════════════════════════════════════
const applyAdempimentiFiltri = debounce(() => {
  const q = document.getElementById("global-search-adempimenti")?.value?.toLowerCase() || "";
  const filtered = state.adempimenti.filter((a) => 
    a.codice.toLowerCase().includes(q) || a.nome.toLowerCase().includes(q) || (a.categoria || "").toLowerCase().includes(q)
  );
  renderAdempimentiTabella(filtered);
}, 300);

function renderAdempimentiPage() { renderAdempimentiTabella(state.adempimenti); }

function renderAdempimentiTabella(adempimenti) {
  const tbody = adempimenti.length
    ? adempimenti.map((a) => {
        const catColor = CATEGORIE.find((c) => c.codice === a.categoria)?.color || "var(--accent)";
        return `<tr>
          <td><span style="font-family:var(--mono);font-size:11px;color:var(--accent);font-weight:700">${a.codice}</span></td>
          <td><strong>${a.nome}</strong></td>
          <td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${catColor};margin-right:6px"></span>${a.categoria || "-"}</td>
          <td>${a.scadenza_tipo || "-"}</td>
          <td>${a.is_contabilita ? "📊" : ""} ${a.has_rate ? "💰" : ""}</td>
          <td class="col-actions no-print"><div style="display:flex;gap:5px">
            <button class="btn btn-sm btn-secondary" onclick="editAdpDef(${a.id})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteAdpDef(${a.id})">🗑️</button>
          </div></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="6"><div class="empty"><div class="empty-icon">📋</div><p>Nessun adempimento trovato</p></div></td></tr>`;
  
  document.getElementById("content").innerHTML = `
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Adempimenti (${adempimenti.length})</h3></div>
      <table><thead><tr><th>Codice</th><th>Nome</th><th>Categoria</th><th>Scadenza</th><th>Flags</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>`;
}

function openNuovoAdpDef() {
  document.getElementById("modal-adp-def-title").textContent = "Nuovo Adempimento";
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
  document.getElementById("modal-adp-def-title").textContent = "Modifica Adempimento";
  document.getElementById("adp-def-id").value = a.id;
  document.getElementById("adp-def-codice").value = a.codice;
  document.getElementById("adp-def-nome").value = a.nome;
  document.getElementById("adp-def-desc").value = a.descrizione || "";
  document.getElementById("adp-def-categoria").value = a.categoria || "TUTTI";
  document.getElementById("adp-def-scadenza").value = a.scadenza_tipo || "annuale";
  document.getElementById("adp-def-contabilita").checked = !!a.is_contabilita;
  document.getElementById("adp-def-rate").checked = !!a.has_rate;
  
  let lb = ["Saldo", "1° Acconto", "2° Acconto"];
  try { if (a.rate_labels) lb = JSON.parse(a.rate_labels); } catch (e) {}
  document.getElementById("adp-rate-l1").value = lb[0] || "Saldo";
  document.getElementById("adp-rate-l2").value = lb[1] || "1° Acconto";
  document.getElementById("adp-rate-l3").value = lb[2] || "2° Acconto";
  
  onAdpFlagsChange();
  openModal("modal-adp-def");
}

function onAdpFlagsChange() {
  const isCont = document.getElementById("adp-def-contabilita").checked;
  const hasRate = document.getElementById("adp-def-rate").checked;
  
  if (isCont) {
    document.getElementById("adp-def-rate").checked = false;
  }
  if (hasRate) {
    document.getElementById("adp-def-contabilita").checked = false;
  }
  
  document.getElementById("sect-rate-labels").style.display = hasRate ? "" : "none";
}

function saveAdpDef() {
  const id = document.getElementById("adp-def-id").value;
  const codice = document.getElementById("adp-def-codice").value.trim().toUpperCase();
  const nome = document.getElementById("adp-def-nome").value.trim();
  
  if (!codice || !nome) { showNotif("Codice e nome sono obbligatori", "error"); return; }
  
  const data = {
    codice,
    nome,
    descrizione: document.getElementById("adp-def-desc").value.trim() || null,
    categoria: document.getElementById("adp-def-categoria").value,
    scadenza_tipo: document.getElementById("adp-def-scadenza").value,
    is_contabilita: document.getElementById("adp-def-contabilita").checked ? 1 : 0,
    has_rate: document.getElementById("adp-def-rate").checked ? 1 : 0,
  };
  
  if (data.has_rate) {
    data.rate_labels = [
      document.getElementById("adp-rate-l1").value,
      document.getElementById("adp-rate-l2").value,
      document.getElementById("adp-rate-l3").value,
    ];
  }
  
  if (id) {
    data.id = parseInt(id);
    socket.emit("update:adempimento", data);
  } else {
    socket.emit("create:adempimento", data);
  }
}

function deleteAdpDef(id) {
  if (confirm("Eliminare questo adempimento?")) socket.emit("delete:adempimento", { id });
}

// ═══════════════════════════════════════════════════════════════
// TIPOLOGIE
// ═══════════════════════════════════════════════════════════════
function renderTipologiePage() {
  const content = state.tipologie.map((t) => {
    const subs = (t.sottotipologie || []).map((s) => {
      if (s.is_separator) {
        return `<div class="sottotipologia-chip is-separator">${s.nome}</div>`;
      }
      return `<div class="sottotipologia-chip">
        <span class="sottotipologia-codice">${s.codice}</span>
        ${s.nome}
      </div>`;
    }).join("");
    
    return `
      <div class="tipologia-card">
        <div class="tipologia-header" style="border-left:4px solid ${t.colore || 'var(--accent)'}">
          <div class="tipologia-badge" style="background:${t.colore || 'var(--accent)'}22;color:${t.colore || 'var(--accent)'}">${t.codice}</div>
          <div class="tipologia-info">
            <div class="tipologia-nome">${t.nome}</div>
            <div class="tipologia-desc">${t.descrizione || ""}</div>
          </div>
          <div class="tipologia-count">${(t.sottotipologie || []).filter((s) => !s.is_separator).length} sottotipi</div>
        </div>
        <div class="sottotipologie-grid">${subs || '<div style="color:var(--text3);padding:10px">Nessuna sottotipologia</div>'}</div>
      </div>`;
  }).join("");
  
  document.getElementById("content").innerHTML = `
    <div class="infobox" style="margin-bottom:20px">
      🗂️ Le tipologie definiscono la classificazione principale dei clienti (PF, SP, SC, ASS). Le sottotipologie permettono una classificazione più dettagliata basata su regime contabile e caratteristiche specifiche.
    </div>
    <div class="tipologie-grid">${content}</div>`;
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

// Close modals on overlay click
document.querySelectorAll(".modal-overlay").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("open");
  });
});

// Close modals on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.open").forEach((m) => m.classList.remove("open"));
  }
});
