// ═══════════════════════════════════════════════════════════════
// GLOBALE.JS — Vista Globale scadenzario tutti i clienti
// ═══════════════════════════════════════════════════════════════

// Stato pannello globale (separato da clienti)
let _globTipFiltroPanelOpen = false;

function calcolaGlobaleStats(data) {
  const totale = data.length;
  const comp = data.filter(r => r.stato === "completato").length;
  const daF = data.filter(r => r.stato === "da_fare").length;
  const inC = data.filter(r => r.stato === "in_corso").length;
  const clientiSet = new Set(data.map(r => r.cliente_id));
  const adpSet = new Set(data.map(r => r.adempimento_nome));
  return { totale, comp, daF, inC, clienti: clientiSet.size, adempimenti: adpSet };
}

// ─── TOGGLE PANNELLO GLOBALE ──────────────────────────────────
function toggleGlobTipFiltroPanel(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  _globTipFiltroPanelOpen = !_globTipFiltroPanelOpen;
  _aggiornaGlobPanelVisibility();
}

function closeGlobTipFiltroPanel(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  _globTipFiltroPanelOpen = false;
  _aggiornaGlobPanelVisibility();
}

function _aggiornaGlobPanelVisibility() {
  const container = document.getElementById('glob-tip-filtro-container');
  if (!container) return;
  container.style.display = _globTipFiltroPanelOpen ? 'block' : 'none';
  // Aggiorna bottone header
  const btn = document.getElementById('glob-tip-filtro-toggle-btn');
  if (btn) {
    btn.innerHTML = _globTipFiltroPanelOpen
      ? `<button class="btn btn-xs btn-secondary" onclick="closeGlobTipFiltroPanel(event)">✕ Chiudi</button>`
      : `<button class="btn btn-xs btn-secondary" onclick="toggleGlobTipFiltroPanel(event)">▼ Espandi</button>`;
  }
}

function _aggiornaGlobTipFiltroCounter() {
  const badge = document.getElementById('glob-tip-filtro-count');
  if (badge) {
    // Accesso sicuro a _activeFiltroKeys (definita in clienti.js)
    const keys = typeof window._activeFiltroKeys !== 'undefined' ? window._activeFiltroKeys : (typeof _activeFiltroKeys !== 'undefined' ? _activeFiltroKeys : new Set());
    const allKeys = typeof _getAllKeys === 'function' ? _getAllKeys() : [];
    const n = keys.size;
    const isAll = n === allKeys.length;
    const isNone = n === 0;
    badge.textContent = isNone ? '0' : isAll ? '' : n;
    badge.style.display = (isNone || !isAll) ? 'inline-flex' : 'none';
    badge.style.background = isNone ? 'var(--red)' : 'var(--accent)';
  }
}

// Refresh del pannello tipologie all'interno del globale (dopo toggle singolo chip)
function _refreshGlobTipFiltroPanel() {
  const container = document.getElementById('glob-tip-filtro-container');
  if (!container || !_globTipFiltroPanelOpen) return;
  if (typeof renderTipologieFiltroPanel === 'function') {
    const tmp = document.createElement('div');
    tmp.innerHTML = renderTipologieFiltroPanel();
    container.innerHTML = '';
    container.appendChild(tmp.firstChild);
  }
  container.style.display = 'block';
  _aggiornaGlobTipFiltroCounter();
}

// ─── CHECK FILTRO TIPOLOGIE CLIENTE ──────────────────────────
function clientePassaFiltroTipologie(c) {
  // Accesso sicuro alla variabile definita in clienti.js
  const activeFiltroKeys = typeof window._activeFiltroKeys !== 'undefined'
    ? window._activeFiltroKeys
    : (typeof _activeFiltroKeys !== 'undefined' ? _activeFiltroKeys : null);

  if (!activeFiltroKeys) return true;

  // Se nessuno selezionato → nessun cliente passa
  if (activeFiltroKeys.size === 0) return false;

  // Se tutti selezionati → tutti passano
  const allKeys = typeof _getAllKeys === 'function' ? _getAllKeys() : [];
  if (allKeys.length > 0 && activeFiltroKeys.size === allKeys.length) return true;

  const tipCod = c.tipologia_codice || '';

  // Mappa i valori db alle etichette usate nelle chiavi filtro
  const col2DbToLabel = {
    'privato': 'Privato',
    'ditta': 'Ditta Individuale',
    'socio': 'Socio',
    'professionista': 'Professionista',
  };
  const col3DbToLabel = {
    'ordinario': 'Ordinario',
    'ordinaria': 'Ordinaria',
    'semplificato': 'Semplificato',
    'semplificata': 'Semplificata',
    'forfettario': 'Forfettario',
  };

  const col2Raw = (c.col2 || '').toLowerCase();
  const col3Raw = (c.col3 || '').toLowerCase();
  const col2Display = col2DbToLabel[col2Raw] || '';
  const col3Display = col3DbToLabel[col3Raw] || '';
  const per = c.periodicita || '';

  // Cerca una chiave attiva che corrisponde a questo cliente
  for (const key of activeFiltroKeys) {
    const [kTip, kCol2, kCol3, kPer] = key.split('|');

    // Tipologia deve corrispondere
    if (kTip !== tipCod) continue;

    // Col2: se la chiave ha col2, il cliente deve averlo uguale
    if (kCol2 && kCol2 !== col2Display) continue;

    // Col3: se la chiave ha col3, il cliente deve averlo uguale
    if (kCol3 && kCol3 !== col3Display) continue;

    // Periodicità: se la chiave ha per, il cliente deve averla uguale
    if (kPer && kPer !== per) continue;

    return true;
  }
  return false;
}

function clientePassaFiltroStato(periodi, filtroClienteStato) {
  if (!filtroClienteStato) return true;
  const hasInCorso = periodi.some(r => r.stato === "in_corso");
  const hasDaFare = periodi.some(r => r.stato === "da_fare");
  const hasCompletato = periodi.some(r => r.stato === "completato");
  const hasNA = periodi.some(r => r.stato === "n_a");
  const tuttiComp = periodi.every(r => r.stato === "completato" || r.stato === "n_a");
  const nessunAvanz = periodi.every(r => r.stato === "da_fare");
  switch (filtroClienteStato) {
    case "con_in_corso": return hasInCorso;
    case "senza_in_corso": return !hasInCorso;
    case "tutti_completati": return tuttiComp;
    case "con_da_fare": return hasDaFare;
    case "solo_da_fare": return nessunAvanz;
    case "non_completati": return !tuttiComp;
    case "con_na": return hasNA;
    default: return true;
  }
}

// ─── MAPPA ETICHETTE ─────────────────────────────────────────
const _col2Map = { privato: "Privato", ditta: "Ditta Ind.", socio: "Socio", professionista: "Prof." };
const _col3Map = { ordinario: "Ord.", semplificato: "Sempl.", forfettario: "Forf.", ordinaria: "Ord.", semplificata: "Sempl." };

function _renderGlobaleClienteClassBadges(c) {
  const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
  let badges = `<span class="badge b-${(c.tipologia_codice || "").toLowerCase()}"
    style="font-size:11px" title="${TIPOLOGIE_INFO[c.tipologia_codice]?.desc || ""}">${c.tipologia_codice || "-"}</span>`;
  if (c.col2) badges += `<span class="badge-info" style="font-size:10px">${_col2Map[c.col2] || c.col2}</span>`;
  if (c.col3) badges += `<span class="badge-info" style="font-size:10px">${_col3Map[c.col3] || c.col3}</span>`;
  if (c.periodicita) badges += `<span class="badge-per" style="font-size:10px">${c.periodicita === "mensile" ? "📅 Mens." : c.periodicita === "trimestrale" ? "📆 Trim." : "🗓️ Ann."}</span>`;
  return badges;
}

// ─── RENDER PAGINA ────────────────────────────────────────────
function renderGlobalePage() {
  // Inizializza filtro se vuoto
  const activeFiltroKeys = typeof _activeFiltroKeys !== 'undefined' ? _activeFiltroKeys : null;
  if (activeFiltroKeys && activeFiltroKeys.size === 0 && typeof initializeTipologieFilter === 'function') {
    initializeTipologieFilter();
  }

  document.getElementById("topbar-actions").innerHTML = `
    <div class="year-sel">
      <button onclick="changeAnnoGlobale(-1)" title="Anno precedente">&#9664;</button>
      <span class="year-num">${state.anno}</span>
      <button onclick="changeAnnoGlobale(1)" title="Anno successivo">&#9654;</button>
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
      <input class="input" id="glob-search" placeholder="Cerca cliente..." oninput="applyGlobaleFiltriDebounced()" style="font-size:13px">
    </div>
    <button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" title="Azzera tutti i filtri" style="font-size:13px">⟳ Tutti</button>
    <button class="btn btn-print btn-sm" onclick="window.print()" style="font-size:13px">🖨️ Stampa</button>`;

  setTimeout(() => initSearchableSelect("glob-filtro-adp"), 50);
  loadGlobale();
}

function changeAnnoGlobale(d) {
  state.anno += d;
  document.querySelectorAll(".year-num").forEach(el => (el.textContent = state.anno));
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

function applyGlobaleFiltriLocali() {
  if (state.scadGlobale) renderGlobaleTabella(state.scadGlobale);
}

function resetGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  ["glob-filtro-adp", "glob-filtro-stato", "glob-filtro-tipo", "glob-filtro-periodicita", "glob-filtro-cliente-stato", "glob-search"].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ""; if (el._ssRefresh) el._ssRefresh(); }
  });
  // Reset tipologie filter
  if (typeof initializeTipologieFilter === 'function') initializeTipologieFilter();
  // Refresh pannello se aperto
  _refreshGlobTipFiltroPanel();
  _aggiornaGlobTipFiltroCounter();
  loadGlobale();
}

function renderGlobaleHeader() {
  const st = state.globaleStats;
  if (!st) return;
  const adpSel = document.getElementById("glob-filtro-adp");
  if (adpSel) {
    const current = state.globalePreFiltroAdp || adpSel.value;
    adpSel.innerHTML = `<option value="">📋 Tutti adempimenti</option>` +
      Array.from(st.adempimenti).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }))
        .map(a => `<option value="${escAttr(a)}" ${current === a ? "selected" : ""}>${a}</option>`).join("");
    if (!adpSel.dataset.ssinit) initSearchableSelect("glob-filtro-adp");
    else if (adpSel._ssRefresh) adpSel._ssRefresh();
    if (state.globalePreFiltroAdp) state.globalePreFiltroAdp = "";
  }
}

function navigaAdempimento(direzione) {
  const adpSel = document.getElementById("glob-filtro-adp");
  if (!adpSel || !state.globaleStats) return;
  const lista = Array.from(state.globaleStats.adempimenti).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }));
  const current = adpSel.value;
  const idx = lista.indexOf(current);
  let newIdx;
  if (direzione === -1) newIdx = idx <= 0 ? lista.length - 1 : idx - 1;
  else newIdx = idx >= lista.length - 1 || idx === -1 ? 0 : idx + 1;
  adpSel.value = lista[newIdx];
  if (adpSel._ssRefresh) adpSel._ssRefresh();
  applyGlobaleFiltri();
}

// ─── RENDER TABELLA ───────────────────────────────────────────
function renderGlobaleTabella(rawData) {
  const st = state.globaleStats;
  const filtroTipo = document.getElementById("glob-filtro-tipo")?.value || "";
  const filtroPer = document.getElementById("glob-filtro-periodicita")?.value || "";
  const filtroClienteStato = document.getElementById("glob-filtro-cliente-stato")?.value || "";

  const data = rawData.filter(r => {
    if (filtroTipo && r.cliente_tipologia_codice !== filtroTipo) return false;
    if (filtroPer && r.cliente_periodicita !== filtroPer) return false;
    return true;
  });

  const perc = st.totale > 0 ? Math.round((st.comp / st.totale) * 100) : 0;

  const adpSel = document.getElementById("glob-filtro-adp");
  const adpFiltroAttivo = adpSel?.value || "";
  const adpListaOrdinata = st.adempimenti
    ? Array.from(st.adempimenti).sort((a, b) => a.localeCompare(b, "it", { sensitivity: "base" }))
    : [];
  const adpIdx = adpListaOrdinata.indexOf(adpFiltroAttivo);

  // ── Counter filtro tipologie ───────────────────────────────
  const activeFiltroKeys = typeof _activeFiltroKeys !== 'undefined' ? _activeFiltroKeys : new Set();
  const allKeysArr = typeof _getAllKeys === 'function' ? _getAllKeys() : [];
  const tipFiltroActiveCount = activeFiltroKeys.size;
  const tipFiltroIsAll = tipFiltroActiveCount === allKeysArr.length;
  const tipFiltroIsNone = tipFiltroActiveCount === 0;

  const filtroClienteStatoLabels = {
    con_in_corso: "🔄 Con almeno 1 in corso", senza_in_corso: "✅ Senza in corso",
    tutti_completati: "🏆 Tutto completato", con_da_fare: "⭕ Con almeno 1 da fare",
    solo_da_fare: "🚨 Solo da fare", non_completati: "⚠️ Non al 100%", con_na: "➖ Con almeno 1 N/A",
  };
  const filtroClienteStatoBadge = filtroClienteStato
    ? `<div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:5px 12px;background:var(--yellow)18;border:1px solid var(--yellow)44;border-radius:20px;font-size:12px;color:var(--yellow)">
        <span>Filtro clienti:</span>
        <strong>${filtroClienteStatoLabels[filtroClienteStato] || filtroClienteStato}</strong>
        <button onclick="document.getElementById('glob-filtro-cliente-stato').value='';applyGlobaleFiltriLocali()"
          style="background:none;border:none;color:var(--yellow);cursor:pointer;font-size:13px;padding:0 2px;line-height:1" title="Rimuovi filtro">✕</button>
      </div>` : "";

  const navAdpHtml = adpFiltroAttivo && adpListaOrdinata.length > 1
    ? `<div class="glob-nav-adp" style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 16px;background:var(--s3);border-radius:var(--r-sm);border:1px solid var(--b2)">
        <button class="btn btn-sm btn-secondary" onclick="navigaAdempimento(-1)">&#9664; Prec.</button>
        <span style="flex:1;text-align:center;font-size:14px;font-weight:700;color:var(--accent)">${adpFiltroAttivo}</span>
        <span style="font-size:12px;color:var(--t3)">${adpIdx + 1} / ${adpListaOrdinata.length}</span>
        <button class="btn btn-sm btn-secondary" onclick="navigaAdempimento(1)">Succ. &#9654;</button>
        <button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" style="margin-left:8px">✕ Tutti</button>
      </div>` : "";

  // ── Pannello filtro tipologie nel globale ──────────────────
  const tipFiltroHtml = typeof renderTipologieFiltroPanel === 'function' ? `
    <div class="glob-tip-filtro-wrap" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--s2);border:1px solid var(--b0);border-radius:var(--r-sm);cursor:pointer;"
           onclick="toggleGlobTipFiltroPanel(event)">
        <span style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">🏷️ Filtro Tipologie Clienti</span>
        <span id="glob-tip-filtro-count"
          style="display:${!tipFiltroIsAll ? 'inline-flex' : 'none'};align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;background:${tipFiltroIsNone ? 'var(--red)' : 'var(--accent)'};color:#fff;border-radius:10px;font-size:11px;font-weight:700">
          ${tipFiltroIsNone ? '0' : tipFiltroActiveCount}
        </span>
        ${tipFiltroIsNone ? `<span style="font-size:11px;color:var(--red);font-weight:700">⚠️ Nessuno selezionato</span>` : ''}
        <div id="glob-tip-filtro-toggle-btn" style="margin-left:auto" onclick="event.stopPropagation()">
          ${_globTipFiltroPanelOpen
            ? `<button class="btn btn-xs btn-secondary" onclick="closeGlobTipFiltroPanel(event)">✕ Chiudi</button>`
            : `<button class="btn btn-xs btn-secondary" onclick="toggleGlobTipFiltroPanel(event)">▼ Espandi</button>`
          }
        </div>
      </div>
      <div id="glob-tip-filtro-container" style="display:${_globTipFiltroPanelOpen ? 'block' : 'none'};margin-top:8px">
        ${renderTipologieFiltroPanel()}
      </div>
    </div>` : '';

  const headerCard = `<div class="globale-preview-card">
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;width:100%">
      <div class="gpc-left">
        <div class="gpc-globe">🌐</div>
        <div>
          <div class="gpc-title">Vista Globale ${state.anno}</div>
          <div class="gpc-sub">${st.clienti} clienti · ${st.adempimenti.size} tipi adempimenti</div>
          ${filtroClienteStatoBadge}
        </div>
      </div>
      <div class="gpc-stats">
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--accent)">${st.totale}</div><div class="cpc-stat-lbl">Totale</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${st.comp}</div><div class="cpc-stat-lbl">Comp.</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--red)">${st.daF}</div><div class="cpc-stat-lbl">Da fare</div></div>
        <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--yellow)">${st.inC}</div><div class="cpc-stat-lbl">In corso</div></div>
        <div class="cpc-stat-item">
          <div class="cpc-stat-num" style="color:var(--green)">${perc}%</div>
          <div class="cpc-stat-lbl">Progresso</div>
          <div class="mini-bar" style="margin-top:4px;width:70px"><div class="mini-fill" style="width:${perc}%"></div></div>
        </div>
      </div>
    </div>
    ${navAdpHtml}
  </div>
  ${tipFiltroHtml}`;

  // ── Raggruppa per adempimento ──────────────────────────────
  const grouped = new Map();
  data.forEach(r => {
    storeRow(r);
    const adpKey = r.adempimento_nome;
    if (!grouped.has(adpKey)) grouped.set(adpKey, { nome: r.adempimento_nome, codice: r.adempimento_codice, clienti: new Map() });
    const g = grouped.get(adpKey);
    const cliKey = r.cliente_id;
    if (!g.clienti.has(cliKey)) g.clienti.set(cliKey, {
      id: r.cliente_id, nome: r.cliente_nome, cf: r.cliente_cf, piva: r.cliente_piva,
      tipologia_codice: r.cliente_tipologia_codice, tipologia_colore: r.cliente_tipologia_colore,
      sottotipologia_nome: r.cliente_sottotipologia_nome, periodicita: r.cliente_periodicita,
      col2: r.cliente_col2, col3: r.cliente_col3, periodi: [],
    });
    g.clienti.get(cliKey).periodi.push(r);
  });

  const gruppiOrdinati = Array.from(grouped.values()).sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));

  const hasFiltroTipologie = !tipFiltroIsAll;

  let content = "";
  gruppiOrdinati.forEach(g => {
    const clientiFiltrati = Array.from(g.clienti.values())
      .filter(c => clientePassaFiltroStato(c.periodi, filtroClienteStato))
      .filter(c => clientePassaFiltroTipologie(c))
      .sort((a, b) => a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }));

    if (!clientiFiltrati.length) return;

    const allRows = clientiFiltrati.flatMap(c => c.periodi);
    const compG = allRows.filter(r => r.stato === "completato").length;
    const totG = allRows.length;
    const pG = totG > 0 ? Math.round((compG / totG) * 100) : 0;

    const clientiHtml = clientiFiltrati.map(c => {
      const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
      const avatar = getAvatar(c.nome);
      const compC = c.periodi.filter(r => r.stato === "completato").length;
      const inCC = c.periodi.filter(r => r.stato === "in_corso").length;
      const daFC = c.periodi.filter(r => r.stato === "da_fare").length;
      const naC = c.periodi.filter(r => r.stato === "n_a").length;
      const totC = c.periodi.length;
      const pC = totC > 0 ? Math.round((compC / totC) * 100) : 0;
      const pgColor = pC === 100 ? "var(--green)" : pC > 50 ? "var(--yellow)" : "var(--red)";

      const situazioneBadges = [];
      if (compC > 0) situazioneBadges.push(`<span style="font-size:10px;color:var(--green);background:var(--green)12;border:1px solid var(--green)33;border-radius:10px;padding:1px 6px">✅ ${compC}</span>`);
      if (inCC > 0) situazioneBadges.push(`<span style="font-size:10px;color:var(--yellow);background:var(--yellow)12;border:1px solid var(--yellow)33;border-radius:10px;padding:1px 6px">🔄 ${inCC}</span>`);
      if (daFC > 0) situazioneBadges.push(`<span style="font-size:10px;color:var(--red);background:var(--red)12;border:1px solid var(--red)33;border-radius:10px;padding:1px 6px">⭕ ${daFC}</span>`);
      if (naC > 0) situazioneBadges.push(`<span style="font-size:10px;color:var(--t3);background:var(--s3);border:1px solid var(--b0);border-radius:10px;padding:1px 6px">➖ ${naC}</span>`);

      const classBadgesHtml = _renderGlobaleClienteClassBadges(c);
      const sottotipoLabel = c.sottotipologia_nome || "";
      const periodiHtml = c.periodi.map(r => renderPeriodoPill(r)).join("");
      const isMensile = c.periodi.length > 4;

      return `<div class="glob-cliente-card">
        <div class="glob-cliente-header">
          <div class="gcr-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}15">${avatar}</div>
          <div style="flex:1;min-width:0">
            <div class="gcr-nome">${escAttr(c.nome)}</div>
            <div class="gcr-cf">${c.cf || c.piva || "-"}</div>
            ${sottotipoLabel ? `<div style="font-size:10px;color:var(--t3);margin-top:2px">🏷️ ${sottotipoLabel}</div>` : ""}
            <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${classBadgesHtml}</div>
            ${situazioneBadges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${situazioneBadges.join("")}</div>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-left:10px">
            <div class="mini-bar" style="width:56px"><div class="mini-fill" style="width:${pC}%;background:${pgColor}"></div></div>
            <span style="font-size:11px;font-family:var(--mono);color:${pgColor};min-width:36px;text-align:right">${compC}/${totC}</span>
          </div>
        </div>
        <div class="glob-cliente-periodi${isMensile ? " periodi-mensili" : ""}">${periodiHtml}</div>
      </div>`;
    }).join("");

    content += `<div class="table-wrap" style="margin-bottom:16px">
      <div class="table-header">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <strong style="font-size:15px">${g.nome}</strong>
          <span style="font-family:var(--mono);font-size:11px;color:var(--t3)">${g.codice}</span>
          ${(filtroClienteStato || hasFiltroTipologie) ? `<span style="font-size:11px;color:var(--t3);margin-left:8px">${clientiFiltrati.length} client${clientiFiltrati.length === 1 ? "e" : "i"} visibil${clientiFiltrati.length === 1 ? "e" : "i"}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="mini-bar" style="width:90px"><div class="mini-fill" style="width:${pG}%"></div></div>
          <span style="font-size:12px;font-family:var(--mono);color:var(--t2)">${compG}/${totG} (${pG}%)</span>
        </div>
      </div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px">${clientiHtml}</div>
    </div>`;
  });

  if (!content) {
    const msgVuoto = tipFiltroIsNone
      ? `Nessun filtro tipologia selezionato — clicca <strong>✦ Tutti</strong> nel pannello Tipologie per vedere i clienti`
      : filtroClienteStato || hasFiltroTipologie
        ? `Nessun cliente corrisponde ai filtri attivi per ${state.anno}`
        : `Nessun adempimento trovato per ${state.anno}`;

    content = `<div class="empty">
      <div class="empty-icon">🌐</div>
      <p style="font-size:15px">${msgVuoto}</p>
      <button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" style="margin-top:12px">⟳ Rimuovi filtri</button>
    </div>`;
  }

  document.getElementById("content").innerHTML = headerCard + content;
}

// ─── ESPOSIZIONE GLOBALE ──────────────────────────────────────
window.toggleGlobTipFiltroPanel = toggleGlobTipFiltroPanel;
window.closeGlobTipFiltroPanel = closeGlobTipFiltroPanel;
window.resetGlobaleFiltri = resetGlobaleFiltri;
window.applyGlobaleFiltri = applyGlobaleFiltri;
window.applyGlobaleFiltriLocali = applyGlobaleFiltriLocali;
window.applyGlobaleFiltriDebounced = applyGlobaleFiltriDebounced;
window.navigaAdempimento = navigaAdempimento;
window.changeAnnoGlobale = changeAnnoGlobale;