// ═══════════════════════════════════════════════════════════════
// GLOBALE.JS — Vista Globale scadenzario tutti i clienti
// ═══════════════════════════════════════════════════════════════

// Carica le tipologie dal file JSON (condiviso con clienti.js)
let TIPOLOGIE_DATA_GLOBALE = null;

function loadTipologieDataGlobale() {
  if (TIPOLOGIE_DATA_GLOBALE) return Promise.resolve(TIPOLOGIE_DATA_GLOBALE);

  return fetch('./json/tipologie-data.json')
    .then(response => response.json())
    .then(data => {
      TIPOLOGIE_DATA_GLOBALE = data;
      return data;
    })
    .catch(error => {
      console.error('Errore nel caricamento delle tipologie (globale):', error);
      return null;
    });
}

// Costruisci le opzioni di filtro dinamicamente dai dati per vista globale
function buildGlobaleFilterOptions() {
  if (!TIPOLOGIE_DATA_GLOBALE) {
    // Fallback to default options if data not loaded yet
    return {
      tipo: [
        { value: "PF",  label: "👤 PF — Persona Fisica" },
        { value: "SP",  label: "🤝 SP — Soc. Persone" },
        { value: "SC",  label: "🏢 SC — Soc. Capitali" },
        { value: "ASS", label: "🏛️ ASS — Associazione" },
      ],
      col2: [
        { value: "privato",        label: "👤 Privato" },
        { value: "ditta",          label: "🏢 Ditta Ind." },
        { value: "socio",          label: "🤝 Socio" },
        { value: "professionista", label: "⚕️ Professionista" },
      ],
      col3: [
        { value: "forfettario",  label: "💰 Forfettario" },
        { value: "ordinario",    label: "📊 Ordinario" },
        { value: "ordinaria",    label: "📊 Ordinaria" },
        { value: "semplificato", label: "📄 Semplificato" },
        { value: "semplificata", label: "📄 Semplificata" },
      ],
      periodicita: [
        { value: "mensile",      label: "📅 Mensile" },
        { value: "trimestrale",  label: "📆 Trimestrale" },
        { value: "annuale",      label: "🗓️ Annuale" },
      ],
    };
  }

  const options = {
    tipo: [],
    col2: [],
    col3: [],
    periodicita: [],
  };

  // Tipologie principali
  Object.entries(TIPOLOGIE_DATA_GLOBALE.tipologie).forEach(([key, value]) => {
    options.tipo.push({
      value: key,
      label: `${value.icon} ${key.toUpperCase()} — ${value.desc}`,
    });
  });

  // Col2 (sottocategorie) — deduplicate dai percorsi
  const col2Set = new Set();
  Object.values(TIPOLOGIE_DATA_GLOBALE.percorsi).forEach(percorso => {
    percorso.forEach(item => {
      if (item.col2Label) col2Set.add(item.col2Label);
    });
  });
  col2Set.forEach(col2 => {
    const value = col2.toLowerCase().replace(/\s+/g, '_').replace('.', '');
    options.col2.push({ value, label: col2 });
  });

  // Col3 (regimi) — deduplicate dai percorsi
  const col3Set = new Set();
  Object.values(TIPOLOGIE_DATA_GLOBALE.percorsi).forEach(percorso => {
    percorso.forEach(item => {
      if (item.col3Label) col3Set.add(item.col3Label);
    });
  });
  col3Set.forEach(col3 => {
    const value = col3.toLowerCase().replace(/\s+/g, '_').replace('.', '');
    options.col3.push({ value, label: col3 });
  });

  // Periodicità
  [...TIPOLOGIE_DATA_GLOBALE.periodicitaIva, ...TIPOLOGIE_DATA_GLOBALE.periodicitaAnnuale].forEach(periodo => {
    options.periodicita.push({ value: periodo.value, label: periodo.label });
  });

  return options;
}

let GLOBALE_FILTER_OPTIONS = buildGlobaleFilterOptions();

// ─── STATISTICHE ─────────────────────────────────────────────
function calcolaGlobaleStats(data) {
  const totale   = data.length;
  const comp     = data.filter(r => r.stato === "completato").length;
  const daF      = data.filter(r => r.stato === "da_fare").length;
  const inC      = data.filter(r => r.stato === "in_corso").length;
  const clientiSet = new Set(data.map(r => r.cliente_id));
  const adpSet     = new Set(data.map(r => r.adempimento_nome));
  return { totale, comp, daF, inC, clienti: clientiSet.size, adempimenti: adpSet };
}

// ─── STATO FILTRI ────────────────────────────────────────────
let globaleFilterState = null;

function initGlobaleFilterState() {
  if (globaleFilterState) return;
  globaleFilterState = {};
  Object.entries(GLOBALE_FILTER_OPTIONS).forEach(([group, options]) => {
    globaleFilterState[group] = new Set(options.map(o => o.value));
  });
}

function getGlobaleFilterValues(group) {
  initGlobaleFilterState();
  return Array.from(globaleFilterState[group] || []);
}

function isGlobaleAllSelected(group) {
  const selected = new Set(getGlobaleFilterValues(group));
  const all = GLOBALE_FILTER_OPTIONS[group].map(o => o.value);
  return all.every(v => selected.has(v));
}

// ─── RENDER GRUPPO FILTRO ─────────────────────────────────────
function renderGlobaleFilterGroup(group, title) {
  const values     = getGlobaleFilterValues(group);
  const selected   = new Set(values);
  const allSelected = isGlobaleAllSelected(group);

  const optionsHtml = GLOBALE_FILTER_OPTIONS[group]
    .map(opt => `<label class="gf-option ${selected.has(opt.value) ? "is-selected" : ""}">
      <input type="checkbox" ${selected.has(opt.value) ? "checked" : ""} onchange="onGlobaleFilterToggle('${group}','${opt.value}',this.checked)">
      <span>${opt.label}</span>
    </label>`)
    .join("");

  return `<div class="gf-group">
    <div class="gf-head">
      <strong>${title}</strong>
      <label class="gf-all ${allSelected ? "is-selected" : ""}">
        <input type="checkbox" ${allSelected ? "checked" : ""} onchange="onGlobaleFilterToggleAll('${group}',this.checked)">
        <span>Tutti</span>
      </label>
    </div>
    <div class="gf-options">${optionsHtml}</div>
  </div>`;
}

// ─── TOGGLE FILTRI ────────────────────────────────────────────
function onGlobaleFilterToggle(group, value, checked) {
  initGlobaleFilterState();
  if (!globaleFilterState[group]) globaleFilterState[group] = new Set();
  if (checked) globaleFilterState[group].add(value);
  else         globaleFilterState[group].delete(value);
  applyGlobaleFiltriLocali();
}

function onGlobaleFilterToggleAll(group, checked) {
  initGlobaleFilterState();
  globaleFilterState[group] = checked
    ? new Set(GLOBALE_FILTER_OPTIONS[group].map(o => o.value))
    : new Set();
  applyGlobaleFiltriLocali();
}

// ─── RENDER PAGINA ────────────────────────────────────────────
function renderGlobalePage() {
  loadTipologieDataGlobale().then(() => {
    GLOBALE_FILTER_OPTIONS = buildGlobaleFilterOptions();
    // Reinizializza lo stato in modo che includa i nuovi gruppi col2/col3
    globaleFilterState = null;
    initGlobaleFilterState();

    document.getElementById("topbar-actions").innerHTML = `
      <div class="year-sel">
        <button onclick="changeAnnoGlobale(-1)" title="Anno precedente">&#9664;</button>
        <span class="year-num">${state.anno}</span>
        <button onclick="changeAnnoGlobale(1)" title="Anno successivo">&#9654;</button>
      </div>
      <div class="clienti-count-badge" style="background:var(--accent)18;color:var(--accent);border:1px solid var(--accent)44;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:600;margin:0 8px" id="clienti-count-globale">
        👥 Clienti: <span id="clienti-num">-</span>
      </div>
      <select class="select" id="glob-filtro-adp" style="width:210px;font-size:13px" onchange="applyGlobaleFiltri()" title="Filtra per tipo di adempimento">
        <option value="">📋 Tutti adempimenti</option>
      </select>
      <select class="select" id="glob-filtro-stato" style="width:155px;font-size:13px" onchange="applyGlobaleFiltri()" title="Filtra per stato adempimento">
        <option value="">🔵 Tutti stati</option>
        <option value="da_fare">⭕ Da fare</option>
        <option value="in_corso">🔄 In corso</option>
        <option value="completato">✅ Completato</option>
        <option value="n_a">➖ N/A</option>
      </select>
      <div class="search-wrap" style="width:200px">
        <span class="search-icon">🔍</span>
        <input class="input" id="glob-search" placeholder="Cerca cliente..." oninput="applyGlobaleFiltriDebounced()" title="Cerca per nome cliente, CF o P.IVA" style="font-size:13px">
      </div>
      <button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" title="Azzera tutti i filtri e mostra tutto" style="font-size:13px">⟳ Tutti</button>
      <button class="btn btn-print btn-sm" onclick="window.print()" title="Stampa la vista globale" style="font-size:13px">🖨️ Stampa</button>`;

    setTimeout(() => initSearchableSelect("glob-filtro-adp"), 50);
    loadGlobale();
  });
}

// ─── ANNO ─────────────────────────────────────────────────────
function changeAnnoGlobale(d) {
  state.anno += d;
  document.querySelectorAll(".year-num").forEach(el => (el.textContent = state.anno));
  loadGlobale();
}

// ─── CARICA DATI ──────────────────────────────────────────────
function loadGlobale() {
  const filtri = {};
  const adpSel   = document.getElementById("glob-filtro-adp")?.value;
  const statoSel = document.getElementById("glob-filtro-stato")?.value;
  const search   = document.getElementById("glob-search")?.value;
  if (adpSel)  filtri.adempimento = adpSel;
  if (statoSel) filtri.stato      = statoSel;
  if (search)   filtri.search     = search;
  if (state.globalePreFiltroAdp) filtri.adempimento = state.globalePreFiltroAdp;

  socket.emit("get:scadenzario_globale", { anno: state.anno, filtri });
  socket.emit("get:clienti", { anno: state.anno });
  socket.once("res:scadenzario_globale", ({ success, data }) => {
    if (!success) return;
    state.scadGlobale = data || [];
    if (state.globaleClientiAnno) renderGlobaleTabella(state.scadGlobale);
  });
  socket.once("res:clienti", ({ success, data }) => {
    if (!success) return;
    state.globaleClientiAnno = data || [];
    if (state.scadGlobale) renderGlobaleTabella(state.scadGlobale);
  });
}

// ─── FILTRI ───────────────────────────────────────────────────
const applyGlobaleFiltriDebounced = debounce(() => {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}, 300);

function applyGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}

function applyGlobaleFiltriLocali() {
  if (state.scadGlobale) renderGlobaleTabella(state.scadGlobale);
}

function resetGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  globaleFilterState = null;
  initGlobaleFilterState();

  ["glob-filtro-adp", "glob-filtro-stato", "glob-filtro-cliente-stato", "glob-search"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (el.multiple) Array.from(el.options).forEach(o => { o.selected = false; });
      else el.value = "";
      if (el._ssRefresh) el._ssRefresh();
    }
  });
  loadGlobale();
}

// ─── HEADER ADEMPIMENTI SELECT ────────────────────────────────
function renderGlobaleHeader() {
  const st = state.globaleStats;
  if (!st) return;
  const adpSel = document.getElementById("glob-filtro-adp");
  if (adpSel) {
    const current = state.globalePreFiltroAdp || adpSel.value;
    adpSel.innerHTML =
      `<option value="">📋 Tutti adempimenti</option>` +
      Array.from(st.adempimenti)
        .sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }))
        .map(a => `<option value="${escAttr(a)}" ${current === a ? "selected" : ""}>${a}</option>`)
        .join("");
    if (!adpSel.dataset.ssinit) initSearchableSelect("glob-filtro-adp");
    else if (adpSel._ssRefresh) adpSel._ssRefresh();
    if (state.globalePreFiltroAdp) state.globalePreFiltroAdp = "";
  }
}

function navigaAdempimento(direzione) {
  const adpSel = document.getElementById("glob-filtro-adp");
  if (!adpSel || !state.globaleStats) return;
  const lista = Array.from(state.globaleStats.adempimenti).sort((a, b) =>
    a.localeCompare(b, "it", { sensitivity: "base" }),
  );
  const current = adpSel.value;
  const idx = lista.indexOf(current);
  let newIdx;
  if (direzione === -1) newIdx = idx <= 0 ? lista.length - 1 : idx - 1;
  else newIdx = idx >= lista.length - 1 || idx === -1 ? 0 : idx + 1;
  adpSel.value = lista[newIdx];
  if (adpSel._ssRefresh) adpSel._ssRefresh();
  applyGlobaleFiltri();
}

// ─── HELPER FILTRO STATO CLIENTE ─────────────────────────────
function clientePassaFiltroStato(periodi, filtroClienteStato) {
  if (!filtroClienteStato) return true;
  const hasInCorso    = periodi.some(r => r.stato === "in_corso");
  const hasDaFare     = periodi.some(r => r.stato === "da_fare");
  const hasCompletato = periodi.some(r => r.stato === "completato");
  const hasNA         = periodi.some(r => r.stato === "n_a");
  const tuttiComp     = periodi.every(r => r.stato === "completato" || r.stato === "n_a");
  const nessunAvanz   = periodi.every(r => r.stato === "da_fare");
  switch (filtroClienteStato) {
    case "con_in_corso":    return hasInCorso;
    case "senza_in_corso":  return !hasInCorso;
    case "tutti_completati":return tuttiComp;
    case "con_da_fare":     return hasDaFare;
    case "solo_da_fare":    return nessunAvanz;
    case "non_completati":  return !tuttiComp;
    case "con_na":          return hasNA;
    default:                return true;
  }
}

// ─── MAPPA ETICHETTE CLASSIFICAZIONE ─────────────────────────
const _col2Map = {
  privato:        "Privato",
  ditta:          "Ditta Ind.",
  socio:          "Socio",
  professionista: "Prof.",
};
const _col3Map = {
  ordinario:    "Ord.",
  semplificato: "Sempl.",
  forfettario:  "Forf.",
  ordinaria:    "Ord.",
  semplificata: "Sempl.",
};

// ─── BADGE CLASSIFICAZIONE CLIENTE ───────────────────────────
function _renderGlobaleClienteClassBadges(c) {
  const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
  let badges = `<span class="badge b-${(c.tipologia_codice || "").toLowerCase()}"
    style="font-size:11px" title="${TIPOLOGIE_INFO[c.tipologia_codice]?.desc || ""}">${c.tipologia_codice || "-"}</span>`;
  if (c.col2)
    badges += `<span class="badge-info" style="font-size:10px">${_col2Map[c.col2] || c.col2}</span>`;
  if (c.col3)
    badges += `<span class="badge-info" style="font-size:10px">${_col3Map[c.col3] || c.col3}</span>`;
  if (c.periodicita)
    badges += `<span class="badge-per" style="font-size:10px">${c.periodicita === "mensile" ? "📅 Mens." : "📆 Trim."}</span>`;
  return badges;
}

// ─── RENDER TABELLA PRINCIPALE ────────────────────────────────
function renderGlobaleTabella(rawData) {
  initGlobaleFilterState();

  const st = state.globaleStats;

  // Leggi tutti i valori di filtro (ora inclusi col2 e col3)
  const filtroTipo        = getGlobaleFilterValues("tipo");
  const filtroCol2        = getGlobaleFilterValues("col2");
  const filtroCol3        = getGlobaleFilterValues("col3");
  const filtroPer         = getGlobaleFilterValues("periodicita");
  const filtroClienteStato = document.getElementById("glob-filtro-cliente-stato")?.value || "";
  const filtroAdp         = document.getElementById("glob-filtro-adp")?.value || "";
  const filtroStatoAdp    = document.getElementById("glob-filtro-stato")?.value || "";
  const searchText        = (document.getElementById("glob-search")?.value || "").toLowerCase().trim();

  // Applica filtri alle righe
  const data = rawData.filter(r => {
    if (filtroTipo.length && !filtroTipo.includes(r.cliente_tipologia_codice)) return false;
    if (filtroPer.length  && !filtroPer.includes(r.cliente_periodicita))       return false;
    if (filtroCol2.length && r.cliente_col2 && !filtroCol2.includes(r.cliente_col2)) return false;
    if (filtroCol3.length && r.cliente_col3 && !filtroCol3.includes(r.cliente_col3)) return false;
    
    // Filtra per testo
    if (searchText) {
      const searchFields = [
        r.cliente_nome || "",
        r.cliente_cf || "",
        r.cliente_piva || ""
      ];
      const found = searchFields.some(field => 
        field.toLowerCase().includes(searchText)
      );
      if (!found) return false;
    }
    
    return true;
  });

  const perc = st.totale > 0 ? Math.round((st.comp / st.totale) * 100) : 0;

  const adpSel = document.getElementById("glob-filtro-adp");
  const adpFiltroAttivo  = adpSel?.value || "";
  const adpListaOrdinata = st.adempimenti
    ? Array.from(st.adempimenti).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }))
    : [];
  const adpIdx = adpListaOrdinata.indexOf(adpFiltroAttivo);

  const filtroClienteStatoLabels = {
    con_in_corso:    "🔄 Con almeno 1 in corso",
    senza_in_corso:  "✅ Senza in corso",
    tutti_completati:"🏆 Tutto completato",
    con_da_fare:     "⭕ Con almeno 1 da fare",
    solo_da_fare:    "🚨 Solo da fare",
    non_completati:  "⚠️ Non al 100%",
    con_na:          "➖ Con almeno 1 N/A",
  };
  const filtroClienteStatoBadge = filtroClienteStato
    ? `<div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:5px 12px;background:var(--yellow)18;border:1px solid var(--yellow)44;border-radius:20px;font-size:12px;color:var(--yellow)">
        <span>Filtro clienti:</span>
        <strong>${filtroClienteStatoLabels[filtroClienteStato] || filtroClienteStato}</strong>
        <button onclick="document.getElementById('glob-filtro-cliente-stato').value='';applyGlobaleFiltriLocali()"
          style="background:none;border:none;color:var(--yellow);cursor:pointer;font-size:13px;padding:0 2px;line-height:1" title="Rimuovi filtro">✕</button>
      </div>`
    : "";

  const navAdpHtml = adpFiltroAttivo && adpListaOrdinata.length > 1
    ? `<div class="glob-nav-adp" style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 16px;background:var(--surface3);border-radius:var(--r-sm);border:1px solid var(--border2)">
        <button class="btn btn-sm btn-secondary" onclick="navigaAdempimento(-1)" style="font-size:13px">&#9664; Prec.</button>
        <span style="flex:1;text-align:center;font-size:14px;font-weight:700;color:var(--accent)">${adpFiltroAttivo}</span>
        <span style="font-size:12px;color:var(--text3)">${adpIdx + 1} / ${adpListaOrdinata.length}</span>
        <button class="btn btn-sm btn-secondary" onclick="navigaAdempimento(1)" style="font-size:13px">Succ. &#9654;</button>
        <button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" style="margin-left:8px;font-size:13px">✕ Tutti</button>
      </div>`
    : "";

  // ── Header card con filtri a 4 colonne (come clienti.js) ──────────
  const headerCard = `
  <div class="filtri-avanzati no-print" style="margin-bottom:12px">
    <span style="font-size:11px;color:var(--text3);font-weight:700;">🎯 Filtri Clienti:</span>
    <div class="gf-wrap">
      ${renderGlobaleFilterGroup("tipo",       "Tipologia")}
      ${renderGlobaleFilterGroup("col2",       "Sottocategoria")}
      ${renderGlobaleFilterGroup("col3",       "Regime")}
      ${renderGlobaleFilterGroup("periodicita","Periodicità")}
    </div>
  </div>
  <div class="globale-preview-card">
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;width:100%">
      <div class="gpc-left">
        <div class="gpc-globe" title="Vista globale di tutti i clienti">🌐</div>
        <div>
          <div class="gpc-title" style="font-size:17px">Vista Globale ${state.anno}</div>
          <div class="gpc-sub" style="font-size:13px">${st.clienti} clienti · ${st.adempimenti.size} tipi adempimenti</div>
          ${filtroClienteStatoBadge}
        </div>
      </div>
      <div class="gpc-stats">
        <div class="cpc-stat-item" title="Totale adempimenti"><div class="cpc-stat-num" style="color:var(--accent);font-size:24px">${st.totale}</div><div class="cpc-stat-lbl" style="font-size:11px">Totale</div></div>
        <div class="cpc-stat-item" title="Completati"><div class="cpc-stat-num" style="color:var(--green);font-size:24px">${st.comp}</div><div class="cpc-stat-lbl" style="font-size:11px">Comp.</div></div>
        <div class="cpc-stat-item" title="Da fare"><div class="cpc-stat-num" style="color:var(--red);font-size:24px">${st.daF}</div><div class="cpc-stat-lbl" style="font-size:11px">Da fare</div></div>
        <div class="cpc-stat-item" title="In corso"><div class="cpc-stat-num" style="color:var(--yellow);font-size:24px">${st.inC}</div><div class="cpc-stat-lbl" style="font-size:11px">In corso</div></div>
        <div class="cpc-stat-item" title="Percentuale completamento">
          <div class="cpc-stat-num" style="color:var(--green);font-size:24px">${perc}%</div>
          <div class="cpc-stat-lbl" style="font-size:11px">Progresso</div>
          <div class="mini-bar" style="margin-top:4px;width:70px"><div class="mini-fill" style="width:${perc}%"></div></div>
        </div>
      </div>
    </div>
    ${navAdpHtml}
  </div>`;

  // ── Raggruppa per adempimento ──────────────────────────────────────
  const grouped = new Map();
  data.forEach(r => {
    storeRow(r);
    const adpKey = r.adempimento_nome;
    if (!grouped.has(adpKey))
      grouped.set(adpKey, { nome: r.adempimento_nome, codice: r.adempimento_codice, clienti: new Map() });
    const g = grouped.get(adpKey);
    const cliKey = r.cliente_id;
    if (!g.clienti.has(cliKey))
      g.clienti.set(cliKey, {
        id:                  r.cliente_id,
        nome:                r.cliente_nome,
        cf:                  r.cliente_cf,
        piva:                r.cliente_piva,
        tipologia_codice:    r.cliente_tipologia_codice,
        tipologia_colore:    r.cliente_tipologia_colore,
        sottotipologia_nome: r.cliente_sottotipologia_nome,
        periodicita:         r.cliente_periodicita,
        col2:                r.cliente_col2,
        col3:                r.cliente_col3,
        periodi:             [],
      });
    g.clienti.get(cliKey).periodi.push(r);
  });

  // ── Ordina gruppi alfabeticamente ─────────────────────────────────
  const gruppiOrdinati = Array.from(grouped.values()).sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }),
  );

  let content = "";
  gruppiOrdinati.forEach(g => {
    const clientiFiltrati = Array.from(g.clienti.values())
      .filter(c => clientePassaFiltroStato(c.periodi, filtroClienteStato))
      .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));

    if (!clientiFiltrati.length) return;

    const allRows = clientiFiltrati.flatMap(c => c.periodi);
    const compG = allRows.filter(r => r.stato === "completato").length;
    const totG  = allRows.length;
    const pG    = totG > 0 ? Math.round((compG / totG) * 100) : 0;

    const clientiHtml = clientiFiltrati.map(c => {
      const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
      const avatar   = getAvatar(c.nome);
      const compC = c.periodi.filter(r => r.stato === "completato").length;
      const inCC  = c.periodi.filter(r => r.stato === "in_corso").length;
      const daFC  = c.periodi.filter(r => r.stato === "da_fare").length;
      const naC   = c.periodi.filter(r => r.stato === "n_a").length;
      const totC  = c.periodi.length;
      const pC    = totC > 0 ? Math.round((compC / totC) * 100) : 0;
      const pgColor = pC === 100 ? "var(--green)" : pC > 50 ? "var(--yellow)" : "var(--red)";

      const situazioneBadges = [];
      if (compC > 0) situazioneBadges.push(`<span style="font-size:10px;color:var(--green);background:var(--green)12;border:1px solid var(--green)33;border-radius:10px;padding:1px 6px" title="${compC} completati">✅ ${compC}</span>`);
      if (inCC  > 0) situazioneBadges.push(`<span style="font-size:10px;color:var(--yellow);background:var(--yellow)12;border:1px solid var(--yellow)33;border-radius:10px;padding:1px 6px" title="${inCC} in corso">🔄 ${inCC}</span>`);
      if (daFC  > 0) situazioneBadges.push(`<span style="font-size:10px;color:var(--red);background:var(--red)12;border:1px solid var(--red)33;border-radius:10px;padding:1px 6px" title="${daFC} da fare">⭕ ${daFC}</span>`);
      if (naC   > 0) situazioneBadges.push(`<span style="font-size:10px;color:var(--text3);background:var(--surface3);border:1px solid var(--border);border-radius:10px;padding:1px 6px" title="${naC} N/A">➖ ${naC}</span>`);

      const classBadgesHtml   = _renderGlobaleClienteClassBadges(c);
      const sottotipoLabel    = c.sottotipologia_nome || "";
      const periodiHtml       = c.periodi.map(r => renderPeriodoPill(r)).join("");
      const isMensile         = c.periodi.length > 4;

      return `<div class="glob-cliente-card">
        <div class="glob-cliente-header">
          <div class="gcr-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}15;font-size:13px" title="${escAttr(c.nome)}">${avatar}</div>
          <div style="flex:1;min-width:0">
            <div class="gcr-nome" style="font-size:14px">${escAttr(c.nome)}</div>
            <div class="gcr-cf"   style="font-size:11px">${c.cf || c.piva || "-"}</div>
            ${sottotipoLabel ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">🏷️ ${sottotipoLabel}</div>` : ""}
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${classBadgesHtml}</div>
            ${situazioneBadges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${situazioneBadges.join("")}</div>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-left:10px">
            <div class="mini-bar" style="width:56px" title="${pC}% completato"><div class="mini-fill" style="width:${pC}%;background:${pgColor}"></div></div>
            <span style="font-size:11px;font-family:var(--mono);color:${pgColor};min-width:36px;text-align:right" title="${compC} completati su ${totC}">${compC}/${totC}</span>
          </div>
        </div>
        <div class="glob-cliente-periodi${isMensile ? " periodi-mensili" : ""}">${periodiHtml}</div>
      </div>`;
    }).join("");

    content += `<div class="table-wrap" style="margin-bottom:16px">
      <div class="table-header">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <strong style="font-size:15px">${g.nome}</strong>
          <span style="font-family:var(--mono);font-size:11px;color:var(--text3)" title="Codice adempimento">${g.codice}</span>
          ${filtroClienteStato ? `<span style="font-size:11px;color:var(--text3);margin-left:8px">${clientiFiltrati.length} client${clientiFiltrati.length === 1 ? "e" : "i"} visibil${clientiFiltrati.length === 1 ? "e" : "i"}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="mini-bar" style="width:90px" title="${pG}% completato"><div class="mini-fill" style="width:${pG}%"></div></div>
          <span style="font-size:12px;font-family:var(--mono);color:var(--text2)" title="${compG} completati su ${totG} (${pG}%)">${compG}/${totG} (${pG}%)</span>
        </div>
      </div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px">${clientiHtml}</div>
    </div>`;
  });

  if (!content)
    content = `<div class="empty">
      <div class="empty-icon">🌐</div>
      <p style="font-size:15px">
        ${filtroClienteStato
          ? `Nessun cliente corrisponde al filtro per ${state.anno}`
          : `Nessun adempimento trovato per ${state.anno}`}
      </p>
      ${filtroClienteStato ? `<button class="btn btn-sm btn-primary" onclick="document.getElementById('glob-filtro-cliente-stato').value='';applyGlobaleFiltriLocali()" style="margin-top:12px">⟳ Rimuovi filtro</button>` : ""}
    </div>`;

  // ── Clienti senza adempimenti ──────────────────────────────────────
  const clientiAnno              = state.globaleClientiAnno || [];
  const clientiConAdempimenti    = new Set(rawData.map(r => r.cliente_id));
  const mostraSenzaAdempimenti   = !filtroAdp && !filtroStatoAdp;
  let senzaAdempimentiHtml       = "";

  if (mostraSenzaAdempimenti) {
    const missing = clientiAnno
      .filter(c => !clientiConAdempimenti.has(c.id))
      .filter(c => filtroTipo.length ? filtroTipo.includes(c.tipologia_codice) : true)
      .filter(c => filtroPer.length  ? filtroPer.includes(c.periodicita)       : true)
      .filter(c => filtroCol2.length && c.col2 ? filtroCol2.includes(c.col2) : true)
      .filter(c => filtroCol3.length && c.col3 ? filtroCol3.includes(c.col3) : true)
      .filter(c => {
        if (!searchText) return true;
        return (c.nome || "").toLowerCase().includes(searchText)
          || (c.codice_fiscale || "").toLowerCase().includes(searchText)
          || (c.partita_iva   || "").toLowerCase().includes(searchText);
      });

    if (missing.length) {
      const rows = missing
        .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }))
        .map(c => `<tr>
          <td style="padding:10px 12px">${escAttr(c.nome)}</td>
          <td style="padding:10px 12px">${c.tipologia_codice || "-"}</td>
          <td style="padding:10px 12px">${c.codice_fiscale || c.partita_iva || "-"}</td>
          <td style="padding:10px 12px" class="no-print">
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn btn-xs btn-primary" onclick="goScadenzario(${c.id})">📅 Apri Scadenzario</button>
              <button class="btn btn-xs btn-orange"  onclick="generaScadenzarioDaGlobale(${c.id})">⚡ Genera Ora</button>
            </div>
          </td>
        </tr>`)
        .join("");

      senzaAdempimentiHtml = `<div class="table-wrap" style="margin-top:12px">
        <div class="table-header">
          <h3>Clienti Senza Adempimenti ${state.anno}
            <span style="font-size:12px;color:var(--text3);margin-left:8px">(${missing.length})</span>
          </h3>
        </div>
        <div style="padding:10px 12px">
          <div class="infobox" style="margin-bottom:10px;font-size:12px">
            Questi clienti esistono nell'anno ${state.anno}, ma non hanno ancora adempimenti generati.
          </div>
          <table style="width:100%;font-size:12px">
            <thead><tr>
              <th style="padding:8px 12px;text-align:left">Cliente</th>
              <th style="padding:8px 12px;text-align:left">Tipo</th>
              <th style="padding:8px 12px;text-align:left">CF/P.IVA</th>
              <th style="padding:8px 12px;text-align:left" class="no-print">Azione</th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
    }
  }

  document.getElementById("content").innerHTML = headerCard + content + senzaAdempimentiHtml;
}

// ─── GENERA SCADENZARIO DA GLOBALE ───────────────────────────
function generaScadenzarioDaGlobale(idCliente) {
  if (typeof socket === "undefined") return;
  socket.emit("genera:scadenzario", { id_cliente: idCliente, anno: state.anno });
  socket.once("res:genera:scadenzario", ({ success, inseriti, error }) => {
    if (success) {
      showNotif(`Generazione completata (${inseriti || 0} inseriti) per l'anno ${state.anno}`, "success");
      loadGlobale();
    } else {
      showNotif(error || "Errore durante la generazione", "error");
    }
  });
}

// ─── ESPOSIZIONE GLOBALE ──────────────────────────────────────
window.onGlobaleFilterToggle      = onGlobaleFilterToggle;
window.onGlobaleFilterToggleAll   = onGlobaleFilterToggleAll;
window.generaScadenzarioDaGlobale = generaScadenzarioDaGlobale;
window.showCopyClientiDialog      = showCopyClientiDialog;