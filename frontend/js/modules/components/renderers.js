// ═══════════════════════════════════════════════════════════════
// RENDERERS.JS — Helper di rendering condivisi
// ═══════════════════════════════════════════════════════════════

// ─── IMPORTO CELL ─────────────────────────────────────────────
function renderImportoCellCompact(r) {
  if (isContabilita(r)) {
    const iva = r.importo_iva
      ? `€${parseFloat(r.importo_iva).toFixed(2)}`
      : null;
    const cont = r.importo_contabilita
      ? `€${parseFloat(r.importo_contabilita).toFixed(2)}`
      : null;
    if (!iva && !cont) return `<span class="imp-empty">—</span>`;
    return `<div class="importi-cell">
      ${iva ? `<div class="imp-row"><span class="imp-lbl">💰 IVA</span><span class="imp-val">${iva}</span></div>` : ""}
      ${cont ? `<div class="imp-row"><span class="imp-lbl">📊 Cont.</span><span class="imp-val">${cont}</span></div>` : ""}
    </div>`;
  }
  if (hasRate(r)) {
    let lb = ["Saldo", "1°Acc.", "2°Acc."];
    try {
      if (r.rate_labels) lb = JSON.parse(r.rate_labels);
    } catch (e) {}
    const s = r.importo_saldo
      ? `€${parseFloat(r.importo_saldo).toFixed(2)}`
      : null;
    const a1 = r.importo_acconto1
      ? `€${parseFloat(r.importo_acconto1).toFixed(2)}`
      : null;
    const a2 = r.importo_acconto2
      ? `€${parseFloat(r.importo_acconto2).toFixed(2)}`
      : null;
    if (!s && !a1 && !a2) return `<span class="imp-empty">—</span>`;
    return `<div class="importi-cell">
      ${s ? `<div class="imp-row"><span class="imp-lbl">💰 ${lb[0]}</span><span class="imp-val">${s}</span></div>` : ""}
      ${a1 ? `<div class="imp-row"><span class="imp-lbl">📥 ${lb[1]}</span><span class="imp-val">${a1}</span></div>` : ""}
      ${a2 ? `<div class="imp-row"><span class="imp-lbl">📥 ${lb[2]}</span><span class="imp-val">${a2}</span></div>` : ""}
    </div>`;
  }
  return r.importo
    ? `<div class="importi-cell"><div class="imp-row"><span class="imp-lbl">💶 Imp.</span><span class="imp-val">€${parseFloat(r.importo).toFixed(2)}</span></div></div>`
    : `<span class="imp-empty">—</span>`;
}

// ─── PERIODO PILL ─────────────────────────────────────────────
function renderPeriodoPill(r) {
  const stato = r.stato || "da_fare";
  const ps = getPeriodoShort(r);
  const statoColors = {
    da_fare: "var(--red)",
    in_corso: "var(--yellow)",
    completato: "var(--green)",
    n_a: "var(--text3)",
  };
  const statoColor = statoColors[stato] || "var(--text3)";
  const statoIcon =
    stato === "da_fare"
      ? "⭕"
      : stato === "in_corso"
        ? "🔄"
        : stato === "completato"
          ? "✅"
          : "➖";
  const statoLabel =
    stato === "da_fare"
      ? "Da fare"
      : stato === "in_corso"
        ? "In corso"
        : stato === "completato"
          ? "Completato"
          : "N/A";
  const impHtml = renderImportoCellCompact(r);
  const hasImp = impHtml !== `<span class="imp-empty">—</span>`;

  let dateLine = "";
  if (r.data_scadenza || r.data_completamento) {
    dateLine = `<div class="pp-dates">`;
    if (r.data_scadenza)
      dateLine += `<span class="pp-date" title="Data scadenza">📅 ${r.data_scadenza}</span>`;
    if (r.data_completamento)
      dateLine += `<span class="pp-date" style="color:var(--green)" title="Data completamento">✅ ${r.data_completamento}</span>`;
    dateLine += `</div>`;
  }

  const tooltipText = `${getPeriodoLabel(r)} — ${statoLabel}${r.data_scadenza ? ` | Scad: ${r.data_scadenza}` : ""}${r.data_completamento ? ` | Compl: ${r.data_completamento}` : ""}\nClicca per modificare`;

  return `<div class="periodo-pill s-${stato}" onclick="openAdpById(${r.id})" title="${escAttr(tooltipText)}">
    <div class="pp-top">
      <span class="pp-tag" style="border-color:${statoColor};color:${statoColor}">${ps}</span>
      <span class="pp-stato-icon" title="${escAttr(statoLabel)}">${statoIcon}</span>
    </div>
    ${dateLine}
    ${hasImp ? `<div class="pp-imp">${impHtml}</div>` : ""}
    ${r.note ? `<div class="pp-note" title="${escAttr(r.note)}">📝 ${r.note}</div>` : ""}
  </div>`;
}

// ─── CLIENTE INFO BOX ─────────────────────────────────────────
function renderClienteInfoBox(cliente) {
  if (!cliente) return "";
  const avatar = getAvatar(cliente.nome);
  const tipColor = getTipologiaColor(cliente.tipologia_codice);
  const tipBadge = cliente.tipologia_codice
    ? `<span class="badge b-${(cliente.tipologia_codice || "").toLowerCase()}" title="${TIPOLOGIE_INFO[cliente.tipologia_codice]?.desc || cliente.tipologia_codice}">${cliente.tipologia_codice}</span>`
    : "";
  const sottotipoLabel = getLabelSottotipologia(cliente);
  const subBadge = sottotipoLabel
    ? `<span class="badge b-categoria" title="Sottotipologia: ${sottotipoLabel}">📋 ${sottotipoLabel}</span>`
    : "";

  let classCols = "";
  if (cliente.col2_value || cliente.col3_value || cliente.periodicita) {
    classCols = `<div class="cliente-class-pills">`;
    const col2Map = {
      privato: "Privato",
      ditta: "Ditta Ind.",
      socio: "Socio",
      professionista: "Professionista",
    };
    const col3Map = {
      ordinario: "Ordinario",
      semplificato: "Semplificato",
      forfettario: "Forfettario",
      ordinaria: "Ordinaria",
      semplificata: "Semplificata",
    };
    if (cliente.col2_value)
      classCols += `<span class="class-pill" title="Sottocategoria"><span class="cp-num">2</span>${col2Map[cliente.col2_value] || cliente.col2_value}</span>`;
    if (cliente.col3_value)
      classCols += `<span class="class-pill" title="Regime fiscale"><span class="cp-num">3</span>${col3Map[cliente.col3_value] || cliente.col3_value}</span>`;
    if (cliente.periodicita)
      classCols += `<span class="class-pill per-pill" title="Periodicità contabile"><span class="cp-num">4</span>${cliente.periodicita === "mensile" ? "📅 Mensile" : "📆 Trimestrale"}</span>`;
    classCols += `</div>`;
  }

  let metaChips = [];
  if (cliente.codice_fiscale)
    metaChips.push(
      `<span class="meta-chip" title="Codice Fiscale">CF: <strong>${cliente.codice_fiscale}</strong></span>`,
    );
  if (cliente.partita_iva)
    metaChips.push(
      `<span class="meta-chip" title="Partita IVA">P.IVA: <strong>${cliente.partita_iva}</strong></span>`,
    );
  if (cliente.email)
    metaChips.push(
      `<span class="meta-chip" title="Indirizzo email">📧 ${cliente.email}</span>`,
    );
  if (cliente.telefono)
    metaChips.push(
      `<span class="meta-chip" title="Numero di telefono">📞 ${cliente.telefono}</span>`,
    );

  return `
    <div class="cliente-info-header">
      <div class="cliente-info-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}22;font-size:${avatarFontSize(avatar, 15)}">${avatar}</div>
      <div style="flex:1">
        <div class="cliente-info-nome">${escAttr(cliente.nome)}</div>
        <div class="cliente-info-badges">${tipBadge} ${subBadge}</div>
        ${classCols}
      </div>
    </div>
    ${metaChips.length ? `<div class="cliente-info-meta">${metaChips.join("")}</div>` : ""}
  `;
}

// ─── CLIENTE DATI RIFERIMENTO ─────────────────────────────────
function renderClienteDatiRiferimento(cliente) {
  if (!cliente) return "";
  const items = [];
  const add = (icon, label, val, title) =>
    items.push(
      `<div class="dati-ref-item" title="${title || label + " " + val}"><span class="ref-icon">${icon}</span><span class="ref-label">${label}</span><span class="ref-value">${val}</span></div>`,
    );
  if (cliente.codice_fiscale)
    add("🆔", "CF:", cliente.codice_fiscale, "Codice Fiscale");
  if (cliente.partita_iva)
    add("🏢", "P.IVA:", cliente.partita_iva, "Partita IVA");
  if (cliente.email) add("📧", "Email:", cliente.email, "Indirizzo email");
  if (cliente.telefono)
    add("📞", "Tel:", cliente.telefono, "Numero di telefono");
  if (cliente.pec)
    add("📨", "PEC:", cliente.pec, "Posta Elettronica Certificata");
  if (cliente.sdi)
    add("📋", "SDI:", cliente.sdi, "Codice SDI per fatturazione elettronica");
  if (cliente.referente)
    add("👤", "Ref.:", cliente.referente, "Referente / Contatto");
  if (cliente.iban) add("🏦", "IBAN:", cliente.iban, "Coordinate bancarie");
  if (cliente.indirizzo)
    add(
      "📍",
      "Indirizzo:",
      `${cliente.indirizzo}${cliente.citta ? `, ${cliente.citta}` : ""}`,
      "Indirizzo completo",
    );
  if (!items.length) return "";
  return `<div class="cpc-dati-riferimento"><div class="dati-ref-title">📋 Dati di Riferimento</div><div class="dati-ref-grid">${items.join("")}</div></div>`;
}

// ─── ICONE CATEGORIE CON TOOLTIP per lista clienti ────────────
function renderCatIconsWithTooltip(categorie) {
  return categorie
    .map((cat) => {
      const found = CATEGORIE.find((x) => x.codice === cat);
      if (!found) return "";
      return `<span class="cat-mini-badge tooltip-cat" 
      style="color:${found.color};border-color:${found.color}22;background:${found.color}11" 
      title="${found.nome} — ${getCatDescription(found.codice)}">${found.icona}</span>`;
    })
    .join("");
}

function getCatDescription(codice) {
  const desc = {
    IVA: "Gestione IVA, LIPE, acconto IVA",
    DICHIARAZIONI: "730, Redditi, CU, 770, Dich. IVA",
    PREVIDENZA: "INPS trimestrale e contributi",
    LAVORO: "INAIL e adempimenti lavoro",
    TRIBUTI: "IMU, IRAP, diritto CCIAA",
    BILANCIO: "Deposito bilancio e contabilità",
  };
  return desc[codice] || codice;
}