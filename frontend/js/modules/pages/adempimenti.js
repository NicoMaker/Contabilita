// ═══════════════════════════════════════════════════════════════
// ADEMPIMENTI.JS — Gestione definizioni adempimenti e modal stato
// ═══════════════════════════════════════════════════════════════

// ─── UTILITY NULL-SAFE ────────────────────────────────────────
function setVal(id, val) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[adp] elemento non trovato: #${id}`);
    return;
  }
  if (el.type === "checkbox") el.checked = !!val;
  else el.value = val ?? "";
}
function setTxt(id, txt) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[adp] elemento non trovato: #${id}`);
    return;
  }
  el.textContent = txt ?? "";
}
function setDisplay(id, display) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[adp] elemento non trovato: #${id}`);
    return;
  }
  el.style.display = display;
}
function getVal(id) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn(`[adp] elemento non trovato: #${id}`);
    return "";
  }
  return el.type === "checkbox" ? el.checked : (el.value ?? "");
}

// ─── LISTA ADEMPIMENTI ────────────────────────────────────────
const applyAdempimentiFiltriSearch = debounce(() => {
  const q =
    document
      .getElementById("global-search-adempimenti")
      ?.value?.toLowerCase() || "";
  const filtered = state.adempimenti.filter((a) => {
    if (
      q &&
      !a.codice.toLowerCase().includes(q) &&
      !a.nome.toLowerCase().includes(q)
    )
      return false;
    return true;
  });
  renderAdempimentiTabella(filtered);
}, 300);

function resetAdempimentiFiltri() {
  const s = document.getElementById("global-search-adempimenti");
  if (s) s.value = "";
  renderAdempimentiTabella(state.adempimenti);
}

function renderAdempimentiPage() {
  renderAdempimentiTabella(state.adempimenti);
}

function renderAdempimentiTabella(adempimenti) {
  const scadIcons = {
    annuale: "📅",
    semestrale: "📆",
    trimestrale: "📊",
    mensile: "🗓️",
  };
  const scadFreq = {
    annuale: "1×/anno",
    semestrale: "2×/anno",
    trimestrale: "4×/anno",
    mensile: "12×/anno",
  };
  const scadDesc = {
    annuale: "Scadenza annuale",
    semestrale: "Scadenza semestrale",
    trimestrale: "Scadenza trimestrale",
    mensile: "Scadenza mensile",
  };

  const totAdp = adempimenti.length;
  const totAll = state.adempimenti.length;
  const isFiltrato = totAdp < totAll;

  let html = `<div style="margin-bottom:16px;display:flex;align-items:center;gap:10px">
    <span style="font-size:14px;color:var(--text2)">
      ${
        isFiltrato
          ? `<span style="color:var(--yellow)">⚠️ Filtro attivo:</span> ${totAdp} di ${totAll} adempimenti`
          : `<span style="color:var(--text3)">${totAll} adempimenti totali</span>`
      }
    </span>
    ${isFiltrato ? `<button class="btn btn-sm btn-primary" onclick="resetAdempimentiFiltri()" style="font-size:12px">⟳ Tutti</button>` : ""}
  </div>`;

  const cards = adempimenti
    .map((a) => {
      const flagsBadges = [];
      if (a.is_contabilita)
        flagsBadges.push(
          `<span class="adp-flag-badge" style="color:#22d3ee;background:#22d3ee15;border-color:#22d3ee33;font-size:11px" title="IVA + Contabilità separati">📊 Cont.</span>`,
        );
      if (a.has_rate)
        flagsBadges.push(
          `<span class="adp-flag-badge" style="color:#34d399;background:#34d39915;border-color:#34d39933;font-size:11px" title="Con rate">💰 Rate</span>`,
        );
      if (a.is_checkbox)
        flagsBadges.push(
          `<span class="adp-flag-badge" style="color:#a78bfa;background:#a78bfa15;border-color:#a78bfa33;font-size:11px" title="Checkbox semplice ✓/✗">☑️ Check</span>`,
        );

      return `<div class="adp-def-card" title="${escAttr(a.nome)} — ${scadDesc[a.scadenza_tipo] || a.scadenza_tipo}">
      <div class="adp-def-card-top">
        <div class="adp-def-codice" style="font-size:13px">${a.codice}</div>
        <div style="display:flex;gap:5px">
          <button class="btn btn-xs btn-secondary" onclick="editAdpDef(${a.id})"   title="Modifica">✏️</button>
          <button class="btn btn-xs btn-danger"    onclick="deleteAdpDef(${a.id})" title="Elimina">🗑️</button>
        </div>
      </div>
      <div class="adp-def-nome" style="font-size:15px">${a.nome}</div>
      ${a.descrizione ? `<div class="adp-def-desc" style="font-size:12px">${a.descrizione}</div>` : ""}
      <div class="adp-def-meta">
        <span class="adp-scad-badge" style="font-size:12px" title="${scadDesc[a.scadenza_tipo] || a.scadenza_tipo}">
          <span style="font-size:14px">${scadIcons[a.scadenza_tipo] || "📅"}</span>
          ${a.scadenza_tipo}
          <span style="color:var(--text3);font-size:10px">(${scadFreq[a.scadenza_tipo] || ""})</span>
        </span>
        ${flagsBadges.join("")}
      </div>
    </div>`;
    })
    .join("");

  if (!adempimenti.length) {
    html += `<div class="empty"><div class="empty-icon">📋</div><p style="font-size:15px">Nessun adempimento trovato</p></div>`;
    document.getElementById("content").innerHTML = html;
    return;
  }

  html += `<div class="adp-def-grid-flat">${cards}</div>`;
  document.getElementById("content").innerHTML = html;
}

// ─── MODAL ADEMPIMENTO DEF ────────────────────────────────────
function openNuovoAdpDef() {
  setTxt("modal-adp-def-title", "Nuovo Adempimento");
  setVal("adp-def-id", "");
  setVal("adp-def-codice", "");
  setVal("adp-def-nome", "");
  setVal("adp-def-desc", "");
  setVal("adp-def-categoria", "TUTTI");
  setVal("adp-def-scadenza", "annuale");
  setVal("adp-def-contabilita", false);
  setVal("adp-def-rate", false);
  setVal("adp-def-checkbox", false);
  setDisplay("sect-rate-labels", "none");
  setVal("adp-rate-l1", "Saldo");
  setVal("adp-rate-l2", "1° Acconto");
  setVal("adp-rate-l3", "2° Acconto");
  openModal("modal-adp-def");
}

function editAdpDef(id) {
  const a = state.adempimenti.find((x) => x.id === id);
  if (!a) return;

  setTxt("modal-adp-def-title", "Modifica Adempimento");
  setVal("adp-def-id", a.id);
  setVal("adp-def-codice", a.codice);
  setVal("adp-def-nome", a.nome);
  setVal("adp-def-desc", a.descrizione || "");
  setVal("adp-def-categoria", a.categoria || "TUTTI");
  setVal("adp-def-scadenza", a.scadenza_tipo || "annuale");
  setVal("adp-def-contabilita", !!a.is_contabilita);
  setVal("adp-def-rate", !!a.has_rate);
  setVal("adp-def-checkbox", !!a.is_checkbox);

  let lb = ["Saldo", "1° Acconto", "2° Acconto"];
  try {
    if (a.rate_labels) lb = JSON.parse(a.rate_labels);
  } catch (e) {}
  setVal("adp-rate-l1", lb[0] || "Saldo");
  setVal("adp-rate-l2", lb[1] || "1° Acconto");
  setVal("adp-rate-l3", lb[2] || "2° Acconto");

  onAdpFlagsChange();
  openModal("modal-adp-def");
}

function onAdpFlagsChange() {
  const isCont = !!getVal("adp-def-contabilita");
  const hasRateEl = !!getVal("adp-def-rate");
  const isCheckEl = !!getVal("adp-def-checkbox");

  // Mutuamente esclusivi
  if (isCont) {
    setVal("adp-def-rate", false);
    setVal("adp-def-checkbox", false);
  }
  if (hasRateEl) {
    setVal("adp-def-contabilita", false);
    setVal("adp-def-checkbox", false);
  }
  if (isCheckEl) {
    setVal("adp-def-contabilita", false);
    setVal("adp-def-rate", false);
  }

  // Ricalcola dopo le modifiche
  const rateAttivo = !!getVal("adp-def-rate");
  setDisplay("sect-rate-labels", rateAttivo ? "" : "none");
}

function saveAdpDef() {
  const id = getVal("adp-def-id");
  const codice = String(getVal("adp-def-codice")).trim().toUpperCase();
  const nome = String(getVal("adp-def-nome")).trim();
  if (!codice || !nome) {
    showNotif("Codice e nome sono obbligatori", "error");
    return;
  }

  const data = {
    codice,
    nome,
    descrizione: String(getVal("adp-def-desc")).trim() || null,
    categoria: getVal("adp-def-categoria"),
    scadenza_tipo: getVal("adp-def-scadenza"),
    is_contabilita: getVal("adp-def-contabilita") ? 1 : 0,
    has_rate: getVal("adp-def-rate") ? 1 : 0,
    is_checkbox: getVal("adp-def-checkbox") ? 1 : 0,
  };

  if (data.has_rate) {
    data.rate_labels = [
      getVal("adp-rate-l1"),
      getVal("adp-rate-l2"),
      getVal("adp-rate-l3"),
    ];
  }

  if (id) {
    data.id = parseInt(id);
    socket.emit("update:adempimento", data);
  } else socket.emit("create:adempimento", data);
}

function deleteAdpDef(id) {
  if (confirm("Eliminare questo adempimento?"))
    socket.emit("delete:adempimento", { id });
}

// ─── MODAL STATO ADEMPIMENTO ──────────────────────────────────
function openAdpModal(r) {
  setVal("adp-id", r.id);
  setTxt("adp-nome-label", `${r.adempimento_nome} — ${getPeriodoLabel(r)}`);
  setVal("adp-stato", r.stato || "da_fare");
  setVal("adp-scadenza", r.data_scadenza || "");
  setVal("adp-data", r.data_completamento || "");
  setVal("adp-note", r.note || "");
  setVal("adp-is-contabilita", r.is_contabilita || 0);
  setVal("adp-has-rate", r.has_rate || 0);
  setVal("adp-is-checkbox", r.is_checkbox || 0);
  setVal("adp-rate-labels-json", r.rate_labels || "");

  const clienteInfo = document.getElementById("adp-cliente-info");
  if (clienteInfo) {
    clienteInfo.innerHTML = renderClienteInfoBox({
      nome: r.cliente_nome,
      tipologia_codice: r.cliente_tipologia_codice,
      sottotipologia_nome: r.cliente_sottotipologia_nome,
      codice_fiscale: r.cliente_cf,
      partita_iva: r.cliente_piva,
      periodicita: r.cliente_periodicita,
      col2_value: r.cliente_col2,
      col3_value: r.cliente_col3,
    });
  }

  const isCont = isContabilita(r);
  const isRate = hasRate(r);
  const isCbx = isCheckbox(r);

  // Mostra le sezioni — priorità: checkbox > cont+rate > cont > rate > normale
  setDisplay(
    "sect-importo-normale",
    !isCont && !isRate && !isCbx ? "" : "none",
  );
  setDisplay("sect-importo-cont", isCont && !isCbx ? "" : "none");
  setDisplay("sect-importo-rate", isRate && !isCbx ? "" : "none");
  setDisplay("sect-importo-checkbox", isCbx ? "" : "none");

  setVal("adp-importo", r.importo || "");
  setVal("adp-imp-iva", r.importo_iva || "");
  setVal("adp-imp-cont", r.importo_contabilita || "");
  setVal("adp-imp-saldo", r.importo_saldo || "");
  setVal("adp-imp-acc1", r.importo_acconto1 || "");
  setVal("adp-imp-acc2", r.importo_acconto2 || "");

  // Nascondi checkbox contabilità se il cliente ha contabilità attiva
  const clienteHaContabilita = state.selectedCliente && state.selectedCliente.contabilita === 1;
  const contCheckboxWrapper = document.getElementById("contabilita-checkbox-wrapper");
  const rateCheckboxWrapper = document.getElementById("rate-contabilita-checkbox-wrapper");
  
  if (contCheckboxWrapper) {
    contCheckboxWrapper.style.display = clienteHaContabilita ? "none" : "";
  }
  if (rateCheckboxWrapper) {
    rateCheckboxWrapper.style.display = clienteHaContabilita ? "none" : "";
  }

  // Contabilità: checkbox cont_completata + colori (solo se cliente non ha contabilità attiva)
  if (isCont && !isCbx && !clienteHaContabilita) {
    const contCheck = document.getElementById("adp-cont-completata");
    if (contCheck) contCheck.checked = parseInt(r.cont_completata) === 1;
    _aggiornaColoriContabilita(r);
  }

  // Rate con contabilità: checkbox cont_completata + colori (solo se cliente non ha contabilità attiva)
  if (isRate && !isCbx && !clienteHaContabilita) {
    const rateContCheck = document.getElementById("adp-rate-cont-completata");
    if (rateContCheck)
      rateContCheck.checked = parseInt(r.cont_completata) === 1;
    _aggiornaColoriRateContabilita(r);
  }

  // Rate: personalizza label
  if (isRate && !isCont && !isCbx) {
    let lb = ["Saldo", "1° Acconto", "2° Acconto"];
    try {
      if (r.rate_labels) lb = JSON.parse(r.rate_labels);
    } catch (e) {}
    setTxt("rate-l0", `💰 ${lb[0]} (€)`);
    setTxt("rate-l1", `📥 ${lb[1]} (€)`);
    setTxt("rate-l2", `📥 ${lb[2]} (€)`);
  }

  openModal("modal-adempimento");
}

// ─── COLORI CONTABILITÀ (blu=solo IVA, verde=IVA+cont) ────────
function _aggiornaColoriContabilita(r) {
  const contCheck = document.getElementById("adp-cont-completata");
  const contDone = contCheck
    ? contCheck.checked
    : parseInt(r?.cont_completata) === 1;
  const ivaVal = document.getElementById("adp-imp-iva")?.value;
  const hasIva = ivaVal != null && ivaVal !== "";

  // Se il cliente ha contabilità attiva, l'IVA compilata diventa verde
  const clienteHaContabilita = state.selectedCliente && state.selectedCliente.contabilita === 1;
  
  let vs = "none";
  if (hasIva && contDone && !clienteHaContabilita) vs = "both";
  else if (hasIva) vs = "iva";

  const colorIva =
    vs === "both" ? "var(--green)" : vs === "iva" ? (clienteHaContabilita ? "var(--green)" : "var(--accent)") : "";
  const colorCont = vs === "both" ? "var(--green)" : "";

  const ivaLabel = document.getElementById("label-imp-iva");
  const ivaInput = document.getElementById("adp-imp-iva");
  const contLabel = document.getElementById("label-imp-cont");
  const contCbxLabel = document.getElementById("label-cont-completata");

  if (ivaLabel) ivaLabel.style.color = colorIva;
  if (ivaInput)
    ivaInput.style.borderColor =
      vs !== "none" ? (vs === "both" ? "var(--green)" : (clienteHaContabilita ? "var(--green)" : "var(--accent)")) : "";
  if (contLabel) contLabel.style.color = colorCont;
  if (contCbxLabel)
    contCbxLabel.style.color =
      vs === "both" ? "var(--green)" : vs === "iva" ? "var(--text2)" : "";
}

function onContabilitaImportoChange() {
  _aggiornaColoriContabilita(null);
}

// ─── COLORI RATE + CONTABILITÀ (blu=uno solo, verde=entrambi) ─────
function _aggiornaColoriRateContabilita(r) {
  const rateContCheck = document.getElementById("adp-rate-cont-completata");
  const contDone = rateContCheck
    ? rateContCheck.checked
    : parseInt(r?.cont_completata) === 1;

  // Verifica se almeno una rata è compilata
  const saldoVal = document.getElementById("adp-imp-saldo")?.value;
  const acc1Val = document.getElementById("adp-imp-acc1")?.value;
  const acc2Val = document.getElementById("adp-imp-acc2")?.value;
  const hasRate =
    (saldoVal && saldoVal !== "") ||
    (acc1Val && acc1Val !== "") ||
    (acc2Val && acc2Val !== "");

  let color = "none";
  if (hasRate && contDone) color = "both";
  else if (hasRate || contDone) color = "one";

  const labelCont = document.getElementById("label-rate-cont");
  if (labelCont) {
    labelCont.style.color =
      color === "both"
        ? "var(--green)"
        : color === "one"
          ? "var(--accent)"
          : "";
  }
}

function onRateContabilitaChange() {
  _aggiornaColoriRateContabilita(null);
}

// ─── SALVA STATO ADEMPIMENTO ──────────────────────────────────
function saveAdpStato() {
  const id = parseInt(getVal("adp-id"));
  const isCont = getVal("adp-is-contabilita") === "1";
  const isRate = getVal("adp-has-rate") === "1";
  const isCbx = getVal("adp-is-checkbox") === "1";

  const data = {
    id,
    stato: getVal("adp-stato"),
    data_scadenza: getVal("adp-scadenza") || null,
    data_completamento: getVal("adp-data") || null,
    note: getVal("adp-note") || null,
    cont_completata: 0,
  };

  if (isCbx) {
    // Checkbox: nessun importo
  } else if (isCont) {
    data.importo_iva = parseFloat(getVal("adp-imp-iva")) || null;
    data.importo_contabilita = parseFloat(getVal("adp-imp-cont")) || null;
    data.cont_completata = document.getElementById("adp-cont-completata")
      ?.checked
      ? 1
      : 0;
  } else if (isRate) {
    data.importo_saldo = parseFloat(getVal("adp-imp-saldo")) || null;
    data.importo_acconto1 = parseFloat(getVal("adp-imp-acc1")) || null;
    data.importo_acconto2 = parseFloat(getVal("adp-imp-acc2")) || null;
    // Salva anche la checkbox della contabilità
    data.cont_completata = document.getElementById("adp-rate-cont-completata")
      ?.checked
      ? 1
      : 0;
  } else {
    data.importo = parseFloat(getVal("adp-importo")) || null;
  }

  socket.emit("update:adempimento_stato", data);
}

// ─── ELIMINA ADEMPIMENTO CLIENTE ──────────────────────────────
function deleteAdpCliente() {
  if (!confirm("Rimuovere questo adempimento dallo scadenzario?")) return;
  const id = parseInt(getVal("adp-id"));
  socket.emit("delete:adempimento_cliente", { id });
}
