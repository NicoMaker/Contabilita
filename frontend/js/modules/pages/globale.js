// ═══════════════════════════════════════════════════════════════
// GLOBALE.JS — Vista Globale scadenzario tutti i clienti
// ═══════════════════════════════════════════════════════════════

var _globTipFiltroPanelOpen = false;

function calcolaGlobaleStats(data) {
  var totale = data.length;
  var comp = 0, daF = 0, inC = 0;
  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (r.stato === "completato") comp++;
    else if (r.stato === "da_fare") daF++;
    else if (r.stato === "in_corso") inC++;
  }
  var clientiSet = {}, adpSet = {};
  for (var j = 0; j < data.length; j++) {
    var row = data[j];
    clientiSet[row.cliente_id] = true;
    adpSet[row.adempimento_nome] = true;
  }
  return { totale: totale, comp: comp, daF: daF, inC: inC, clienti: Object.keys(clientiSet).length, adempimenti: Object.keys(adpSet) };
}

function _globCfg() {
  if (window.TIPOLOGIE_CONFIG) return window.TIPOLOGIE_CONFIG;
  if (!window._globCfgFetchStarted) {
    window._globCfgFetchStarted = true;
    fetch("json/tipologie-data.json").then(function(r) { return r.json(); }).then(function(data) { window.TIPOLOGIE_CONFIG = data; }).catch(function(e) { console.error("[globale.js] fetch tipologie-data.json:", e); });
  }
  return {};
}

function _getActiveFiltroKeys() {
  if (typeof window._activeFiltroKeys !== "undefined") return window._activeFiltroKeys;
  if (typeof _activeFiltroKeys !== "undefined") return _activeFiltroKeys;
  return new Set();
}

function _isManualNessuno() {
  return typeof window._filtroManualeNessuno !== "undefined" ? window._filtroManualeNessuno : false;
}

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
  var container = document.getElementById("glob-tip-filtro-container");
  if (!container) return;
  container.style.display = _globTipFiltroPanelOpen ? "block" : "none";
  var btn = document.getElementById("glob-tip-filtro-toggle-btn");
  if (btn) {
    btn.innerHTML = _globTipFiltroPanelOpen ? '<button class="btn btn-xs btn-secondary" onclick="closeGlobTipFiltroPanel(event)">✕ Chiudi</button>' : '<button class="btn btn-xs btn-secondary" onclick="toggleGlobTipFiltroPanel(event)">▼ Espandi</button>';
  }
}

function _aggiornaGlobTipFiltroCounter() {
  var badge = document.getElementById("glob-tip-filtro-count");
  if (!badge) return;
  var keys = _getActiveFiltroKeys();
  var allKeys = typeof window._getAllKeys === "function" ? window._getAllKeys() : [];
  var isNone = _isManualNessuno() || keys.size === 0;
  var isAll = !isNone && keys.size === allKeys.length;
  if (isNone) {
    badge.textContent = "0";
    badge.style.display = "inline-flex";
    badge.style.background = "var(--red)";
  } else if (isAll) {
    badge.textContent = "";
    badge.style.display = "none";
  } else {
    badge.textContent = keys.size;
    badge.style.display = "inline-flex";
    badge.style.background = "var(--accent)";
  }
}

function _refreshGlobTipFiltroPanel() {
  var container = document.getElementById("glob-tip-filtro-container");
  if (!container || !_globTipFiltroPanelOpen) return;
  if (typeof renderTipologieFiltroPanel === "function") {
    var tmp = document.createElement("div");
    tmp.innerHTML = renderTipologieFiltroPanel();
    container.innerHTML = "";
    container.appendChild(tmp.firstChild);
  }
  container.style.display = "block";
  _aggiornaGlobTipFiltroCounter();
}

function clientePassaFiltroTipologie(c) {
  var activeFiltroKeys = _getActiveFiltroKeys();
  var isNone = _isManualNessuno();
  if (isNone || activeFiltroKeys.size === 0) return false;
  var allKeys = typeof window._getAllKeys === "function" ? window._getAllKeys() : [];
  if (allKeys.length > 0 && activeFiltroKeys.size === allKeys.length) return true;
  var tipCod = c.tipologia_codice || "";
  var col2DbToLabel = window.COL2_DB_TO_LABEL || { privato: "Privato", ditta: "Ditta Individuale", socio: "Socio", professionista: "Professionista" };
  var col3DbToLabel = window.COL3_DB_TO_LABEL || { ordinario: "Ordinario", ordinaria: "Ordinaria", semplificato: "Semplificato", semplificata: "Semplificata", forfettario: "Forfettario" };
  var col2Raw = (c.col2 || "").toLowerCase();
  var col3Raw = (c.col3 || "").toLowerCase();
  var col2Display = col2DbToLabel[col2Raw] || "";
  var col3Display = col3DbToLabel[col3Raw] || "";
  var per = c.periodicita || "";
  var keysArray = Array.from(activeFiltroKeys);
  for (var i = 0; i < keysArray.length; i++) {
    var key = keysArray[i];
    var parts = key.split("|");
    var kTip = parts[0];
    var kCol2 = parts[1] || "";
    var kCol3 = parts[2] || "";
    var kPer = parts[3] || "";
    if (kTip !== tipCod) continue;
    if (kCol2 && kCol2 !== col2Display && kCol2.toLowerCase() !== col2Raw) continue;
    if (kCol3 && kCol3 !== col3Display && kCol3.toLowerCase() !== col3Raw) continue;
    if (kPer && kPer !== per) continue;
    return true;
  }
  return false;
}

function clientePassaFiltroStato(periodi, filtroClienteStato) {
  if (!filtroClienteStato) return true;
  var hasInCorso = false, hasDaFare = false, hasCompletato = false, hasNA = false;
  var tuttiComp = true, nessunAvanz = true;
  for (var i = 0; i < periodi.length; i++) {
    var stato = periodi[i].stato;
    if (stato === "in_corso") hasInCorso = true;
    if (stato === "da_fare") hasDaFare = true;
    if (stato === "completato") hasCompletato = true;
    if (stato === "n_a") hasNA = true;
    if (stato !== "completato" && stato !== "n_a") tuttiComp = false;
    if (stato !== "da_fare") nessunAvanz = false;
  }
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

function _getCol2DisplayMap() {
  var cfg = _globCfg();
  var map = {};
  var percorsi = cfg.percorsi || {};
  var keys = Object.keys(percorsi);
  for (var k = 0; k < keys.length; k++) {
    var arr = percorsi[keys[k]];
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p.col2Label) continue;
      var db = p.col2Label === "Ditta Individuale" ? "ditta" : p.col2Label.toLowerCase();
      var short = p.col2Label === "Ditta Individuale" ? "Ditta Ind." : (p.col2Label === "Professionista" ? "Prof." : p.col2Label);
      map[db] = short;
    }
  }
  return map;
}

function _getCol3DisplayMap() {
  var cfg = _globCfg();
  var map = {};
  var percorsi = cfg.percorsi || {};
  var keys = Object.keys(percorsi);
  for (var k = 0; k < keys.length; k++) {
    var arr = percorsi[keys[k]];
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      if (!p.col3Label) continue;
      var db = p.col3Label.toLowerCase();
      var short = p.col3Label.indexOf("Ordin") === 0 ? "Ord." : (p.col3Label.indexOf("Sempl") === 0 ? "Sempl." : (p.col3Label === "Forfettario" ? "Forf." : p.col3Label));
      map[db] = short;
    }
  }
  return map;
}

function _renderGlobaleClienteClassBadges(c) {
  var cfg = _globCfg();
  var col2Map = _getCol2DisplayMap();
  var col3Map = _getCol3DisplayMap();
  var tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
  var perAll = (cfg.periodicitaIva || []).concat(cfg.periodicitaAnnuale || []);
  var badges = '<span class="badge b-' + (c.tipologia_codice || "").toLowerCase() + '" style="font-size:11px" title="' + ((TIPOLOGIE_INFO[c.tipologia_codice] || {}).desc || "") + '">' + (c.tipologia_codice || "-") + '</span>';
  if (c.col2) badges += '<span class="badge-info" style="font-size:10px">' + (col2Map[c.col2] || c.col2) + '</span>';
  if (c.col3) badges += '<span class="badge-info" style="font-size:10px">' + (col3Map[c.col3] || c.col3) + '</span>';
  if (c.periodicita) {
    var perObj = null;
    for (var i = 0; i < perAll.length; i++) { if (perAll[i].value === c.periodicita) { perObj = perAll[i]; break; } }
    badges += '<span class="badge-per" style="font-size:10px">' + (perObj ? perObj.label : c.periodicita) + '</span>';
  }
  return badges;
}

function escapeHtmlForSelect(str) {
  if (!str) return str;
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

// ═══════════════════════════════════════════════════════════════
// RENDER PAGINA PRINCIPALE
// ═══════════════════════════════════════════════════════════════

function renderGlobalePage() {
  var activeFiltroKeys = _getActiveFiltroKeys();
  if (activeFiltroKeys.size === 0 && !_isManualNessuno() && typeof initializeTipologieFilter === "function") {
    initializeTipologieFilter();
  }
  if (typeof state.globaleSelectedCliente === "undefined") state.globaleSelectedCliente = "";

  document.getElementById("topbar-actions").innerHTML = 
    '<div class="year-sel">' +
      '<button onclick="changeAnnoGlobale(-1)" title="Anno precedente">&#9664;</button>' +
      '<span class="year-num">' + state.anno + '</span>' +
      '<button onclick="changeAnnoGlobale(1)" title="Anno successivo">&#9654;</button>' +
    '</div>' +
    '<select class="select topbar-select" id="glob-sel-cliente" onchange="onGlobaleClienteChange()" title="Seleziona il cliente" style="min-width:200px;max-width:260px">' +
      '<option value="">-- Seleziona Cliente --</option>' +
    '</select>' +
    '<select class="select" id="glob-filtro-adp" style="width:210px;font-size:13px" onchange="applyGlobaleFiltri()" title="Filtra per tipo di adempimento">' +
      '<option value="">📋 Tutti adempimenti</option>' +
    '</select>' +
    '<select class="select" id="glob-filtro-stato" style="width:155px;font-size:13px" onchange="applyGlobaleFiltri()" title="Filtra per stato adempimento">' +
      '<option value="">🔵 Tutti stati</option>' +
      '<option value="da_fare">⭕ Da fare</option>' +
      '<option value="in_corso">🔄 In corso</option>' +
      '<option value="completato">✅ Completato</option>' +
      '<option value="n_a">➖ N/A</option>' +
    '</select>' +
    '<button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" title="Azzera tutti i filtri" style="font-size:13px">⟳ Tutti</button>' +
    '<button class="btn btn-print btn-sm" onclick="window.print()" style="font-size:13px">🖨️ Stampa</button>';

  setTimeout(function() {
    initSearchableSelect("glob-filtro-adp");
    initSearchableSelect("glob-sel-cliente");
    populateGlobaleClienti();
    if (state.globalePreFiltroAdp && state.globalePreFiltroAdp !== "") {
      var filterValue = state.globalePreFiltroAdp;
      var adpSel = document.getElementById("glob-filtro-adp");
      if (adpSel) {
        setTimeout(function() {
          adpSel.value = filterValue;
          if (adpSel._ssRefresh) adpSel._ssRefresh();
          var filtri = { adempimento: filterValue };
          socket.emit("get:scadenzario_globale", { anno: state.anno, filtri: filtri });
        }, 150);
      }
    } else {
      loadGlobale();
    }
  }, 50);
}

function changeAnnoGlobale(d) {
  state.anno += d;
  var yearNums = document.querySelectorAll(".year-num");
  for (var i = 0; i < yearNums.length; i++) yearNums[i].textContent = state.anno;
  loadGlobale();
}

function populateGlobaleClienti() {
  if (!state.clienti || state.clienti.length === 0) {
    socket.emit("get:clienti", { anno: state.anno });
    socket.once("res:clienti", function(data) {
      if (data.success) { state.clienti = data.data; renderGlobaleClientiSelect(); }
    });
  } else {
    renderGlobaleClientiSelect();
  }
}

function renderGlobaleClientiSelect() {
  var clienteSel = document.getElementById("glob-sel-cliente");
  if (!clienteSel) return;
  var currentValue = state.globaleSelectedCliente || "";
  var opts = (state.clienti || []).map(function(c) { return '<option value="' + c.id + '"' + (String(c.id) === String(currentValue) ? ' selected' : '') + '>[' + (c.tipologia_codice || "?") + '] ' + c.nome + '</option>'; }).join("");
  clienteSel.innerHTML = '<option value="">-- Seleziona Cliente --</option>' + opts;
  if (currentValue) clienteSel.value = currentValue;
  if (!clienteSel.dataset.ssinit) { initSearchableSelect("glob-sel-cliente"); } else if (clienteSel._ssRefresh) { clienteSel._ssRefresh(); }
}

function onGlobaleClienteChange() {
  var clienteSel = document.getElementById("glob-sel-cliente");
  var clienteId = clienteSel ? clienteSel.value : "";
  state.globaleSelectedCliente = clienteId;
  applyGlobaleFiltri();
}

function loadGlobale() {
  var filtri = {};
  var adpSel = document.getElementById("glob-filtro-adp");
  var statoSel = document.getElementById("glob-filtro-stato");
  var clienteSearch = document.getElementById("glob-search-cliente");
  if (adpSel && adpSel.value) filtri.adempimento = adpSel.value;
  if (statoSel && statoSel.value) filtri.stato = statoSel.value;
  if (clienteSearch && clienteSearch.value) filtri.search = clienteSearch.value;
  if (state.globaleSelectedCliente && state.globaleSelectedCliente !== "") filtri.cliente_id = parseInt(state.globaleSelectedCliente);
  if (state.globalePreFiltroAdp && !filtri.adempimento) filtri.adempimento = state.globalePreFiltroAdp;
  socket.emit("get:scadenzario_globale", { anno: state.anno, filtri: filtri });
}

var applyGlobaleFiltriDebounced = debounce(function() { state.globalePreFiltroAdp = ""; loadGlobale(); }, 300);
function applyGlobaleFiltri() { state.globalePreFiltroAdp = ""; loadGlobale(); }
function applyGlobaleFiltriLocali() { if (state.scadGlobale) renderGlobaleTabella(state.scadGlobale); }

function resetGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  state.globaleSelectedCliente = "";
  var ids = ["glob-filtro-adp","glob-filtro-stato","glob-search-cliente","glob-sel-cliente"];
  for (var i = 0; i < ids.length; i++) { var el = document.getElementById(ids[i]); if (el) { el.value = ""; if (el._ssRefresh) el._ssRefresh(); } }
  if (typeof initializeTipologieFilter === "function") initializeTipologieFilter();
  _refreshGlobTipFiltroPanel();
  _aggiornaGlobTipFiltroCounter();
  loadGlobale();
}

function resetGlobaleClienteSel() {
  state.globaleSelectedCliente = "";
  var el = document.getElementById("glob-sel-cliente");
  if (el) { el.value = ""; if (el._ssRefresh) el._ssRefresh(); }
}

// ═══════════════════════════════════════════════════════════════
// RENDER HEADER CON FILTRO ADEMPIMENTO
// ═══════════════════════════════════════════════════════════════

function renderGlobaleHeader() {
  var st = state.globaleStats;
  if (!st) return;
  var adpSel = document.getElementById("glob-filtro-adp");
  if (adpSel) {
    var currentValue = adpSel.value;
    if (state.globalePreFiltroAdp && state.globalePreFiltroAdp !== "") currentValue = state.globalePreFiltroAdp;
    var adpList = Array.from(st.adempimenti);
    adpList.sort(function(a, b) { return a.localeCompare(b, "it", { sensitivity: "base" }); });
    var options = '<option value="">📋 Tutti adempimenti</option>';
    var foundValue = false;
    for (var i = 0; i < adpList.length; i++) {
      var adpName = adpList[i];
      var selected = (currentValue === adpName) ? ' selected' : '';
      if (currentValue === adpName) foundValue = true;
      options += '<option value="' + escapeHtmlForSelect(adpName) + '"' + selected + '>' + adpName + '</option>';
    }
    adpSel.innerHTML = options;
    if (!foundValue && state.globalePreFiltroAdp && state.globalePreFiltroAdp !== "") adpSel.value = state.globalePreFiltroAdp;
    if (!adpSel.dataset.ssinit) initSearchableSelect("glob-filtro-adp");
    else if (adpSel._ssRefresh) adpSel._ssRefresh();
    if (state.globalePreFiltroAdp) {
      var tempFilter = state.globalePreFiltroAdp;
      state.globalePreFiltroAdp = "";
      if (adpSel.value !== tempFilter) { adpSel.value = tempFilter; if (adpSel._ssRefresh) adpSel._ssRefresh(); }
    }
  }
}

function navigaAdempimento(direzione) {
  var adpSel = document.getElementById("glob-filtro-adp");
  if (!adpSel || !state.globaleStats) return;
  var lista = Array.from(state.globaleStats.adempimenti);
  lista.sort(function(a, b) { return a.localeCompare(b, "it", { sensitivity: "base" }); });
  var current = adpSel.value;
  var idx = lista.indexOf(current);
  var newIdx;
  if (direzione === -1) newIdx = idx <= 0 ? lista.length - 1 : idx - 1;
  else newIdx = idx >= lista.length - 1 || idx === -1 ? 0 : idx + 1;
  adpSel.value = lista[newIdx];
  if (adpSel._ssRefresh) adpSel._ssRefresh();
  applyGlobaleFiltri();
}

// ═══════════════════════════════════════════════════════════════
// RENDER TABELLA COMPLETO (UNICA VERSIONE - ORDINAMENTO DESC)
// ═══════════════════════════════════════════════════════════════

function renderGlobaleTabella(rawData) {
  var st = state.globaleStats;
  var filtroClienteStatoEl = document.getElementById("glob-filtro-cliente-stato");
  var filtroClienteStato = filtroClienteStatoEl ? filtroClienteStatoEl.value : "";
  var clienteSearch = document.getElementById("glob-search-cliente");
  var searchTerm = clienteSearch ? clienteSearch.value.toLowerCase() : "";
  var selectedClienteId = (state.globaleSelectedCliente && state.globaleSelectedCliente !== "") ? parseInt(state.globaleSelectedCliente) : null;

  var data = [];
  for (var i = 0; i < rawData.length; i++) {
    var r = rawData[i];
    if (selectedClienteId && r.cliente_id !== selectedClienteId) continue;
    if (searchTerm) {
      var clienteNome = (r.cliente_nome || "").toLowerCase();
      var clienteCf = (r.cliente_cf || "").toLowerCase();
      var clientePiva = (r.cliente_piva || "").toLowerCase();
      if (clienteNome.indexOf(searchTerm) === -1 && clienteCf.indexOf(searchTerm) === -1 && clientePiva.indexOf(searchTerm) === -1) continue;
    }
    data.push(r);
  }
  
  var perc = st.totale > 0 ? Math.round((st.comp / st.totale) * 100) : 0;
  var activeFiltroKeys = _getActiveFiltroKeys();
  var allKeysArr = typeof window._getAllKeys === "function" ? window._getAllKeys() : [];
  var isNone = _isManualNessuno() || activeFiltroKeys.size === 0;
  var isAll = !isNone && activeFiltroKeys.size === allKeysArr.length;
  var tipFiltroIsNone = isNone;
  var hasFiltroTipologie = !isAll;
  var tipFiltroCountDisplay = isNone ? "0" : (isAll ? "" : activeFiltroKeys.size);
  var showTipBadge = isNone || (!isAll && activeFiltroKeys.size > 0);
  var adpSel = document.getElementById("glob-filtro-adp");
  var adpFiltroAttivo = adpSel ? adpSel.value : "";
  if (state.globalePreFiltroAdp && state.globalePreFiltroAdp !== "" && !adpFiltroAttivo) adpFiltroAttivo = state.globalePreFiltroAdp;
  
  var filtroClienteStatoLabels = {
    con_in_corso: "🔄 Con almeno 1 in corso", senza_in_corso: "✅ Senza in corso",
    tutti_completati: "🏆 Tutto completato", con_da_fare: "⭕ Con almeno 1 da fare",
    solo_da_fare: "🚨 Solo da fare", non_completati: "⚠️ Non al 100%",
    con_na: "➖ Con almeno 1 N/A"
  };
  
  var filtroClienteStatoBadge = "";
  if (filtroClienteStato) {
    filtroClienteStatoBadge = '<div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:5px 12px;background:var(--yellow)18;border:1px solid var(--yellow)44;border-radius:20px;font-size:12px;color:var(--yellow)">' +
      '<span>Filtro clienti:</span>' +
      '<strong>' + (filtroClienteStatoLabels[filtroClienteStato] || filtroClienteStato) + '</strong>' +
      '<button onclick="document.getElementById(\'glob-filtro-cliente-stato\').value=\'\';applyGlobaleFiltriLocali()" style="background:none;border:none;color:var(--yellow);cursor:pointer;font-size:13px;padding:0 2px;line-height:1" title="Rimuovi filtro">✕</button>' +
      '</div>';
  }

  var clienteSelBadge = "";
  if (selectedClienteId && state.clienti) {
    var clienteTrovato = null;
    for (var ci = 0; ci < state.clienti.length; ci++) {
      if (parseInt(state.clienti[ci].id) === selectedClienteId) { clienteTrovato = state.clienti[ci]; break; }
    }
    if (clienteTrovato) {
      clienteSelBadge = '<div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;margin-left:10px;padding:5px 12px;background:var(--accent)18;border:1px solid var(--accent)44;border-radius:20px;font-size:12px;color:var(--accent)">' +
        '<span>👤 Cliente:</span>' +
        '<strong>' + escAttr(clienteTrovato.nome) + '</strong>' +
        '<button onclick="state.globaleSelectedCliente=\'\';resetGlobaleClienteSel();applyGlobaleFiltri()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:0 2px;line-height:1" title="Rimuovi filtro cliente">✕</button>' +
        '</div>';
    }
  }

  var searchBadge = "";
  if (searchTerm) {
    searchBadge = '<div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;margin-left:10px;padding:5px 12px;background:var(--accent)18;border:1px solid var(--accent)44;border-radius:20px;font-size:12px;color:var(--accent)">' +
      '<span>🔍 Ricerca:</span>' +
      '<strong>' + searchTerm + '</strong>' +
      '<button onclick="document.getElementById(\'glob-search-cliente\').value=\'\';applyGlobaleFiltri()" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:13px;padding:0 2px;line-height:1" title="Rimuovi filtro">✕</button>' +
      '</div>';
  }
  
  var navAdpHtml = "";
  if (adpFiltroAttivo && adpFiltroAttivo !== "" && st.adempimenti && st.adempimenti.length > 0) {
    navAdpHtml = '<div class="glob-nav-adp" style="margin-top:14px;text-align:center">' +
      '<span style="font-family:var(--mono);font-size:13px;color:var(--accent);background:var(--accent-d);padding:4px 12px;border-radius:20px">' + adpFiltroAttivo + '</span>' +
      '</div>';
  }
  
  var tipFiltroHtml = "";
  if (typeof renderTipologieFiltroPanel === "function") {
    tipFiltroHtml = '<div class="glob-tip-filtro-wrap" style="margin-bottom:14px">' +
      '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--s2);border:1px solid var(--b0);border-radius:var(--r-sm);cursor:pointer;" onclick="toggleGlobTipFiltroPanel(event)">' +
        '<span style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">🏷️ Filtro Tipologie Clienti</span>' +
        '<span id="glob-tip-filtro-count" style="display:' + (showTipBadge ? "inline-flex" : "none") + ';align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;background:' + (isNone ? "var(--red)" : "var(--accent)") + ';color:#fff;border-radius:10px;font-size:11px;font-weight:700">' + tipFiltroCountDisplay + '</span>' +
        (tipFiltroIsNone ? '<span style="font-size:11px;color:var(--red);font-weight:700">⚠️ Nessuno selezionato</span>' : '') +
        '<div id="glob-tip-filtro-toggle-btn" style="margin-left:auto" onclick="event.stopPropagation()">' +
          (_globTipFiltroPanelOpen ? '<button class="btn btn-xs btn-secondary" onclick="closeGlobTipFiltroPanel(event)">✕ Chiudi</button>' : '<button class="btn btn-xs btn-secondary" onclick="toggleGlobTipFiltroPanel(event)">▼ Espandi</button>') +
        '</div>' +
      '</div>' +
      '<div id="glob-tip-filtro-container" style="display:' + (_globTipFiltroPanelOpen ? "block" : "none") + ';margin-top:8px">' + renderTipologieFiltroPanel() + '</div>' +
      '</div>';
  }
  
  var headerCard = '<div class="globale-preview-card">' +
    '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;width:100%">' +
      '<div class="gpc-left">' +
        '<div class="gpc-globe">🌐</div>' +
        '<div>' +
          '<div class="gpc-title">Vista Globale ' + state.anno + '</div>' +
          '<div class="gpc-sub">' + st.clienti + ' clienti · ' + st.adempimenti.length + ' tipi adempimenti</div>' +
          '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:6px">' +
            filtroClienteStatoBadge + clienteSelBadge + searchBadge +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="gpc-stats">' +
        '<div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--accent)">' + st.totale + '</div><div class="cpc-stat-lbl">Totale</div></div>' +
        '<div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">' + st.comp + '</div><div class="cpc-stat-lbl">Comp.</div></div>' +
        '<div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--red)">' + st.daF + '</div><div class="cpc-stat-lbl">Da fare</div></div>' +
        '<div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--yellow)">' + st.inC + '</div><div class="cpc-stat-lbl">In corso</div></div>' +
        '<div class="cpc-stat-item">' +
          '<div class="cpc-stat-num" style="color:var(--green)">' + perc + '%</div>' +
          '<div class="cpc-stat-lbl">Progresso</div>' +
          '<div class="mini-bar" style="margin-top:4px;width:70px"><div class="mini-fill" style="width:' + perc + '%"></div></div>' +
        '</div>' +
      '</div>' +
    '</div>' + navAdpHtml + '</div>' + tipFiltroHtml;
  
  // RAGGRUPPA PER ADEMPIMENTO E CLIENTE
  var grouped = {};
  for (var idxData = 0; idxData < data.length; idxData++) {
    var rowData = data[idxData];
    storeRow(rowData);
    var adpKey = rowData.adempimento_nome;
    if (!grouped[adpKey]) grouped[adpKey] = { nome: rowData.adempimento_nome, codice: rowData.adempimento_codice, clienti: {} };
    var group = grouped[adpKey];
    var cliKey = rowData.cliente_id;
    if (!group.clienti[cliKey]) {
      group.clienti[cliKey] = {
        id: rowData.cliente_id, nome: rowData.cliente_nome, cf: rowData.cliente_cf, piva: rowData.cliente_piva,
        tipologia_codice: rowData.cliente_tipologia_codice, tipologia_colore: rowData.cliente_tipologia_colore,
        sottotipologia_nome: rowData.cliente_sottotipologia_nome, periodicita: rowData.cliente_periodicita,
        col2: rowData.cliente_col2, col3: rowData.cliente_col3, periodi: []
      };
    }
    group.clienti[cliKey].periodi.push(rowData);
  }
  
  var gruppi = [];
  for (var key in grouped) { if (grouped.hasOwnProperty(key)) gruppi.push(grouped[key]); }
  gruppi.sort(function(a, b) { return a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }); });
  
  var content = "";
  for (var gIdx = 0; gIdx < gruppi.length; gIdx++) {
    var g = gruppi[gIdx];
    var clientiArray = [];
    for (var cKey in g.clienti) { if (g.clienti.hasOwnProperty(cKey)) clientiArray.push(g.clienti[cKey]); }
    
    var clientiFiltrati = [];
    for (var cIdx = 0; cIdx < clientiArray.length; cIdx++) {
      var c = clientiArray[cIdx];
      if (!clientePassaFiltroStato(c.periodi, filtroClienteStato)) continue;
      if (!clientePassaFiltroTipologie(c)) continue;
      clientiFiltrati.push(c);
    }
    clientiFiltrati.sort(function(a, b) { return a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }); });
    if (clientiFiltrati.length === 0) continue;
    
    var allRows = [];
    for (var cfIdx = 0; cfIdx < clientiFiltrati.length; cfIdx++) {
      var periodi = clientiFiltrati[cfIdx].periodi;
      for (var pIdx = 0; pIdx < periodi.length; pIdx++) allRows.push(periodi[pIdx]);
    }
    var compG = 0;
    for (var arIdx = 0; arIdx < allRows.length; arIdx++) { if (allRows[arIdx].stato === "completato") compG++; }
    var totG = allRows.length;
    var pG = totG > 0 ? Math.round((compG / totG) * 100) : 0;
    
    var clientiHtml = "";
    for (var cFilIdx = 0; cFilIdx < clientiFiltrati.length; cFilIdx++) {
      var client = clientiFiltrati[cFilIdx];
      var tipColor = client.tipologia_colore || getTipologiaColor(client.tipologia_codice);
      var avatar = getAvatar(client.nome);
      var compC = 0, inCC = 0, daFC = 0, naC = 0;
      for (var perIdx = 0; perIdx < client.periodi.length; perIdx++) {
        var statoPer = client.periodi[perIdx].stato;
        if (statoPer === "completato") compC++;
        else if (statoPer === "in_corso") inCC++;
        else if (statoPer === "da_fare") daFC++;
        else if (statoPer === "n_a") naC++;
      }
      var totC = client.periodi.length;
      var pC = totC > 0 ? Math.round((compC / totC) * 100) : 0;
      var pgColor = pC === 100 ? "var(--green)" : pC > 50 ? "var(--yellow)" : "var(--red)";
      
      var situazioneBadges = "";
      if (compC > 0) situazioneBadges += '<span style="font-size:10px;color:var(--green);background:var(--green)12;border:1px solid var(--green)33;border-radius:10px;padding:1px 6px">✅ ' + compC + '</span>';
      if (inCC > 0) situazioneBadges += '<span style="font-size:10px;color:var(--yellow);background:var(--yellow)12;border:1px solid var(--yellow)33;border-radius:10px;padding:1px 6px">🔄 ' + inCC + '</span>';
      if (daFC > 0) situazioneBadges += '<span style="font-size:10px;color:var(--red);background:var(--red)12;border:1px solid var(--red)33;border-radius:10px;padding:1px 6px">⭕ ' + daFC + '</span>';
      if (naC > 0) situazioneBadges += '<span style="font-size:10px;color:var(--t3);background:var(--s3);border:1px solid var(--b0);border-radius:10px;padding:1px 6px">➖ ' + naC + '</span>';
      
      var classBadgesHtml = _renderGlobaleClienteClassBadges(client);
      var sottotipoLabel = client.sottotipologia_nome || "";
      
      // ⭐ ORDINA i periodi: data_scadenza ASC (più vecchio prima), poi nome adempimento
      var periodiOrdinati = client.periodi.slice().sort(function(a, b) {
        // Prima ordina per data_scadenza ASC (più vecchio prima)
        if (a.data_scadenza && b.data_scadenza) {
          var dateA = new Date(a.data_scadenza);
          var dateB = new Date(b.data_scadenza);
          return dateA - dateB;
        }
        // Chi ha data va prima di chi non ha data
        if (a.data_scadenza) return -1;
        if (b.data_scadenza) return 1;
        // Se nessuna data, ordina per nome adempimento (alfabetico)
        return a.adempimento_nome.localeCompare(b.adempimento_nome, "it", { sensitivity: "base" });
      });
      
      var periodiHtml = "";
      for (var perHtmlIdx = 0; perHtmlIdx < periodiOrdinati.length; perHtmlIdx++) {
        periodiHtml += renderPeriodoPill(periodiOrdinati[perHtmlIdx]);
      }
      var isMensile = client.periodi.length > 4;
      
      clientiHtml += '<div class="glob-cliente-card">' +
        '<div class="glob-cliente-header">' +
          '<div class="gcr-avatar" style="border-color:' + tipColor + ';color:' + tipColor + ';background:' + tipColor + '15">' + avatar + '</div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="gcr-nome">' + escAttr(client.nome) + '</div>' +
            '<div class="gcr-cf">' + (client.cf || client.piva || "-") + '</div>' +
            (sottotipoLabel ? '<div style="font-size:10px;color:var(--t3);margin-top:2px">🏷️ ' + sottotipoLabel + '</div>' : '') +
            '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">' + classBadgesHtml + '</div>' +
            (situazioneBadges ? '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">' + situazioneBadges + '</div>' : '') +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:8px;margin-left:10px">' +
            '<div class="mini-bar" style="width:56px"><div class="mini-fill" style="width:' + pC + '%;background:' + pgColor + '"></div></div>' +
            '<span style="font-size:11px;font-family:var(--mono);color:' + pgColor + ';min-width:36px;text-align:right">' + compC + '/' + totC + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="glob-cliente-periodi' + (isMensile ? " periodi-mensili" : "") + '">' + periodiHtml + '</div>' +
      '</div>';
    }
    
    content += '<div class="table-wrap" style="margin-bottom:16px">' +
      '<div class="table-header">' +
        '<div style="display:flex;align-items:center;gap:12px;flex:1">' +
          '<strong style="font-size:15px">' + g.nome + '</strong>' +
          '<span style="font-family:var(--mono);font-size:11px;color:var(--t3)">' + g.codice + '</span>' +
          (filtroClienteStato || hasFiltroTipologie ? '<span style="font-size:11px;color:var(--t3);margin-left:8px">' + clientiFiltrati.length + ' client' + (clientiFiltrati.length === 1 ? "e" : "i") + ' visibil' + (clientiFiltrati.length === 1 ? "e" : "i") + '</span>' : '') +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<div class="mini-bar" style="width:90px"><div class="mini-fill" style="width:' + pG + '%"></div></div>' +
          '<span style="font-size:12px;font-family:var(--mono);color:var(--t2)">' + compG + '/' + totG + ' (' + pG + '%)</span>' +
        '</div>' +
      '</div>' +
      '<div style="padding:12px;display:flex;flex-direction:column;gap:8px">' + clientiHtml + '</div>' +
    '</div>';
  }
  
  if (!content) {
    var msgVuoto = tipFiltroIsNone ? 'Nessun filtro tipologia selezionato — clicca <strong>✦ Tutti</strong> nel pannello Tipologie per vedere i clienti' : (filtroClienteStato || hasFiltroTipologie || searchTerm || selectedClienteId ? 'Nessun cliente corrisponde ai filtri attivi per ' + state.anno : 'Nessun adempimento trovato per ' + state.anno);
    content = '<div class="empty">' +
      '<div class="empty-icon">🌐</div>' +
      '<p style="font-size:15px">' + msgVuoto + '</p>' +
      '<button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" style="margin-top:12px">⟳ Rimuovi filtri</button>' +
    '</div>';
  }
  
  document.getElementById("content").innerHTML = headerCard + content;
  if (state.globalePreFiltroAdp) state.globalePreFiltroAdp = "";
}

// ═══════════════════════════════════════════════════════════════
// ESPOSIZIONE GLOBALE
// ═══════════════════════════════════════════════════════════════

window.toggleGlobTipFiltroPanel = toggleGlobTipFiltroPanel;
window.closeGlobTipFiltroPanel = closeGlobTipFiltroPanel;
window.resetGlobaleFiltri = resetGlobaleFiltri;
window.resetGlobaleClienteSel = resetGlobaleClienteSel;
window.applyGlobaleFiltri = applyGlobaleFiltri;
window.applyGlobaleFiltriLocali = applyGlobaleFiltriLocali;
window.applyGlobaleFiltriDebounced = applyGlobaleFiltriDebounced;
window.navigaAdempimento = navigaAdempimento;
window.changeAnnoGlobale = changeAnnoGlobale;
window.populateGlobaleClienti = populateGlobaleClienti;
window.renderGlobaleClientiSelect = renderGlobaleClientiSelect;
window.onGlobaleClienteChange = onGlobaleClienteChange;