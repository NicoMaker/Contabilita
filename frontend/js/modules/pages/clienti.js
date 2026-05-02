// ═══════════════════════════════════════════════════════════════
// CLIENTI.JS — Gestione clienti con configurazione annuale
// ═══════════════════════════════════════════════════════════════

let currentClienteAnno = new Date().getFullYear();
let currentClienteId = null;

// Variabili globali per mantenere i valori dei campi di classificazione tra le aperture del form
let lastClienteFormValues = {
  col2: "",
  col3: "",
  col4: "",
};

// Carica le tipologie dal file JSON
let TIPOLOGIE_DATA = null;

function loadTipologieData() {
  if (TIPOLOGIE_DATA) return Promise.resolve(TIPOLOGIE_DATA);
  
  return fetch('./json/tipologie-data.json')
    .then(response => response.json())
    .then(data => {
      TIPOLOGIE_DATA = data;
      return data;
    })
    .catch(error => {
      console.error('Errore nel caricamento delle tipologie:', error);
      return null;
    });
}

// Costruisci le opzioni di filtro dinamicamente dai dati
function buildClientiFilterOptions() {
  if (!TIPOLOGIE_DATA) {
    // Fallback to default options if data not loaded yet
    return {
      tipo: [
        { value: "PF", label: "👤 PF — Persona Fisica" },
        { value: "SP", label: "🤝 SP — Soc. Persone" },
        { value: "SC", label: "🏢 SC — Soc. Capitali" },
        { value: "ASS", label: "🏛️ ASS — Associazione" },
      ],
      col2: [
        { value: "privato", label: "👤 Privato" },
        { value: "ditta", label: "🏢 Ditta" },
        { value: "socio", label: "🤝 Socio" },
        { value: "professionista", label: "⚕️ Professionista" },
      ],
      col3: [
        { value: "forfettario", label: "💰 Forfettario" },
        { value: "ordinario", label: "📊 Ordinario" },
        { value: "ordinaria", label: "📊 Ordinaria" },
        { value: "semplificato", label: "📄 Semplificato" },
        { value: "semplificata", label: "📄 Semplificata" },
      ],
      periodicita: [
        { value: "mensile", label: "📅 Mensile" },
        { value: "trimestrale", label: "📆 Trimestrale" },
        { value: "annuale", label: "🗓️ Annuale" },
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
  Object.entries(TIPOLOGIE_DATA.tipologie).forEach(([key, value]) => {
    options.tipo.push({
      value: key,
      label: `${value.icon} ${key.toUpperCase()} — ${value.desc}`
    });
  });
  
  // Col2 (sottocategorie)
  const col2Set = new Set();
  Object.values(TIPOLOGIE_DATA.percorsi).forEach(percorso => {
    percorso.forEach(item => {
      if (item.col2Label) {
        col2Set.add(item.col2Label);
      }
    });
  });
  
  col2Set.forEach(col2 => {
    const value = col2.toLowerCase().replace(/\s+/g, '_').replace('.', '');
    options.col2.push({
      value: value,
      label: col2
    });
  });
  
  // Col3 (regimi)
  const col3Set = new Set();
  Object.values(TIPOLOGIE_DATA.percorsi).forEach(percorso => {
    percorso.forEach(item => {
      if (item.col3Label) {
        col3Set.add(item.col3Label);
      }
    });
  });
  
  col3Set.forEach(col3 => {
    const value = col3.toLowerCase().replace(/\s+/g, '_').replace('.', '');
    options.col3.push({
      value: value,
      label: col3
    });
  });
  
  // Periodicità
  [...TIPOLOGIE_DATA.periodicitaIva, ...TIPOLOGIE_DATA.periodicitaAnnuale].forEach(periodo => {
    options.periodicita.push({
      value: periodo.value,
      label: periodo.label
    });
  });
  
  return options;
}

let CLIENTI_FILTER_OPTIONS = buildClientiFilterOptions();
let clientiFilterState = null;

// ─── ANNO MIN/MAX ─────────────────────────────────────────────
const ANNO_MIN = 2026;
const ANNO_MAX = 2200;

function initClientiFilterState() {
  if (clientiFilterState) return;
  clientiFilterState = {};
  Object.entries(CLIENTI_FILTER_OPTIONS).forEach(([group, options]) => {
    clientiFilterState[group] = new Set(options.map((o) => o.value));
  });
}

function getClientiFilterValues(group) {
  initClientiFilterState();
  return Array.from(clientiFilterState[group] || []);
}

function isClientiAllSelected(group) {
  const selected = new Set(getClientiFilterValues(group));
  const all = CLIENTI_FILTER_OPTIONS[group].map((o) => o.value);
  return all.every((v) => selected.has(v));
}

function renderClientiFilterGroup(group, title) {
  const values = getClientiFilterValues(group);
  const selected = new Set(values);
  const allSelected = isClientiAllSelected(group);
  const optionsHtml = CLIENTI_FILTER_OPTIONS[group]
    .map(
      (opt) => `<label class="gf-option ${selected.has(opt.value) ? "is-selected" : ""}">
      <input type="checkbox" ${selected.has(opt.value) ? "checked" : ""} onchange="onClientiFilterToggle('${group}','${opt.value}',this.checked)">
      <span>${opt.label}</span>
    </label>`,
    )
    .join("");
  return `<div class="gf-group">
    <div class="gf-head">
      <strong>${title}</strong>
      <label class="gf-all ${allSelected ? "is-selected" : ""}">
        <input type="checkbox" ${allSelected ? "checked" : ""} onchange="onClientiFilterToggleAll('${group}',this.checked)">
        <span>Tutti</span>
      </label>
    </div>
    <div class="gf-options">${optionsHtml}</div>
  </div>`;
}

function onClientiFilterToggle(group, value, checked) {
  initClientiFilterState();
  if (!clientiFilterState[group]) clientiFilterState[group] = new Set();
  if (checked) clientiFilterState[group].add(value);
  else clientiFilterState[group].delete(value);
  renderClientiPage();
  applyClientiFiltri();
}

function onClientiFilterToggleAll(group, checked) {
  initClientiFilterState();
  clientiFilterState[group] = checked
    ? new Set(CLIENTI_FILTER_OPTIONS[group].map((o) => o.value))
    : new Set();
  renderClientiPage();
  applyClientiFiltri();
}

function buildAnniOptions(selectedAnno, includeAll = false) {
  const opts = [];
  for (let y = ANNO_MIN; y <= ANNO_MAX; y++) {
    opts.push(
      `<option value="${y}" ${y === selectedAnno ? "selected" : ""}>${y}</option>`,
    );
  }
  return opts.join("");
}

// ─── FILTRI ───────────────────────────────────────────────────
const applyClientiFiltriDB = debounce(() => {
  const search = document.getElementById("global-search-clienti")?.value || "";
  const tipologia = getClientiFilterValues("tipo");
  const col2 = getClientiFilterValues("col2");
  const col3 = getClientiFilterValues("col3");
  const periodicita = getClientiFilterValues("periodicita");
  const anno =
    parseInt(document.getElementById("filter-anno")?.value) ||
    new Date().getFullYear();
  if (typeof socket !== "undefined") {
    socket.emit("get:clienti", {
      search,
      tipologia,
      col2,
      col3,
      periodicita,
      anno,
    });
  }
}, 300);

function applyClientiFiltri() {
  applyClientiFiltriDB();
}

function resetClientiFiltri() {
  const search = document.getElementById("global-search-clienti");
  if (search) search.value = "";
  initClientiFilterState();
  Object.entries(CLIENTI_FILTER_OPTIONS).forEach(([group, options]) => {
    clientiFilterState[group] = new Set(options.map((o) => o.value));
  });
  const annoSelect = document.getElementById("filter-anno");
  if (annoSelect) annoSelect.value = new Date().getFullYear();
  if (typeof socket !== "undefined")
    socket.emit("get:clienti", { anno: new Date().getFullYear() });
}

// ─── RENDER LISTA ─────────────────────────────────────────────
function renderClientiPage() {
  // Carica i dati delle tipologie se non già caricati
  loadTipologieData().then(() => {
    // Ricostruisci le opzioni di filtro con i dati caricati
    CLIENTI_FILTER_OPTIONS = buildClientiFilterOptions();
    // Reinizializza lo stato dei filtri con le nuove opzioni
    initClientiFilterState();
    // Renderizza la tabella
    renderClientiTabella(state.clienti);
  });
}

function renderClientiTabella(clienti) {
  initClientiFilterState();
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

  const filterBar = `
    <div class="filtri-avanzati no-print" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:var(--surface2);border-radius:var(--r-sm);">
      <span style="font-size:11px;color:var(--text3);font-weight:700;">🔍 Filtri:</span>
      <select id="filter-anno" class="select" style="width:110px" onchange="applyClientiFiltri()" title="Filtra per anno">
        ${buildAnniOptions(currentAnno)}
      </select>
      <div class="gf-wrap">
        ${renderClientiFilterGroup("tipo", "Tipologia")}
        ${renderClientiFilterGroup("col2", "Sottocategoria")}
        ${renderClientiFilterGroup("col3", "Regime")}
        ${renderClientiFilterGroup("periodicita", "Periodicità")}
      </div>
      <button class="btn btn-sm btn-orange" onclick="showCopyClientiDialog()" title="Copia clienti da un anno all'altro" style="margin-right:8px">📋 Copia Anno</button>
      <button class="btn btn-sm btn-primary" onclick="resetClientiFiltri()" style="margin-left:auto">⟳ Tutti</button>
    </div>`;

  let tableRows = "";
  if (!clienti || clienti.length === 0) {
    tableRows = `<tr><td colspan="4"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato per l'anno ${currentAnno}</p></div></td></tr>`;
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
          colBadges += `<span class="badge-per"  style="font-size:11px">📅 ${periodicitaMap[c.periodicita] || c.periodicita}</span>`;

        const configInfo =
          c.config_anno && c.config_anno !== currentAnno
            ? `<div style="font-size:9px;color:var(--yellow);margin-top:3px" title="Configurazione ereditata dal ${c.config_anno}">📌 eredita ${c.config_anno}</div>`
            : `<div style="font-size:9px;color:var(--green);margin-top:3px" title="Configurazione per l'anno ${currentAnno}">✅ Configurato ${currentAnno}</div>`;

        return `<tr class="clickable" onclick="showClienteDettaglio(${c.id})" style="cursor:pointer">
        <td style="padding:12px 16px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="cliente-avatar-sm" style="background:${tipColor}22;border-color:${tipColor};color:${tipColor};width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:10px;font-weight:800;font-size:${avatarFontSize(avatar, 13)}">${avatar}</div>
            <div>
              <div style="font-weight:700;font-size:15px">${escAttr(c.nome)}</div>
              <div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-top:2px">${c.codice_fiscale || c.partita_iva || "—"}</div>
              ${configInfo}
            </div>
          </div>
        </td>
        <td style="padding:12px 16px">
          <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">${tipBadge} ${colBadges}</div>
          ${sottotipoLabel ? `<div style="font-size:10px;color:var(--text3);margin-top:4px">🏷️ ${sottotipoLabel}</div>` : ""}
        </td>
        <td style="padding:12px 16px;color:var(--text2);font-size:13px">${c.email || "—"}</td>
        <td class="no-print" style="padding:12px 16px;white-space:nowrap">
          <div style="display:flex;gap:6px;flex-wrap:wrap" onclick="event.stopPropagation()">
            <button class="btn btn-xs btn-secondary" onclick="editCliente(${c.id})"   title="Modifica">✏️</button>
            <button class="btn btn-xs btn-success"   onclick="goScadenzario(${c.id})" title="Scadenzario">📅</button>
            <button class="btn btn-xs btn-danger"    onclick="deleteCliente(${c.id})" title="Elimina">🗑️</button>
          </div>
        </td>
      </tr>`;
      })
      .join("");
  }

  const html = `${filterBar}
    <div class="table-wrap">
      <div class="table-header no-print">
        <h3>Clienti <span style="font-size:13px;color:var(--text3);margin-left:8px">(${clienti ? clienti.length : 0})</span></h3>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text2)">Cliente</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text2)">Classificazione ${currentAnno}</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text2)">Email</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text2)" class="no-print">Azioni</th>
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
        <span style="font-size:13px;color:var(--text2)">📅 Anno configurazione:</span>
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
      <div style="background:var(--surface2);border-radius:var(--r-sm);padding:14px;border-left:3px solid ${tipColor}">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase">Tipologia</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${tipInfo.icon || ""} ${c.tipologia_codice || "-"} — ${c.tipologia_nome || ""}</div>
      </div>
      ${
        c.col2_value
          ? `<div style="background:var(--surface2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #fb923c">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase">Sottocategoria</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${col2LMap[c.col2_value] || c.col2_value}</div>
      </div>`
          : ""
      }
      ${
        c.col3_value
          ? `<div style="background:var(--surface2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #5b8df6">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase">Regime</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${col3LMap[c.col3_value] || c.col3_value}</div>
      </div>`
          : ""
      }
      ${
        c.periodicita
          ? `<div style="background:var(--surface2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #22d3ee">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase">Periodicità</div>
        <div style="font-size:15px;font-weight:700;margin-top:4px">${periodicitaMap[c.periodicita] || c.periodicita}</div>
      </div>`
          : ""
      }
    </div>`
    : "";

  document.getElementById("modal-cliente-det-title").textContent = c.nome;
  document.getElementById("cliente-dettaglio-content").innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--surface2);border-radius:var(--r-sm);margin-bottom:20px;border-left:4px solid ${tipColor}">
      <div class="det-avatar" style="width:48px;height:48px;background:${tipColor}22;border:2px solid ${tipColor};color:${tipColor};display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:18px;font-weight:800">${avatar}</div>
      <div>
        <div style="font-size:20px;font-weight:800">${escAttr(c.nome)}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px">${c.codice_fiscale || c.partita_iva || ""}</div>
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
    container.innerHTML = `<div class="infobox" style="font-size:12px">📋 Nessuna configurazione storica. Modifica altri anni per vedere lo storico.</div>`;
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
    rows += `<tr style="border-bottom:1px solid var(--border)">
      <td style="padding:8px 12px;font-weight:700;color:var(--accent)">${cfg.anno}</td>
      <td style="padding:8px 12px"><span class="badge b-${(cfg.tipologia_codice || "").toLowerCase()}">${cfg.tipologia_codice || "-"}</span></td>
      <td style="padding:8px 12px">${cfg.col2_value || "-"}</td>
      <td style="padding:8px 12px">${cfg.col3_value ? col3Map[cfg.col3_value] || cfg.col3_value : "-"}</td>
      <td style="padding:8px 12px">${cfg.periodicita ? periodicitaMap[cfg.periodicita] || cfg.periodicita : "-"}</td>
      <td style="padding:8px 12px"><button class="btn btn-xs btn-secondary" onclick="editClienteConfig(${cfg.id_cliente},${cfg.anno})">✏️</button></td>
    </tr>`;
  });

  container.innerHTML = `
    <div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">
      <div style="font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px">📜 Storico configurazioni per anno</div>
      <div style="overflow-x:auto">
        <table style="width:100%;font-size:12px">
          <thead><tr style="background:var(--surface2)">
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
      <div class="infobox" style="margin-top:12px;font-size:11px">
        💡 <strong>Suggerimento:</strong> Se un cliente cambia regime in un nuovo anno, modifica la configurazione per quell'anno specifico.
        Gli adempimenti degli anni precedenti rimarranno invariati.
      </div>
    </div>`;
}

// ─── NAVIGAZIONE ANNO DETTAGLIO ───────────────────────────────
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
  
  const anno = parseInt(document.getElementById("det-anno-select")?.value) || new Date().getFullYear();
  const cliente = state.clienti.find(c => c.id === currentClienteId);
  const clienteNome = cliente ? cliente.nome : "questo cliente";
  
  // Per ora, usa la logica semplificata senza verifica degli adempimenti
  // TODO: Implementare verifica adempimenti quando il backend supporta l'evento
  const message = `Eliminare "${clienteNome}" solo per l'anno ${anno}?
  
Questa operazione eliminerà il cliente solo dall'anno ${anno}, mantenendo i dati negli altri anni.
Se vuoi eliminare il cliente da tutti gli anni, contatta l'amministratore.`;

  if (confirm(message)) {
    closeModal("modal-cliente-dettaglio");
    if (typeof socket !== "undefined") {
      socket.emit("delete:cliente", { id: currentClienteId, anno });
    }
  }
}

function goToClienteScadenzario() {
  if (currentClienteId) {
    closeModal("modal-cliente-dettaglio");
    goScadenzario(currentClienteId);
  }
}

// ─── EDIT CLIENTE ─────────────────────────────────────────────
function editCliente(id) {
  const anno =
    parseInt(document.getElementById("filter-anno")?.value) ||
    new Date().getFullYear();
  editClienteConfig(id, anno);
}

// ─── MODALE MODIFICA CLIENTE ──────────────────────────────────
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

// ─── NUOVO CLIENTE ────────────────────────────────────────────
function openNuovoCliente() {
  const currentAnno = parseInt(document.getElementById("filter-anno")?.value) || new Date().getFullYear();
  
  document.getElementById("modal-cliente-title").textContent = `Nuovo Cliente — ${currentAnno}`;
  document.getElementById("cliente-id").value = "";
  document.getElementById("cliente-edit-anno").value = currentAnno;
  const annoInfo = document.getElementById("cliente-anno-info");
  if (annoInfo) {
    annoInfo.innerHTML = `<div class="infobox" style="margin-bottom:16px;background:var(--accent-d);border-color:var(--accent)">
      📅 Creazione cliente per l'anno <strong>${currentAnno}</strong>. Il cliente sarà disponibile solo per questo anno e gli anni successivi.
    </div>`;
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

  if (state.tipologie && state.tipologie.length > 0) {
    populateTipologiaSelect(state.tipologie[0].id);
  } else {
    populateTipologiaSelect("");
  }

  setTimeout(() => {
    aggiornaColonneCliente();
    aggiornaRiepilogoClassificazione();
  }, 50);

  openModal("modal-cliente");
}

// ─── SALVA CLIENTE ────────────────────────────────────────────
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

  let col2Val = null;
  let col3Val = null;
  let col4Val = null;

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
    // ✅ Partita IVA: solo cifre
    partita_iva:
      document
        .getElementById("c-piva")
        ?.value.replace(/[^0-9]/g, "")
        .trim() || null,
    email: document.getElementById("c-email")?.value.trim() || null,
    // ✅ Telefono: solo cifre + simboli telefonici
    telefono:
      document
        .getElementById("c-tel")
        ?.value.replace(/[^0-9+\s\-]/g, "")
        .trim() || null,
    indirizzo: document.getElementById("c-indirizzo")?.value.trim() || null,
    citta: document.getElementById("c-citta")?.value.trim() || null,
    // ✅ CAP: solo cifre
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
  const currentAnno = parseInt(document.getElementById("filter-anno")?.value) || new Date().getFullYear();
  const cliente = state.clienti.find(c => c.id === id);
  const clienteNome = cliente ? cliente.nome : "questo cliente";
  
  // Verifica se il cliente ha adempimenti nell'anno corrente
  if (typeof socket !== "undefined") {
    socket.emit("check:adempimenti_cliente", { id_cliente: id, anno: currentAnno });
    
    // Aspetta la risposta per decidere il tipo di eliminazione
    socket.once("res:check:adempimenti_cliente", ({ success, data }) => {
      if (!success) {
        // Se il backend non supporta la verifica, procedi con logica base
        proceedWithBasicDeletion(id, currentAnno, clienteNome);
        return;
      }
      const totalAdempimenti =
        (data || []).reduce((sum, item) => sum + (item?.esistenti?.length || 0), 0) || 0;
      const hasAdempimenti = totalAdempimenti > 0;
      const count = totalAdempimenti;
      
      let message;
      let deleteAllYears = false;
      
      if (hasAdempimenti && count > 0) {
        // Ha adempimenti - elimina solo per l'anno corrente
        message = `Eliminare "${clienteNome}" solo per l'anno ${currentAnno}?
        
Il cliente ha ${count} adempimento/i in questo anno. Questa operazione eliminerà il cliente solo dall'anno ${currentAnno}, mantenendo i dati negli altri anni.
Se vuoi eliminare il cliente da tutti gli anni, prima elimina tutti gli adempimenti.`;
        deleteAllYears = false;
      } else {
        // Non ha adempimenti - elimina solo per l'anno corrente
        message = `Eliminare "${clienteNome}" dall'anno ${currentAnno}?
        
Questa operazione eliminerà il cliente solo dall'anno ${currentAnno}, mantenendo i dati negli altri anni.`;
        deleteAllYears = false;
      }
      
      const confirmed = confirm(message);
      
      if (confirmed) {
        if (typeof socket !== "undefined") {
          if (deleteAllYears) {
            // Elimina da tutti gli anni
            socket.emit("delete:cliente", { id, anno: null, deleteAll: true });
          } else {
            // Elimina solo per l'anno corrente
            socket.emit("delete:cliente", { id, anno: currentAnno });
          }
        }
      } else if (hasAdempimenti && count > 0) {
        // Se ha adempimenti e l'utente annulla, chiedi se vuole eliminare solo per l'anno corrente
        const confirmYearOnly = confirm(`Eliminare "${clienteNome}" solo per l'anno ${currentAnno}?
        
Questa operazione eliminerà il cliente solo dall'anno ${currentAnno}, mantenendo i dati negli altri anni.`);
        
        if (confirmYearOnly) {
          if (typeof socket !== "undefined") {
            socket.emit("delete:cliente", { id, anno: currentAnno });
          }
        }
      }
    });
  } else {
    // Fallback se socket non disponibile
    proceedWithBasicDeletion(id, currentAnno, clienteNome);
  }
}

function proceedWithBasicDeletion(id, currentAnno, clienteNome) {
  const message = `Eliminare "${clienteNome}" solo per l'anno ${currentAnno}?  
Questa operazione eliminerà il cliente solo dall'anno ${currentAnno}, mantenendo i dati negli altri anni.
Se vuoi eliminare il cliente da tutti gli anni, contatta l'amministratore.`;

  if (confirm(message)) {
    if (typeof socket !== "undefined") {
      socket.emit("delete:cliente", { id, anno: currentAnno });
    }
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
    chips.push(`<div class="riepilogo-chip" style="border-color:${tipColor}44;background:${tipColor}12">
    <span class="chip-label">Tipologia:</span>
    <span class="chip-value" style="color:${tipColor}">${tip.codice} — ${tip.nome}</span></div>`);
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
    const col2Val = document.getElementById("c-col2").value;
    if (!col2Val) {
      showNotif("La Sottocategoria è obbligatoria", "error");
      document.getElementById("c-col2").focus();
      return false;
    }
  }

  if (col3Wrap && col3Wrap.style.display !== "none") {
    const col3Val = document.getElementById("c-col3").value;
    if (!col3Val) {
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
    const col4Val = document.getElementById("c-col4").value;
    if (!col4Val) {
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

// ─── COPIA CLIENTI DA ANNO ───────────────────────────────────────
function showCopyClientiDialog() {
  const currentAnno = parseInt(document.getElementById("filter-anno")?.value) || new Date().getFullYear();
  
  const dialog = document.createElement('div');
  dialog.className = 'modal-overlay';
  dialog.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <h3>📋 Copia Clienti da Anno</h3>
        <button class="btn-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <p style="margin-bottom:16px;color:var(--text2)">Copia tutti i clienti con le loro configurazioni da un anno all'altro.</p>
        
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;color:var(--text1)">Da anno:</label>
            <select id="copy-da-anno" class="select" style="width:100%">
              ${buildAnniOptions(currentAnno - 1)}
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-weight:600;color:var(--text1)">A anno:</label>
            <select id="copy-a-anno" class="select" style="width:100%">
              ${buildAnniOptions(currentAnno)}
            </select>
          </div>
        </div>
        
        <div class="infobox" style="background:var(--blue)18;color:var(--blue);border:1px solid var(--blue)44">
          ℹ️ <strong>Attenzione:</strong> Verranno copiati solo i clienti che hanno una configurazione valida nell'anno di origine. Le configurazioni esistenti nell'anno di destinazione verranno sovrascritte.
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Annulla</button>
        <button class="btn btn-primary" onclick="eseguiCopiaClientiAnno()">📋 Copia Clienti</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
}

function eseguiCopiaClientiAnno() {
  const annoDa = parseInt(document.getElementById("copy-da-anno").value);
  const annoA = parseInt(document.getElementById("copy-a-anno").value);
  
  if (!annoDa || !annoA) {
    showNotification("Seleziona entrambi gli anni", "error");
    return;
  }
  
  if (annoDa === annoA) {
    showNotification("Gli anni di origine e destinazione devono essere diversi", "error");
    return;
  }
  
  if (typeof socket !== "undefined") {
    socket.emit("copia:clienti_da_anno", { anno_da: annoDa, anno_a: annoA });
    // Chiudi il dialog
    document.querySelector('.modal-overlay')?.remove();
  } else {
    showNotification("Funzionalità non disponibile in modalità offline", "error");
  }
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
    if (typeof socket !== "undefined") {
      socket.emit("copia:config_cliente", {
        id_cliente: parseInt(id_cliente),
        anno_da: da,
        anno_a: a,
      });
    }
  } else {
    if (typeof socket !== "undefined") {
      socket.emit("copia:config_tutti_clienti", {
        anno_da: da,
        anno_a: a,
      });
    }
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
window.showCopyClientiDialog = showCopyClientiDialog;
window.eseguiCopiaClientiAnno = eseguiCopiaClientiAnno;
window.openNuovoCliente = openNuovoCliente;
window.saveCliente = saveCliente;
window.applyClientiFiltri = applyClientiFiltri;
window.resetClientiFiltri = resetClientiFiltri;
window.onTipologiaChange = onTipologiaChange;
window.onCol2Change = onCol2Change;
window.onCol3Change = onCol3Change;
window.onClientiFilterToggle = onClientiFilterToggle;
window.onClientiFilterToggleAll = onClientiFilterToggleAll;
