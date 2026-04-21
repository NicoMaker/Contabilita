// ═══════════════════════════════════════════════════════════════
// CLIENTI.JS — Gestione clienti: lista, CRUD, modal, filtri
// ═══════════════════════════════════════════════════════════════

// ─── FILTRI ───────────────────────────────────────────────────
const applyClientiFiltriDB = debounce(() => {
  const search      = document.getElementById("global-search-clienti")?.value || "";
  const tipologia   = document.getElementById("filter-tipo")?.value || "";
  const col2        = document.getElementById("filter-col2")?.value || "";
  const col3        = document.getElementById("filter-col3")?.value || "";
  const periodicita = document.getElementById("filter-periodicita")?.value || "";
  socket.emit("get:clienti", { search, tipologia, col2, col3, periodicita });
}, 300);

function applyClientiFiltri() { applyClientiFiltriDB(); }

function resetClientiFiltri() {
  ["global-search-clienti","filter-tipo","filter-col2","filter-col3","filter-periodicita"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
  socket.emit("get:clienti", {});
}

// ─── RENDER LISTA ─────────────────────────────────────────────
function renderClientiPage() { renderClientiTabella(state.clienti); }

function renderClientiTabella(clienti) {
  const col2Map = { privato: "Privato", ditta: "Ditta Ind.", socio: "Socio", professionista: "Prof." };
  const col3Map = { ordinario: "Ord.", semplificato: "Sempl.", forfettario: "Forf.", ordinaria: "Ord.", semplificata: "Sempl." };

  // Legge i valori correnti dei filtri per ripristinarli dopo il render
  const curTipo        = document.getElementById("filter-tipo")?.value || "";
  const curCol2        = document.getElementById("filter-col2")?.value || "";
  const curCol3        = document.getElementById("filter-col3")?.value || "";
  const curPeriodicita = document.getElementById("filter-periodicita")?.value || "";

  const tbody = clienti.length
    ? clienti.map(c => {
        const tipColor = getTipologiaColor(c.tipologia_codice);
        const sottotipoLabel = getLabelSottotipologia(c);
        const avatar = getAvatar(c.nome);

        let infoBadges = `<span class="badge b-${(c.tipologia_codice || "").toLowerCase()}" title="${TIPOLOGIE_INFO[c.tipologia_codice]?.desc || c.tipologia_codice}">${c.tipologia_codice || "-"}</span>`;
        if (c.col2_value) infoBadges += ` <span class="badge-info" title="Sottocategoria: ${col2Map[c.col2_value] || c.col2_value}">${col2Map[c.col2_value] || c.col2_value}</span>`;
        if (c.col3_value) infoBadges += ` <span class="badge-info" title="Regime: ${col3Map[c.col3_value] || c.col3_value}">${col3Map[c.col3_value] || c.col3_value}</span>`;
        if (c.periodicita) infoBadges += ` <span class="badge-per" title="Periodicità: ${c.periodicita === 'mensile' ? 'Mensile' : 'Trimestrale'}">${c.periodicita === "mensile" ? "📅" : "📆"} ${c.periodicita === "mensile" ? "Mens." : "Trim."}</span>`;

        const categorie = (() => { try { return JSON.parse(c.categorie_attive || "[]"); } catch (e) { return []; } })();
        const catBadges = renderCatIconsWithTooltip(categorie);

        return `<tr class="clickable" onclick="showClienteDettaglio(${c.id})" title="Clicca per vedere il dettaglio di ${escAttr(c.nome)}">
          <td>
            <div style="display:flex;align-items:center;gap:10px">
              <div class="cliente-avatar-sm" style="background:${tipColor}22;border-color:${tipColor};color:${tipColor}" title="${escAttr(c.nome)}">${avatar}</div>
              <div>
                <div style="font-weight:700;font-size:13px">${escAttr(c.nome)}</div>
                <div style="font-size:10px;color:var(--text3);margin-top:2px;font-family:var(--mono)">${c.codice_fiscale || c.partita_iva || ""}</div>
              </div>
            </div>
          </td>
          <td><div style="display:flex;flex-wrap:wrap;gap:4px;align-items:center">${infoBadges}</div>${sottotipoLabel ? `<div style="font-size:10px;color:var(--text3);margin-top:3px">${sottotipoLabel}</div>` : ""}</td>
          <td class="td-dim" style="font-size:12px">${c.email || "-"}</td>
          <td><div style="display:flex;flex-wrap:wrap;gap:3px">${catBadges}</div></td>
          <td class="col-actions no-print"><div style="display:flex;gap:5px" onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="editCliente(${c.id})" title="Modifica i dati del cliente">✏️</button>
            <button class="btn btn-sm btn-success"   onclick="goScadenzario(${c.id})" title="Vai allo scadenzario del cliente">📅</button>
            <button class="btn btn-sm btn-danger"    onclick="deleteCliente(${c.id})" title="Elimina il cliente (operazione irreversibile)">🗑️</button>
          </div></td>
        </tr>`;
      }).join("")
    : `<tr><td colspan="5"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato</p></div></td></tr>`;

  document.getElementById("content").innerHTML = `
    <div class="filtri-avanzati no-print" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center;padding:12px 16px;background:var(--surface2);border-radius:var(--r-sm);">
      <span style="font-size:11px;color:var(--text3);font-weight:700;">🔍 Filtri:</span>
      <select id="filter-tipo" class="select" style="width:160px" onchange="applyClientiFiltri()" title="Filtra per tipologia cliente">
        <option value="" ${!curTipo ? "selected" : ""}>📋 Tutti i tipi</option>
        <option value="PF"  ${curTipo === "PF"  ? "selected" : ""}>👤 PF – Persona Fisica</option>
        <option value="SP"  ${curTipo === "SP"  ? "selected" : ""}>🤝 SP – Soc. Persone</option>
        <option value="SC"  ${curTipo === "SC"  ? "selected" : ""}>🏢 SC – Soc. Capitali</option>
        <option value="ASS" ${curTipo === "ASS" ? "selected" : ""}>🏛️ ASS – Associazione</option>
      </select>
      <select id="filter-col2" class="select" style="width:190px" onchange="applyClientiFiltri()" title="Filtra per sottocategoria">
        <option value="" ${!curCol2 ? "selected" : ""}>📋 Tutte le sottocategorie</option>
        <option value="privato"        ${curCol2 === "privato"        ? "selected" : ""}>👤 Privato</option>
        <option value="ditta"          ${curCol2 === "ditta"          ? "selected" : ""}>🏢 Ditta Individuale</option>
        <option value="socio"          ${curCol2 === "socio"          ? "selected" : ""}>🤝 Socio</option>
        <option value="professionista" ${curCol2 === "professionista" ? "selected" : ""}>⚕️ Professionista</option>
      </select>
      <select id="filter-col3" class="select" style="width:180px" onchange="applyClientiFiltri()" title="Filtra per regime fiscale">
        <option value="" ${!curCol3 ? "selected" : ""}>📋 Tutti i regimi</option>
        <option value="ordinario"    ${curCol3 === "ordinario"    ? "selected" : ""}>📊 Ordinario</option>
        <option value="semplificato" ${curCol3 === "semplificato" ? "selected" : ""}>📄 Semplificato</option>
        <option value="forfettario"  ${curCol3 === "forfettario"  ? "selected" : ""}>💰 Forfettario</option>
        <option value="ordinaria"    ${curCol3 === "ordinaria"    ? "selected" : ""}>📊 Ordinaria</option>
        <option value="semplificata" ${curCol3 === "semplificata" ? "selected" : ""}>📄 Semplificata</option>
      </select>
      <select id="filter-periodicita" class="select" style="width:170px" onchange="applyClientiFiltri()" title="Filtra per periodicità contabile">
        <option value="" ${!curPeriodicita ? "selected" : ""}>📋 Tutte le periodicità</option>
        <option value="mensile"     ${curPeriodicita === "mensile"     ? "selected" : ""}>📅 Mensile</option>
        <option value="trimestrale" ${curPeriodicita === "trimestrale" ? "selected" : ""}>📆 Trimestrale</option>
      </select>
      <button class="btn btn-sm btn-primary" onclick="resetClientiFiltri()" style="margin-left:auto" title="Azzera tutti i filtri e mostra tutti i clienti">⟳ Tutti</button>
    </div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Clienti (${clienti.length})</h3></div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Classificazione</th>
            <th>Email</th>
            <th title="Categorie adempimenti attive per questo cliente — passa il mouse sulle icone per i dettagli">Categorie</th>
            <th class="no-print">Azioni</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

// ─── DETTAGLIO CLIENTE ────────────────────────────────────────
function showClienteDettaglio(id) {
  const c = state.clienti.find(x => x.id === id);
  if (!c) return;
  state._currentClienteDettaglio = c;
  const tipColor = getTipologiaColor(c.tipologia_codice);
  const sottotipoLabel = getLabelSottotipologia(c);
  const avatar = getAvatar(c.nome);

  const categorie = (() => { try { return JSON.parse(c.categorie_attive || "[]"); } catch (e) { return []; } })();
  const catHtml = categorie.map(cat => {
    const found = CATEGORIE.find(x => x.codice === cat);
    return found ? `<span class="cat-det-badge" style="color:${found.color};border-color:${found.color}33;background:${found.color}11" title="${found.nome}: ${getCatDescription(found.codice)}">${found.icona} ${found.codice}</span>` : "";
  }).join("");

  const col2LMap = { privato: "Privato", ditta: "Ditta Individuale", socio: "Socio", professionista: "Professionista" };
  const col3LMap = { ordinario: "Ordinario", semplificato: "Semplificato", forfettario: "Forfettario", ordinaria: "Ordinaria", semplificata: "Semplificata" };

  const classificazioneHtml = `
    <div class="det-class-grid">
      <div class="det-class-item" title="Tipologia principale del cliente"><div class="det-class-num">1</div><div><div class="det-class-label">Tipologia</div><div class="det-class-val"><span class="badge b-${(c.tipologia_codice||"").toLowerCase()}">${c.tipologia_codice||"-"}</span> ${c.tipologia_nome||""}</div></div></div>
      ${c.col2_value ? `<div class="det-class-item" title="Sottocategoria del cliente"><div class="det-class-num">2</div><div><div class="det-class-label">Sottocategoria</div><div class="det-class-val">${col2LMap[c.col2_value]||c.col2_value}</div></div></div>` : ""}
      ${c.col3_value ? `<div class="det-class-item" title="Regime fiscale applicato"><div class="det-class-num">3</div><div><div class="det-class-label">Regime</div><div class="det-class-val">${col3LMap[c.col3_value]||c.col3_value}</div></div></div>` : ""}
      ${c.periodicita ? `<div class="det-class-item" title="Frequenza di registrazione contabile"><div class="det-class-num">4</div><div><div class="det-class-label">Periodicità</div><div class="det-class-val">${c.periodicita==="mensile"?"📅 Mensile":"📆 Trimestrale"}</div></div></div>` : ""}
    </div>
    ${sottotipoLabel ? `<div class="sottotipo-badge-full">🏷️ ${sottotipoLabel}</div>` : ""}`;

  document.getElementById("modal-cliente-det-title").textContent = c.nome;
  document.getElementById("cliente-dettaglio-content").innerHTML = `
    <div class="det-header" style="border-left:4px solid ${tipColor}">
      <div class="det-avatar" style="background:${tipColor}22;border-color:${tipColor};color:${tipColor}">${avatar}</div>
      <div style="flex:1">
        <div style="font-size:18px;font-weight:800">${escAttr(c.nome)}</div>
        <div style="font-size:12px;color:var(--text2);margin-top:4px">${getClassificazioneCompleta(c)}</div>
      </div>
    </div>
    <div style="margin:16px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--accent)">📊 Classificazione</div>
    ${classificazioneHtml}
    ${catHtml ? `<div style="margin:12px 0 8px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--text3)">📋 Categorie attive</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${catHtml}</div>` : ""}
    ${renderClienteDatiRiferimento(c)}`;
  openModal("modal-cliente-dettaglio");
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
  const col2Sel  = document.getElementById("c-col2");
  const col2Opts = COL2_OPTIONS[tipCodice];
  if (!col2Opts) {
    col2Wrap.style.display = "none";
    col2Sel.value = "";
    _aggiornaCol3(tipCodice, "");
  } else {
    col2Wrap.style.display = "";
    const col2Current = col2Sel.value;
    col2Sel.innerHTML = `<option value="">-- Seleziona --</option>` +
      col2Opts.map(o => `<option value="${o.value}" ${col2Current===o.value?"selected":""}>${o.label}</option>`).join("");
    if (!col2Current) col2Sel.value = "";
    _aggiornaCol3(tipCodice, col2Sel.value);
  }
  aggiornaRiepilogoClassificazione();
}

function _aggiornaCol3(tipCodice, col2Val) {
  const col3Opts = getCol3Options(tipCodice, col2Val);
  const col3Wrap = document.getElementById("wrap-col3");
  const col3Sel  = document.getElementById("c-col3");
  if (!col3Opts) { _nascondiCol3(); return; }
  col3Wrap.style.display = "";
  const col3Current = col3Sel.value;
  col3Sel.innerHTML = `<option value="">-- Seleziona --</option>` +
    col3Opts.map(o => `<option value="${o.value}" ${col3Current===o.value?"selected":""}>${o.label}</option>`).join("");
  if (!col3Current) col3Sel.value = "";
  if (col3Sel.value) document.getElementById("wrap-col4").style.display = "";
  else _nascondiCol4();
  aggiornaRiepilogoClassificazione();
}

function _nascondiCol3() {
  const w = document.getElementById("wrap-col3"), s = document.getElementById("c-col3");
  if (w) w.style.display = "none"; if (s) s.value = "";
  _nascondiCol4(); aggiornaRiepilogoClassificazione();
}

function _nascondiCol4() {
  const w = document.getElementById("wrap-col4"), s = document.getElementById("c-col4");
  if (w) w.style.display = "none"; if (s) s.value = "";
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
  const box     = document.getElementById("cliente-riepilogo-box");
  const content = document.getElementById("riepilogo-classificazione");
  if (!box || !content) return;
  const tipCodice = _getTipologiaCodice();
  const tip  = state.tipologie.find(t => t.codice === tipCodice);
  const col2 = document.getElementById("c-col2")?.value || "";
  const col3 = document.getElementById("c-col3")?.value || "";
  const col4 = document.getElementById("c-col4")?.value || "";
  let chips = [];
  if (tip) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Tipologia:</span><span class="chip-value">${tip.codice} — ${tip.nome}</span></div>`);
  if (col2) {
    const col2Opt = COL2_OPTIONS[tipCodice]?.find(o => o.value === col2);
    if (col2Opt) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Sottocategoria:</span><span class="chip-value">${col2Opt.label}</span></div>`);
  }
  if (col3) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Regime:</span><span class="chip-value">${col3}</span></div>`);
  if (col4) chips.push(`<div class="riepilogo-chip"><span class="chip-label">Periodicità:</span><span class="chip-value">${col4==="mensile"?"📅 Mensile":"📆 Trimestrale"}</span></div>`);
  if (chips.length > 0) { content.innerHTML = chips.join(""); box.style.display = ""; }
  else box.style.display = "none";
}

function populateTipologiaSelect(selectedId) {
  const sel = document.getElementById("c-tipologia");
  if (!sel) return;
  sel.innerHTML = state.tipologie
    .map(t => `<option value="${t.id}" ${String(t.id)===String(selectedId)?"selected":""}>${t.codice} — ${t.nome}</option>`)
    .join("");
}

function onTipologiaChange() {
  const col2Sel = document.getElementById("c-col2"); if (col2Sel) col2Sel.value = "";
  const col3Sel = document.getElementById("c-col3"); if (col3Sel) col3Sel.value = "";
  _nascondiCol4(); aggiornaColonneCliente();
}

function onCol2Change() {
  const col3Sel = document.getElementById("c-col3"); if (col3Sel) col3Sel.value = "";
  _nascondiCol4(); aggiornaColonneCliente();
}

function onCol3Change() {
  const tipCodice = _getTipologiaCodice();
  const col2Val   = document.getElementById("c-col2")?.value || "";
  _aggiornaCol3(tipCodice, col2Val);
  if (document.getElementById("c-col3")?.value)
    document.getElementById("wrap-col4").style.display = "";
  aggiornaRiepilogoClassificazione();
}

function renderCategorieSelect(attuali = []) {
  const container = document.getElementById("categorie-attive");
  if (!container) return;
  container.innerHTML = CATEGORIE.map(cat =>
    `<label style="display:inline-flex;align-items:center;gap:8px;margin:4px 8px 4px 0;padding:8px 12px;background:var(--surface2);border-radius:var(--r-sm);cursor:pointer;border:1px solid ${attuali.includes(cat.codice)?"var(--accent)":"var(--border)"};transition:all 0.12s" title="${cat.nome}: ${getCatDescription(cat.codice)}">
      <input type="checkbox" value="${cat.codice}" ${attuali.includes(cat.codice)?"checked":""} style="accent-color:var(--accent)" onchange="this.parentElement.style.borderColor=this.checked?'var(--accent)':'var(--border)'">
      <span>${cat.icona} ${cat.nome}</span>
    </label>`
  ).join("");
}

function getSelectedCategorie() {
  return Array.from(document.querySelectorAll("#categorie-attive input"))
    .filter(cb => cb.checked).map(cb => cb.value);
}

// ─── OPEN/EDIT/SAVE/DELETE ────────────────────────────────────
function openNuovoCliente() {
  document.getElementById("modal-cliente-title").textContent = "Nuovo Cliente";
  document.getElementById("cliente-id").value = "";
  ["c-nome","c-cf","c-piva","c-email","c-tel","c-indirizzo","c-note","c-pec","c-sdi","c-citta","c-cap","c-prov","c-referente","c-iban"]
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
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
    const fields = { "c-nome": "nome","c-cf":"codice_fiscale","c-piva":"partita_iva","c-email":"email","c-tel":"telefono","c-indirizzo":"indirizzo","c-note":"note","c-pec":"pec","c-sdi":"sdi","c-citta":"citta","c-cap":"cap","c-prov":"provincia","c-referente":"referente","c-iban":"iban" };
    Object.entries(fields).forEach(([elId, key]) => {
      const el = document.getElementById(elId); if (el) el.value = data[key] || "";
    });
    const cat = JSON.parse(data.categorie_attive || '["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]');
    renderCategorieSelect(cat);
    populateTipologiaSelect(data.id_tipologia);
    const col2Val = data.col2_value || "", col3Val = data.col3_value || "", col4Val = data.periodicita || "";
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
  const id   = document.getElementById("cliente-id").value;
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
    id_tipologia:    parseInt(document.getElementById("c-tipologia").value),
    id_sottotipologia: id_sottotipologia || null,
    col2_value:      col2Val || null,
    col3_value:      col3Val || null,
    periodicita:     col4Val || null,
    codice_fiscale:  document.getElementById("c-cf").value.trim().toUpperCase() || null,
    partita_iva:     document.getElementById("c-piva").value.trim() || null,
    email:           document.getElementById("c-email").value.trim() || null,
    telefono:        document.getElementById("c-tel").value.trim() || null,
    indirizzo:       document.getElementById("c-indirizzo").value.trim() || null,
    citta:           document.getElementById("c-citta")?.value.trim() || null,
    cap:             document.getElementById("c-cap")?.value.trim() || null,
    provincia:       document.getElementById("c-prov")?.value.trim().toUpperCase() || null,
    pec:             document.getElementById("c-pec")?.value.trim() || null,
    sdi:             document.getElementById("c-sdi")?.value.trim().toUpperCase() || null,
    iban:            document.getElementById("c-iban")?.value.trim().toUpperCase() || null,
    referente:       document.getElementById("c-referente")?.value.trim() || null,
    note:            document.getElementById("c-note").value.trim() || null,
    categorie_attive: categorie,
  };
  if (id) { data.id = parseInt(id); socket.emit("update:cliente", data); }
  else socket.emit("create:cliente", data);
}

function deleteCliente(id) {
  if (confirm("Eliminare questo cliente?")) socket.emit("delete:cliente", { id });
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