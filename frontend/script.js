const socket = io();

const MESI = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
const MESI_SHORT = ["Gen","Feb","Mar","Apr","Mag","Giu","Lug","Ago","Set","Ott","Nov","Dic"];
const STATI = { da_fare: "⭕ Da fare", in_corso: "🔄 In corso", completato: "✅ Completato", n_a: "➖ N/A" };
const CATEGORIE = [
  { codice: "IVA", nome: "💰 IVA", icona: "💰", color: "#fbbf24" },
  { codice: "DICHIARAZIONI", nome: "📄 Dichiarazioni", icona: "📄", color: "#5b8df6" },
  { codice: "PREVIDENZA", nome: "🏦 Previdenza", icona: "🏦", color: "#34d399" },
  { codice: "LAVORO", nome: "👔 Lavoro", icona: "👔", color: "#a78bfa" },
  { codice: "TRIBUTI", nome: "🏛️ Tributi", icona: "🏛️", color: "#f87171" },
  { codice: "BILANCIO", nome: "📊 Bilancio", icona: "📊", color: "#22d3ee" },
];

let _rowStore = {};
function storeRow(r) { _rowStore[r.id] = r; return r.id; }
function openAdpById(id) {
  const r = _rowStore[id];
  if (!r) { console.warn("Row not found for id:", id); return; }
  openAdpModal(
    r.id, r.stato, r.data_scadenza || "", r.data_completamento || "",
    r.importo || "", r.note || "",
    r.adempimento_nome + " – " + getPeriodoLabel(r),
    r.is_contabilita || 0, r.has_rate || 0,
    r.importo_saldo || "", r.importo_acconto1 || "", r.importo_acconto2 || "",
    r.importo_iva || "", r.importo_contabilita || "", r.rate_labels || ""
  );
}

let state = {
  page: "dashboard",
  tipologie: [],
  clienti: [],
  adempimenti: [],
  selectedCliente: null,
  anno: new Date().getFullYear(),
  filtri: { stato: "tutti", categoria: "tutti", search: "", adempimento: "" },
  scadenzario: [],
  scadGlobale: [],
  dashStats: null,
  dashSearch: "",
  dashFiltroCategoria: "tutti",
  globalePreFiltroAdp: "",
  _dashRendered: false,
};

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function escAttr(s) { return (s||"").toString().replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

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

socket.on("res:tipologie", ({ success, data }) => { if (success) { state.tipologie = data; populateTipologiaSelect(); } });
socket.on("res:clienti", ({ success, data }) => {
  if (!success) return;
  state.clienti = data;
  if (state._pending === "clienti") { state._pending = null; renderClientiPage(); }
  else if (state._pending === "scadenzario") { state._pending = null; renderScadenzarioPage(); }
  else if (state.page === "clienti") renderClientiPage();
});
socket.on("res:adempimenti", ({ success, data }) => {
  if (success) state.adempimenti = data;
  if (state._pending === "adempimenti") { state._pending = null; renderAdempimentiPage(); }
  else if (state.page === "adempimenti") renderAdempimentiPage();
  const sel = document.getElementById("add-adp-select");
  if (sel && success) { sel.innerHTML = data.map(a => `<option value="${a.id}">[${a.categoria}] ${a.codice} - ${a.nome}</option>`).join(""); updatePeriodoOptions(); }
});
socket.on("res:stats", ({ success, data }) => { if (success) { state.dashStats = data; renderDashboard(data); } });
socket.on("res:scadenzario", ({ success, data }) => { if (success) { state.scadenzario = data; renderScadenzarioTabella(data); } });
socket.on("res:scadenzario_globale", ({ success, data }) => { if (success) { state.scadGlobale = data; renderGlobaleTabella(data); } });
socket.on("res:create:cliente", ({ success }) => { if (success) { closeModal("modal-cliente"); state._pending = "clienti"; socket.emit("get:clienti"); } });
socket.on("res:update:cliente", ({ success }) => { if (success) { closeModal("modal-cliente"); refreshPage(); } });
socket.on("res:delete:cliente", ({ success }) => { if (success) refreshPage(); });
socket.on("res:create:adempimento", ({ success, error }) => {
  if (success) { closeModal("modal-adp-def"); state._pending = "adempimenti"; socket.emit("get:adempimenti"); }
  else showNotif(error, "error");
});
socket.on("res:update:adempimento", ({ success, error }) => {
  if (success) { closeModal("modal-adp-def"); state._pending = "adempimenti"; socket.emit("get:adempimenti"); }
  else showNotif(error, "error");
});
socket.on("res:delete:adempimento", ({ success }) => { if (success) { state._pending = "adempimenti"; socket.emit("get:adempimenti"); } });
socket.on("res:genera:scadenzario", ({ success }) => { if (success && state.selectedCliente) loadScadenzario(); });
socket.on("res:genera:tutti", ({ success }) => { if (success) closeModal("modal-genera-tutti"); });
socket.on("res:copia:scadenzario", ({ success }) => { if (success) { closeModal("modal-copia"); loadScadenzario(); } });
socket.on("res:copia:tutti", ({ success }) => { if (success) closeModal("modal-copia"); });
socket.on("res:update:adempimento_stato", ({ success }) => {
  if (success) {
    closeModal("modal-adempimento");
    if (state.page === "scadenzario") loadScadenzario();
    if (state.page === "scadenzario_globale") loadGlobale();
    if (state.page === "dashboard") socket.emit("get:stats", { anno: state.anno });
  }
});
socket.on("res:delete:adempimento_cliente", ({ success }) => {
  if (success) { closeModal("modal-adempimento"); if (state.page === "scadenzario") loadScadenzario(); if (state.page === "scadenzario_globale") loadGlobale(); }
});
socket.on("res:add:adempimento_cliente", ({ success }) => { if (success) { closeModal("modal-add-adp"); loadScadenzario(); } });

document.querySelectorAll(".nav-item").forEach(el => {
  el.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
    el.classList.add("active");
    renderPage(el.dataset.page);
  });
});

function renderPage(page) {
  state.page = page;
  state._dashRendered = false;
  const titles = { dashboard:"Dashboard", clienti:"Clienti", scadenzario:"Scadenzario Cliente", scadenzario_globale:"Vista Globale", adempimenti:"Adempimenti Fiscali", tipologie:"Tipologie Clienti" };
  document.getElementById("page-title").textContent = titles[page] || page;

  if (page === "dashboard") {
    document.getElementById("topbar-actions").innerHTML = `
      <div class="year-sel"><button onclick="changeAnno(-1)">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnno(1)">&#9654;</button></div>
      <button class="btn btn-orange btn-sm no-print" onclick="openGeneraTutti()">&#9889; Genera Tutti</button>
      <button class="btn btn-cyan btn-sm no-print" onclick="openCopiaTutti()">&#128203; Copia Anno</button>
      <button class="btn btn-print btn-sm" onclick="window.print()">&#128424; Stampa</button>`;
    socket.emit("get:stats", { anno: state.anno });
  } else if (page === "clienti") {
    state._pending = "clienti";
    document.getElementById("topbar-actions").innerHTML = `
      <div class="search-wrap" style="width:280px"><span class="search-icon">&#128269;</span><input class="input" id="global-search-clienti" placeholder="Cerca nome, CF, P.IVA, email..." oninput="applyClientiFiltri()"></div>
      <select class="select" id="filter-tipo" style="width:150px" onchange="applyClientiFiltri()">
        <option value="">Tutte tipologie</option><option value="PF">PF</option><option value="SP">SP</option><option value="SC">SC</option><option value="ASS">ASS</option>
      </select>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()">&#128424; Stampa</button>
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
      <div class="search-wrap" style="width:280px"><span class="search-icon">&#128269;</span><input class="input" id="global-search-adempimenti" placeholder="Cerca codice, nome, categoria..." oninput="applyAdempimentiFiltri()"></div>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()">&#128424; Stampa</button>
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
  document.querySelectorAll(".year-num").forEach(el => el.textContent = state.anno);
  if (state.page === "dashboard") { state._dashRendered = false; socket.emit("get:stats", { anno: state.anno }); }
}

// ============================================================
// DASHBOARD
// ============================================================
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
        <h3 id="dash-adp-count-title" style="white-space:nowrap">Adempimenti ${stats.anno}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1">
          <div id="dash-cat-tabs" style="display:flex;gap:4px;flex-wrap:wrap"></div>
          <div class="search-wrap" style="width:210px;margin-left:auto">
            <span class="search-icon">&#128269;</span>
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
  CATEGORIE.forEach(c => catColor[c.codice] = c.color);

  const adpVis = allAdp.filter(a => {
    if (sc !== "tutti" && a.categoria !== sc) return false;
    if (sq && !a.nome.toLowerCase().includes(sq) && !a.codice.toLowerCase().includes(sq) && !a.categoria.toLowerCase().includes(sq)) return false;
    return true;
  });

  const filtTotale = adpVis.reduce((s,a) => s+a.totale, 0);
  const filtCompletati = adpVis.reduce((s,a) => s+a.completati, 0);
  const filtDaFare = adpVis.reduce((s,a) => s+a.da_fare, 0);
  const filtInCorso = adpVis.reduce((s,a) => s+Math.max(0,a.totale-a.completati-a.da_fare), 0);
  const filtPerc = filtTotale > 0 ? Math.round(filtCompletati/filtTotale*100) : 0;
  const isFiltered = sc !== "tutti" || sq !== "";

  const setEl = (id,v) => { const e=document.getElementById(id); if(e) e.textContent=v; };
  const setW = (id,v) => { const e=document.getElementById(id); if(e) e.style.width=v; };
  const setTxt = (id,v) => { const e=document.getElementById(id); if(e) e.innerHTML=v; };

  setTxt("ds-lbl-tot", `Adempimenti ${stats.anno}${isFiltered ? ' <span style="font-size:9px;color:var(--yellow)">(filtro)</span>' : ""}`);
  setEl("ds-tot", filtTotale);
  setEl("ds-comp", filtCompletati);
  setEl("ds-dafare", filtDaFare);
  setEl("ds-incorso", filtInCorso);
  setEl("ds-na", stats.na || 0);
  setEl("ds-perc", filtPerc + "%");
  setW("ds-prog", filtPerc + "%");

  const title = document.getElementById("dash-adp-count-title");
  if (title) title.innerHTML = `Adempimenti ${stats.anno} <span style="font-size:11px;font-weight:400;color:var(--text3);margin-left:6px">${adpVis.length}/${allAdp.length} — clicca riga per Vista Globale</span>`;

  const tabsEl = document.getElementById("dash-cat-tabs");
  if (tabsEl) {
    tabsEl.innerHTML = [{ codice:"tutti", nome:"Tutti", color:"var(--text2)" }, ...CATEGORIE].map(c => {
      const active = state.dashFiltroCategoria === c.codice;
      const col = c.color || "var(--text2)";
      return `<button class="cat-tab${active ? " cat-tab-active" : ""}" style="${active ? `background:${col}22;border-color:${col};color:${col}` : ""}" onclick="setDashCat('${c.codice}')">${c.nome || c.codice}</button>`;
    }).join("");
  }

  const tbody = document.getElementById("dash-adp-tbody");
  if (!tbody) return;
  if (!adpVis.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--text3)">Nessun adempimento trovato</td></tr>`;
    return;
  }
  tbody.innerHTML = adpVis.map(a => {
    const p = a.totale > 0 ? Math.round(a.completati/a.totale*100) : 0;
    const inCorso = Math.max(0, a.totale - a.completati - a.da_fare);
    const dot = catColor[a.categoria] ? `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${catColor[a.categoria]};margin-right:5px;vertical-align:middle"></span>` : "";
    return `<tr class="adp-dash-row" onclick="goVistaGlobaleAdp('${escAttr(a.nome)}')" title="Clicca per Vista Globale">
      <td><span style="font-family:var(--mono);font-size:10px;color:var(--accent);font-weight:700">${a.codice}</span></td>
      <td style="font-weight:700">${a.nome}</td>
      <td>${dot}<span class="badge b-categoria">${a.categoria}</span></td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;text-align:right">${a.totale}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--green);text-align:right">${a.completati}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--red);text-align:right">${a.da_fare}</td>
      <td style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--yellow);text-align:right">${inCorso > 0 ? inCorso : "-"}</td>
      <td><div style="display:flex;align-items:center;gap:6px;min-width:110px">
        <div class="mini-bar" style="flex:1;height:7px"><div class="mini-fill" style="width:${p}%"></div></div>
        <span style="font-size:10px;font-family:var(--mono);color:var(--text3);min-width:30px;text-align:right">${p}%</span>
      </div></td>
    </tr>`;
  }).join("");
}

function renderDashboard(stats) { if (!state._dashRendered) buildDashboardShell(stats); updateDashboardContent(stats); }
function setDashCat(codice) { state.dashFiltroCategoria = codice; if (state.dashStats) updateDashboardContent(state.dashStats); }
function onDashAdpSearch(val) { state.dashSearch = val; if (state.dashStats) updateDashboardContent(state.dashStats); }
function goVistaGlobaleAdp(nomeAdp) {
  state.globalePreFiltroAdp = nomeAdp;
  document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
  document.querySelector('[data-page="scadenzario_globale"]').classList.add("active");
  renderPage("scadenzario_globale");
}

// ============================================================
// CLIENTI
// ============================================================
const applyClientiFiltriDB = debounce(() => {
  const q = document.getElementById("global-search-clienti")?.value || "";
  const t = document.getElementById("filter-tipo")?.value || "";
  socket.emit("get:clienti", { search: q, tipologia: t });
}, 300);
function applyClientiFiltri() { applyClientiFiltriDB(); }
function renderClientiPage() { renderClientiTabella(state.clienti); }
function renderClientiTabella(clienti) {
  const tbody = clienti.length ? clienti.map(c => `<tr>
    <td><strong>${c.nome}</strong></td>
    <td><span class="badge b-${(c.tipologia_codice||"").toLowerCase()}">${c.tipologia_codice||"-"}</span></td>
    <td class="td-dim">${c.sottotipologia_nome||"-"}</td>
    <td class="td-mono td-dim">${c.codice_fiscale||c.partita_iva||"-"}</td>
    <td class="td-dim">${c.email||"-"}</td>
    <td class="td-dim">${c.telefono||"-"}</td>
    <td class="col-actions no-print"><div style="display:flex;gap:5px">
      <button class="btn btn-sm btn-secondary" onclick="editCliente(${c.id})">&#9999;</button>
      <button class="btn btn-sm btn-success" onclick="goScadenzario(${c.id})">&#128197;</button>
      <button class="btn btn-sm btn-danger" onclick="deleteCliente(${c.id})">&#128465;</button>
    </div></td>
  </tr>`).join("") : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">&#128101;</div><p>Nessun cliente trovato</p></div></td></tr>`;
  document.getElementById("content").innerHTML = `
    <div class="print-header"><strong>Studio Commerciale - Elenco Clienti</strong><br>Stampa: ${new Date().toLocaleDateString("it-IT")} - Tot: ${clienti.length}</div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Clienti (${clienti.length})</h3></div>
      <table><thead><tr><th>Nome</th><th>Tipo</th><th>Sottotipo</th><th>CF / P.IVA</th><th>Email</th><th>Telefono</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>`;
}

// ============================================================
// SCADENZARIO
// ============================================================
function renderScadenzarioPage() {
  const opts = state.clienti.map(c =>
    `<option value="${c.id}" ${state.selectedCliente?.id===c.id?"selected":""}>[${c.tipologia_codice}] ${c.nome}</option>`
  ).join("");
  document.getElementById("topbar-actions").innerHTML = `
    <select class="select" id="sel-cliente" style="width:260px" onchange="onClienteChange()">
      <option value="">-- Seleziona Cliente --</option>${opts}
    </select>
    <div class="year-sel"><button onclick="changeAnnoScad(-1)">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnnoScad(1)">&#9654;</button></div>
    <div class="search-wrap" style="width:200px"><span class="search-icon">&#128269;</span><input class="input" id="scad-search" placeholder="Cerca adempimento..." oninput="applyScadSearch()"></div>`;
  if (state.selectedCliente) loadScadenzario();
  else document.getElementById("content").innerHTML = `<div class="empty"><div class="empty-icon">&#128197;</div><p>Seleziona un cliente</p></div>`;
}
function onClienteChange() {
  const id = parseInt(document.getElementById("sel-cliente").value);
  state.selectedCliente = state.clienti.find(c => c.id === id) || null;
  if (state.selectedCliente) loadScadenzario();
}
function changeAnnoScad(d) {
  state.anno += d;
  document.querySelectorAll(".year-num").forEach(el => el.textContent = state.anno);
  if (state.selectedCliente) loadScadenzario();
}
function loadScadenzario() {
  const sv = document.getElementById("scad-search")?.value || "";
  const st = document.getElementById("f-stato")?.value || "tutti";
  socket.emit("get:scadenzario", { id_cliente: state.selectedCliente.id, anno: state.anno, filtro_stato: st, filtro_adempimento: sv });
}
const applyScadSearchDB = debounce(loadScadenzario, 300);
function applyScadSearch() { applyScadSearchDB(); }
function applyScadFiltri() { loadScadenzario(); }
function resetScadFiltri() {
  if (document.getElementById("f-stato")) document.getElementById("f-stato").value = "tutti";
  if (document.getElementById("scad-search")) document.getElementById("scad-search").value = "";
  loadScadenzario();
}

function getPeriodoLabel(r) {
  if (r.scadenza_tipo === "trimestrale") {
    const m = { 1:"Gen-Mar", 2:"Apr-Giu", 3:"Lug-Set", 4:"Ott-Dic" };
    return `${r.trimestre}° Trim. (${m[r.trimestre]||""})`;
  }
  if (r.scadenza_tipo === "semestrale") return r.semestre === 1 ? "1° Sem. (Gen-Giu)" : "2° Sem. (Lug-Dic)";
  if (r.scadenza_tipo === "mensile") return MESI[(r.mese||1)-1] || "-";
  return "Annuale";
}

function getPeriodoShort(r) {
  if (r.scadenza_tipo === "trimestrale") return `T${r.trimestre}`;
  if (r.scadenza_tipo === "semestrale") return r.semestre === 1 ? "S1" : "S2";
  if (r.scadenza_tipo === "mensile") return MESI_SHORT[(r.mese||1)-1];
  return "Ann.";
}

// ─── Render importo compatto per celle multi-riga ─────────────────────────
function renderImportoCellCompact(r) {
  if (r.is_contabilita || parseInt(r.is_contabilita) === 1) {
    const iva = r.importo_iva ? `€${parseFloat(r.importo_iva).toFixed(2)}` : null;
    const cont = r.importo_contabilita ? `€${parseFloat(r.importo_contabilita).toFixed(2)}` : null;
    if (!iva && !cont) return '<span style="color:var(--text3);font-size:10px">—</span>';
    return `<div class="importi-cell">${iva ? `<div class="imp-row"><span class="imp-lbl">IVA:</span><span class="imp-val">${iva}</span></div>` : ""}${cont ? `<div class="imp-row"><span class="imp-lbl">Cont.:</span><span class="imp-val">${cont}</span></div>` : ""}</div>`;
  }
  if (r.has_rate || parseInt(r.has_rate) === 1) {
    let labels = ["Saldo","1°Acc.","2°Acc."];
    try { if (r.rate_labels) labels = JSON.parse(r.rate_labels); } catch(e) {}
    const s = r.importo_saldo ? `€${parseFloat(r.importo_saldo).toFixed(2)}` : null;
    const a1 = r.importo_acconto1 ? `€${parseFloat(r.importo_acconto1).toFixed(2)}` : null;
    const a2 = r.importo_acconto2 ? `€${parseFloat(r.importo_acconto2).toFixed(2)}` : null;
    if (!s && !a1 && !a2) return '<span style="color:var(--text3);font-size:10px">—</span>';
    return `<div class="importi-cell">${s ? `<div class="imp-row"><span class="imp-lbl">${labels[0]}:</span><span class="imp-val">${s}</span></div>` : ""}${a1 ? `<div class="imp-row"><span class="imp-lbl">${labels[1]}:</span><span class="imp-val">${a1}</span></div>` : ""}${a2 ? `<div class="imp-row"><span class="imp-lbl">${labels[2]}:</span><span class="imp-val">${a2}</span></div>` : ""}</div>`;
  }
  return r.importo ? `<span style="color:var(--green);font-family:var(--mono);font-size:11px">€ ${parseFloat(r.importo).toFixed(2)}</span>` : '<span style="color:var(--text3);font-size:10px">—</span>';
}

// ─── Render importo completo per modal e vista singola ────────────────────
function renderImportoCell(r) {
  if (r.is_contabilita) {
    const iva = r.importo_iva ? `€${parseFloat(r.importo_iva).toFixed(2)}` : "-";
    const cont = r.importo_contabilita ? `€${parseFloat(r.importo_contabilita).toFixed(2)}` : "-";
    return `<div class="importi-cell"><div class="imp-row"><span class="imp-lbl">IVA:</span><span class="imp-val">${iva}</span></div><div class="imp-row"><span class="imp-lbl">Cont.:</span><span class="imp-val">${cont}</span></div></div>`;
  }
  if (r.has_rate) {
    let labels = ["Saldo","1°Acc.","2°Acc."];
    try { if (r.rate_labels) labels = JSON.parse(r.rate_labels); } catch(e) {}
    const s = r.importo_saldo ? `€${parseFloat(r.importo_saldo).toFixed(2)}` : "-";
    const a1 = r.importo_acconto1 ? `€${parseFloat(r.importo_acconto1).toFixed(2)}` : "-";
    const a2 = r.importo_acconto2 ? `€${parseFloat(r.importo_acconto2).toFixed(2)}` : "-";
    return `<div class="importi-cell"><div class="imp-row"><span class="imp-lbl">${labels[0]}:</span><span class="imp-val">${s}</span></div><div class="imp-row"><span class="imp-lbl">${labels[1]}:</span><span class="imp-val">${a1}</span></div><div class="imp-row"><span class="imp-lbl">${labels[2]}:</span><span class="imp-val">${a2}</span></div></div>`;
  }
  return r.importo ? `€ ${parseFloat(r.importo).toFixed(2)}` : "-";
}

// ─── Render riga periodo con TUTTI i dati (per multi-periodo singolo cliente) ─
function renderPeriodoRigaCompleta(r, labelPeriodo) {
  const stato = r.stato || "da_fare";
  const importoHtml = renderImportoCellCompact(r);
  return `<div class="periodo-row-full s-${stato}" onclick="openAdpById(${r.id})" style="cursor:pointer">
    <div class="periodo-row-header">
      <span class="badge b-${stato}" style="font-size:9px;min-width:55px;text-align:center">${getPeriodoShort(r)}</span>
      <span class="badge b-${stato}" style="font-size:9px">${STATI[stato]||stato}</span>
      ${r.data_scadenza ? `<span style="font-size:10px;color:var(--text3);font-family:var(--mono)">📅 ${r.data_scadenza}</span>` : ""}
      ${r.data_completamento ? `<span style="font-size:10px;color:var(--green);font-family:var(--mono)">✅ ${r.data_completamento}</span>` : ""}
    </div>
    <div class="periodo-row-body">
      <div class="periodo-importo-wrap">${importoHtml}</div>
      ${r.note ? `<div class="periodo-note-full">📝 ${r.note}</div>` : ""}
    </div>
  </div>`;
}

function renderScadenzarioTabella(righe) {
  _rowStore = {};
  righe.forEach(r => storeRow(r));
  const c = state.selectedCliente;
  const tot = righe.length, comp = righe.filter(r=>r.stato==="completato").length;
  const daF = righe.filter(r=>r.stato==="da_fare").length, inC = righe.filter(r=>r.stato==="in_corso").length, na = righe.filter(r=>r.stato==="n_a").length;
  const perc = tot > 0 ? Math.round(comp/tot*100) : 0;

  const grouped = {};
  righe.forEach(r => {
    if (!grouped[r.id_adempimento]) grouped[r.id_adempimento] = [];
    grouped[r.id_adempimento].push(r);
  });
  Object.values(grouped).forEach(rows => rows.sort((a,b) =>
    (a.trimestre||0)-(b.trimestre||0) || (a.semestre||0)-(b.semestre||0) || (a.mese||0)-(b.mese||0)
  ));

  const tbody = Object.entries(grouped).map(([adpId, rows]) => {
    const r0 = rows[0];
    const isMulti = r0.scadenza_tipo === "mensile" || r0.scadenza_tipo === "trimestrale" || r0.scadenza_tipo === "semestrale";
    const totR = rows.length, compR = rows.filter(x=>x.stato==="completato").length;
    const percR = totR > 0 ? Math.round(compR/totR*100) : 0;

    const flagsBadge = (r0.is_contabilita ? `<span class="badge" style="background:var(--cyan-dim);color:var(--cyan);font-size:9px">CONT.</span>` : "") +
      (r0.has_rate ? `<span class="badge" style="background:var(--green-dim);color:var(--green);font-size:9px">RATE</span>` : "");

    const adpLabel = `<td style="border-right:1px solid var(--border);font-weight:700;vertical-align:top;padding-top:12px;min-width:180px">
      <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r0.codice}</span><br>
      <span style="font-size:12px">${r0.adempimento_nome}</span><br>
      <span class="badge b-categoria" style="margin-top:4px">${r0.categoria||"-"}</span>
      ${flagsBadge ? `<br><div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">${flagsBadge}</div>` : ""}
    </td>`;

    if (isMulti) {
      // Per tutti i tipi multi-periodo: mostra ogni periodo con tutti i dati
      const periodiHtml = rows.map(rx => renderPeriodoRigaCompleta(rx, getPeriodoLabel(rx))).join("");
      return `<tr>${adpLabel}<td colspan="5">
        <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;color:var(--text3);margin-bottom:6px">
              ${r0.scadenza_tipo === "semestrale" ? "2 semestri" : r0.scadenza_tipo === "trimestrale" ? "4 trimestri" : "12 mesi"} — clicca un periodo per modificare
            </div>
            <div class="periodi-lista">${periodiHtml}</div>
          </div>
          <div style="text-align:right;min-width:80px">
            <div style="font-size:11px;color:var(--text2);margin-bottom:4px">${compR}/${totR}</div>
            <div class="prog-bar" style="width:80px"><div class="prog-fill green" style="width:${percR}%"></div></div>
            <div style="font-size:10px;color:var(--text3);margin-top:3px">${percR}%</div>
          </div>
        </div>
      </td></tr>`;
    }

    return rows.map((rx, idx) => {
      const periodo = getPeriodoLabel(rx);
      return `<tr class="clickable s-${rx.stato}" onclick="openAdpById(${rx.id})">${idx===0 ? adpLabel : '<td style="border-right:1px solid var(--border)"></td>'}
        <td>${periodo}</td>
        <td><span class="badge b-${rx.stato}">${STATI[rx.stato]||rx.stato}</span></td>
        <td>${renderImportoCell(rx)}</td>
        <td class="td-mono td-dim" style="font-size:11px">${rx.data_scadenza||"-"}</td>
        <td class="td-mono td-dim" style="font-size:11px">${rx.data_completamento||"-"}</td>
        <td class="td-dim" style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis">${rx.note||""}</td>
      </tr>`;
    }).join("");
  }).join("") || `<tr><td colspan="7"><div class="empty"><div class="empty-icon">&#128203;</div><p>Nessun adempimento. Clicca Genera.</p></div></td></tr>`;

  document.getElementById("content").innerHTML = `
    <div class="print-header"><strong>Studio Commerciale - Scadenzario</strong><br>Cliente: <strong>${c.nome}</strong> | Anno: <strong>${state.anno}</strong> | Stampa: ${new Date().toLocaleDateString("it-IT")}</div>
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;flex-wrap:wrap">
      <div><div style="font-size:18px;font-weight:800">${c.nome}</div><div style="font-size:12px;color:var(--text2)">${c.tipologia_nome||""}${c.sottotipologia_nome?" · "+c.sottotipologia_nome:""}</div></div>
      <div style="flex:1"></div>
      <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-purple" onclick="openAddAdp(${c.id})">+ Adempimento</button>
        <button class="btn btn-sm btn-secondary" onclick="openCopia(${c.id})">Copia anno</button>
        <button class="btn btn-sm btn-primary" onclick="generaScad(${c.id})">Genera ${state.anno}</button>
        <button class="btn btn-print btn-sm" onclick="window.print()">Stampa</button>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Totale</div><div class="stat-value v-blue">${tot}</div></div>
      <div class="stat-card"><div class="stat-label">Completati</div><div class="stat-value v-green">${comp}</div><div class="prog-bar"><div class="prog-fill green" style="width:${perc}%"></div></div></div>
      <div class="stat-card"><div class="stat-label">Da Fare</div><div class="stat-value v-yellow">${daF}</div></div>
      <div class="stat-card"><div class="stat-label">In Corso</div><div class="stat-value v-purple">${inC}</div></div>
      <div class="stat-card"><div class="stat-label">N/A</div><div class="stat-value" style="color:var(--text3)">${na}</div></div>
    </div>
    <div class="filtri-bar no-print">
      <label>Filtra:</label>
      <select class="select" style="width:150px" id="f-stato" onchange="applyScadFiltri()">
        <option value="tutti">Tutti</option><option value="da_fare">Da fare</option>
        <option value="in_corso">In corso</option><option value="completato">Completato</option><option value="n_a">N/A</option>
      </select>
      <button class="btn btn-sm btn-secondary" onclick="resetScadFiltri()">Reset</button>
    </div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Scadenzario ${state.anno}</h3></div>
      <table><thead><tr><th>Adempimento</th><th>Periodo</th><th>Stato</th><th>Importo</th><th>Scadenza</th><th>Completato</th><th>Note</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>`;
  if (document.getElementById("f-stato")) document.getElementById("f-stato").value = state.filtri.stato;
}

function generaScad(id) { if (confirm(`Generare scadenzario ${state.anno}?`)) socket.emit("genera:scadenzario", { id_cliente: id, anno: state.anno }); }
function openGeneraTutti() { document.getElementById("genera-tutti-anno").value = state.anno; openModal("modal-genera-tutti"); }
function eseguiGeneraTutti() { const anno = parseInt(document.getElementById("genera-tutti-anno").value); if (!anno) return; socket.emit("genera:tutti", { anno }); }
function openCopiaTutti() {
  document.getElementById("copia-cliente-id").value = "";
  document.getElementById("copia-modalita").value = "tutti";
  document.getElementById("copia-info").innerHTML = "Copia per tutti i clienti.";
  document.getElementById("copia-da").value = state.anno - 1;
  document.getElementById("copia-a").value = state.anno;
  openModal("modal-copia");
}
function eseguiCopia() {
  const modalita = document.getElementById("copia-modalita").value;
  const anno_da = parseInt(document.getElementById("copia-da").value);
  const anno_a = parseInt(document.getElementById("copia-a").value);
  if (modalita === "tutti") socket.emit("copia:tutti", { anno_da, anno_a });
  else socket.emit("copia:scadenzario", { id_cliente: parseInt(document.getElementById("copia-cliente-id").value), anno_da, anno_a });
}

// ============================================================
// VISTA GLOBALE — con tutti i dati dettagliati per ogni periodo
// ============================================================
function renderGlobalePage() {
  const preSearch = state.globalePreFiltroAdp || "";
  document.getElementById("topbar-actions").innerHTML = `
    <div class="search-wrap" style="width:260px"><span class="search-icon">&#128269;</span>
      <input class="input" id="global-search-globale" placeholder="Cerca cliente, adempimento..."
        value="${escAttr(preSearch)}" oninput="onGlobaleSearchInput(this.value)">
    </div>
    <div class="year-sel"><button onclick="changeAnnoGlobale(-1)">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnnoGlobale(1)">&#9654;</button></div>
    ${preSearch ? `<button class="btn btn-xs btn-secondary no-print" onclick="clearGlobalePrefiltro()">✕ "${escAttr(preSearch)}"</button>` : ""}
    <button class="btn btn-print btn-sm no-print" onclick="window.print()">Stampa</button>`;
  renderGlobaleFiltri(preSearch);
  loadGlobale(preSearch);
}
function clearGlobalePrefiltro() { state.globalePreFiltroAdp = ""; renderGlobalePage(); }
function onGlobaleSearchInput(val) { state.globalePreFiltroAdp = val; applyGlobaleSearchDB(); }
function loadGlobale(searchOverride) {
  const search = searchOverride !== undefined ? searchOverride : document.getElementById("global-search-globale")?.value || "";
  socket.emit("get:scadenzario_globale", { anno: state.anno, filtro_stato: state.filtri.stato, filtro_categoria: state.filtri.categoria, search });
}
function changeAnnoGlobale(d) { state.anno += d; document.querySelectorAll(".year-num").forEach(el => el.textContent = state.anno); loadGlobale(); }
function renderGlobaleFiltri(preSearch) {
  document.getElementById("content").innerHTML = `
    <div class="print-header"><strong>Studio Commerciale - Vista Globale ${state.anno}</strong><br>Stampa: ${new Date().toLocaleDateString("it-IT")}</div>
    ${preSearch ? `<div class="infobox no-print" style="margin-bottom:12px">Filtro attivo: <strong>${escAttr(preSearch)}</strong></div>` : ""}
    <div class="filtri-bar no-print">
      <label>Stato:</label>
      <select class="select" style="width:150px" id="fg-stato" onchange="applyGlobaleFiltri()">
        <option value="tutti">Tutti</option><option value="da_fare">Da fare</option>
        <option value="in_corso">In corso</option><option value="completato">Completato</option><option value="n_a">N/A</option>
      </select>
      <label>Categoria:</label>
      <select class="select" style="width:160px" id="fg-categoria" onchange="applyGlobaleFiltri()">
        <option value="tutti">Tutte</option>
        ${CATEGORIE.map(c => `<option value="${c.codice}">${c.nome}</option>`).join("")}
        <option value="TUTTI">Tutti</option>
      </select>
    </div>
    <div id="globale-content"><div class="empty">Caricamento...</div></div>`;
  if (document.getElementById("fg-stato")) document.getElementById("fg-stato").value = state.filtri.stato;
  if (document.getElementById("fg-categoria")) document.getElementById("fg-categoria").value = state.filtri.categoria;
}
function applyGlobaleFiltri() {
  state.filtri.stato = document.getElementById("fg-stato")?.value || "tutti";
  state.filtri.categoria = document.getElementById("fg-categoria")?.value || "tutti";
  loadGlobale();
}
const applyGlobaleSearchDB = debounce(loadGlobale, 300);

function renderGlobaleTabella(righe) {
  // PRIMA store tutte le righe
  righe.forEach(r => storeRow(r));

  const container = document.getElementById("globale-content");
  if (!container) return;

  const perCliente = {};
  righe.forEach(r => {
    if (!perCliente[r.id_cliente]) perCliente[r.id_cliente] = { id: r.id_cliente, nome: r.cliente_nome, tipo: r.tipologia_codice, righe: [] };
    perCliente[r.id_cliente].righe.push(r);
  });

  if (!Object.keys(perCliente).length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">&#128203;</div><p>Nessun risultato</p></div>`;
    return;
  }

  const html = Object.values(perCliente).map(cl => {
    const comp = cl.righe.filter(r => r.stato === "completato").length;
    const daF = cl.righe.filter(r => r.stato === "da_fare").length;
    const inC = cl.righe.filter(r => r.stato === "in_corso").length;
    const na = cl.righe.filter(r => r.stato === "n_a").length;
    const perc = cl.righe.length > 0 ? Math.round(comp/cl.righe.length*100) : 0;

    // Raggruppa per adempimento
    const groupedAdp = {};
    cl.righe.forEach(r => {
      if (!groupedAdp[r.id_adempimento]) groupedAdp[r.id_adempimento] = {
        nome: r.adempimento_nome, codice: r.codice, categoria: r.categoria,
        scad: r.scadenza_tipo, is_contabilita: r.is_contabilita, has_rate: r.has_rate,
        rate_labels: r.rate_labels, totale: 0, completati: 0, da_fare: 0, in_corso: 0, righe: []
      };
      groupedAdp[r.id_adempimento].totale++;
      if (r.stato === "completato") groupedAdp[r.id_adempimento].completati++;
      if (r.stato === "da_fare") groupedAdp[r.id_adempimento].da_fare++;
      if (r.stato === "in_corso") groupedAdp[r.id_adempimento].in_corso++;
      groupedAdp[r.id_adempimento].righe.push(r);
    });

    const adpRows = Object.values(groupedAdp).map(adp => {
      const p2 = adp.totale > 0 ? Math.round(adp.completati/adp.totale*100) : 0;
      const isMulti = adp.scad === "mensile" || adp.scad === "trimestrale" || adp.scad === "semestrale";

      const flagsBadge = (adp.is_contabilita ? `<span class="badge" style="background:var(--cyan-dim);color:var(--cyan);font-size:9px">CONT.</span>` : "") +
        (adp.has_rate ? `<span class="badge" style="background:var(--green-dim);color:var(--green);font-size:9px">RATE</span>` : "");

      let periodoCell;
      if (isMulti) {
        const sorted = adp.righe.slice().sort((a,b) =>
          adp.scad === "mensile" ? (a.mese||0)-(b.mese||0) :
          adp.scad === "trimestrale" ? (a.trimestre||0)-(b.trimestre||0) :
          (a.semestre||0)-(b.semestre||0)
        );
        // Vista espansa con tutti i dati per ogni periodo
        periodoCell = `<div class="periodi-globale-wrap">${sorted.map(rx => {
          const importoHtml = renderImportoCellCompact(rx);
          return `<div class="periodo-globale-row s-${rx.stato}" onclick="openAdpById(${rx.id})">
            <div class="pga-label">
              <span class="badge b-${rx.stato}" style="font-size:8px;min-width:42px;text-align:center">${getPeriodoShort(rx)}</span>
            </div>
            <div class="pga-stato">
              <span class="badge b-${rx.stato}" style="font-size:8px">${STATI[rx.stato]||rx.stato}</span>
            </div>
            <div class="pga-importo">${importoHtml}</div>
            <div class="pga-date">
              ${rx.data_scadenza ? `<span title="Scadenza" style="color:var(--text3);font-size:9px;font-family:var(--mono)">📅${rx.data_scadenza}</span>` : ""}
              ${rx.data_completamento ? `<span title="Completato" style="color:var(--green);font-size:9px;font-family:var(--mono)">✅${rx.data_completamento}</span>` : ""}
            </div>
            <div class="pga-note">${rx.note ? `<span style="font-size:9px;color:var(--text2)">📝 ${rx.note}</span>` : ""}</div>
          </div>`;
        }).join("")}</div>`;
      } else {
        const rx = adp.righe[0];
        const importoHtml = renderImportoCellCompact(rx);
        periodoCell = `<div class="periodo-globale-row s-${rx.stato}" onclick="openAdpById(${rx.id})" style="cursor:pointer">
          <div class="pga-label"><span class="badge b-${rx.stato}" style="font-size:8px">${getPeriodoLabel(rx)}</span></div>
          <div class="pga-stato"><span class="badge b-${rx.stato}" style="font-size:8px">${STATI[rx.stato]||rx.stato}</span></div>
          <div class="pga-importo">${importoHtml}</div>
          <div class="pga-date">
            ${rx.data_scadenza ? `<span style="color:var(--text3);font-size:9px;font-family:var(--mono)">📅 ${rx.data_scadenza}</span>` : ""}
            ${rx.data_completamento ? `<span style="color:var(--green);font-size:9px;font-family:var(--mono)">✅ ${rx.data_completamento}</span>` : ""}
          </div>
          <div class="pga-note">${rx.note ? `<span style="font-size:9px;color:var(--text2)">📝 ${rx.note}</span>` : ""}</div>
        </div>`;
      }

      return `<tr>
        <td class="td-mono" style="font-size:10px;color:var(--accent);white-space:nowrap">${adp.codice}</td>
        <td><strong style="font-size:12px">${adp.nome}</strong>${flagsBadge ? `<div style="margin-top:3px;display:flex;gap:3px">${flagsBadge}</div>` : ""}</td>
        <td><span class="badge b-categoria">${adp.categoria||"-"}</span></td>
        <td style="min-width:280px;padding:6px 14px">${periodoCell}</td>
        <td style="white-space:nowrap">
          <span class="badge b-completato" style="margin-bottom:3px;display:block">✓ ${adp.completati}</span>
          <span class="badge b-da_fare" style="display:block">⭕ ${adp.da_fare}</span>
          ${adp.in_corso > 0 ? `<span class="badge b-in_corso" style="display:block">🔄 ${adp.in_corso}</span>` : ""}
        </td>
        <td><div style="display:flex;align-items:center;gap:6px;min-width:90px">
          <div class="mini-bar" style="width:60px"><div class="mini-fill" style="width:${p2}%"></div></div>
          <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">${p2}%</span>
        </div></td>
      </tr>`;
    }).join("");

    return `<div class="table-wrap" style="margin-bottom:14px">
      <div class="table-header" style="cursor:pointer" onclick="toggleSection(this)">
        <span class="badge b-${(cl.tipo||"").toLowerCase()}" style="margin-right:6px">${cl.tipo}</span>
        <h3>${cl.nome}</h3>
        <div style="display:flex;align-items:center;gap:10px;margin-left:8px">
          <span class="badge b-completato">✓ ${comp}</span>
          <span class="badge b-da_fare">⭕ ${daF}</span>
          ${inC > 0 ? `<span class="badge b-in_corso">🔄 ${inC}</span>` : ""}
          ${na > 0 ? `<span class="badge b-n_a">➖ ${na}</span>` : ""}
        </div>
        <div class="mini-bar" style="width:70px;display:inline-block;margin-left:6px"><div class="mini-fill" style="width:${perc}%"></div></div>
        <span style="font-size:10px;font-family:var(--mono);color:var(--text3);margin-left:4px">${perc}%</span>
        <span class="toggle-arrow" style="margin-left:auto">&#9660;</span>
      </div>
      <div class="section-body">
        <table><thead><tr>
          <th style="width:70px">Codice</th>
          <th>Adempimento</th>
          <th style="width:90px">Categoria</th>
          <th>Periodi / Dati</th>
          <th style="width:90px">Riepilogo</th>
          <th style="width:100px">Avanz.</th>
        </tr></thead>
        <tbody>${adpRows}</tbody></table>
      </div>
    </div>`;
  }).join("");

  container.innerHTML = html;
}

function toggleSection(header) {
  const body = header.nextElementSibling, arrow = header.querySelector(".toggle-arrow");
  if (body.style.display === "none") { body.style.display = ""; if (arrow) arrow.textContent = "▾"; }
  else { body.style.display = "none"; if (arrow) arrow.textContent = "▸"; }
}

// ============================================================
// ADEMPIMENTI
// ============================================================
const applyAdpFiltriDB = debounce(() => {
  const q = document.getElementById("global-search-adempimenti")?.value || "";
  socket.emit("get:adempimenti", { search: q });
}, 300);
function applyAdempimentiFiltri() { applyAdpFiltriDB(); }
function renderAdempimentiPage() { renderAdempimentiTabella(state.adempimenti); }
function renderAdempimentiTabella(adempimenti) {
  const rows = adempimenti.map(a => {
    const flags = [];
    if (a.is_contabilita) flags.push(`<span class="badge" style="background:var(--cyan-dim);color:var(--cyan);font-size:9px">CONT.</span>`);
    if (a.has_rate) flags.push(`<span class="badge" style="background:var(--green-dim);color:var(--green);font-size:9px">RATE</span>`);
    const scadLabel = { annuale:"1x/anno", semestrale:"2x/anno", trimestrale:"4x/anno", mensile:"12x/anno" };
    return `<tr>
      <td><span style="font-family:var(--mono);font-weight:700;color:var(--accent)">${a.codice}</span></td>
      <td><strong>${a.nome}</strong></td>
      <td class="td-dim" style="font-size:12px">${a.descrizione||"-"}</td>
      <td><span class="badge b-categoria">${a.categoria||"-"}</span></td>
      <td><span style="font-family:var(--mono);font-size:11px">${a.scadenza_tipo||"-"}</span></td>
      <td><span class="badge" style="background:var(--accent-dim);color:var(--accent);font-size:10px">${scadLabel[a.scadenza_tipo]||a.scadenza_tipo}</span></td>
      <td>${flags.join(" ")||"-"}</td>
      <td class="col-actions no-print"><div style="display:flex;gap:4px">
        <button class="btn btn-xs btn-secondary" onclick="editAdpDef(${a.id})">Modifica</button>
        <button class="btn btn-xs btn-danger" onclick="deleteAdpDef(${a.id})">Elimina</button>
      </div></td>
    </tr>`;
  }).join("") || `<tr><td colspan="8"><div class="empty">Nessun adempimento trovato</div></td></tr>`;
  document.getElementById("content").innerHTML = `
    <div class="print-header"><strong>Studio Commerciale - Adempimenti</strong><br>Stampa: ${new Date().toLocaleDateString("it-IT")} - Tot: ${adempimenti.length}</div>
    <div class="infobox" style="margin-bottom:16px">Ogni nuovo adempimento viene automaticamente assegnato a tutti i clienti con la categoria corrispondente.</div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Adempimenti (${adempimenti.length})</h3></div>
      <table><thead><tr><th>Codice</th><th>Nome</th><th>Descrizione</th><th>Categoria</th><th>Cadenza</th><th>Periodi/anno</th><th>Flags</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

// ============================================================
// TIPOLOGIE
// ============================================================
function renderTipologiePage() {
  const colors = { PF:"var(--accent)", SP:"var(--purple)", SC:"var(--green)", ASS:"var(--yellow)" };
  const cards = state.tipologie.map(t => {
    const color = colors[t.codice]||"var(--accent)";
    const subs = (t.sottotipologie||[]).map(s => {
      if (s.is_separator) return `<div style="font-size:10px;color:var(--text3);margin:8px 0 4px;font-weight:700;text-transform:uppercase">${s.nome}</div>`;
      return `<div style="font-size:12px;padding:4px 8px;background:var(--surface2);border-radius:5px;border-left:2px solid ${color};margin-bottom:4px">${s.nome}</div>`;
    }).join("");
    return `<div class="tipo-card"><div class="tipo-codice" style="color:${color}">${t.codice}</div><div class="tipo-nome">${t.nome}</div><div class="tipo-desc">${t.descrizione||""}</div><div class="divider"></div>${subs}</div>`;
  }).join("");
  document.getElementById("content").innerHTML = `<div class="tipo-cards">${cards}</div>`;
}

// ============================================================
// MODAL CLIENTE
// ============================================================
function populateTipologiaSelect() {
  const sel = document.getElementById("c-tipologia");
  if (!sel) return;
  sel.innerHTML = state.tipologie.map(t => `<option value="${t.id}">${t.codice} - ${t.nome}</option>`).join("");
  onTipologiaChange();
}
function onTipologiaChange() {
  const tipId = parseInt(document.getElementById("c-tipologia")?.value);
  const tip = state.tipologie.find(t => t.id === tipId);
  const sel = document.getElementById("c-sottotipologia");
  if (!sel || !tip) return;
  sel.innerHTML = '<option value="">-- Nessuna --</option>' + (tip.sottotipologie||[]).map(s => {
    if (s.is_separator) return `<option disabled>-- ${s.nome} --</option>`;
    return `<option value="${s.id}">${s.nome}</option>`;
  }).join("");
}
function renderCategorieSelect(attuali=[]) {
  const container = document.getElementById("categorie-attive");
  if (!container) return;
  container.innerHTML = CATEGORIE.map(cat =>
    `<label style="display:inline-flex;align-items:center;gap:8px;margin:4px 8px 4px 0;padding:8px 12px;background:var(--surface2);border-radius:var(--r-sm);cursor:pointer;border:1px solid ${attuali.includes(cat.codice)?"var(--accent)":"var(--border)"};transition:all 0.12s"><input type="checkbox" value="${cat.codice}" ${attuali.includes(cat.codice)?"checked":""} style="accent-color:var(--accent)" onchange="this.parentElement.style.borderColor=this.checked?'var(--accent)':'var(--border)'"><span>${cat.icona} ${cat.nome}</span></label>`
  ).join("");
}
function getSelectedCategorie() {
  return Array.from(document.querySelectorAll("#categorie-attive input")).filter(cb => cb.checked).map(cb => cb.value);
}
function openNuovoCliente() {
  document.getElementById("modal-cliente-title").textContent = "Nuovo Cliente";
  document.getElementById("cliente-id").value = "";
  ["c-nome","c-cf","c-piva","c-email","c-tel","c-indirizzo","c-note"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  renderCategorieSelect(["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]);
  populateTipologiaSelect();
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
    const cat = JSON.parse(data.categorie_attive || '["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]');
    renderCategorieSelect(cat);
    populateTipologiaSelect();
    document.getElementById("c-tipologia").value = data.id_tipologia;
    onTipologiaChange();
    setTimeout(() => { document.getElementById("c-sottotipologia").value = data.id_sottotipologia || ""; }, 60);
    openModal("modal-cliente");
  });
  socket.emit("get:cliente", { id });
}
function saveCliente() {
  const id = document.getElementById("cliente-id").value;
  const data = {
    nome: document.getElementById("c-nome").value.trim(),
    id_tipologia: parseInt(document.getElementById("c-tipologia").value),
    id_sottotipologia: document.getElementById("c-sottotipologia").value || null,
    codice_fiscale: document.getElementById("c-cf").value.trim().toUpperCase() || null,
    partita_iva: document.getElementById("c-piva").value.trim() || null,
    email: document.getElementById("c-email").value.trim() || null,
    telefono: document.getElementById("c-tel").value.trim() || null,
    indirizzo: document.getElementById("c-indirizzo").value.trim() || null,
    note: document.getElementById("c-note").value.trim() || null,
    categorie_attive: getSelectedCategorie(),
  };
  if (!data.nome) { showNotif("Il nome è obbligatorio", "error"); return; }
  if (!data.categorie_attive.length) { showNotif("Seleziona almeno una categoria", "error"); return; }
  if (id) { data.id = parseInt(id); socket.emit("update:cliente", data); }
  else socket.emit("create:cliente", data);
}
function deleteCliente(id) { if (confirm("Eliminare questo cliente?")) socket.emit("delete:cliente", { id }); }
function goScadenzario(id) {
  const c = state.clienti.find(x => x.id === id);
  if (c) {
    state.selectedCliente = c;
    document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
    document.querySelector('[data-page="scadenzario"]').classList.add("active");
    renderPage("scadenzario");
  } else {
    state._gotoClienteId = id;
    state._pending = "scadenzario";
    socket.emit("get:clienti");
  }
}

// ============================================================
// MODAL ADEMPIMENTO STATO
// ============================================================
function openAdpModal(id, stato, scadenza, dataComp, importo, note, nome, isContabilita, hasRate, impSaldo, impAcc1, impAcc2, impIva, impCont, rateLabels) {
  document.getElementById("adp-id").value = id;
  document.getElementById("adp-stato").value = stato;
  document.getElementById("adp-scadenza").value = scadenza || "";
  document.getElementById("adp-data").value = dataComp || "";
  document.getElementById("adp-note").value = note || "";
  document.getElementById("adp-nome-label").textContent = nome || "";
  document.getElementById("adp-is-contabilita").value = isContabilita || 0;
  document.getElementById("adp-has-rate").value = hasRate || 0;
  document.getElementById("adp-rate-labels-json").value = rateLabels || "";
  const showNorm = !isContabilita && !hasRate;
  document.getElementById("sect-importo-normale").style.display = showNorm ? "" : "none";
  document.getElementById("sect-importo-rate").style.display = hasRate ? "" : "none";
  document.getElementById("sect-importo-cont").style.display = isContabilita ? "" : "none";
  if (showNorm) document.getElementById("adp-importo").value = importo || "";
  if (hasRate) {
    let labels = ["Saldo (€)","1° Acconto (€)","2° Acconto (€)"];
    try { if (rateLabels) { const l = JSON.parse(rateLabels); labels = l.map(x => x+" (€)"); } } catch(e) {}
    document.getElementById("rate-l0").textContent = labels[0];
    document.getElementById("rate-l1").textContent = labels[1];
    document.getElementById("rate-l2").textContent = labels[2];
    document.getElementById("adp-imp-saldo").value = impSaldo || "";
    document.getElementById("adp-imp-acc1").value = impAcc1 || "";
    document.getElementById("adp-imp-acc2").value = impAcc2 || "";
  }
  if (isContabilita) {
    document.getElementById("adp-imp-iva").value = impIva || "";
    document.getElementById("adp-imp-cont").value = impCont || "";
  }
  openModal("modal-adempimento");
}
function saveAdpStato() {
  const isC = parseInt(document.getElementById("adp-is-contabilita").value);
  const hasR = parseInt(document.getElementById("adp-has-rate").value);
  const payload = {
    id: parseInt(document.getElementById("adp-id").value),
    stato: document.getElementById("adp-stato").value,
    data_scadenza: document.getElementById("adp-scadenza").value || null,
    data_completamento: document.getElementById("adp-data").value || null,
    note: document.getElementById("adp-note").value || null,
    importo: null, importo_saldo: null, importo_acconto1: null, importo_acconto2: null, importo_iva: null, importo_contabilita: null,
  };
  if (!isC && !hasR) payload.importo = document.getElementById("adp-importo").value || null;
  if (hasR) {
    payload.importo_saldo = document.getElementById("adp-imp-saldo").value || null;
    payload.importo_acconto1 = document.getElementById("adp-imp-acc1").value || null;
    payload.importo_acconto2 = document.getElementById("adp-imp-acc2").value || null;
  }
  if (isC) {
    payload.importo_iva = document.getElementById("adp-imp-iva").value || null;
    payload.importo_contabilita = document.getElementById("adp-imp-cont").value || null;
  }
  socket.emit("update:adempimento_stato", payload);
}
function deleteAdpCliente() { if (confirm("Rimuovere questo adempimento?")) socket.emit("delete:adempimento_cliente", { id: parseInt(document.getElementById("adp-id").value) }); }

// ============================================================
// MODAL ADEMPIMENTO DEF
// ============================================================
function onAdpFlagsChange() {
  const hasCont = document.getElementById("adp-def-contabilita").checked;
  const hasRate = document.getElementById("adp-def-rate").checked;
  if (hasCont) document.getElementById("adp-def-rate").checked = false;
  if (hasRate) document.getElementById("adp-def-contabilita").checked = false;
  document.getElementById("sect-rate-labels").style.display = document.getElementById("adp-def-rate").checked ? "" : "none";
}
function openNuovoAdpDef() {
  document.getElementById("modal-adp-def-title").textContent = "Nuovo Adempimento";
  ["adp-def-id","adp-def-codice","adp-def-nome","adp-def-desc"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("adp-def-scadenza").value = "annuale";
  document.getElementById("adp-def-categoria").value = "TUTTI";
  document.getElementById("adp-def-contabilita").checked = false;
  document.getElementById("adp-def-rate").checked = false;
  document.getElementById("adp-rate-l1").value = "Saldo";
  document.getElementById("adp-rate-l2").value = "1° Acconto";
  document.getElementById("adp-rate-l3").value = "2° Acconto";
  document.getElementById("sect-rate-labels").style.display = "none";
  openModal("modal-adp-def");
}
function editAdpDef(id) {
  const a = state.adempimenti.find(x => x.id === id);
  if (!a) return;
  document.getElementById("modal-adp-def-title").textContent = "Modifica Adempimento";
  document.getElementById("adp-def-id").value = a.id;
  document.getElementById("adp-def-codice").value = a.codice;
  document.getElementById("adp-def-nome").value = a.nome;
  document.getElementById("adp-def-desc").value = a.descrizione || "";
  document.getElementById("adp-def-scadenza").value = a.scadenza_tipo || "annuale";
  document.getElementById("adp-def-categoria").value = a.categoria || "TUTTI";
  document.getElementById("adp-def-contabilita").checked = !!a.is_contabilita;
  document.getElementById("adp-def-rate").checked = !!a.has_rate;
  if (a.rate_labels) { try { const l = JSON.parse(a.rate_labels); document.getElementById("adp-rate-l1").value = l[0]||"Saldo"; document.getElementById("adp-rate-l2").value = l[1]||"1° Acconto"; document.getElementById("adp-rate-l3").value = l[2]||"2° Acconto"; } catch(e) {} }
  document.getElementById("sect-rate-labels").style.display = a.has_rate ? "" : "none";
  openModal("modal-adp-def");
}
function saveAdpDef() {
  const id = document.getElementById("adp-def-id").value;
  const isC = document.getElementById("adp-def-contabilita").checked;
  const hasR = document.getElementById("adp-def-rate").checked;
  const data = {
    codice: document.getElementById("adp-def-codice").value.trim().toUpperCase(),
    nome: document.getElementById("adp-def-nome").value.trim(),
    descrizione: document.getElementById("adp-def-desc").value.trim() || null,
    scadenza_tipo: document.getElementById("adp-def-scadenza").value,
    categoria: document.getElementById("adp-def-categoria").value,
    is_contabilita: isC, has_rate: hasR,
    rate_labels: hasR ? [document.getElementById("adp-rate-l1").value||"Saldo", document.getElementById("adp-rate-l2").value||"1° Acconto", document.getElementById("adp-rate-l3").value||"2° Acconto"] : null,
  };
  if (!data.codice || !data.nome) { showNotif("Codice e Nome obbligatori", "error"); return; }
  if (id) { data.id = parseInt(id); socket.emit("update:adempimento", data); }
  else socket.emit("create:adempimento", data);
}
function deleteAdpDef(id) { const a = state.adempimenti.find(x => x.id === id); if (confirm(`Eliminare "${a?.nome||id}"?`)) socket.emit("delete:adempimento", { id }); }

function openCopia(id) {
  document.getElementById("copia-cliente-id").value = id;
  document.getElementById("copia-modalita").value = "cliente";
  document.getElementById("copia-info").innerHTML = "Copia scadenzario per questo cliente.";
  document.getElementById("copia-da").value = state.anno - 1;
  document.getElementById("copia-a").value = state.anno;
  openModal("modal-copia");
}
function openAddAdp(id) {
  document.getElementById("add-adp-cliente-id").value = id;
  document.getElementById("add-adp-anno").value = state.anno;
  const sel = document.getElementById("add-adp-select");
  sel.innerHTML = state.adempimenti.map(a => `<option value="${a.id}">[${a.categoria}] ${a.codice} - ${a.nome}</option>`).join("");
  updatePeriodoOptions();
  openModal("modal-add-adp");
}
function updatePeriodoOptions() {
  const selAdp = document.getElementById("add-adp-select"), selP = document.getElementById("add-adp-periodo");
  if (!selAdp || !selP) return;
  const adp = state.adempimenti.find(a => a.id === parseInt(selAdp.value));
  if (!adp) return;
  let opts = '<option value="">- Seleziona -</option>';
  if (adp.scadenza_tipo === "trimestrale")
    opts += `<option value="trimestre_1">1° Trim. (Gen-Mar)</option><option value="trimestre_2">2° Trim. (Apr-Giu)</option><option value="trimestre_3">3° Trim. (Lug-Set)</option><option value="trimestre_4">4° Trim. (Ott-Dic)</option>`;
  else if (adp.scadenza_tipo === "semestrale")
    opts += `<option value="semestre_1">1° Semestre (Gen-Giu)</option><option value="semestre_2">2° Semestre (Lug-Dic)</option>`;
  else if (adp.scadenza_tipo === "mensile")
    MESI.forEach((m,i) => { opts += `<option value="mese_${i+1}">${m}</option>`; });
  else opts += `<option value="annuale">Annuale</option>`;
  selP.innerHTML = opts;
}
function eseguiAddAdp() {
  const pv = document.getElementById("add-adp-periodo").value;
  let trimestre=null, semestre=null, mese=null;
  if (pv.startsWith("trimestre_")) trimestre = parseInt(pv.split("_")[1]);
  else if (pv.startsWith("semestre_")) semestre = parseInt(pv.split("_")[1]);
  else if (pv.startsWith("mese_")) mese = parseInt(pv.split("_")[1]);
  socket.emit("add:adempimento_cliente", {
    id_cliente: parseInt(document.getElementById("add-adp-cliente-id").value),
    id_adempimento: parseInt(document.getElementById("add-adp-select").value),
    anno: parseInt(document.getElementById("add-adp-anno").value) || state.anno,
    trimestre, semestre, mese,
  });
}

function openModal(id) { document.getElementById(id).classList.add("open"); }
function closeModal(id) { document.getElementById(id).classList.remove("open"); }
document.querySelectorAll(".modal-overlay").forEach(el => { el.addEventListener("click", e => { if (e.target === el) el.classList.remove("open"); }); });

function showNotif(msg, type="info") {
  const icons = { success:"ok", info:"i", error:"!" };
  const el = document.createElement("div");
  el.className = `notif ${type}`;
  el.innerHTML = `<span>${icons[type]||"."}</span><span>${msg}</span>`;
  document.getElementById("notif-container").appendChild(el);
  setTimeout(() => el.remove(), 3800);
}