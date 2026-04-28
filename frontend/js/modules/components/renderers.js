// ═══════════════════════════════════════════════════════════════
// RENDERERS.JS — Helper di rendering condivisi
// ═══════════════════════════════════════════════════════════════

// ─── UTILITY ───────────────────────────────────────────────
function formattaNumeroItaliano(valore) {
  if (valore === null || valore === undefined || valore === "") return "";
  return String(valore).replace('.', ',');
}

// ─── TYPE HELPERS ─────────────────────────────────────────────
function isContabilita(r) {
  return (
    parseInt(r.is_contabilita) === 1 ||
    r.is_contabilita === true ||
    r.is_contabilita === 1
  );
}
function hasRate(r) {
  return parseInt(r.has_rate) === 1 || r.has_rate === true || r.has_rate === 1;
}
function isCheckbox(r) {
  return (
    parseInt(r.is_checkbox) === 1 ||
    r.is_checkbox === true ||
    r.is_checkbox === 1
  );
}

// ─── IMPORTO CELL ─────────────────────────────────────────────
function renderImportoCellCompact(r) {
  if (isCheckbox(r)) {
    return `<span class="imp-empty">—</span>`;
  }
  if (isContabilita(r)) {
    const iva = r.importo_iva
      ? `€${formattaNumeroItaliano(r.importo_iva)}`
      : null;
    const acc2 = r.importo_acconto2
      ? `€${formattaNumeroItaliano(r.importo_acconto2)}`
      : null;
    const contDone = parseInt(r.cont_completata) === 1;
    if (!iva && !acc2 && !contDone) return `<span class="imp-empty">—</span>`;
    return `<div class="importi-cell">
      ${iva ? `<div class="imp-row"><span class="imp-lbl">💰 IVA</span><span class="imp-val">${iva}</span></div>` : ""}
      ${acc2 ? `<div class="imp-row"><span class="imp-lbl">📥 2°Acc.</span><span class="imp-val">${acc2}</span></div>` : ""}
      ${contDone ? `<div class="imp-row"><span class="imp-lbl">📊 Adempimento Comp.</span><span class="imp-val">✓</span></div>` : ""}
    </div>`;
  }
  if (hasRate(r)) {
    let lb = ["Saldo", "1°Acc.", "2°Acc."];
    try {
      if (r.rate_labels) lb = JSON.parse(r.rate_labels);
    } catch (e) {}
    const s = r.importo_saldo
      ? `€${formattaNumeroItaliano(r.importo_saldo)}`
      : null;
    const a1 = r.importo_acconto1
      ? `€${formattaNumeroItaliano(r.importo_acconto1)}`
      : null;
    const a2 = r.importo_acconto2
      ? `€${formattaNumeroItaliano(r.importo_acconto2)}`
      : null;
    if (!s && !a1 && !a2) return `<span class="imp-empty">—</span>`;
    return `<div class="importi-cell">
      ${s ? `<div class="imp-row"><span class="imp-lbl">💰 ${lb[0]}</span><span class="imp-val">${s}</span></div>` : ""}
      ${a1 ? `<div class="imp-row"><span class="imp-lbl">📥 ${lb[1]}</span><span class="imp-val">${a1}</span></div>` : ""}
      ${a2 ? `<div class="imp-row"><span class="imp-lbl">📥 ${lb[2]}</span><span class="imp-val">${a2}</span></div>` : ""}
    </div>`;
  }
  return r.importo
    ? `<div class="importi-cell"><div class="imp-row"><span class="imp-lbl">💶</span><span class="imp-val">€${formattaNumeroItaliano(r.importo)}</span></div></div>`
    : `<span class="imp-empty">—</span>`;
}

// ─── COLORE PILLOLA ───────────────────────────────────────────
//
// CONTABILITÀ: verde = IVA compilata | rosso = niente
// RATE:        verde = 3 rate + cont | blu = 1-2 rate | rosso = 0 rate
// CHECKBOX:    verde = completato    | grigio = n_a   | rosso = da fare
// NORMALE:     verde = completato    | rosso = da fare
//
function getPillColor(r, stato) {
  const isCompletato = stato === "completato";
  const isNA = stato === "n_a";

  if (isCheckbox(r)) {
    if (isNA) return "var(--text3)";
    if (isCompletato) return "var(--green)";
    return "var(--red)";
  }

  if (isContabilita(r)) {
    const hasIva = !!r.importo_iva;
    const contDone = parseInt(r.cont_completata) === 1;
    
    if (hasIva && contDone) {
      // Entrambi completati = verde
      return "var(--green)";
    } else if (hasIva || contDone) {
      // Solo uno completato = blu
      return "var(--accent)";
    }
    return "var(--red)";
  }

  if (hasRate(r)) {
    const filled = [
      r.importo_saldo,
      r.importo_acconto1,
      r.importo_acconto2,
    ].filter(
      (v) => v != null && v !== "" && v !== 0 && parseFloat(v) > 0,
    ).length;
    const contDone = parseInt(r.cont_completata) === 1;
    const hasAnyRate = filled >= 1;

    if (hasAnyRate && contDone) return "var(--green)";
    if (hasAnyRate || contDone) return "var(--accent)";
    return "var(--red)";
  }

  // normale
  if (isCompletato) return "var(--green)";
  return "var(--red)";
}

// ─── CHECKBOX PILL ────────────────────────────────────────────
function renderCheckboxPill(r) {
  const stato = r.stato || "da_fare";
  const ps = getPeriodoShort(r);

  const isDone = stato === "completato";
  const isNA = stato === "n_a";
  const isDaFare = !isDone && !isNA;

  // Colori coerenti con getPillColor: verde=completato, grigio=n/a, rosso=da fare
  let color;
  if (isDone) color = "var(--green)";
  else if (isNA) color = "var(--text3)";
  else color = "var(--red)";

  const icon = isDone ? "✅" : isNA ? "➖" : "✗";

  const btnReset = `<button class="cbx-btn${isDaFare ? " cbx-active cbx-red" : ""}" onclick="setCbxStato(event,${r.id},'da_fare')"    title="Segna da fare">☐</button>`;
  const btnNA = `<button class="cbx-btn${isNA ? " cbx-active cbx-gray" : ""}" onclick="setCbxStato(event,${r.id},'n_a')"        title="Segna N/A">➖</button>`;
  const btnDone = `<button class="cbx-btn${isDone ? " cbx-active cbx-green" : ""}" onclick="setCbxStato(event,${r.id},'completato')" title="Segna completato">✅</button>`;

  // Nome adempimento (visibile sopra i bottoni)
  const nomeHtml = r.adempimento_nome
    ? `<div class="pp-nome" style="color:${color};font-size:11px;line-height:1.3;margin-bottom:2px">${r.adempimento_nome}</div>`
    : "";

  return `<div class="periodo-pill checkbox-pill s-${stato}"
    onclick="openAdpById(${r.id})"
    oncontextmenu="toggleAdpCompletato(event,${r.id})"
    title="${escAttr(getPeriodoLabel(r))} — Click: modifica | Tasto DX: toggle completato"
    style="border-color:${color};min-width:120px;flex:0 1 120px">
    <div class="pp-top" style="justify-content:space-between;gap:4px">
      <span class="pp-tag" style="border-color:${color};color:${color}">${ps}</span>
      <span style="font-size:18px;line-height:1">${icon}</span>
    </div>
    ${nomeHtml}
    <div class="cbx-btn-row" onclick="event.stopPropagation()">
      ${btnReset}${btnNA}${btnDone}
    </div>
    ${r.note ? `<div class="pp-note" title="${escAttr(r.note)}">📝 ${r.note}</div>` : ""}
  </div>`;
}

// ─── PERIODO PILL ─────────────────────────────────────────────
function renderPeriodoPill(r) {
  if (isCheckbox(r)) return renderCheckboxPill(r);

  const stato = r.stato || "da_fare";
  const ps = getPeriodoShort(r);

  const pillColor = getPillColor(r, stato);

  // Icona stato
  let statoIcon, statoLabel;
  if (hasRate(r)) {
    const filled = [
      r.importo_saldo,
      r.importo_acconto1,
      r.importo_acconto2,
    ].filter(
      (v) => v != null && v !== "" && v !== 0 && parseFloat(v) > 0,
    ).length;
    statoIcon = filled >= 3 ? "✅" : filled >= 1 ? "🔄" : "⭕";
    statoLabel =
      filled >= 3
        ? "Tutte le rate"
        : filled >= 1
          ? `${filled}/3 rate`
          : "Nessuna rata";
  } else {
    statoIcon =
      stato === "da_fare"
        ? "⭕"
        : stato === "in_corso"
          ? "🔄"
          : stato === "completato"
            ? "✅"
            : "➖";
    statoLabel =
      stato === "da_fare"
        ? "Da fare"
        : stato === "in_corso"
          ? "In corso"
          : stato === "completato"
            ? "Completato"
            : "N/A";
  }

  const impHtml = renderImportoCellCompact(r);
  const hasImp = impHtml !== `<span class="imp-empty">—</span>`;

  let importiInline = "";
  if (isContabilita(r)) {
    importiInline = _buildContabilitaLabel(r, pillColor);
  } else if (hasRate(r)) {
    importiInline = _buildRateLabel(r, pillColor);
  }

  let dateLine = "";
  if (r.data_scadenza || r.data_completamento) {
    dateLine = `<div class="pp-dates">`;
    if (r.data_scadenza)
      dateLine += `<span class="pp-date" title="Data scadenza">📅 ${r.data_scadenza}</span>`;
    if (r.data_completamento)
      dateLine += `<span class="pp-date" style="color:var(--green)" title="Data completamento">✅ ${r.data_completamento}</span>`;
    dateLine += `</div>`;
  }

  const tooltipText = `${getPeriodoLabel(r)} — ${statoLabel}${r.data_scadenza ? ` | Scad: ${r.data_scadenza}` : ""}${r.data_completamento ? ` | Compl: ${r.data_completamento}` : ""}\nClick sinistro: modifica | Click destro: toggle completato`;

  const tagColor =
    isContabilita(r) && r.importo_iva ? "var(--green)" : pillColor;

  return `<div class="periodo-pill s-${stato}"
    onclick="openAdpById(${r.id})"
    oncontextmenu="toggleAdpCompletato(event,${r.id})"
    title="${escAttr(tooltipText)}"
    style="border-color:${pillColor};color:${pillColor}">
    <div class="pp-top">
      <span class="pp-tag" style="border-color:${tagColor};color:${tagColor}">${ps}</span>
      <span class="pp-stato-icon" title="${escAttr(statoLabel)}">${statoIcon}</span>
    </div>
    <div class="pp-nome" style="color:${pillColor}">${r.adempimento_nome || ""}</div>
    ${importiInline}
    ${dateLine}
    ${!importiInline && hasImp ? `<div class="pp-imp">${impHtml}</div>` : ""}
    ${r.note ? `<div class="pp-note" title="${escAttr(r.note)}">📝 ${r.note}</div>` : ""}
  </div>`;
}

// ─── HELPER: label con checkbox per contabilità ───────────────
function _buildContabilitaLabel(r, pillColor) {
  const hasIva = !!r.importo_iva;
  const contDone = parseInt(r.cont_completata) === 1;
  
  let cIva, cCont;
  if (hasIva && contDone) {
    // Entrambi completati = verde
    cIva = cCont = "var(--green)";
  } else if (hasIva || contDone) {
    // Solo uno completato = blu
    cIva = cCont = "var(--accent)";
  } else {
    // Nessuno completato = rosso
    cIva = cCont = "var(--red)";
  }
  
  const ivaVal = hasIva ? `€${formattaNumeroItaliano(r.importo_iva)}` : "—";

  return `<div class="pp-cont-labels">
    <div class="pp-cont-row">
      <span class="pp-cont-check" style="color:${cIva}">${hasIva ? "✓" : "✗"}</span>
      <span class="pp-cont-lbl" style="color:${cIva}">💰 IVA</span>
      <span class="pp-cont-val" style="color:${cIva}">${ivaVal}</span>
    </div>
    <div class="pp-cont-row">
      <span class="pp-cont-check" style="color:${cCont}">${contDone ? "✓" : "✗"}</span>
      <span class="pp-cont-lbl" style="color:${cCont}">📊 Adempimento Comp.</span>
      <span class="pp-cont-val" style="color:${cCont}">${contDone ? "fatto" : "—"}</span>
    </div>
  </div>`;
}

// ─── HELPER: label con checkbox per rate ─────────────────────
function _buildRateLabel(r, pillColor) {
  let lb = ["Saldo", "1°Acc.", "2°Acc."];
  try {
    if (r.rate_labels) lb = JSON.parse(r.rate_labels);
  } catch (e) {}

  const vals = [r.importo_saldo, r.importo_acconto1, r.importo_acconto2];
  const icons = ["💰", "📥", "📥"];
  const filled = vals.filter(
    (v) => v != null && v !== "" && parseFloat(v) > 0,
  ).length;
  const allDone = filled >= 3;
  const contDone = parseInt(r.cont_completata) === 1;
  const hasAnyRate = filled >= 1;

  let cRate, cCont;
  if (allDone && contDone) {
    cRate = cCont = "var(--green)";
  } else if (hasAnyRate || contDone) {
    cRate = cCont = "var(--accent)";
  } else {
    cRate = cCont = "var(--red)";
  }

  const rows = vals
    .map((v, i) => {
      const done = v != null && v !== "" && parseFloat(v) > 0;
      const display = done ? `€${formattaNumeroItaliano(v)}` : "—";
      return `<div class="pp-cont-row">
      <span class="pp-cont-check" style="color:${cRate}">${done ? "✓" : "✗"}</span>
      <span class="pp-cont-lbl" style="color:${cRate}">${icons[i]} ${lb[i]}</span>
      <span class="pp-cont-val" style="color:${cRate}">${display}</span>
    </div>`;
    })
    .join("");

  const contRow = `<div class="pp-cont-row">
    <span class="pp-cont-check" style="color:${cCont}">${contDone ? "✓" : "✗"}</span>
    <span class="pp-cont-lbl" style="color:${cCont}">📊 Adempimento Comp.</span>
    <span class="pp-cont-val" style="color:${cCont}">${contDone ? "fatto" : "—"}</span>
  </div>`;

  return `<div class="pp-cont-labels">${rows}${contRow}</div>`;
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
      classCols += `<span class="class-pill per-pill" title="Periodicità contabile"><span class="cp-num">4</span>${cliente.periodicita === "mensile" ? "📅 Mensile" : cliente.periodicita === "annuale" ? "📅 Annuale" : "📆 Trimestrale"}</span>`;
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
    add("🏢", "P.IVA:", cliente.partita_iva.replace(/[^0-9]/g, ''), "Partita IVA");
  if (cliente.email) add("📧", "Email:", cliente.email, "Indirizzo email");
  if (cliente.telefono)
    add("📞", "Tel:", cliente.telefono.replace(/[^0-9]/g, ''), "Numero di telefono");
  if (cliente.pec)
    add("📨", "PEC:", cliente.pec, "Posta Elettronica Certificata");
  if (cliente.sdi)
    add("📋", "SDI:", cliente.sdi, "Codice SDI per fatturazione elettronica");
  if (cliente.referente)
    add("👤", "Ref.:", cliente.referente, "Referente / Contatto");
  if (cliente.iban) add("🏦", "IBAN:", cliente.iban, "Coordinate bancarie");
  if (cliente.cap)
    add("📮", "CAP:", cliente.cap.replace(/[^0-9]/g, ''), "Codice di Avviamento Postale");
  if (cliente.indirizzo)
    add(
      "📍",
      "Indirizzo:",
      `${cliente.indirizzo}${cliente.citta ? `, ${cliente.citta}` : ""}${cliente.cap ? ` (${cliente.cap.replace(/[^0-9]/g, '')})` : ""}`,
      "Indirizzo completo",
    );
  if (cliente.note)
    add(
      "📝",
      "Note:",
      cliente.note.length > 50 ? cliente.note.substring(0, 50) + "..." : cliente.note,
      cliente.note,
    );
  if (!items.length) return "";
  return `<div class="cpc-dati-riferimento"><div class="dati-ref-title">📋 Dati di Riferimento</div><div class="dati-ref-grid">${items.join("")}</div></div>`;
}
