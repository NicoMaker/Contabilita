// ═══════════════════════════════════════════════════════════════
// SCADENZARIO.JS — Scadenzario singolo cliente
// ═══════════════════════════════════════════════════════════════

function getAdempimentiMancanti() {
  if (!state.selectedCliente) return [];
  const cat = JSON.parse(state.selectedCliente.categorie_attive || "[]");
  const compatibili = state.adempimenti.filter(a => a.categoria === "TUTTI" || cat.includes(a.categoria));
  return compatibili.filter(a => !state.adpInseriti.includes(a.id));
}

function renderBtnAddAdp(id_cliente) {
  const mancanti = getAdempimentiMancanti();
  if (!mancanti.length)
    return `<button class="btn btn-sm btn-purple" disabled style="opacity:0.4;cursor:not-allowed">✓ Tutti inseriti</button>`;
  return `<button class="btn btn-sm btn-purple" onclick="openAddAdp(${id_cliente})" title="${mancanti.length} adempimenti da aggiungere">+ Adempimento <span style="font-size:10px;background:rgba(255,255,255,0.2);border-radius:10px;padding:1px 6px;margin-left:2px">${mancanti.length}</span></button>`;
}

// ─── RENDER PAGE ──────────────────────────────────────────────
function renderScadenzarioPage() {
  const opts = state.clienti
    .map(c => `<option value="${c.id}" ${state.selectedCliente?.id===c.id?"selected":""}>[${c.tipologia_codice}] ${c.nome}</option>`)
    .join("");
  document.getElementById("topbar-actions").innerHTML = `
    <select class="select" id="sel-cliente" style="width:260px" onchange="onClienteChange()">
      <option value="">-- Seleziona Cliente --</option>${opts}
    </select>
    <div class="year-sel">
      <button onclick="changeAnnoScad(-1)">&#9664;</button>
      <span class="year-num">${state.anno}</span>
      <button onclick="changeAnnoScad(1)">&#9654;</button>
    </div>
    <div class="search-wrap" style="width:200px">
      <span class="search-icon">🔍</span>
      <input class="input" id="scad-search" placeholder="Cerca adempimento..." oninput="applyScadSearch()">
    </div>`;
  if (state.selectedCliente) loadScadenzario();
  else document.getElementById("content").innerHTML = `<div class="empty"><div class="empty-icon">📅</div><p>Seleziona un cliente dalla lista in alto</p></div>`;
}

function onClienteChange() {
  const id = parseInt(document.getElementById("sel-cliente").value);
  state.selectedCliente = state.clienti.find(c => c.id === id) || null;
  state.adpInseriti = [];
  if (state.selectedCliente) loadScadenzario();
}

function changeAnnoScad(d) {
  state.anno += d;
  document.querySelectorAll(".year-num").forEach(el => el.textContent = state.anno);
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

// ─── RENDER TABELLA ───────────────────────────────────────────
function renderScadenzarioTabella(data) {
  const c = state.selectedCliente;
  if (!c) return;
  const totale = data.length;
  const comp   = data.filter(r => r.stato === "completato").length;
  const daF    = data.filter(r => r.stato === "da_fare").length;
  const inC    = data.filter(r => r.stato === "in_corso").length;
  const perc   = totale > 0 ? Math.round((comp / totale) * 100) : 0;
  const avatar = (c.nome || "?").charAt(0).toUpperCase();
  const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
  const sottotipoLabel = getLabelSottotipologia(c);

  const categorie = (() => { try { return JSON.parse(c.categorie_attive || "[]"); } catch (e) { return []; } })();
  const catBadges = categorie.map(cat => {
    const found = CATEGORIE.find(x => x.codice === cat);
    return found ? `<span class="cat-mini-badge" style="color:${found.color};border-color:${found.color}22;background:${found.color}11">${found.icona} ${found.codice}</span>` : "";
  }).join("");

  const col2Map = { privato: "Privato", ditta: "Ditta Ind.", socio: "Socio", professionista: "Prof." };
  const col3Map = { ordinario: "Ord.", semplificato: "Sempl.", forfettario: "Forf.", ordinaria: "Ord.", semplificata: "Sempl." };

  const clienteCard = `<div class="cliente-preview-card" style="border-left-color:${tipColor}">
    <div style="display:flex;align-items:flex-start;gap:16px;width:100%">
      <div class="cpc-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}22">${avatar}</div>
      <div style="flex:1;min-width:0">
        <div class="cpc-nome">${escAttr(c.nome)}</div>
        <div class="cpc-sub" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:4px">
          <span class="badge b-${(c.tipologia_codice||"").toLowerCase()}">${c.tipologia_codice||"-"}</span>
          ${sottotipoLabel ? `<span class="badge b-categoria">📋 ${sottotipoLabel}</span>` : ""}
          ${c.col2_value ? `<span class="badge-info">${col2Map[c.col2_value]||c.col2_value}</span>` : ""}
          ${c.col3_value ? `<span class="badge-info">${col3Map[c.col3_value]||c.col3_value}</span>` : ""}
          ${c.periodicita ? `<span class="badge-per">${c.periodicita==="mensile"?"📅 Mensile":"📆 Trimestrale"}</span>` : ""}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px">${catBadges}</div>
        ${c.codice_fiscale||c.partita_iva||c.email ? `<div class="cpc-meta-row" style="margin-top:8px">
          ${c.codice_fiscale ? `<span class="cpc-meta-chip">CF: <strong>${c.codice_fiscale}</strong></span>` : ""}
          ${c.partita_iva    ? `<span class="cpc-meta-chip">P.IVA: <strong>${c.partita_iva}</strong></span>` : ""}
          ${c.email          ? `<span class="cpc-meta-chip">📧 ${c.email}</span>` : ""}
          ${c.telefono       ? `<span class="cpc-meta-chip">📞 ${c.telefono}</span>` : ""}
        </div>` : ""}
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
      <button class="btn btn-sm btn-cyan"   onclick="openCopia()">📋 Copia</button>
      ${renderBtnAddAdp(c.id)}
      <button class="btn btn-print btn-sm" style="margin-left:auto" onclick="window.print()">🖨️ Stampa</button>
    </div>
    ${renderClienteDatiRiferimento(c)}
  </div>`;

  // Raggruppa per categoria → per adempimento
  const grouped = {};
  data.forEach(r => {
    storeRow(r);
    const cat = r.categoria || "ALTRI";
    if (!grouped[cat]) grouped[cat] = {};
    const key = r.id_adempimento;
    if (!grouped[cat][key])
      grouped[cat][key] = { nome: r.adempimento_nome, codice: r.adempimento_codice, categoria: r.categoria, scadenza_tipo: r.scadenza_tipo, rows: [] };
    grouped[cat][key].rows.push(r);
  });

  let content = "";
  Object.entries(grouped).forEach(([catCode, adpMap]) => {
    const catInfo  = CATEGORIE.find(x => x.codice === catCode);
    const catColor = catInfo?.color || "var(--accent)";
    let adpHtml = "";
    Object.values(adpMap).forEach(g => {
      const compG = g.rows.filter(r => r.stato === "completato").length;
      const totG  = g.rows.length;
      const pG    = totG > 0 ? Math.round((compG / totG) * 100) : 0;
      const pgColor = pG === 100 ? "var(--green)" : pG > 50 ? "var(--yellow)" : "var(--red)";
      const periodiHtml = g.rows.map(r => renderPeriodoPill(r)).join("");
      const isMensile   = g.rows.length > 4;
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
        <div class="adp-card-periodi${isMensile ? " periodi-mensili" : ""}">${periodiHtml}</div>
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

  document.getElementById("content").innerHTML = `${clienteCard}<div id="scad-content">${content}</div>`;
}

// ─── AZIONI ───────────────────────────────────────────────────
function generaScadenzario() {
  if (!state.selectedCliente) return;
  socket.emit("genera:scadenzario", { id_cliente: state.selectedCliente.id, anno: state.anno });
}

function openCopia() {
  if (!state.selectedCliente) return;
  document.getElementById("copia-cliente-id").value = state.selectedCliente.id;
  document.getElementById("copia-modalita").value   = "singolo";
  document.getElementById("copia-da").value         = state.anno - 1;
  document.getElementById("copia-a").value          = state.anno;
  document.getElementById("copia-info").innerHTML   = `Copia adempimenti per <strong>${state.selectedCliente.nome}</strong>`;
  openModal("modal-copia");
}

function openCopiaTutti() {
  document.getElementById("copia-cliente-id").value = "";
  document.getElementById("copia-modalita").value   = "tutti";
  document.getElementById("copia-da").value         = state.anno - 1;
  document.getElementById("copia-a").value          = state.anno;
  document.getElementById("copia-info").innerHTML   = `Copia adempimenti per <strong>tutti i clienti</strong>`;
  openModal("modal-copia");
}

function eseguiCopia() {
  const modalita = document.getElementById("copia-modalita").value;
  const da = parseInt(document.getElementById("copia-da").value);
  const a  = parseInt(document.getElementById("copia-a").value);
  if (modalita === "singolo") {
    const id = parseInt(document.getElementById("copia-cliente-id").value);
    socket.emit("copia:scadenzario", { id_cliente: id, anno_da: da, anno_a: a });
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

// ─── ADD ADEMPIMENTO ──────────────────────────────────────────
function openAddAdp(id_cliente) {
  document.getElementById("add-adp-cliente-id").value = id_cliente;
  document.getElementById("add-adp-anno").value       = state.anno;
  const c = state.selectedCliente;
  if (c) document.getElementById("add-adp-cliente-info").innerHTML = renderClienteInfoBox(c);
  refreshAddAdpSelect();
  openModal("modal-add-adp");
}

function refreshAddAdpSelect() {
  const mancanti = getAdempimentiMancanti();
  const sel = document.getElementById("add-adp-select");
  sel.innerHTML = mancanti
    .map(a => `<option value="${a.id}" data-scadenza="${a.scadenza_tipo}">${a.codice} — ${a.nome}</option>`)
    .join("");
  updatePeriodoOptions();
}

function updatePeriodoOptions() {
  const sel    = document.getElementById("add-adp-select");
  const perSel = document.getElementById("add-adp-periodo");
  if (!sel || !perSel) return;
  const opt  = sel.options[sel.selectedIndex];
  if (!opt) { perSel.innerHTML = ""; return; }
  const tipo = opt.dataset.scadenza;
  let opts = "";
  if (tipo === "mensile")
    opts = MESI.map((m, i) => `<option value="mese:${i + 1}">${m}</option>`).join("");
  else if (tipo === "trimestrale")
    opts = [1,2,3,4].map(t => `<option value="trim:${t}">${t}° Trimestre</option>`).join("");
  else if (tipo === "semestrale")
    opts = `<option value="sem:1">1° Semestre</option><option value="sem:2">2° Semestre</option>`;
  else
    opts = `<option value="annuale">Annuale</option>`;
  perSel.innerHTML = opts;
}

function eseguiAddAdp() {
  const id_cliente     = parseInt(document.getElementById("add-adp-cliente-id").value);
  const id_adempimento = parseInt(document.getElementById("add-adp-select").value);
  const anno           = parseInt(document.getElementById("add-adp-anno").value);
  const periodo        = document.getElementById("add-adp-periodo").value;
  const data = { id_cliente, id_adempimento, anno };
  if (periodo.startsWith("mese:"))  data.mese      = parseInt(periodo.split(":")[1]);
  else if (periodo.startsWith("trim:")) data.trimestre = parseInt(periodo.split(":")[1]);
  else if (periodo.startsWith("sem:"))  data.semestre  = parseInt(periodo.split(":")[1]);
  socket.emit("add:adempimento_cliente", data);
}