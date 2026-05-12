// ═══════════════════════════════════════════════════════════════
// CLIENTI.JS — Gestione clienti con configurazione annuale
// Configurazione letta da: json/tipologie-data.json
// ═══════════════════════════════════════════════════════════════

let currentClienteAnno = new Date().getFullYear();
let currentClienteId = null;

let lastClienteFormValues = {
  col2: "",
  col3: "",
  col4: "",
};

// ─── CARICAMENTO CONFIG JSON ──────────────────────────────────
// _TIPOLOGIE_DATA è null finché il fetch non completa.
// _cfgReady è una Promise che si risolve appena i dati sono disponibili.
let _TIPOLOGIE_DATA = null;

const _cfgReady = (async () => {
  try {
    const res = await fetch("json/tipologie-data.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    _TIPOLOGIE_DATA = await res.json();
    // Esponi anche globalmente per globale.js (caricato separatamente)
    window.TIPOLOGIE_CONFIG = _TIPOLOGIE_DATA;
    // Ora che i dati ci sono, inizializza i filtri e le mappe
    initializeTipologieFilter();
    _syncGlobalFiltroKeys();
  } catch (e) {
    console.error(
      "[clienti.js] Impossibile caricare json/tipologie-data.json:",
      e,
    );
    _TIPOLOGIE_DATA = {};
    window.TIPOLOGIE_CONFIG = {};
  }
})();

// Accessor sincrono — restituisce l'oggetto già caricato oppure {}
// (tutte le funzioni che lo usano vengono chiamate dopo il DOM ready,
//  quindi _TIPOLOGIE_DATA è già popolato quando servono)
function _cfg() {
  if (!_TIPOLOGIE_DATA) {
    // Caso raro: chiamata prima che il fetch completi
    return window.TIPOLOGIE_CONFIG || {};
  }
  return _TIPOLOGIE_DATA;
}

// Espone una funzione per attendere il caricamento (usabile da altri moduli)
window._cfgReady = _cfgReady;

// ─── COSTRUISCE TIPOLOGIE_PERCORSI_DATA DAL JSON ──────────────
// Shape identica alla versione hardcoded, così il resto del codice
// continua a funzionare senza modifiche.
function _buildTipologiePercorsiData() {
  const cfg = _cfg();
  if (!cfg.percorsi || !cfg.tipologie) return {};
  const out = {};
  Object.entries(cfg.percorsi).forEach(([tipCod, percorsiArr]) => {
    const tipMeta = cfg.tipologie[tipCod] || {};
    out[tipCod] = {
      color: tipMeta.color || "#888",
      icon: tipMeta.icon || "📋",
      desc: tipMeta.desc || tipCod,
      percorsi: percorsiArr.map((p) => ({
        col2: p.col2Label,
        col3: p.col3Label,
        codice: p.codice,
        hasPer: p.hasPer,
        isForf: p.isForfettario,
      })),
    };
  });
  return out;
}

// Getter lazy: si ricalcola dal JSON ogni volta, così un hot-reload
// del JSON viene recepito immediatamente.
function _getTipologiePercorsiData() {
  return _buildTipologiePercorsiData();
}

// ─── MAPPE LABEL ↔ DB ─────────────────────────────────────────
// Costruite dinamicamente dal JSON invece di essere hardcoded.
function _buildCol2Maps() {
  const cfg = _cfg();
  const label2db = {};
  const db2label = {};
  Object.values(cfg.percorsi || {})
    .flat()
    .forEach((p) => {
      if (!p.col2Label) return;
      const db =
        p.col2Label === "Ditta Individuale"
          ? "ditta"
          : p.col2Label.toLowerCase();
      label2db[p.col2Label] = db;
      db2label[db] = p.col2Label;
    });
  return { label2db, db2label };
}

function _buildCol3Maps() {
  const cfg = _cfg();
  const label2db = {};
  const db2label = {};
  Object.values(cfg.percorsi || {})
    .flat()
    .forEach((p) => {
      if (!p.col3Label) return;
      const db = p.col3Label.toLowerCase();
      label2db[p.col3Label] = db;
      db2label[db] = p.col3Label;
    });
  return { label2db, db2label };
}

// Esposti globalmente (usati anche da globale.js)
function _col2LabelToDb() {
  return _buildCol2Maps().label2db;
}
function _col2DbToLabel() {
  return _buildCol2Maps().db2label;
}
function _col3LabelToDb() {
  return _buildCol3Maps().label2db;
}
function _col3DbToLabel() {
  return _buildCol3Maps().db2label;
}

// ─── STATO FILTRO ─────────────────────────────────────────────
// Set di chiavi attive: "TIP|col2Label|col3Label|periodicita"
// NOTA: col2 e col3 nelle chiavi usano il *label display* (non il valore DB)
let _activeFiltroKeys = new Set();
let _tipFiltroPanelOpen = false;

// ─── COSTANTE SPECIALE ────────────────────────────────────────
// Usata internamente per distinguere "nessuno selezionato manualmente"
// da "tutti selezionati".
const _FILTRO_NESSUNO = "__NESSUNO__";
let _filtroManualeNessuno = false; // true = l'utente ha cliccato "Nessuno"

// ─── LOCAL STORAGE KEYS ───────────────────────────────────────
const _STORAGE_KEYS = {
  FILTRI: 'gestionale_filtri_tipologie',
  NESSUNO: 'gestionale_filtri_nessuno',
  PANNELLO_APERTO: 'gestionale_filtri_pannello_aperto'
};

function _buildFiltroKey(tipCod, col2, col3, per) {
  return `${tipCod}|${col2 || ""}|${col3 || ""}|${per || ""}`;
}

function _getAllKeys() {
  const data = _getTipologiePercorsiData();
  const cfg = _cfg();
  const ivaPer = (cfg.periodicitaIva || []).map((p) => p.value);
  const annPer = (cfg.periodicitaAnnuale || []).map((p) => p.value);

  const keys = [];
  Object.entries(data).forEach(([tipCod, tip]) => {
    tip.percorsi.forEach((p) => {
      const perList = p.isForf ? annPer : p.hasPer ? ivaPer : [""];
      perList.forEach((per) =>
        keys.push(_buildFiltroKey(tipCod, p.col2, p.col3, per)),
      );
    });
  });
  return keys;
}

// ─── GESTIONE PERSISTENZA ─────────────────────────────────────
function salvaFiltriSuStorage() {
  try {
    const filtriData = {
      keys: Array.from(_activeFiltroKeys),
      nessuno: _filtroManualeNessuno,
      pannelloAperto: _tipFiltroPanelOpen
    };
    localStorage.setItem(_STORAGE_KEYS.FILTRI, JSON.stringify(filtriData));
  } catch (e) {
    console.warn('[clienti.js] Errore salvataggio filtri:', e);
  }
}

function caricaFiltriDaStorage() {
  try {
    const saved = localStorage.getItem(_STORAGE_KEYS.FILTRI);
    if (saved) {
      const filtriData = JSON.parse(saved);
      _activeFiltroKeys = new Set(filtriData.keys || []);
      _filtroManualeNessuno = filtriData.nessuno || false;
      _tipFiltroPanelOpen = filtriData.pannelloAperto || false;
      return true;
    }
  } catch (e) {
    console.warn('[clienti.js] Errore caricamento filtri:', e);
  }
  return false;
}

// ─── INIT FILTRO: carica da storage o seleziona tutto ────────────────────────────
function initializeTipologieFilter() {
  const hasLoaded = caricaFiltriDaStorage();
  if (!hasLoaded) {
    // Se non ci sono filtri salvati, seleziona tutto
    _filtroManualeNessuno = false;
    _activeFiltroKeys = new Set(_getAllKeys());
  } else {
    // Also ensure we have all keys even if loaded from storage
    const allKeys = _getAllKeys();
    if (_activeFiltroKeys.size === 0 || (_activeFiltroKeys.size === 1 && _filtroManualeNessuno)) {
      // If filters are empty or only "nessuno", select all
      _filtroManualeNessuno = false;
      _activeFiltroKeys = new Set(allKeys);
      salvaFiltriSuStorage(); // Save the corrected state
    }
  }
  _syncGlobalFiltroKeys();
}

// ─── NOTA: initializeTipologieFilter() viene chiamata automaticamente
// dalla _cfgReady Promise appena il JSON è caricato. ─────────

function _syncGlobalFiltroKeys() {
  window._activeFiltroKeys = _activeFiltroKeys;
  window._filtroManualeNessuno = _filtroManualeNessuno;
  window.COL2_DB_TO_LABEL = _col2DbToLabel();
  window.COL3_DB_TO_LABEL = _col3DbToLabel();
  window.COL2_LABEL_TO_DB = _col2LabelToDb();
  window.COL3_LABEL_TO_DB = _col3LabelToDb();
  
  // Sincronizza con altre viste aperte
  _sincronizzaFiltriGlobali();
}

function _sincronizzaFiltriGlobali() {
  // Emetti evento custom per notificare le altre viste
  const event = new CustomEvent('filtriTipologieAggiornati', {
    detail: {
      keys: Array.from(_activeFiltroKeys),
      nessuno: _filtroManualeNessuno,
      pannelloAperto: _tipFiltroPanelOpen
    }
  });
  window.dispatchEvent(event);
}

function _isTipCodAllSelected(tipCod) {
  const data = _getTipologiePercorsiData();
  const tip = data[tipCod];
  if (!tip) return false;
  const cfg = _cfg();
  const ivaPer = (cfg.periodicitaIva || []).map((p) => p.value);
  const annPer = (cfg.periodicitaAnnuale || []).map((p) => p.value);
  return tip.percorsi.every((p) => {
    const perList = p.isForf ? annPer : p.hasPer ? ivaPer : [""];
    return perList.every((per) =>
      _activeFiltroKeys.has(_buildFiltroKey(tipCod, p.col2, p.col3, per)),
    );
  });
}

// ─── RENDER PANNELLO ──────────────────────────────────────────
function renderTipologieFiltroPanel() {
  const data = _getTipologiePercorsiData();
  const cfg = _cfg();
  const ivaPer = cfg.periodicitaIva || [];
  const annPer = cfg.periodicitaAnnuale || [];
  const allKeys = _getAllKeys();
  const totalKeys = allKeys.length;
  // ── Counter: mostra numero effettivo solo se parziale ─────
  const activeCount = _filtroManualeNessuno ? 0 : _activeFiltroKeys.size;
  const isAll = !_filtroManualeNessuno && activeCount === totalKeys;
  const isNone = _filtroManualeNessuno || activeCount === 0;
  // Badge numerico: visibile solo se parziale (né tutto né niente)
  const showBadge = !isAll && !isNone;
  const badgeNum = isNone ? "" : isAll ? "" : activeCount;

  let html = `<div class="tip-filtro-panel" id="tip-filtro-panel">
    <div class="tip-filtro-header">
      <span style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">🏷️ Filtra per Tipologia</span>
      <span style="font-size:11px;color:var(--t3);margin-left:4px">(${isNone ? 0 : isAll ? totalKeys : activeCount}/${totalKeys} selezionati)</span>
      <div style="display:flex;gap:6px;align-items:center;margin-left:auto">
        <button class="tip-btn-all"  onclick="event.stopPropagation(); selezionaTuttiTipFiltro(event)"   title="Seleziona tutto">✦ Tutti</button>
        <button class="tip-btn-none" onclick="event.stopPropagation(); deselezionaTuttiTipFiltro(event)" title="Deseleziona tutto">✕ Nessuno</button>
      </div>
    </div>
    <div class="tip-filtro-body">`;

  Object.entries(data).forEach(([tipCod, tip]) => {
    const allSelected = !isNone && _isTipCodAllSelected(tipCod);
    const someSelected =
      !isNone &&
      tip.percorsi.some((p) => {
        const perList = p.isForf
          ? annPer.map((x) => x.value)
          : p.hasPer
            ? ivaPer.map((x) => x.value)
            : [""];
        return perList.some((per) =>
          _activeFiltroKeys.has(_buildFiltroKey(tipCod, p.col2, p.col3, per)),
        );
      });

    html += `<div class="tip-gruppo">
      <div class="tip-gruppo-header" onclick="event.stopPropagation(); toggleTipologiaGruppo(event,'${tipCod}')"
           style="border-color:${tip.color}44;background:${tip.color}0d">
        <span class="tip-gruppo-badge" style="background:${tip.color}22;color:${tip.color};border-color:${tip.color}44">${tip.icon} ${tipCod}</span>
        <span class="tip-gruppo-desc">${tip.desc}</span>
        <span class="tip-gruppo-selall" style="color:${tip.color}" title="Seleziona/deseleziona tutto ${tipCod}">
          ${allSelected ? "✦ tutti" : someSelected ? "◐ parz." : "○ nessuno"}
        </span>
      </div>
      <div class="tip-percorsi-grid">`;

    tip.percorsi.forEach((p) => {
      const perList = p.isForf
        ? annPer
        : p.hasPer
          ? ivaPer
          : [{ value: "", color: "" }];
      perList.forEach((perObj) => {
        const per = typeof perObj === "string" ? perObj : perObj.value || "";
        const perColor = typeof perObj === "object" ? perObj.color || "" : "";
        const key = _buildFiltroKey(tipCod, p.col2, p.col3, per);
        const isActive = !isNone && _activeFiltroKeys.has(key);

        let labelParts = [];
        if (p.col2) labelParts.push(p.col2);
        if (p.col3) labelParts.push(p.col3);
        const label = labelParts.join(" · ") || tipCod;

        const perIcon =
          per === "mensile"
            ? "📅"
            : per === "trimestrale"
              ? "📆"
              : per === "annuale"
                ? "🗓️"
                : "";

        html += `<button
          class="tip-percorso-chip${isActive ? " tip-active" : ""}"
          onclick="event.stopPropagation(); toggleFiltroPercorso(event,'${tipCod}','${p.col2 || ""}','${p.col3 || ""}','${per}')"
          style="${isActive ? `background:${tip.color}22;border-color:${tip.color};color:${tip.color}` : ""}"
          title="${p.codice}">
          <span class="tip-chip-codice">${p.codice}</span>
          <span class="tip-chip-label">${label}</span>
          ${per ? `<span class="tip-chip-per" style="color:${perColor};background:${perColor}18;border-color:${perColor}44">${perIcon} ${per}</span>` : ""}
        </button>`;
      });
    });

    html += `</div></div>`;
  });

  html += `</div></div>`;
  return html;
}

// ─── TOGGLE PANNELLO ──────────────────────────────────────────
function toggleTipFiltroPanel(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  _tipFiltroPanelOpen = !_tipFiltroPanelOpen;
  salvaFiltriSuStorage(); // Salva lo stato del pannello
  _aggiornaTipFiltroPanelVisibility();
}

function closeTipFiltroPanel(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  _tipFiltroPanelOpen = false;
  salvaFiltriSuStorage(); // Salva lo stato del pannello
  _aggiornaTipFiltroPanelVisibility();
}

function _aggiornaTipFiltroPanelVisibility() {
  const container = document.getElementById("tip-filtro-container");
  const headerRow = document.getElementById("tip-filtro-header-row");
  if (!container) return;
  container.style.display = _tipFiltroPanelOpen ? "block" : "none";
  if (headerRow) {
    const btn = headerRow.querySelector(".tip-filtro-toggle-btn");
    if (btn) {
      btn.innerHTML = _tipFiltroPanelOpen
        ? `<button class="btn btn-xs btn-secondary" onclick="closeTipFiltroPanel(event)">✕ Chiudi</button>`
        : `<button class="btn btn-xs btn-secondary" onclick="toggleTipFiltroPanel(event)">▼ Espandi</button>`;
    }
  }
}

// ─── AZIONI FILTRO ────────────────────────────────────────────

function toggleFiltroPercorso(event, tipCod, col2, col3, per) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const key = _buildFiltroKey(tipCod, col2, col3, per);

  if (_filtroManualeNessuno) {
    // Prima selezione dopo "Nessuno": attiva solo questo chip
    _filtroManualeNessuno = false;
    _activeFiltroKeys = new Set([key]);
  } else {
    if (_activeFiltroKeys.has(key)) {
      _activeFiltroKeys.delete(key);
      // Se ora è vuoto → passa in stato "nessuno manuale"
      if (_activeFiltroKeys.size === 0) _filtroManualeNessuno = true;
    } else {
      _activeFiltroKeys.add(key);
    }
  }

  _syncGlobalFiltroKeys();
  salvaFiltriSuStorage(); // Salva le modifiche
  
  // Aggiorna solo il chip cliccato e il contatore, non tutto il pannello
  _updateSingleChip(key, tipCod, col2, col3, per);
  _aggiornaTipFiltroCounter();
}

function toggleTipologiaGruppo(event, tipCod) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const data = _getTipologiePercorsiData();
  const tip = data[tipCod];
  if (!tip) return;
  const cfg = _cfg();
  const ivaPer = (cfg.periodicitaIva || []).map((p) => p.value);
  const annPer = (cfg.periodicitaAnnuale || []).map((p) => p.value);

  const allKeys = [];
  tip.percorsi.forEach((p) => {
    const perList = p.isForf ? annPer : p.hasPer ? ivaPer : [""];
    perList.forEach((per) =>
      allKeys.push(_buildFiltroKey(tipCod, p.col2, p.col3, per)),
    );
  });

  if (_filtroManualeNessuno) {
    // Attiva tutto il gruppo partendo da zero
    _filtroManualeNessuno = false;
    allKeys.forEach((k) => _activeFiltroKeys.add(k));
  } else {
    const allActive = allKeys.every((k) => _activeFiltroKeys.has(k));
    if (allActive) {
      allKeys.forEach((k) => _activeFiltroKeys.delete(k));
      if (_activeFiltroKeys.size === 0) _filtroManualeNessuno = true;
    } else {
      allKeys.forEach((k) => _activeFiltroKeys.add(k));
    }
  }

  _syncGlobalFiltroKeys();
  salvaFiltriSuStorage(); // Salva le modifiche
  _refreshTipFiltroPanel();
  applyClientiFiltriDB();
}

// ── "✦ Tutti": seleziona tutto (resetta flag nessuno) ────────
function selezionaTuttiTipFiltro(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  _filtroManualeNessuno = false;
  _activeFiltroKeys = new Set(_getAllKeys());
  _syncGlobalFiltroKeys();
  salvaFiltriSuStorage(); // Salva le modifiche
  _refreshTipFiltroPanel();
}

// ── "✕ Nessuno": deseleziona tutto, rimane nessuno finché
//    l'utente non clicca singolarmente o "Tutti"  ────────────
function deselezionaTuttiTipFiltro(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  _filtroManualeNessuno = true;
  _activeFiltroKeys = new Set();
  _syncGlobalFiltroKeys();
  salvaFiltriSuStorage(); // Salva le modifiche
  _refreshTipFiltroPanel();
}

function _refreshTipFiltroPanel() {
  const container = document.getElementById("tip-filtro-container");
  if (!container) return;
  const tmp = document.createElement("div");
  tmp.innerHTML = renderTipologieFiltroPanel();
  container.innerHTML = "";
  container.appendChild(tmp.firstChild);
  _aggiornaTipFiltroCounter();
  container.style.display = _tipFiltroPanelOpen ? "block" : "none";
}

function _updateSingleChip(key, tipCod, col2, col3, per) {
  // Trova tutti i chip e cerca quello corrispondente
  const chips = document.querySelectorAll('.tip-percorso-chip');
  
  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    const onclickAttr = chip.getAttribute('onclick') || '';
    
    // Verifica se questo chip corrisponde ai parametri
    if (onclickAttr.includes(`'${tipCod}'`) && 
        onclickAttr.includes(`'${col2 || ''}'`) && 
        onclickAttr.includes(`'${col3 || ''}'`) && 
        onclickAttr.includes(`'${per}'`)) {
      
      const isActive = _activeFiltroKeys.has(key);
      const data = _getTipologiePercorsiData();
      const tip = data[tipCod];
      const tipColor = tip ? tip.color : "#888";
      
      if (isActive) {
        chip.classList.add("tip-active");
        chip.style.background = `${tipColor}22`;
        chip.style.borderColor = tipColor;
        chip.style.color = tipColor;
      } else {
        chip.classList.remove("tip-active");
        chip.style.background = "";
        chip.style.borderColor = "";
        chip.style.color = "";
      }
      break; // Trovato il chip corretto, esci dal ciclo
    }
  }
}

function _aggiornaTipFiltroCounter() {
  const badge = document.getElementById("tip-filtro-count");
  if (!badge) return;
  const allKeys = _getAllKeys();
  const isAll =
    !_filtroManualeNessuno && _activeFiltroKeys.size === allKeys.length;
  const isNone = _filtroManualeNessuno || _activeFiltroKeys.size === 0;
  // Mostra numero solo se parziale; se tutto → nasconde badge; se nessuno → "0" in rosso
  if (isNone) {
    badge.textContent = "0";
    badge.style.display = "inline-flex";
    badge.style.background = "var(--red)";
  } else if (isAll) {
    badge.textContent = "";
    badge.style.display = "none";
  } else {
    badge.textContent = _activeFiltroKeys.size;
    badge.style.display = "inline-flex";
    badge.style.background = "var(--accent)";
  }
}

// ─── COSTRUISCE I FILTRI PER LA RICHIESTA AL SERVER ───────────
function getFiltriPerRequest() {
  // Nessuno selezionato manualmente → filtro vuoto (0 clienti)
  if (_filtroManualeNessuno || _activeFiltroKeys.size === 0) {
    return { nessuno: true };
  }
  // Tutti selezionati → nessun filtro (mostra tutto)
  const allKeys = _getAllKeys();
  if (_activeFiltroKeys.size === allKeys.length) {
    return {};
  }

  const tipologie = new Set();
  const col2Values = new Set();
  const col3Values = new Set();
  const periodicitaValues = new Set();
  const chiavi = [];
  const col2L2Db = _col2LabelToDb();
  const col3L2Db = _col3LabelToDb();

  _activeFiltroKeys.forEach((key) => {
    const [tip, col2, col3, per] = key.split("|");
    if (tip) tipologie.add(tip);
    if (col2) col2Values.add(col2L2Db[col2] || col2.toLowerCase());
    if (col3) col3Values.add(col3L2Db[col3] || col3.toLowerCase());
    if (per) periodicitaValues.add(per);
    chiavi.push(key);
  });

  return {
    tipologie: Array.from(tipologie),
    col2_values: Array.from(col2Values),
    col3_values: Array.from(col3Values),
    periodicita_values: Array.from(periodicitaValues),
    chiavi_attive: chiavi,
  };
}

// ─── ANNO MIN/MAX ─────────────────────────────────────────────
const ANNO_MIN = 2000;
const ANNO_MAX = 2200;

function buildAnniOptions(selectedAnno) {
  const opts = [];
  for (let y = ANNO_MIN; y <= ANNO_MAX; y++) {
    opts.push(
      `<option value="${y}" ${y === selectedAnno ? "selected" : ""}>${y}</option>`,
    );
  }
  return opts.join("");
}

// ─── FILTRI DB ────────────────────────────────────────────────
function applyClientiFiltriImmediate() {
  const search = document.getElementById("global-search-clienti")?.value || "";
  const anno =
    parseInt(document.getElementById("filter-anno")?.value) ||
    new Date().getFullYear();
  const filtriTip = getFiltriPerRequest();

  if (typeof socket !== "undefined") {
    socket.emit("get:clienti", {
      search,
      anno,
      filtri_tipologie: filtriTip,
      tipologia: filtriTip.tipologie ? filtriTip.tipologie.join(",") : "",
      col2: filtriTip.col2_values ? filtriTip.col2_values.join(",") : "",
      col3: filtriTip.col3_values ? filtriTip.col3_values.join(",") : "",
      periodicita: filtriTip.periodicita_values
        ? filtriTip.periodicita_values.join(",")
        : "",
      nessuno: filtriTip.nessuno || false,
    });
  }
}

const applyClientiFiltriDB = debounce(applyClientiFiltriImmediate, 300);

function applyClientiFiltri() {
  applyClientiFiltriDB();
}

function resetClientiFiltri() {
  const s = document.getElementById("global-search-clienti");
  if (s) s.value = "";
  const annoSelect = document.getElementById("filter-anno");
  if (annoSelect) annoSelect.value = new Date().getFullYear();
  initializeTipologieFilter();
  _refreshTipFiltroPanel();
  salvaFiltriSuStorage(); // Salva il reset
  if (typeof socket !== "undefined")
    socket.emit("get:clienti", { anno: new Date().getFullYear() });
}

// ─── RENDER LISTA ─────────────────────────────────────────────
function renderClientiPage() {
  // Ensure filters are properly initialized before rendering
  if (
    _activeFiltroKeys.size === 0 &&
    !_filtroManualeNessuno &&
    _getAllKeys().length > 0
  ) {
    initializeTipologieFilter();
    // Force a filter refresh to ensure all clients are loaded
    setTimeout(() => {
      applyClientiFiltriImmediate();
    }, 100);
    return; // Exit early, will be called again after filters are ready
  }
  
  // Double-check that we have valid filter state
  if (_activeFiltroKeys.size === 0 && !_filtroManualeNessuno && _cfg()) {
    initializeTipologieFilter();
    setTimeout(() => {
      renderClientiPage();
    }, 50);
    return;
  }
  
  renderClientiTabella(state.clienti);
}

function renderClientiTabella(clienti) {
  const col2Map = {
    privato: "Privato",
    ditta: "Ditta Ind.",
    socio: "Socio",
    professionista: "Prof.",
  };
  const col3Map = {
    ordinario: "Ord.",
    semplificato: "Sempl.",
    forfettario: "Forf.",
    ordinaria: "Ord.",
    semplificata: "Sempl.",
  };
  const periodicitaMap = {
    mensile: "Mensile",
    trimestrale: "Trimestrale",
    annuale: "Annuale",
  };

  const currentAnno =
    parseInt(document.getElementById("filter-anno")?.value) ||
    new Date().getFullYear();
  const allKeys = _getAllKeys();
  const isAll =
    !_filtroManualeNessuno && _activeFiltroKeys.size === allKeys.length;
  const isNone = _filtroManualeNessuno || _activeFiltroKeys.size === 0;
  const activeCount = isNone ? 0 : _activeFiltroKeys.size;
  const totalKeys = allKeys.length;

  const filterBar = `
    <div class="filtri-avanzati no-print" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:var(--surface2);border-radius:var(--r-sm);">
      <span style="font-size:11px;color:var(--text3);font-weight:700;">📅 Anno:</span>
      <select id="filter-anno" class="select" style="width:110px" onchange="applyClientiFiltri()" title="Filtra per anno">
        ${buildAnniOptions(currentAnno)}
      </select>
      <button class="btn btn-sm btn-primary" onclick="resetClientiFiltri()" style="margin-left:auto">⟳ Reset</button>
    </div>

    <div style="margin-bottom:16px">
      <div id="tip-filtro-header-row" style="display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:10px 14px;background:var(--s2);border:1px solid var(--b0);border-radius:var(--r-sm);">
        <span style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">🏷️ Filtro Tipologie</span>
        <span id="tip-filtro-count" style="display:${isNone ? "inline-flex" : !isAll ? "inline-flex" : "none"};align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;background:${isNone ? "var(--red)" : "var(--accent)"};color:#fff;border-radius:10px;font-size:11px;font-weight:700">${isNone ? "0" : activeCount}</span>
        ${isNone ? `<span style="font-size:11px;color:var(--red);font-weight:700">⚠️ Nessuno selezionato</span>` : ""}
        <div class="tip-filtro-toggle-btn" style="margin-left:auto" onclick="event.stopPropagation()">
          ${
            _tipFiltroPanelOpen
              ? `<button class="btn btn-xs btn-secondary" onclick="closeTipFiltroPanel(event)">✕ Chiudi</button>`
              : `<button class="btn btn-xs btn-secondary" onclick="toggleTipFiltroPanel(event)">▼ Espandi</button>`
          }
        </div>
      </div>
      <div id="tip-filtro-container" style="display:${_tipFiltroPanelOpen ? "block" : "none"}">
        ${renderTipologieFiltroPanel()}
      </div>
    </div>`;

  let tableRows = "";
  if (!clienti || clienti.length === 0) {
    if (isNone) {
      tableRows = `<tr><td colspan="4"><div class="empty"><div class="empty-icon">🏷️</div><p>Nessun filtro selezionato — clicca <strong>✦ Tutti</strong> per vedere tutti i clienti</p></div></td></tr>`;
    } else {
      tableRows = `<tr><td colspan="4"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato per l'anno ${currentAnno}</p></div></td></tr>`;
    }
  } else {
    tableRows = clienti
      .map((c) => {
        const tipColor =
          c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
        const avatar = getAvatar(c.nome);
        const sottotipoLabel = c.sottotipologia_nome || "";
        const tipInfo = TIPOLOGIE_INFO[c.tipologia_codice] || {};
        const tipBadge = `<span class="badge b-${(c.tipologia_codice || "").toLowerCase()}"
        style="background:${tipColor}22;color:${tipColor};border:1px solid ${tipColor}44;font-size:12px"
        title="${tipInfo.desc || c.tipologia_codice}">${tipInfo.icon || ""} ${c.tipologia_codice || "-"}</span>`;

        let colBadges = "";
        if (c.col2_value)
          colBadges += `<span class="badge-info" style="font-size:11px">📁 ${col2Map[c.col2_value] || c.col2_value}</span>`;
        if (c.col3_value)
          colBadges += `<span class="badge-info" style="font-size:11px">⚙️ ${col3Map[c.col3_value] || c.col3_value}</span>`;
        if (c.periodicita && c.col2_value !== "privato")
          colBadges += `<span class="badge-per" style="font-size:11px">📅 ${periodicitaMap[c.periodicita] || c.periodicita}</span>`;

        const configInfo =
          c.config_anno && c.config_anno !== currentAnno
            ? `<div style="font-size:9px;color:var(--yellow);margin-top:3px" title="Configurazione ereditata dal ${c.config_anno}">📌 eredita ${c.config_anno}</div>`
            : "";

        return `<tr class="clickable" onclick="showClienteDettaglio(${c.id})" style="cursor:pointer">
        <td style="padding:12px 16px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="cliente-avatar-sm" style="background:${tipColor}22;border-color:${tipColor};color:${tipColor};width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:10px;font-weight:800;font-size:${avatarFontSize(avatar, 13)}">${avatar}</div>
            <div>
              <div style="font-weight:700;font-size:15px">${escAttr(c.nome)}</div>
              <div style="font-size:11px;color:var(--t3);font-family:var(--mono);margin-top:2px">${c.codice_fiscale || c.partita_iva || "—"}</div>
              ${configInfo}
            </div>
          </div>
        </td>
        <td style="padding:12px 16px">
          <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">${tipBadge} ${colBadges}</div>
          ${sottotipoLabel ? `<div style="font-size:10px;color:var(--t3);margin-top:4px">🏷️ ${sottotipoLabel}</div>` : ""}
        </td>
        <td style="padding:12px 16px;color:var(--t2);font-size:13px">${c.email || "—"}</td>
        <td class="no-print" style="padding:12px 16px;white-space:nowrap">
          <div style="display:flex;gap:6px;flex-wrap:wrap" onclick="event.stopPropagation()">
            <button class="btn btn-xs btn-secondary" onclick="editCliente(${c.id})"    title="Modifica">✏️</button>
            <button class="btn btn-xs btn-success"   onclick="goScadenzario(${c.id})"  title="Scadenzario">📅</button>
            <button class="btn btn-xs btn-danger"    onclick="deleteCliente(${c.id})"  title="Elimina">🗑️</button>
          </div>
        </td>
      </tr>`;
      })
      .join("");
  }

  const html = `${filterBar}
    <div class="table-wrap">
      <div class="table-header no-print">
        <h3>Clienti <span style="font-size:13px;color:var(--t3);margin-left:8px">(${clienti ? clienti.length : 0})</span></h3>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--s2);border-bottom:1px solid var(--b0)">
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--t2)">Cliente</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--t2)">Classificazione ${currentAnno}</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--t2)">Email</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--t2)" class="no-print">Azioni</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

  document.getElementById("content").innerHTML = html;
}

// ─── DETTAGLIO CLIENTE ────────────────────────────────────────
function showClienteDettaglio(id) {
  currentClienteId = id;
  currentClienteAnno = new Date().getFullYear();
  loadClienteDettaglio(id, currentClienteAnno);
}

function loadClienteDettaglio(id, anno) {
  if (typeof socket !== "undefined") {
    socket.emit("get:cliente", { id, anno });
    socket.emit("get:cliente_storico", { id });
  }
}

if (typeof socket !== "undefined") {
  socket.on("res:cliente", ({ success, data, anno }) => {
    if (!success || !data) return;
    currentClienteAnno = anno;
    renderClienteDettaglio(data, anno);
  });

  socket.on("res:cliente_storico", ({ success, data }) => {
    if (!success) return;
    renderStoricoConfig(data);
  });
}

function renderClienteDettaglio(c, anno) {
  const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
  const avatar = getAvatar(c.nome);
  const tipInfo = TIPOLOGIE_INFO[c.tipologia_codice] || {};

  const col2LMap = _col2DbToLabel();
  const col3LMap = _col3DbToLabel();
  const periodicitaMap = {
    mensile: "📅 Mensile",
    trimestrale: "📆 Trimestrale",
    annuale: "📅 Annuale",
  };

  const classificazioneHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:13px;color:var(--t2)">📅 Anno configurazione:</span>
        <select id="det-anno-select" class="select" style="width:110px" onchange="onDettaglioAnnoChange()">
          ${buildAnniOptions(anno)}
        </select>
        ${
          c.config_anno && c.config_anno !== anno
            ? `<span class="badge-info" style="background:var(--yellow)18;color:var(--yellow)">⚠️ Ereditata dal ${c.config_anno}</span>`
            : ""
        }
      </div>
      <button class="btn btn-sm btn-primary" onclick="editClienteConfig(${c.id},${anno})" title="Modifica configurazione per quest'anno">✏️ Modifica ${anno}</button>
    </div>`;

  const noConfigWarning = !c.id_tipologia
    ? `<div class="infobox" style="margin-bottom:16px;background:var(--yellow)18;border-color:var(--yellow);color:var(--yellow)">
        ⚠️ Nessuna configurazione registrata per il ${anno}. Clicca <strong>Modifica ${anno}</strong> per crearne una.
       </div>`
    : "";

  const configCards = c.id_tipologia
    ? `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px">
      <div style="background:var(--s2);border-radius:var(--r-sm);padding:14px;border-left:3px solid ${tipColor}">
        <div style="font-size:11px;color:var(--t3);text-transform:uppercase">Tipologia</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${tipInfo.icon || ""} ${c.tipologia_codice || "-"} — ${c.tipologia_nome || ""}</div>
      </div>
      ${
        c.col2_value
          ? `<div style="background:var(--s2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #fb923c">
        <div style="font-size:11px;color:var(--t3);text-transform:uppercase">Sottocategoria</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${col2LMap[c.col2_value] || c.col2_value}</div>
      </div>`
          : ""
      }
      ${
        c.col3_value
          ? `<div style="background:var(--s2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #5b8df6">
        <div style="font-size:11px;color:var(--t3);text-transform:uppercase">Regime</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${col3LMap[c.col3_value] || c.col3_value}</div>
      </div>`
          : ""
      }
      ${
        c.periodicita
          ? `<div style="background:var(--s2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #22d3ee">
        <div style="font-size:11px;color:var(--t3);text-transform:uppercase">Periodicità</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${periodicitaMap[c.periodicita] || c.periodicita}</div>
      </div>`
          : ""
      }
    </div>`
    : "";

  document.getElementById("modal-cliente-det-title").textContent = c.nome;
  document.getElementById("cliente-dettaglio-content").innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--s2);border-radius:var(--r-sm);margin-bottom:20px;border-left:4px solid ${tipColor}">
      <div class="det-avatar" style="width:48px;height:48px;background:${tipColor}22;border:2px solid ${tipColor};color:${tipColor};display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:18px;font-weight:800">${avatar}</div>
      <div>
        <div style="font-size:20px;font-weight:800">${escAttr(c.nome)}</div>
        <div style="font-size:13px;color:var(--t2);margin-top:4px">${c.codice_fiscale || c.partita_iva || ""}</div>
      </div>
    </div>
    <div style="margin-bottom:12px;font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase">📊 Classificazione per ${anno}</div>
    ${classificazioneHtml}
    ${noConfigWarning}
    ${configCards}
    <div id="storico-config-container" style="margin-top:20px"></div>
    ${renderClienteDatiRiferimento(c)}`;

  const actions = document.getElementById("modal-cliente-det-actions");
  if (actions) {
    actions.innerHTML = `
      <button class="btn btn-danger btn-sm" onclick="deleteClienteFromDettaglio()">🗑️ Elimina</button>
      <div style="flex:1"></div>
      <button class="btn btn-secondary" onclick="closeModal('modal-cliente-dettaglio')">Chiudi</button>
      <button class="btn btn-primary" onclick="goToClienteScadenzario()">📅 Vai a Scadenzario</button>`;
  }
  openModal("modal-cliente-dettaglio");
}

function renderStoricoConfig(storico) {
  const container = document.getElementById("storico-config-container");
  if (!container) return;
  if (!storico || storico.length === 0) {
    container.innerHTML = `<div class="infobox" style="font-size:12px">📋 Nessuna configurazione storica.</div>`;
    return;
  }
  const col3Map = {
    ordinario: "Ord.",
    semplificato: "Sempl.",
    forfettario: "Forf.",
    ordinaria: "Ord.",
    semplificata: "Sempl.",
  };
  const periodicitaMap = {
    mensile: "Mensile",
    trimestrale: "Trimestrale",
    annuale: "Annuale",
  };
  let rows = "";
  storico.forEach((cfg) => {
    rows += `<tr style="border-bottom:1px solid var(--b0)">
      <td style="padding:8px 12px;font-weight:700;color:var(--accent)">${cfg.anno}</td>
      <td style="padding:8px 12px"><span class="badge b-${(cfg.tipologia_codice || "").toLowerCase()}">${cfg.tipologia_codice || "-"}</span></td>
      <td style="padding:8px 12px">${cfg.col2_value || "-"}</td>
      <td style="padding:8px 12px">${cfg.col3_value ? col3Map[cfg.col3_value] || cfg.col3_value : "-"}</td>
      <td style="padding:8px 12px">${cfg.periodicita ? periodicitaMap[cfg.periodicita] || cfg.periodicita : "-"}</td>
      <td style="padding:8px 12px"><button class="btn btn-xs btn-secondary" onclick="editClienteConfig(${cfg.id_cliente},${cfg.anno})">✏️</button></td>
    </tr>`;
  });
  container.innerHTML = `
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--b0)">
      <div style="font-size:12px;font-weight:700;color:var(--t2);margin-bottom:10px">📜 Storico configurazioni per anno</div>
      <div style="overflow-x:auto">
        <table style="width:100%;font-size:12px">
          <thead><tr style="background:var(--s2)">
            <th style="padding:8px 12px;text-align:left">Anno</th>
            <th style="padding:8px 12px;text-align:left">Tipo</th>
            <th style="padding:8px 12px;text-align:left">Col2</th>
            <th style="padding:8px 12px;text-align:left">Col3</th>
            <th style="padding:8px 12px;text-align:left">Periodicità</th>
            <th style="padding:8px 12px;text-align:left"></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function onDettaglioAnnoChange() {
  const anno = parseInt(document.getElementById("det-anno-select").value);
  if (currentClienteId) loadClienteDettaglio(currentClienteId, anno);
}

function editClienteConfig(id, anno) {
  if (typeof socket !== "undefined") {
    socket.emit("get:cliente", { id, anno });
    socket.once("res:cliente", ({ success, data }) => {
      if (!success || !data) return;
      openEditClienteModal(data, anno);
    });
  }
}

function editClienteFromDettaglio() {
  const anno = parseInt(
    document.getElementById("det-anno-select")?.value ||
      new Date().getFullYear(),
  );
  if (currentClienteId) editClienteConfig(currentClienteId, anno);
}

function deleteClienteFromDettaglio() {
  if (!currentClienteId) return;
  const anno =
    parseInt(document.getElementById("det-anno-select")?.value) ||
    new Date().getFullYear();
  const cliente = state.clienti.find((c) => c.id === currentClienteId);
  const clienteNome = cliente ? cliente.nome : "questo cliente";
  if (confirm(`Eliminare "${clienteNome}" solo per l'anno ${anno}?`)) {
    closeModal("modal-cliente-dettaglio");
    if (typeof socket !== "undefined")
      socket.emit("delete:cliente", { id: currentClienteId, anno });
  }
}

function goToClienteScadenzario() {
  if (currentClienteId) {
    closeModal("modal-cliente-dettaglio");
    goScadenzario(currentClienteId);
  }
}

function editCliente(id) {
  const anno =
    parseInt(document.getElementById("filter-anno")?.value) ||
    new Date().getFullYear();
  editClienteConfig(id, anno);
}

function openEditClienteModal(cliente, anno) {
  document.getElementById("modal-cliente-title").textContent =
    `Modifica Cliente — ${anno}`;
  document.getElementById("cliente-id").value = cliente.id;
  document.getElementById("cliente-edit-anno").value = anno;
  const annoInfo = document.getElementById("cliente-anno-info");
  if (annoInfo) {
    annoInfo.innerHTML = `<div class="infobox" style="margin-bottom:16px;background:var(--accent-d);border-color:var(--accent)">
      📅 Configurazione per <strong>${anno}</strong>. Le modifiche non influenzeranno gli anni precedenti.</div>`;
  }
  const fields = {
    "c-nome": cliente.nome,
    "c-cf": cliente.codice_fiscale,
    "c-piva": cliente.partita_iva,
    "c-email": cliente.email,
    "c-tel": cliente.telefono,
    "c-indirizzo": cliente.indirizzo,
    "c-note": cliente.note,
    "c-pec": cliente.pec,
    "c-sdi": cliente.sdi,
    "c-citta": cliente.citta,
    "c-cap": cliente.cap,
    "c-prov": cliente.provincia,
    "c-referente": cliente.referente,
    "c-iban": cliente.iban,
  };
  Object.entries(fields).forEach(([elId, val]) => {
    const el = document.getElementById(elId);
    if (el) el.value = val || "";
  });
  populateTipologiaSelect(cliente.id_tipologia);
  const col2Val = cliente.col2_value || "",
    col3Val = cliente.col3_value || "",
    col4Val = cliente.periodicita || "";
  const badge = document.getElementById("col4-forfettario-badge");
  if (badge) badge.style.display = "none";
  
  // Store the values that need to be set after the columns are updated
  lastClienteFormValues = { col2: col2Val, col3: col3Val, col4: col4Val };
  
  setTimeout(() => {
    // First update the columns structure
    aggiornaColonneCliente();
    
    setTimeout(() => {
      // Then set the actual values after the DOM is ready
      if (document.getElementById("c-col2"))
        document.getElementById("c-col2").value = col2Val;
      if (document.getElementById("c-col3"))
        document.getElementById("c-col3").value = col3Val;
      
      const tipCodice = _getTipologiaCodice();
      if (REGIMI_ANNUALI.includes(col3Val))
        _aggiornCol4BasedOnCol3(tipCodice, col3Val);
      else if (document.getElementById("c-col4"))
        document.getElementById("c-col4").value = col4Val;
      
      aggiornaRiepilogoClassificazione();
    }, 50);
  }, 60);
  openModal("modal-cliente");
}

function openNuovoCliente() {
  const currentAnno =
    parseInt(document.getElementById("filter-anno")?.value) ||
    new Date().getFullYear();
  document.getElementById("modal-cliente-title").textContent =
    `Nuovo Cliente — ${currentAnno}`;
  document.getElementById("cliente-id").value = "";
  document.getElementById("cliente-edit-anno").value = currentAnno;
  const annoInfo = document.getElementById("cliente-anno-info");
  if (annoInfo) {
    annoInfo.innerHTML = `<div class="infobox" style="margin-bottom:16px;background:var(--accent-d);border-color:var(--accent)">
      📅 Creazione cliente per l'anno <strong>${currentAnno}</strong>.</div>`;
  }
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
    "c-col2",
    "c-col3",
    "c-col4",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const badge = document.getElementById("col4-forfettario-badge");
  if (badge) badge.style.display = "none";
  lastClienteFormValues = { col2: "", col3: "", col4: "" };
  if (state.tipologie && state.tipologie.length > 0)
    populateTipologiaSelect(state.tipologie[0].id);
  else populateTipologiaSelect("");
  setTimeout(() => {
    aggiornaColonneCliente();
    aggiornaRiepilogoClassificazione();
  }, 50);
  openModal("modal-cliente");
}

function saveCliente() {
  const id = document.getElementById("cliente-id").value;
  const anno = parseInt(
    document.getElementById("cliente-edit-anno")?.value ||
      new Date().getFullYear(),
  );
  const nome = document.getElementById("c-nome").value.trim();
  if (!nome) {
    showNotif("Il nome è obbligatorio", "error");
    return;
  }
  if (!validaClassificazioneCliente()) return;

  let col2Val = null,
    col3Val = null,
    col4Val = null;
  const col2Wrap = document.getElementById("wrap-col2");
  const col3Wrap = document.getElementById("wrap-col3");
  const col4Wrap = document.getElementById("wrap-col4");

  if (col2Wrap && col2Wrap.style.display !== "none") {
    const val = document.getElementById("c-col2")?.value || "";
    col2Val = val === "" ? null : val;
  }
  if (col3Wrap && col3Wrap.style.display !== "none") {
    const val = document.getElementById("c-col3")?.value || "";
    col3Val = val === "" ? null : val;
    lastClienteFormValues.col3 = col3Val;
  }
  if (col4Wrap && col4Wrap.style.display !== "none") {
    const val = document.getElementById("c-col4")?.value || "";
    col4Val = val === "" ? null : val;
    lastClienteFormValues.col4 = col4Val;
  }
  if (col3Val && REGIMI_ANNUALI.includes(col3Val)) {
    col4Val = "annuale";
    lastClienteFormValues.col4 = col4Val;
  }

  const tipologiaVal = document.getElementById("c-tipologia")?.value || "";
  lastClienteFormValues.col2 = col2Val;
  lastClienteFormValues.col3 = col3Val;
  lastClienteFormValues.col4 = col4Val;

  const data = {
    id: id ? parseInt(id) : undefined,
    anno,
    nome,
    id_tipologia: parseInt(tipologiaVal),
    id_sottotipologia: _calcolaSottotipologiaId() || null,
    col2_value: col2Val || null,
    col3_value: col3Val || null,
    periodicita: col4Val || null,
    codice_fiscale:
      document.getElementById("c-cf")?.value.trim().toUpperCase() || null,
    partita_iva:
      document
        .getElementById("c-piva")
        ?.value.replace(/[^0-9]/g, "")
        .trim() || null,
    email: document.getElementById("c-email")?.value.trim() || null,
    telefono:
      document
        .getElementById("c-tel")
        ?.value.replace(/[^0-9+\s\-]/g, "")
        .trim() || null,
    indirizzo: document.getElementById("c-indirizzo")?.value.trim() || null,
    citta: document.getElementById("c-citta")?.value.trim() || null,
    cap:
      document
        .getElementById("c-cap")
        ?.value.replace(/[^0-9]/g, "")
        .trim() || null,
    provincia:
      document.getElementById("c-prov")?.value.trim().toUpperCase() || null,
    pec: document.getElementById("c-pec")?.value.trim() || null,
    sdi: document.getElementById("c-sdi")?.value.trim().toUpperCase() || null,
    iban: document.getElementById("c-iban")?.value.trim().toUpperCase() || null,
    referente: document.getElementById("c-referente")?.value.trim() || null,
    note: document.getElementById("c-note")?.value.trim() || null,
  };

  if (typeof socket !== "undefined") {
    if (id) socket.emit("update:cliente", data);
    else socket.emit("create:cliente", data);
  }
}

function deleteCliente(id) {
  const currentAnno =
    parseInt(document.getElementById("filter-anno")?.value) ||
    new Date().getFullYear();
  const cliente = state.clienti.find((c) => c.id === id);
  const clienteNome = cliente ? cliente.nome : "questo cliente";

  if (typeof socket !== "undefined") {
    socket.emit("check:adempimenti_cliente", {
      id_cliente: id,
      anno: currentAnno,
    });
    socket.once(
      "res:check:adempimenti_cliente",
      ({ success, hasAdempimenti, count }) => {
        if (!success) {
          proceedWithBasicDeletion(id, currentAnno, clienteNome);
          return;
        }
        if (hasAdempimenti && count > 0) {
          if (
            confirm(
              `Eliminare "${clienteNome}" solo per l'anno ${currentAnno}? Il cliente ha ${count} adempimento/i.`,
            )
          )
            socket.emit("delete:cliente", { id, anno: currentAnno });
        } else {
          if (confirm(`Eliminare "${clienteNome}" da tutti gli anni?`))
            socket.emit("delete:cliente", { id, anno: null, deleteAll: true });
          else if (confirm(`Eliminare solo dall'anno ${currentAnno}?`))
            socket.emit("delete:cliente", { id, anno: currentAnno });
        }
      },
    );
  } else {
    proceedWithBasicDeletion(id, currentAnno, clienteNome);
  }
}

function proceedWithBasicDeletion(id, currentAnno, clienteNome) {
  if (confirm(`Eliminare "${clienteNome}" solo per l'anno ${currentAnno}?`))
    if (typeof socket !== "undefined")
      socket.emit("delete:cliente", { id, anno: currentAnno });
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
    if (typeof socket !== "undefined") socket.emit("get:clienti");
  }
}

// ─── TIPOLOGIA SELECT ─────────────────────────────────────────
function populateTipologiaSelect(selectedId) {
  const sel = document.getElementById("c-tipologia");
  if (!sel) return;
  const cfg = _cfg();
  sel.innerHTML = (state.tipologie || [])
    .map((t) => {
      const meta = (cfg.tipologie || {})[t.codice] || {};
      return `<option value="${t.id}" ${String(t.id) === String(selectedId) ? "selected" : ""}>${meta.icon || "📋"} ${t.codice} — ${meta.desc || t.nome}</option>`;
    })
    .join("");
  _aggiornaTipologiaSelectStyle();
}

function _aggiornaTipologiaSelectStyle() {
  const sel = document.getElementById("c-tipologia");
  if (!sel || !sel.value) return;
  const tipCodice = _getTipologiaCodice();
  const cfg = _cfg();
  const color = (cfg.tipologie || {})[tipCodice]?.color || "var(--accent)";
  sel.style.borderColor = color;
  sel.style.boxShadow = `0 0 0 1px ${color}44`;
}

// ─── 4 COLONNE ────────────────────────────────────────────────
function aggiornaColonneCliente() {
  const tipCodice = _getTipologiaCodice();
  const col2Wrap = document.getElementById("wrap-col2");
  const col2Sel = document.getElementById("c-col2");
  
  // Generate col2 options dynamically from JSON instead of hardcoded
  const col2Opts = _getCol2OptionsFromJson(tipCodice);
  _aggiornaTipologiaSelectStyle();
  if (!col2Opts || col2Opts.length === 0) {
    col2Wrap.style.display = "none";
    col2Sel.value = "";
    _aggiornaCol3(tipCodice, "");
  } else {
    col2Wrap.style.display = "";
    const col2Current = col2Sel.value;
    col2Sel.innerHTML =
      `<option value="">— Seleziona —</option>` +
      col2Opts
        .map(
          (o) =>
            `<option value="${o.value}" ${col2Current === o.value ? "selected" : ""}>${o.label}</option>`,
        )
        .join("");
    if (!col2Current) col2Sel.value = "";
    _aggiornaCol3(tipCodice, col2Sel.value);
  }
  
  // Always check if we should show periodicity based on tipologia and paths
  _checkAndShowPeriodicita(tipCodice);
  aggiornaRiepilogoClassificazione();
}

// Helper function to check and show periodicity field
function _checkAndShowPeriodicita(tipCodice) {
  const cfg = _cfg();
  const percorsi = cfg.percorsi?.[tipCodice] || [];
  const col2Val = document.getElementById("c-col2")?.value || "";
  
  // Check if any path for this tipologia has periodicity
  const hasPeriodicita = percorsi.some(p => p.hasPer || p.isForfettario);
  
  const col4Wrap = document.getElementById("wrap-col4");
  // Hide periodicity for privato and socio
  if (col2Val === "privato" || col2Val === "socio") {
    col4Wrap.style.display = "none";
    const col4Sel = document.getElementById("c-col4");
    if (col4Sel) col4Sel.value = "";
  } else if (hasPeriodicita) {
    // Show periodicity field
    col4Wrap.style.display = "";
    // Initialize with empty options if not already populated
    const col4Sel = document.getElementById("c-col4");
    if (col4Sel && !col4Sel.innerHTML.includes("option")) {
      const ivaPer = cfg.periodicitaIva || [];
      const annPer = (cfg.periodicitaAnnuale || []).map((p) => p.value);
      
      col4Sel.innerHTML = `<option value="">— Seleziona —</option>` +
        ivaPer.map(p => `<option value="${p.value}">${p.label}</option>`).join("") +
        annPer.map(p => `<option value="${p.value}">${p.label}</option>`).join("");
    }
  } else {
    // Hide periodicity field
    _nascondiCol4();
  }
}

// Helper function to generate col2 options from JSON
function _getCol2OptionsFromJson(tipCodice) {
  const cfg = _cfg();
  const percorsi = cfg.percorsi?.[tipCodice] || [];
  const options = [];
  
  percorsi.forEach(p => {
    if (p.col2Label) {
      const value = p.col2Label === "Ditta Individuale" ? "ditta" : p.col2Label.toLowerCase();
      
      // Check if this option already exists
      const existing = options.find(opt => opt.value === value);
      if (!existing) {
        options.push({
          value,
          label: p.col2Label
        });
      }
    }
  });
  
  return options;
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
    `<option value="">— Seleziona —</option>` +
    col3Opts
      .map(
        (o) =>
          `<option value="${o.value}" ${col3Current === o.value ? "selected" : ""}>${o.label}</option>`,
      )
      .join("");
  if (!col3Current) col3Sel.value = "";
  _aggiornCol4BasedOnCol3(tipCodice, col3Sel.value);
  aggiornaRiepilogoClassificazione();
}

function _aggiornCol4BasedOnCol3(tipCodice, col3Val) {
  // Ensure JSON data is available before proceeding
  const cfg = _cfg();
  if (!cfg || !cfg.periodicitaIva || !cfg.periodicitaAnnuale) {
    // If JSON is not ready, wait and try again
    setTimeout(() => {
      if (_cfg() && _cfg().periodicitaIva && _cfg().periodicitaAnnuale) {
        _aggiornCol4BasedOnCol3(tipCodice, col3Val);
      }
    }, 100);
    return;
  }

  const annPer = (cfg.periodicitaAnnuale || []).map((p) => p.value);
  const ivaPer = cfg.periodicitaIva || [];

  const col4Wrap = document.getElementById("wrap-col4");
  const col4Sel = document.getElementById("c-col4");

  if (REGIMI_ANNUALI.includes(col3Val)) {
    col4Wrap.style.display = "none";
    col4Sel.value = annPer[0] || "annuale";
    let badge = document.getElementById("col4-forfettario-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "col4-forfettario-badge";
      badge.style.cssText =
        "font-size:12px;color:var(--yellow);background:var(--yellow)18;border:1px solid var(--yellow)33;border-radius:var(--r-sm);padding:7px 12px;margin-top:8px;grid-column:1/-1";
      badge.innerHTML = `<span style="font-size:14px">📅</span> Regime <strong>Forfettario</strong> — periodicità automatica: <strong>Annuale</strong>`;
      document.querySelector(".quattro-colonne-grid")?.appendChild(badge);
    }
    badge.style.display = "";
  } else if (col3Val) {
    col4Wrap.style.display = "";
    // Popola le opzioni IVA dal JSON
    if (col4Sel && col4Sel.tagName === "SELECT" && ivaPer.length > 0) {
      const current = col4Sel.value;
      col4Sel.innerHTML =
        `<option value="">— Seleziona —</option>` +
        ivaPer
          .map(
            (p) =>
              `<option value="${p.value}" ${current === p.value ? "selected" : ""}>${p.label}</option>`,
          )
          .join("");
    }
    const badge = document.getElementById("col4-forfettario-badge");
    if (badge) badge.style.display = "none";
    if (!col4Sel.value) col4Sel.value = "";
  } else {
    _nascondiCol4();
    const badge = document.getElementById("col4-forfettario-badge");
    if (badge) badge.style.display = "none";
  }
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
  const tip = (state.tipologie || []).find(
    (t) => String(t.id) === String(sel.value),
  );
  return tip ? tip.codice : "";
}

function _calcolaSottotipologiaId() {
  const tipCodice = _getTipologiaCodice();
  const col2 = document.getElementById("c-col2")?.value || "";
  const col3 = document.getElementById("c-col3")?.value || "";
  const stCode = getSottotipoCode(tipCodice, col2, col3);
  if (!stCode) return null;
  for (const t of state.tipologie || []) {
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
  const tip = (state.tipologie || []).find((t) => t.codice === tipCodice);
  const cfg = _cfg();
  const col2 = document.getElementById("c-col2")?.value || "";
  const col3 = document.getElementById("c-col3")?.value || "";
  const col4 = document.getElementById("c-col4")?.value || "";
  const annPer = (cfg.periodicitaAnnuale || []).map((p) => p.value);
  const col4Eff = annPer.includes(col3) ? annPer[0] || "annuale" : col4;
  const tipColor = (cfg.tipologie || {})[tipCodice]?.color || "var(--accent)";

  let chips = [];
  if (tip)
    chips.push(
      `<div class="riepilogo-chip" style="border-color:${tipColor}44;background:${tipColor}12"><span class="chip-label">Tipologia:</span><span class="chip-value" style="color:${tipColor}">${tip.codice} — ${tip.nome}</span></div>`,
    );
  if (col2) {
    const opt = COL2_OPTIONS[tipCodice]?.find((o) => o.value === col2);
    if (opt)
      chips.push(
        `<div class="riepilogo-chip"><span class="chip-label">Sottocategoria:</span><span class="chip-value">${opt.label}</span></div>`,
      );
  }
  if (col3)
    chips.push(
      `<div class="riepilogo-chip"><span class="chip-label">Regime:</span><span class="chip-value">${col3}</span></div>`,
    );
  if (col4Eff) {
    const perObj = [
      ...(cfg.periodicitaIva || []),
      ...(cfg.periodicitaAnnuale || []),
    ].find((p) => p.value === col4Eff);
    chips.push(
      `<div class="riepilogo-chip"><span class="chip-label">Periodicità:</span><span class="chip-value">${perObj ? perObj.label : col4Eff}</span></div>`,
    );
  }
  if (chips.length > 0) {
    content.innerHTML = chips.join("");
    box.style.display = "";
  } else box.style.display = "none";
}

function validaClassificazioneCliente() {
  const tipologia = document.getElementById("c-tipologia").value;
  if (!tipologia) {
    showNotif("La Tipologia è obbligatoria", "error");
    document.getElementById("c-tipologia").focus();
    return false;
  }
  const col2Wrap = document.getElementById("wrap-col2");
  const col3Wrap = document.getElementById("wrap-col3");
  const col4Wrap = document.getElementById("wrap-col4");
  if (col2Wrap && col2Wrap.style.display !== "none")
    if (!document.getElementById("c-col2").value) {
      showNotif("La Sottocategoria è obbligatoria", "error");
      document.getElementById("c-col2").focus();
      return false;
    }
  if (col3Wrap && col3Wrap.style.display !== "none")
    if (!document.getElementById("c-col3").value) {
      showNotif("Il Regime è obbligatorio", "error");
      document.getElementById("c-col3").focus();
      return false;
    }
  const col3Val = document.getElementById("c-col3")?.value || "";
  const cfg = _cfg();
  const annPer = (cfg.periodicitaAnnuale || []).map((p) => p.value);
  if (
    !annPer.includes(col3Val) &&
    col4Wrap &&
    col4Wrap.style.display !== "none"
  )
    if (!document.getElementById("c-col4").value) {
      showNotif("La Periodicità è obbligatoria", "error");
      document.getElementById("c-col4").focus();
      return false;
    }
  return true;
}

function onTipologiaChange() {
  const col2Sel = document.getElementById("c-col2");
  if (col2Sel) col2Sel.value = "";
  const col3Sel = document.getElementById("c-col3");
  if (col3Sel) col3Sel.value = "";
  _nascondiCol4();
  const badge = document.getElementById("col4-forfettario-badge");
  if (badge) badge.style.display = "none";
  
  // Ensure JSON data is loaded before updating columns
  if (_cfg() && _cfg().percorsi) {
    aggiornaColonneCliente();
  } else {
    // If JSON is not ready, wait and try again
    setTimeout(() => {
      if (_cfg() && _cfg().percorsi) {
        aggiornaColonneCliente();
      }
    }, 100);
  }
}

function onCol2Change() {
  const col2Val = document.getElementById("c-col2")?.value || "";
  lastClienteFormValues.col2 = col2Val;
  const col3Sel = document.getElementById("c-col3");
  if (col3Sel) col3Sel.value = "";
  // Nascondi il badge forfettario quando cambia col2
  const badge = document.getElementById("col4-forfettario-badge");
  if (badge) badge.style.display = "none";
  aggiornaColonneCliente();
}

function onCol3Change() {
  const tipCodice = _getTipologiaCodice();
  const col2Val = document.getElementById("c-col2")?.value || "";
  const col3Val = document.getElementById("c-col3")?.value || "";
  lastClienteFormValues.col2 = col2Val;
  lastClienteFormValues.col3 = col3Val;
  _aggiornaCol3(tipCodice, col2Val);
  _aggiornCol4BasedOnCol3(tipCodice, col3Val);
  aggiornaRiepilogoClassificazione();
}

// ─── COPIA CONFIGURAZIONE ─────────────────────────────────────
function openCopiaConfig(id_cliente = null) {
  document.getElementById("copia-config-cliente-id").value = id_cliente || "";
  document.getElementById("copia-config-modalita").value = id_cliente
    ? "singolo"
    : "tutti";
  document.getElementById("copia-config-da").value =
    new Date().getFullYear() - 1;
  document.getElementById("copia-config-a").value = new Date().getFullYear();
  if (id_cliente) {
    const cliente = state.clienti?.find((c) => c.id === id_cliente);
    document.getElementById("copia-config-info").innerHTML = cliente
      ? `Copia configurazione per <strong>${cliente.nome}</strong>`
      : "Copia configurazione cliente";
  } else {
    document.getElementById("copia-config-info").innerHTML =
      "Copia configurazione per <strong>tutti i clienti attivi</strong>";
  }
  openModal("modal-copia-config");
}

function openCopiaConfigTutti() {
  openCopiaConfig();
}

function eseguiCopiaConfig() {
  const modalita = document.getElementById("copia-config-modalita").value;
  const id_cliente = document.getElementById("copia-config-cliente-id").value;
  const da = parseInt(document.getElementById("copia-config-da").value);
  const a = parseInt(document.getElementById("copia-config-a").value);
  if (da >= a) {
    showNotif(
      "L'anno di partenza deve essere precedente all'anno di destinazione",
      "error",
    );
    return;
  }
  if (modalita === "singolo" && id_cliente) {
    if (typeof socket !== "undefined")
      socket.emit("copia:config_cliente", {
        id_cliente: parseInt(id_cliente),
        anno_da: da,
        anno_a: a,
      });
  } else {
    if (typeof socket !== "undefined")
      socket.emit("copia:config_tutti_clienti", { anno_da: da, anno_a: a });
  }
  closeModal("modal-copia-config");
}

// ─── ESPOSIZIONE GLOBALE ──────────────────────────────────────
window.editCliente = editCliente;
window.editClienteConfig = editClienteConfig;
window.deleteCliente = deleteCliente;
window.goScadenzario = goScadenzario;
window.showClienteDettaglio = showClienteDettaglio;
window.onDettaglioAnnoChange = onDettaglioAnnoChange;
window.editClienteFromDettaglio = editClienteFromDettaglio;
window.deleteClienteFromDettaglio = deleteClienteFromDettaglio;
window.goToClienteScadenzario = goToClienteScadenzario;
window.openCopiaConfig = openCopiaConfig;
window.openCopiaConfigTutti = openCopiaConfigTutti;
window.eseguiCopiaConfig = eseguiCopiaConfig;
window.openNuovoCliente = openNuovoCliente;
window.saveCliente = saveCliente;
window.applyClientiFiltri = applyClientiFiltri;
window.applyClientiFiltriImmediate = applyClientiFiltriImmediate;
window.resetClientiFiltri = resetClientiFiltri;
window.onTipologiaChange = onTipologiaChange;
window.onCol2Change = onCol2Change;
window.onCol3Change = onCol3Change;
window.toggleTipFiltroPanel = toggleTipFiltroPanel;
window.closeTipFiltroPanel = closeTipFiltroPanel;
window.toggleFiltroPercorso = toggleFiltroPercorso;
window.toggleTipologiaGruppo = toggleTipologiaGruppo;
window.selezionaTuttiTipFiltro = selezionaTuttiTipFiltro;
window.deselezionaTuttiTipFiltro = deselezionaTuttiTipFiltro;
window.initializeTipologieFilter = initializeTipologieFilter;
window.renderTipologieFiltroPanel = renderTipologieFiltroPanel;
window.getFiltriPerRequest = getFiltriPerRequest;
// Esposizioni per globale.js
window.TIPOLOGIE_PERCORSI_DATA = _getTipologiePercorsiData(); // snapshot iniziale
window._getAllKeys = _getAllKeys;
window._getActiveFiltroKeys = () => _activeFiltroKeys;
window._filtroManualeNessuno = false; // getter live sotto
Object.defineProperty(window, "_filtroManualeNessuno", {
  get: () => _filtroManualeNessuno,
  set: (v) => {
    _filtroManualeNessuno = v;
  },
  configurable: true,
});
