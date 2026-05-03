// ═══════════════════════════════════════════════════════════════
// CLIENTI.JS — Gestione clienti con configurazione annuale
// ═══════════════════════════════════════════════════════════════

let currentClienteAnno = new Date().getFullYear();
let currentClienteId = null;

let lastClienteFormValues = {
  col2: "",
  col3: "",
  col4: "",
};

// ─── CONFIGURAZIONE TIPOLOGIE ────────────────────────────────
const TIPOLOGIE_PERCORSI_DATA = {
  PF: {
    color: "#5b8df6",
    icon: "👤",
    desc: "Persona Fisica",
    percorsi: [
      {
        col2: "Privato",
        col3: null,
        codice: "PF_PRIV",
        hasPer: false,
        isForf: false,
      },
      {
        col2: "Socio",
        col3: null,
        codice: "PF_SOCIO",
        hasPer: false,
        isForf: false,
      },
      {
        col2: "Ditta Individuale",
        col3: "Ordinario",
        codice: "PF_DITTA_ORD",
        hasPer: true,
        isForf: false,
      },
      {
        col2: "Ditta Individuale",
        col3: "Semplificato",
        codice: "PF_DITTA_SEM",
        hasPer: true,
        isForf: false,
      },
      {
        col2: "Ditta Individuale",
        col3: "Forfettario",
        codice: "PF_DITTA_FOR",
        hasPer: false,
        isForf: true,
      },
      {
        col2: "Professionista",
        col3: "Ordinario",
        codice: "PF_PROF_ORD",
        hasPer: true,
        isForf: false,
      },
      {
        col2: "Professionista",
        col3: "Semplificato",
        codice: "PF_PROF_SEM",
        hasPer: true,
        isForf: false,
      },
      {
        col2: "Professionista",
        col3: "Forfettario",
        codice: "PF_PROF_FOR",
        hasPer: false,
        isForf: true,
      },
    ],
  },
  SP: {
    color: "#a78bfa",
    icon: "🤝",
    desc: "Società di Persone",
    percorsi: [
      {
        col2: null,
        col3: "Ordinaria",
        codice: "SP_ORD",
        hasPer: true,
        isForf: false,
      },
      {
        col2: null,
        col3: "Semplificata",
        codice: "SP_SEMP",
        hasPer: true,
        isForf: false,
      },
    ],
  },
  SC: {
    color: "#34d399",
    icon: "🏢",
    desc: "Società di Capitali",
    percorsi: [
      {
        col2: null,
        col3: "Ordinaria",
        codice: "SC_ORD",
        hasPer: true,
        isForf: false,
      },
    ],
  },
  ASS: {
    color: "#fbbf24",
    icon: "🏛️",
    desc: "Associazione",
    percorsi: [
      {
        col2: null,
        col3: "Ordinaria",
        codice: "ASS_ORD",
        hasPer: true,
        isForf: false,
      },
      {
        col2: null,
        col3: "Semplificata",
        codice: "ASS_SEMP",
        hasPer: true,
        isForf: false,
      },
    ],
  },
};

// ─── MAPPE LABEL ↔ DB ────────────────────────────────────────
// Label display (usate nelle chiavi filtro) → valore DB (lowercase)
const COL2_LABEL_TO_DB = {
  Privato: "privato",
  "Ditta Individuale": "ditta",
  Socio: "socio",
  Professionista: "professionista",
};
// Valore DB → label display
const COL2_DB_TO_LABEL = {
  privato: "Privato",
  ditta: "Ditta Individuale",
  socio: "Socio",
  professionista: "Professionista",
};
const COL3_LABEL_TO_DB = {
  Ordinario: "ordinario",
  Ordinaria: "ordinaria",
  Semplificato: "semplificato",
  Semplificata: "semplificata",
  Forfettario: "forfettario",
};
const COL3_DB_TO_LABEL = {
  ordinario: "Ordinario",
  ordinaria: "Ordinaria",
  semplificato: "Semplificato",
  semplificata: "Semplificata",
  forfettario: "Forfettario",
};

// ─── STATO FILTRO ─────────────────────────────────────────────
// Set di chiavi attive: "TIP|col2|col3|per"
let _activeFiltroKeys = new Set();
// Stato pannello: aperto o chiuso
let _tipFiltroPanelOpen = false;

function _buildFiltroKey(tipCod, col2, col3, per) {
  return `${tipCod}|${col2 || ""}|${col3 || ""}|${per || ""}`;
}

function _getAllKeys() {
  const keys = [];
  Object.entries(TIPOLOGIE_PERCORSI_DATA).forEach(([tipCod, tip]) => {
    tip.percorsi.forEach((p) => {
      const perList = p.isForf
        ? ["annuale"]
        : p.hasPer
          ? ["mensile", "trimestrale"]
          : [""];
      perList.forEach((per) =>
        keys.push(_buildFiltroKey(tipCod, p.col2, p.col3, per)),
      );
    });
  });
  return keys;
}

function initializeTipologieFilter() {
  _activeFiltroKeys = new Set(_getAllKeys());
  // Sincronizza la variabile globale esposta
  window._activeFiltroKeys = _activeFiltroKeys;
}

// ─── FIX: Inizializza subito al caricamento del modulo ───────
initializeTipologieFilter();

function _isTipCodAllSelected(tipCod) {
  const tip = TIPOLOGIE_PERCORSI_DATA[tipCod];
  if (!tip) return false;
  return tip.percorsi.every((p) => {
    const perList = p.isForf
      ? ["annuale"]
      : p.hasPer
        ? ["mensile", "trimestrale"]
        : [""];
    return perList.every((per) =>
      _activeFiltroKeys.has(_buildFiltroKey(tipCod, p.col2, p.col3, per)),
    );
  });
}

// ─── RENDER PANNELLO ──────────────────────────────────────────
function renderTipologieFiltroPanel() {
  const totalKeys = _getAllKeys().length;
  const activeCount = _activeFiltroKeys.size;

  let html = `<div class="tip-filtro-panel" id="tip-filtro-panel">
    <div class="tip-filtro-header">
      <span style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">🏷️ Filtra per Tipologia</span>
      <span style="font-size:11px;color:var(--t3);margin-left:4px">(${activeCount}/${totalKeys} selezionati)</span>
      <div style="display:flex;gap:6px;align-items:center;margin-left:auto">
        <button class="tip-btn-all" onclick="selezionaTuttiTipFiltro(event)" title="Seleziona tutto">✦ Tutti</button>
        <button class="tip-btn-none" onclick="deselezionaTuttiTipFiltro(event)" title="Deseleziona tutto">✕ Nessuno</button>
      </div>
    </div>
    <div class="tip-filtro-body">`;

  Object.entries(TIPOLOGIE_PERCORSI_DATA).forEach(([tipCod, tip]) => {
    const allSelected = _isTipCodAllSelected(tipCod);
    const someSelected = tip.percorsi.some((p) => {
      const perList = p.isForf
        ? ["annuale"]
        : p.hasPer
          ? ["mensile", "trimestrale"]
          : [""];
      return perList.some((per) =>
        _activeFiltroKeys.has(_buildFiltroKey(tipCod, p.col2, p.col3, per)),
      );
    });

    html += `<div class="tip-gruppo">
      <div class="tip-gruppo-header" onclick="toggleTipologiaGruppo(event,'${tipCod}')"
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
        ? ["annuale"]
        : p.hasPer
          ? ["mensile", "trimestrale"]
          : [""];
      perList.forEach((per) => {
        const key = _buildFiltroKey(
          tipCod,
          p.col2,
          p.col3,
          per === "" ? "" : per,
        );
        const isActive = _activeFiltroKeys.has(key);
        const perColor =
          per === "mensile"
            ? "#22d3ee"
            : per === "trimestrale"
              ? "#a78bfa"
              : per === "annuale"
                ? "#94a3b8"
                : "";

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
          onclick="toggleFiltroPercorso(event,'${tipCod}','${p.col2 || ""}','${p.col3 || ""}','${per}')"
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
  _aggiornaTipFiltroPanelVisibility();
}

function closeTipFiltroPanel(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  _tipFiltroPanelOpen = false;
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
  if (_activeFiltroKeys.has(key)) {
    _activeFiltroKeys.delete(key);
  } else {
    _activeFiltroKeys.add(key);
  }
  // Sincronizza globale
  window._activeFiltroKeys = _activeFiltroKeys;
  _refreshTipFiltroPanel();
  applyClientiFiltriDB();
}

function toggleTipologiaGruppo(event, tipCod) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  const tip = TIPOLOGIE_PERCORSI_DATA[tipCod];
  if (!tip) return;
  const allKeys = [];
  tip.percorsi.forEach((p) => {
    const perList = p.isForf
      ? ["annuale"]
      : p.hasPer
        ? ["mensile", "trimestrale"]
        : [""];
    perList.forEach((per) =>
      allKeys.push(_buildFiltroKey(tipCod, p.col2, p.col3, per)),
    );
  });
  const allActive = allKeys.every((k) => _activeFiltroKeys.has(k));
  if (allActive) {
    allKeys.forEach((k) => _activeFiltroKeys.delete(k));
  } else {
    allKeys.forEach((k) => _activeFiltroKeys.add(k));
  }
  // Sincronizza globale
  window._activeFiltroKeys = _activeFiltroKeys;
  _refreshTipFiltroPanel();
  applyClientiFiltriDB();
}

function selezionaTuttiTipFiltro(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  _activeFiltroKeys = new Set(_getAllKeys());
  window._activeFiltroKeys = _activeFiltroKeys;
  _refreshTipFiltroPanel();
  applyClientiFiltriDB();
}

function deselezionaTuttiTipFiltro(event) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  _activeFiltroKeys = new Set();
  window._activeFiltroKeys = _activeFiltroKeys;
  _refreshTipFiltroPanel();
  applyClientiFiltriDB();
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

function _aggiornaTipFiltroCounter() {
  const badge = document.getElementById("tip-filtro-count");
  if (badge) {
    const n = _activeFiltroKeys.size;
    badge.textContent = n > 0 ? n : "";
    badge.style.display = n > 0 ? "inline-flex" : "none";
  }
}

// ─── FIX PRINCIPALE: Costruisce i filtri per la richiesta al server ──
// Le chiavi usano label display (es. "Ditta Individuale") ma il DB
// salva valori raw lowercase (es. "ditta"). Convertiamo correttamente.
function getFiltriPerRequest() {
  // Se nessun filtro attivo → ritorna filtro vuoto (mostrerà 0 clienti)
  if (_activeFiltroKeys.size === 0) {
    return { nessuno: true };
  }
  // Se tutti i filtri attivi → nessun filtro (mostra tutto)
  const allKeys = _getAllKeys();
  if (_activeFiltroKeys.size === allKeys.length) {
    return {};
  }

  const tipologie = new Set();
  const col2Values = new Set();
  const col3Values = new Set();
  const periodicitaValues = new Set();
  const chiavi = [];

  _activeFiltroKeys.forEach((key) => {
    const [tip, col2, col3, per] = key.split("|");
    if (tip) tipologie.add(tip);
    // FIX: converti label display → valore db (lowercase)
    if (col2) {
      const dbVal = COL2_LABEL_TO_DB[col2] || col2.toLowerCase();
      col2Values.add(dbVal);
    }
    if (col3) {
      const dbVal = COL3_LABEL_TO_DB[col3] || col3.toLowerCase();
      col3Values.add(dbVal);
    }
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
const applyClientiFiltriDB = debounce(() => {
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
      // Legacy single-value per compatibilità backend
      tipologia: filtriTip.tipologie ? filtriTip.tipologie.join(",") : "",
      col2: filtriTip.col2_values ? filtriTip.col2_values.join(",") : "",
      col3: filtriTip.col3_values ? filtriTip.col3_values.join(",") : "",
      periodicita: filtriTip.periodicita_values
        ? filtriTip.periodicita_values.join(",")
        : "",
      nessuno: filtriTip.nessuno || false,
    });
  }
}, 300);

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
  if (typeof socket !== "undefined")
    socket.emit("get:clienti", { anno: new Date().getFullYear() });
}

// ─── RENDER LISTA ─────────────────────────────────────────────
function renderClientiPage() {
  // FIX: assicura sempre che i filtri siano inizializzati
  if (_activeFiltroKeys.size === 0 && _getAllKeys().length > 0) {
    initializeTipologieFilter();
  }
  renderClientiTabella(state.clienti);
}

function renderClientiTabella(clienti) {
  const col2Map = {
    privato: "Ditta Ind.",
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
  const activeCount = _activeFiltroKeys.size;
  const totalKeys = _getAllKeys().length;

  const filterBar = `
    <div class="filtri-avanzati no-print" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:var(--surface2);border-radius:var(--r-sm);">
      <span style="font-size:11px;color:var(--text3);font-weight:700;">📅 Anno:</span>
      <select id="filter-anno" class="select" style="width:110px" onchange="applyClientiFiltri()" title="Filtra per anno">
        ${buildAnniOptions(currentAnno)}
      </select>
      <button class="btn btn-sm btn-primary" onclick="resetClientiFiltri()" style="margin-left:auto">⟳ Reset</button>
    </div>

    <div style="margin-bottom:16px">
      <div id="tip-filtro-header-row" style="display:flex;align-items:center;gap:10px;margin-bottom:6px;padding:10px 14px;background:var(--s2);border:1px solid var(--b0);border-radius:var(--r-sm);cursor:pointer;" onclick="toggleTipFiltroPanel(event)">
        <span style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">🏷️ Filtro Tipologie</span>
        <span id="tip-filtro-count" style="display:${activeCount > 0 && activeCount < totalKeys ? "inline-flex" : "none"};align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;background:var(--accent);color:#fff;border-radius:10px;font-size:11px;font-weight:700">${activeCount}</span>
        ${activeCount === 0 ? `<span style="font-size:11px;color:var(--red);font-weight:700">⚠️ Nessuno selezionato</span>` : ""}
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
    if (_activeFiltroKeys.size === 0) {
      tableRows = `<tr><td colspan="4"><div class="empty"><div class="empty-icon">🏷️</div><p>Nessun filtro selezionato — clicca <strong>Tutti</strong> per vedere tutti i clienti</p></div></td></tr>`;
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
        if (c.periodicita)
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
            <button class="btn btn-xs btn-secondary" onclick="editCliente(${c.id})" title="Modifica">✏️</button>
            <button class="btn btn-xs btn-success" onclick="goScadenzario(${c.id})" title="Scadenzario">📅</button>
            <button class="btn btn-xs btn-danger" onclick="deleteCliente(${c.id})" title="Elimina">🗑️</button>
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

  const col2LMap = {
    privato: "Privato",
    ditta: "Ditta Individuale",
    socio: "Socio",
    professionista: "Professionista",
  };
  const col3LMap = {
    ordinario: "Ordinario",
    semplificato: "Semplificato",
    forfettario: "Forfettario",
    ordinaria: "Ordinaria",
    semplificata: "Semplificata",
  };
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
        ${c.config_anno && c.config_anno !== anno ? `<span class="badge-info" style="background:var(--yellow)18;color:var(--yellow)">⚠️ Ereditata dal ${c.config_anno}</span>` : ""}
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
  setTimeout(() => {
    if (document.getElementById("c-col2"))
      document.getElementById("c-col2").value = col2Val;
    if (document.getElementById("c-col3"))
      document.getElementById("c-col3").value = col3Val;
    lastClienteFormValues.col2 = col2Val;
    lastClienteFormValues.col3 = col3Val;
    lastClienteFormValues.col4 = col4Val;
    aggiornaColonneCliente();
    setTimeout(() => {
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
          ) {
            socket.emit("delete:cliente", { id, anno: currentAnno });
          }
        } else {
          if (confirm(`Eliminare "${clienteNome}" da tutti gli anni?`)) {
            socket.emit("delete:cliente", { id, anno: null, deleteAll: true });
          } else if (confirm(`Eliminare solo dall'anno ${currentAnno}?`)) {
            socket.emit("delete:cliente", { id, anno: currentAnno });
          }
        }
      },
    );
  } else {
    proceedWithBasicDeletion(id, currentAnno, clienteNome);
  }
}

function proceedWithBasicDeletion(id, currentAnno, clienteNome) {
  if (confirm(`Eliminare "${clienteNome}" solo per l'anno ${currentAnno}?`)) {
    if (typeof socket !== "undefined")
      socket.emit("delete:cliente", { id, anno: currentAnno });
  }
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
  const tipIcons = { PF: "👤", SP: "🤝", SC: "🏢", ASS: "🏛️" };
  const tipDescs = {
    PF: "Persona Fisica",
    SP: "Società di Persone",
    SC: "Società di Capitali",
    ASS: "Associazione",
  };
  sel.innerHTML = (state.tipologie || [])
    .map((t) => {
      const icon = tipIcons[t.codice] || "📋";
      const desc = tipDescs[t.codice] || t.nome;
      return `<option value="${t.id}" ${String(t.id) === String(selectedId) ? "selected" : ""}>${icon} ${t.codice} — ${desc}</option>`;
    })
    .join("");
  _aggiornaTipologiaSelectStyle();
}

function _aggiornaTipologiaSelectStyle() {
  const sel = document.getElementById("c-tipologia");
  if (!sel || !sel.value) return;
  const tipCodice = _getTipologiaCodice();
  const colors = {
    PF: "#5b8df6",
    SP: "#fbbf24",
    SC: "#34d399",
    ASS: "#f472b6",
  };
  const color = colors[tipCodice] || "var(--accent)";
  sel.style.borderColor = color;
  sel.style.boxShadow = `0 0 0 1px ${color}44`;
}

// ─── 4 COLONNE ────────────────────────────────────────────────
function aggiornaColonneCliente() {
  const tipCodice = _getTipologiaCodice();
  const col2Wrap = document.getElementById("wrap-col2");
  const col2Sel = document.getElementById("c-col2");
  const col2Opts = COL2_OPTIONS[tipCodice];
  _aggiornaTipologiaSelectStyle();
  if (!col2Opts) {
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
  const col4Wrap = document.getElementById("wrap-col4");
  const col4Sel = document.getElementById("c-col4");
  if (REGIMI_ANNUALI.includes(col3Val)) {
    col4Wrap.style.display = "none";
    col4Sel.value = "annuale";
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
  const col2 = document.getElementById("c-col2")?.value || "";
  const col3 = document.getElementById("c-col3")?.value || "";
  const col4 = document.getElementById("c-col4")?.value || "";
  const col4Eff = REGIMI_ANNUALI.includes(col3) ? "annuale" : col4;
  const tipColors = {
    PF: "#5b8df6",
    SP: "#fbbf24",
    SC: "#34d399",
    ASS: "#f472b6",
  };
  const tipColor = tipColors[tipCodice] || "var(--accent)";
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
  if (col4Eff)
    chips.push(
      `<div class="riepilogo-chip"><span class="chip-label">Periodicità:</span><span class="chip-value">${col4Eff === "mensile" ? "📅 Mensile" : col4Eff === "annuale" ? "📅 Annuale" : "📆 Trimestrale"}</span></div>`,
    );
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
  if (col2Wrap && col2Wrap.style.display !== "none") {
    if (!document.getElementById("c-col2").value) {
      showNotif("La Sottocategoria è obbligatoria", "error");
      document.getElementById("c-col2").focus();
      return false;
    }
  }
  if (col3Wrap && col3Wrap.style.display !== "none") {
    if (!document.getElementById("c-col3").value) {
      showNotif("Il Regime è obbligatorio", "error");
      document.getElementById("c-col3").focus();
      return false;
    }
  }
  const col3Val = document.getElementById("c-col3")?.value || "";
  if (
    !REGIMI_ANNUALI.includes(col3Val) &&
    col4Wrap &&
    col4Wrap.style.display !== "none"
  ) {
    if (!document.getElementById("c-col4").value) {
      showNotif("La Periodicità è obbligatoria", "error");
      document.getElementById("c-col4").focus();
      return false;
    }
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
  aggiornaColonneCliente();
}

function onCol2Change() {
  const col2Val = document.getElementById("c-col2")?.value || "";
  lastClienteFormValues.col2 = col2Val;
  const col3Sel = document.getElementById("c-col3");
  if (col3Sel) col3Sel.value = "";
  _nascondiCol4();
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
window.resetClientiFiltri = resetClientiFiltri;
window.onTipologiaChange = onTipologiaChange;
window.onCol2Change = onCol2Change;
window.onCol3Change = onCol3Change;
window.toggleTipFiltroPanel = toggleTipFiltroPanel;
window.closeTipFiltroPanel = closeTipFiltroPanel;
window.toggleFiltroPercorso = toggleFiltroPercorso;
window.toggleTipologiaGruppo = toggleTipologiaGruppo;
window.selezionaTuttiTipFiltro = selezionaTuttiTipFiltro;
window.initializeTipologieFilter = initializeTipologieFilter;
window.deselezionaTuttiTipFiltro = deselezionaTuttiTipFiltro;
window.renderTipologieFiltroPanel = renderTipologieFiltroPanel;
window.getFiltriPerRequest = getFiltriPerRequest;
window.TIPOLOGIE_PERCORSI_DATA = TIPOLOGIE_PERCORSI_DATA;
window._activeFiltroKeys = _activeFiltroKeys;
// Esporta le mappe per uso in globale.js
window.COL2_DB_TO_LABEL = COL2_DB_TO_LABEL;
window.COL3_DB_TO_LABEL = COL3_DB_TO_LABEL;
window.COL2_LABEL_TO_DB = COL2_LABEL_TO_DB;
window.COL3_LABEL_TO_DB = COL3_LABEL_TO_DB;
