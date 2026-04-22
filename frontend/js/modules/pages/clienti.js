// ═══════════════════════════════════════════════════════════════
// CLIENTI.JS — Gestione clienti: lista, CRUD, modal, filtri
// ═══════════════════════════════════════════════════════════════

// ─── FILTRI ───────────────────────────────────────────────────
const applyClientiFiltriDB = debounce(() => {
  const search = document.getElementById("global-search-clienti")?.value || "";
  const tipologia = document.getElementById("filter-tipo")?.value || "";
  const col2 = document.getElementById("filter-col2")?.value || "";
  const col3 = document.getElementById("filter-col3")?.value || "";
  const periodicita = document.getElementById("filter-periodicita")?.value || "";
  socket.emit("get:clienti", { search, tipologia, col2, col3, periodicita });
}, 300);

function applyClientiFiltri() { applyClientiFiltriDB(); }

function resetClientiFiltri() {
  ["global-search-clienti", "filter-tipo", "filter-col2", "filter-col3", "filter-periodicita"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  socket.emit("get:clienti", {});
}

// ─── RENDER LISTA ─────────────────────────────────────────────
function renderClientiPage() { renderClientiTabella(state.clienti); }

function renderClientiTabella(clienti) {
  const col2Map = { privato: "Privato", ditta: "Ditta Ind.", socio: "Socio", professionista: "Prof." };
  const col3Map = { ordinario: "Ord.", semplificato: "Sempl.", forfettario: "Forf.", ordinaria: "Ord.", semplificata: "Sempl." };
  const periodicitaMap = { mensile: "Mensile", trimestrale: "Trimestrale", annuale: "Annuale" };

  const curTipo = document.getElementById("filter-tipo")?.value || "";
  const curCol2 = document.getElementById("filter-col2")?.value || "";
  const curCol3 = document.getElementById("filter-col3")?.value || "";
  const curPeriodicita = document.getElementById("filter-periodicita")?.value || "";

  // ⭐ HEADER FILTRI
  const filterBar = `
    <div class="filtri-avanzati no-print" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:var(--surface2);border-radius:var(--r-sm);">
      <span style="font-size:11px;color:var(--text3);font-weight:700;">🔍 Filtri:</span>
      <select id="filter-tipo" class="select" style="width:160px" onchange="applyClientiFiltri()" title="Filtra per tipologia cliente">
        <option value="" ${!curTipo ? "selected" : ""}>📋 Tutti i tipi</option>
        <option value="PF" ${curTipo === "PF" ? "selected" : ""}>👤 PF – Persona Fisica</option>
        <option value="SP" ${curTipo === "SP" ? "selected" : ""}>🤝 SP – Soc. Persone</option>
        <option value="SC" ${curTipo === "SC" ? "selected" : ""}>🏢 SC – Soc. Capitali</option>
        <option value="ASS" ${curTipo === "ASS" ? "selected" : ""}>🏛️ ASS – Associazione</option>
      </select>
      <select id="filter-col2" class="select" style="width:190px" onchange="applyClientiFiltri()" title="Filtra per sottocategoria">
        <option value="" ${!curCol2 ? "selected" : ""}>📋 Tutte le sottocategorie</option>
        <option value="privato" ${curCol2 === "privato" ? "selected" : ""}>👤 Privato</option>
        <option value="ditta" ${curCol2 === "ditta" ? "selected" : ""}>🏢 Ditta Individuale</option>
        <option value="socio" ${curCol2 === "socio" ? "selected" : ""}>🤝 Socio</option>
        <option value="professionista" ${curCol2 === "professionista" ? "selected" : ""}>⚕️ Professionista</option>
      </select>
      <select id="filter-col3" class="select" style="width:180px" onchange="applyClientiFiltri()" title="Filtra per regime fiscale">
        <option value="" ${!curCol3 ? "selected" : ""}>📋 Tutti i regimi</option>
        <option value="ordinario" ${curCol3 === "ordinario" ? "selected" : ""}>📊 Ordinario</option>
        <option value="semplificato" ${curCol3 === "semplificato" ? "selected" : ""}>📄 Semplificato</option>
        <option value="forfettario" ${curCol3 === "forfettario" ? "selected" : ""}>💰 Forfettario</option>
        <option value="ordinaria" ${curCol3 === "ordinaria" ? "selected" : ""}>📊 Ordinaria</option>
        <option value="semplificata" ${curCol3 === "semplificata" ? "selected" : ""}>📄 Semplificata</option>
      </select>
      <select id="filter-periodicita" class="select" style="width:170px" onchange="applyClientiFiltri()" title="Filtra per periodicità contabile">
        <option value="" ${!curPeriodicita ? "selected" : ""}>📋 Tutte le periodicità</option>
        <option value="mensile" ${curPeriodicita === "mensile" ? "selected" : ""}>📅 Mensile</option>
        <option value="trimestrale" ${curPeriodicita === "trimestrale" ? "selected" : ""}>📆 Trimestrale</option>
        <option value="annuale" ${curPeriodicita === "annuale" ? "selected" : ""}>📅 Annuale</option>
      </select>
      <button class="btn btn-sm btn-primary" onclick="resetClientiFiltri()" style="margin-left:auto" title="Azzera tutti i filtri">⟳ Tutti</button>
    </div>
  `;

  // ⭐ TABELLA CLIENTI (una riga per cliente, chiara)
  let tableRows = "";
  if (clienti.length === 0) {
    tableRows = `<tr><td colspan="4"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato</p></div></td></tr>`;
  } else {
    tableRows = clienti.map(c => {
      const tipColor = getTipologiaColor(c.tipologia_codice);
      const avatar = getAvatar(c.nome);
      const sottotipoLabel = getLabelSottotipologia(c);

      // Badge tipologia
      const tipBadge = `<span class="badge b-${(c.tipologia_codice || "").toLowerCase()}" style="background:${tipColor}22;color:${tipColor};border-color:${tipColor}44" title="${TIPOLOGIE_INFO[c.tipologia_codice]?.desc || ""}">${c.tipologia_codice || "-"}</span>`;

      // Badge colonne
      let colBadges = "";
      if (c.col2_value) colBadges += `<span class="badge-info" title="Sottocategoria">📁 ${col2Map[c.col2_value] || c.col2_value}</span>`;
      if (c.col3_value) colBadges += `<span class="badge-info" title="Regime">⚙️ ${col3Map[c.col3_value] || c.col3_value}</span>`;
      if (c.periodicita) colBadges += `<span class="badge-per" title="Periodicità">📅 ${periodicitaMap[c.periodicita] || c.periodicita}</span>`;

      // Sottotipologia completa (se presente)
      const subHtml = sottotipoLabel ? `<div style="font-size:10px;color:var(--text3);margin-top:4px;font-family:var(--mono)">🏷️ ${sottotipoLabel}</div>` : "";

      return `<tr class="clickable" onclick="showClienteDettaglio(${c.id})" style="cursor:pointer">
        <td style="padding:12px 16px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="cliente-avatar-sm" style="background:${tipColor}22;border-color:${tipColor};color:${tipColor};width:36px;height:36px;display:flex;align-items:center;justify-content:center;border-radius:10px;font-weight:800">${avatar}</div>
            <div>
              <div style="font-weight:700;font-size:15px">${escAttr(c.nome)}</div>
              <div style="font-size:11px;color:var(--text3);font-family:var(--mono);margin-top:2px">${c.codice_fiscale || c.partita_iva || "—"}</div>
            </div>
          </div>
        </td>
        <td style="padding:12px 16px">
          <div style="display:flex;flex-wrap:wrap;gap:5px;align-items:center">${tipBadge} ${colBadges}</div>
          ${subHtml}
        </td>
        <td style="padding:12px 16px;color:var(--text2);font-size:13px">${c.email || "—"}</td>
        <td class="no-print" style="padding:12px 16px;white-space:nowrap">
          <div style="display:flex;gap:6px" onclick="event.stopPropagation()">
            <button class="btn btn-xs btn-secondary" onclick="editCliente(${c.id})" title="Modifica">✏️</button>
            <button class="btn btn-xs btn-success" onclick="goScadenzario(${c.id})" title="Scadenzario">📅</button>
            <button class="btn btn-xs btn-danger" onclick="deleteCliente(${c.id})" title="Elimina">🗑️</button>
          </div>
        </td>
      </tr>`;
    }).join("");
  }

  const html = `
    ${filterBar}
    <div class="table-wrap">
      <div class="table-header no-print">
        <h3>Clienti <span style="font-size:13px;color:var(--text3);margin-left:8px">(${clienti.length})</span></h3>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--surface2);border-bottom:1px solid var(--border)">
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text2)">Cliente</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text2)">Classificazione</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text2)">Email</th>
            <th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text2)" class="no-print">Azioni</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("content").innerHTML = html;
}

// ─── DETTAGLIO CLIENTE ────────────────────────────────────────
function showClienteDettaglio(id) {
  const c = state.clienti.find(x => x.id === id);
  if (!c) return;
  state._currentClienteDettaglio = c;
  const tipColor = getTipologiaColor(c.tipologia_codice);
  const sottotipoLabel = getLabelSottotipologia(c);
  const avatar = getAvatar(c.nome);

  const col2LMap = { privato: "Privato", ditta: "Ditta Individuale", socio: "Socio", professionista: "Professionista" };
  const col3LMap = { ordinario: "Ordinario", semplificato: "Semplificato", forfettario: "Forfettario", ordinaria: "Ordinaria", semplificata: "Semplificata" };
  const periodicitaMap = { mensile: "📅 Mensile", trimestrale: "📆 Trimestrale", annuale: "📅 Annuale" };

  const classificazioneHtml = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:20px">
      <div style="background:var(--surface2);border-radius:var(--r-sm);padding:14px;border-left:3px solid ${tipColor}">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">Tipologia</div>
        <div style="font-size:16px;font-weight:700;margin-top:4px">${c.tipologia_codice || "-"} — ${c.tipologia_nome || ""}</div>
      </div>
      ${c.col2_value ? `
      <div style="background:var(--surface2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #fb923c">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">Sottocategoria</div>
        <div style="font-size:16px;font-weight:700;margin-top:4px">${col2LMap[c.col2_value] || c.col2_value}</div>
      </div>` : ""}
      ${c.col3_value ? `
      <div style="background:var(--surface2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #5b8df6">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">Regime</div>
        <div style="font-size:16px;font-weight:700;margin-top:4px">${col3LMap[c.col3_value] || c.col3_value}</div>
      </div>` : ""}
      ${c.periodicita ? `
      <div style="background:var(--surface2);border-radius:var(--r-sm);padding:14px;border-left:3px solid #22d3ee">
        <div style="font-size:11px;color:var(--text3);text-transform:uppercase;letter-spacing:0.06em">Periodicità</div>
        <div style="font-size:16px;font-weight:700;margin-top:4px">${periodicitaMap[c.periodicita] || c.periodicita}</div>
      </div>` : ""}
    </div>
    ${sottotipoLabel ? `<div style="background:var(--green-d);border:1px solid var(--green);border-radius:20px;padding:8px 16px;display:inline-block;margin-bottom:16px"><span style="font-weight:700">🏷️ Sottotipologia completa:</span> ${sottotipoLabel}</div>` : ""}`;

  document.getElementById("modal-cliente-det-title").textContent = c.nome;
  document.getElementById("cliente-dettaglio-content").innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;padding:16px;background:var(--surface2);border-radius:var(--r-sm);margin-bottom:20px;border-left:4px solid ${tipColor}">
      <div class="det-avatar" style="width:48px;height:48px;background:${tipColor}22;border:2px solid ${tipColor};color:${tipColor};display:flex;align-items:center;justify-content:center;border-radius:12px;font-size:18px;font-weight:800">${avatar}</div>
      <div>
        <div style="font-size:20px;font-weight:800">${escAttr(c.nome)}</div>
        <div style="font-size:13px;color:var(--text2);margin-top:4px">${getClassificazioneCompleta(c)}</div>
      </div>
    </div>
    <div style="margin-bottom:12px;font-size:12px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:0.06em">📊 Classificazione dettagliata</div>
    ${classificazioneHtml}
    ${renderClienteDatiRiferimento(c)}`;

  const actions = document.getElementById("modal-cliente-det-actions");
  if (actions) {
    actions.innerHTML = `
      <button class="btn btn-danger btn-sm" onclick="deleteClienteFromDettaglio()" title="Elimina il cliente">🗑️ Elimina</button>
      <div style="flex:1"></div>
      <button class="btn btn-secondary" onclick="closeModal('modal-cliente-dettaglio')">Chiudi</button>
      <button class="btn btn-secondary" onclick="editClienteFromDettaglio()" title="Modifica">✏️ Modifica</button>
      <button class="btn btn-primary" onclick="goToClienteScadenzario()">📅 Vai a Scadenzario</button>`;
  }
  openModal("modal-cliente-dettaglio");
}

function editClienteFromDettaglio() {
  const c = state._currentClienteDettaglio;
  if (!c) return;
  closeModal("modal-cliente-dettaglio");
  editCliente(c.id);
}

function deleteClienteFromDettaglio() {
  const c = state._currentClienteDettaglio;
  if (!c) return;
  closeModal("modal-cliente-dettaglio");
  deleteCliente(c.id);
}

function goToClienteScadenzario() {
  if (state._currentClienteDettaglio) {
    closeModal("modal-cliente-dettaglio");
    goScadenzario(state._currentClienteDettaglio.id);
  }
}

// ─── MODAL 4 COLONNE ──────────────────────────────────────────
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
    col2Sel.innerHTML = `<option value="">-- Seleziona --</option>` +
      col2Opts.map(o => `<option value="${o.value}" ${col2Current === o.value ? "selected" : ""}>${o.label}</option>`).join("");
    if (!col2Current) col2Sel.value = "";
    _aggiornaCol3(tipCodice, col2Sel.value);
  }
  aggiornaRiepilogoClassificazione();
}

function _aggiornaCol3(tipCodice, col2Val) {
  const col3Opts = getCol3Options(tipCodice, col2Val);
  const col3Wrap = document.getElementById("wrap-col3");
  const col3Sel = document.getElementById("c-col3");
  if (!col3Opts) { _nascondiCol3(); return; }
  col3Wrap.style.display = "";
  const col3Current = col3Sel.value;
  col3Sel.innerHTML = `<option value="">-- Seleziona --</option>` +
    col3Opts.map(o => `<option value="${o.value}" ${col3Current === o.value ? "selected" : ""}>${o.label}</option>`).join("");
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
      badge.style.cssText = "font-size:12px;color:var(--yellow);background:var(--yellow)18;border:1px solid var(--yellow)33;border-radius:var(--r-sm);padding:7px 12px;margin-top:8px;grid-column:1/-1";
      badge.innerHTML = `<span style="font-size:14px">📅</span> Regime <strong>Forfettario</strong> — periodicità impostata automaticamente su <strong>Annuale</strong>`;
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
  const w = document.getElementById("wrap-col3"), s = document.getElementById("c-col3");
  if (w) w.style.display = "none";
  if (s) s.value = "";
  _nascondiCol4();
  aggiornaRiepilogoClassificazione();
}

function _nascondiCol4() {
  const w = document.getElementById("wrap-col4"), s = document.getElementById("c-col4");
  if (w) w.style.display = "none";
  if (s) s.value = "";
  aggiornaRiepilogoClassificazione();
}

function _getTipologiaCodice() {
  const sel = document.getElementById("c-tipologia");
  if (!sel || !sel.value) return "";
  const tip = state.tipologie.find(t => String(t.id) === String(sel.value));
  return tip ? tip.codice : "";
}

function _calcolaSottotipologiaId() {
  const tipCodice = _getTipologiaCodice();
  const col2 = document.getElementById("c-col2")?.value || "";
  const col3 = document.getElementById("c-col3")?.value || "";
  const stCode = getSottotipoCode(tipCodice, col2, col3);
  if (!stCode) return null;
  for (const t of state.tipologie) {
    const sub = (t.sottotipologie || []).find(s => s.codice === stCode);
    if (sub) return sub.id;
  }
  return null;
}

function aggiornaRiepilogoClassificazione() {
  const box = document.getElementById("cliente-riepilogo-box");
  const content = document.getElementById("riepilogo-classificazione");
  if (!box || !content) return;
  const tipCodice = _getTipologiaCodice();
  const tip = state.tipologie.find(t => t.codice === tipCodice);
  const col2 = document.getElementById("c-col2")?.value || "";
  const col3 = document.getElementById("c-col3")?.value || "";
  const col4 = document.getElementById("c-col4")?.value || "";
  const col4Effective = REGIMI_ANNUALI.includes(col3) ? "annuale" : col4;

  let chips = [];
  if (tip) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Tipologia:</span><span class="chip-value">${tip.codice} — ${tip.nome}</span></div>`);
  if (col2) {
    const opt = COL2_OPTIONS[tipCodice]?.find(o => o.value === col2);
    if (opt) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Sottocategoria:</span><span class="chip-value">${opt.label}</span></div>`);
  }
  if (col3) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Regime:</span><span class="chip-value">${col3}</span></div>`);
  if (col4Effective) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Periodicità:</span><span class="chip-value">${col4Effective === "mensile" ? "📅 Mensile" : col4Effective === "annuale" ? "📅 Annuale" : "📆 Trimestrale"}</span></div>`);
  if (chips.length > 0) { content.innerHTML = chips.join(""); box.style.display = ""; }
  else box.style.display = "none";
}

function populateTipologiaSelect(selectedId) {
  const sel = document.getElementById("c-tipologia");
  if (!sel) return;
  sel.innerHTML = state.tipologie.map(t =>
    `<option value="${t.id}" ${String(t.id) === String(selectedId) ? "selected" : ""}>${t.codice} — ${t.nome}</option>`
  ).join("");
}

function onTipologiaChange() {
  const col2Sel = document.getElementById("c-col2"); if (col2Sel) col2Sel.value = "";
  const col3Sel = document.getElementById("c-col3"); if (col3Sel) col3Sel.value = "";
  _nascondiCol4();
  const badge = document.getElementById("col4-forfettario-badge");
  if (badge) badge.style.display = "none";
  aggiornaColonneCliente();
}

function onCol2Change() {
  const col3Sel = document.getElementById("c-col3"); if (col3Sel) col3Sel.value = "";
  _nascondiCol4();
  const badge = document.getElementById("col4-forfettario-badge");
  if (badge) badge.style.display = "none";
  aggiornaColonneCliente();
}

function onCol3Change() {
  const tipCodice = _getTipologiaCodice();
  const col2Val = document.getElementById("c-col2")?.value || "";
  const col3Val = document.getElementById("c-col3")?.value || "";
  _aggiornaCol3(tipCodice, col2Val);
  _aggiornCol4BasedOnCol3(tipCodice, col3Val);
  aggiornaRiepilogoClassificazione();
}

// ─── OPEN/EDIT/SAVE/DELETE ────────────────────────────────────
function openNuovoCliente() {
  document.getElementById("modal-cliente-title").textContent = "Nuovo Cliente";
  document.getElementById("cliente-id").value = "";
  ["c-nome", "c-cf", "c-piva", "c-email", "c-tel", "c-indirizzo", "c-note", "c-pec", "c-sdi", "c-citta", "c-cap", "c-prov", "c-referente", "c-iban"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  if (document.getElementById("c-col2")) document.getElementById("c-col2").value = "";
  if (document.getElementById("c-col3")) document.getElementById("c-col3").value = "";
  if (document.getElementById("c-col4")) document.getElementById("c-col4").value = "";
  const badge = document.getElementById("col4-forfettario-badge");
  if (badge) badge.style.display = "none";
  populateTipologiaSelect(state.tipologie[0]?.id);
  aggiornaColonneCliente();
  openModal("modal-cliente");
}

function editCliente(id) {
  socket.once("res:cliente", ({ success, data }) => {
    if (!success || !data) return;
    document.getElementById("modal-cliente-title").textContent = "Modifica Cliente";
    document.getElementById("cliente-id").value = data.id;
    const fields = {
      "c-nome": data.nome, "c-cf": data.codice_fiscale, "c-piva": data.partita_iva,
      "c-email": data.email, "c-tel": data.telefono, "c-indirizzo": data.indirizzo,
      "c-note": data.note, "c-pec": data.pec, "c-sdi": data.sdi, "c-citta": data.citta,
      "c-cap": data.cap, "c-prov": data.provincia, "c-referente": data.referente, "c-iban": data.iban,
    };
    Object.entries(fields).forEach(([elId, val]) => { const el = document.getElementById(elId); if (el) el.value = val || ""; });
    populateTipologiaSelect(data.id_tipologia);
    const col2Val = data.col2_value || "", col3Val = data.col3_value || "", col4Val = data.periodicita || "";
    const badge = document.getElementById("col4-forfettario-badge");
    if (badge) badge.style.display = "none";
    setTimeout(() => {
      if (document.getElementById("c-col2")) document.getElementById("c-col2").value = col2Val;
      if (document.getElementById("c-col3")) document.getElementById("c-col3").value = col3Val;
      aggiornaColonneCliente();
      setTimeout(() => {
        const tipCodice = _getTipologiaCodice();
        if (REGIMI_ANNUALI.includes(col3Val)) {
          _aggiornCol4BasedOnCol3(tipCodice, col3Val);
        } else {
          if (document.getElementById("c-col4")) document.getElementById("c-col4").value = col4Val;
        }
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
  if (!validaClassificazioneCliente()) return;

  const col2Val = document.getElementById("c-col2")?.value || "";
  const col3Val = document.getElementById("c-col3")?.value || "";
  const col4Val = REGIMI_ANNUALI.includes(col3Val) ? "annuale" : (document.getElementById("c-col4")?.value || "");

  const data = {
    nome,
    id_tipologia: parseInt(document.getElementById("c-tipologia").value),
    id_sottotipologia: _calcolaSottotipologiaId() || null,
    col2_value: col2Val || null,
    col3_value: col3Val || null,
    periodicita: col4Val || null,
    codice_fiscale: document.getElementById("c-cf")?.value.trim().toUpperCase() || null,
    partita_iva: document.getElementById("c-piva")?.value.trim() || null,
    email: document.getElementById("c-email")?.value.trim() || null,
    telefono: document.getElementById("c-tel")?.value.trim() || null,
    indirizzo: document.getElementById("c-indirizzo")?.value.trim() || null,
    citta: document.getElementById("c-citta")?.value.trim() || null,
    cap: document.getElementById("c-cap")?.value.trim() || null,
    provincia: document.getElementById("c-prov")?.value.trim().toUpperCase() || null,
    pec: document.getElementById("c-pec")?.value.trim() || null,
    sdi: document.getElementById("c-sdi")?.value.trim().toUpperCase() || null,
    iban: document.getElementById("c-iban")?.value.trim().toUpperCase() || null,
    referente: document.getElementById("c-referente")?.value.trim() || null,
    note: document.getElementById("c-note")?.value.trim() || null,
  };

  if (id) { data.id = parseInt(id); socket.emit("update:cliente", data); }
  else socket.emit("create:cliente", data);
}

function deleteCliente(id) {
  if (confirm("Eliminare questo cliente? L'operazione è irreversibile."))
    socket.emit("delete:cliente", { id });
}

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

// ─── VALIDAZIONE ──────────────────────────────────────────────
function validaClassificazioneCliente() {
  const tipologia = document.getElementById("c-tipologia").value;
  if (!tipologia) { showNotif("La Tipologia è obbligatoria", "error"); document.getElementById("c-tipologia").focus(); return false; }
  const col2Wrap = document.getElementById("wrap-col2");
  const col3Wrap = document.getElementById("wrap-col3");
  const col4Wrap = document.getElementById("wrap-col4");
  if (col2Wrap && col2Wrap.style.display !== "none") {
    if (!document.getElementById("c-col2").value) { showNotif("La Sottocategoria è obbligatoria per questa tipologia", "error"); document.getElementById("c-col2").focus(); return false; }
  }
  if (col3Wrap && col3Wrap.style.display !== "none") {
    if (!document.getElementById("c-col3").value) { showNotif("Il Regime è obbligatorio per questa configurazione", "error"); document.getElementById("c-col3").focus(); return false; }
  }
  const col3Val = document.getElementById("c-col3")?.value || "";
  if (!REGIMI_ANNUALI.includes(col3Val) && col4Wrap && col4Wrap.style.display !== "none") {
    if (!document.getElementById("c-col4").value) { showNotif("La Periodicità è obbligatoria", "error"); document.getElementById("c-col4").focus(); return false; }
  }
  return true;
}