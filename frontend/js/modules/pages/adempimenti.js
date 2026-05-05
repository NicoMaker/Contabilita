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

// ─── HELPERS PER TIPO ─────────────────────────────────────────
function isContabilita(r) {
  return parseInt(r.is_contabilita) === 1 || r.is_contabilita === true;
}
function hasRate(r) {
  return parseInt(r.has_rate) === 1 || r.has_rate === true;
}
function isCheckbox(r) {
  return parseInt(r.is_checkbox) === 1 || r.is_checkbox === true;
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
      ${isFiltrato ? `<span style="color:var(--yellow)">⚠️ Filtro attivo:</span> ${totAdp} di ${totAll} adempimenti` : `<span style="color:var(--text3)">${totAll} adempimenti totali</span>`}
    </span>
    ${isFiltrato ? `<button class="btn btn-sm btn-primary" onclick="resetAdempimentiFiltri()" style="font-size:12px">⟳ Tutti</button>` : ""}
  </div>`;

  const adempimentiOrdinati = [...adempimenti].sort((a, b) =>
    a.nome.localeCompare(b.nome, "it", { sensitivity: "base" }),
  );

  const cards = adempimentiOrdinati
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
      if (!a.is_contabilita && !a.has_rate && !a.is_checkbox)
        flagsBadges.push(
          `<span class="adp-flag-badge" style="color:#5b8df6;background:#5b8df615;border-color:#5b8df633;font-size:11px" title="Solo data scadenza">📅 Solo Scad.</span>`,
        );

      return `<div class="adp-def-card" title="${escAttr(a.nome)} — ${scadDesc[a.scadenza_tipo] || a.scadenza_tipo}">
      <div class="adp-def-card-top">
        <div class="adp-def-codice" style="font-size:13px">${a.codice}</div>
        <div style="display:flex;gap:5px">
          <button class="btn btn-xs btn-secondary" onclick="editAdpDef(${a.id})" title="Modifica">✏️</button>
          <button class="btn btn-xs btn-danger" onclick="deleteAdpDef(${a.id})" title="Elimina">🗑️</button>
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
  setVal("adp-def-scadenza", "annuale");

  const sempliceRadio = document.getElementById("adp-def-semplice");
  const contRadio = document.getElementById("adp-def-contabilita");
  const rateRadio = document.getElementById("adp-def-rate");
  const checkRadio = document.getElementById("adp-def-checkbox");

  if (sempliceRadio) sempliceRadio.checked = true;
  if (contRadio) contRadio.checked = false;
  if (rateRadio) rateRadio.checked = false;
  if (checkRadio) checkRadio.checked = false;

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
  setVal("adp-def-scadenza", a.scadenza_tipo || "annuale");

  const isCont = a.is_contabilita === 1;
  const isRate = a.has_rate === 1;
  const isCheck = a.is_checkbox === 1;

  const sempliceRadio = document.getElementById("adp-def-semplice");
  const contRadio = document.getElementById("adp-def-contabilita");
  const rateRadio = document.getElementById("adp-def-rate");
  const checkRadio = document.getElementById("adp-def-checkbox");

  if (isCont && contRadio) {
    contRadio.checked = true;
    if (sempliceRadio) sempliceRadio.checked = false;
    if (rateRadio) rateRadio.checked = false;
    if (checkRadio) checkRadio.checked = false;
  } else if (isRate && rateRadio) {
    rateRadio.checked = true;
    if (sempliceRadio) sempliceRadio.checked = false;
    if (contRadio) contRadio.checked = false;
    if (checkRadio) checkRadio.checked = false;
  } else if (isCheck && checkRadio) {
    checkRadio.checked = true;
    if (sempliceRadio) sempliceRadio.checked = false;
    if (contRadio) contRadio.checked = false;
    if (rateRadio) rateRadio.checked = false;
  } else {
    if (sempliceRadio) sempliceRadio.checked = true;
    if (contRadio) contRadio.checked = false;
    if (rateRadio) rateRadio.checked = false;
    if (checkRadio) checkRadio.checked = false;
  }

  let lb = ["Saldo", "1° Acconto", "2° Acconto"];
  try {
    if (a.rate_labels) lb = JSON.parse(a.rate_labels);
  } catch (e) {}
  setVal("adp-rate-l1", lb[0] || "Saldo");
  setVal("adp-rate-l2", lb[1] || "1° Acconto");
  setVal("adp-rate-l3", lb[2] || "2° Acconto");

  onAdpTipoChange();
  openModal("modal-adp-def");
}

function onAdpTipoChange() {
  const isRate = document.getElementById("adp-def-rate")?.checked || false;
  setDisplay("sect-rate-labels", isRate ? "" : "none");
}

function saveAdpDef() {
  const id = getVal("adp-def-id");
  const codice = String(getVal("adp-def-codice")).trim().toUpperCase();
  const nome = String(getVal("adp-def-nome")).trim();
  if (!codice || !nome) {
    showNotif("Codice e nome sono obbligatori", "error");
    return;
  }

  const isSemplice =
    document.getElementById("adp-def-semplice")?.checked || false;
  const isCont =
    document.getElementById("adp-def-contabilita")?.checked || false;
  const isRate = document.getElementById("adp-def-rate")?.checked || false;
  const isCheck = document.getElementById("adp-def-checkbox")?.checked || false;

  const data = {
    codice,
    nome,
    descrizione: String(getVal("adp-def-desc")).trim() || null,
    scadenza_tipo: getVal("adp-def-scadenza"),
    is_contabilita: 0,
    has_rate: 0,
    is_checkbox: 0,
  };

  if (isCont) {
    data.is_contabilita = 1;
  } else if (isRate) {
    data.has_rate = 1;
  } else if (isCheck) {
    data.is_checkbox = 1;
  }

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
  setVal("adp-scadenza", formattaDataItaliana(r.data_scadenza) || "");
  setVal("adp-data", formattaDataItaliana(r.data_completamento) || "");
  setVal("adp-note", r.note || "");
  setVal("adp-is-contabilita", r.is_contabilita || 0);
  setVal("adp-has-rate", r.has_rate || 0);
  setVal("adp-is-checkbox", r.is_checkbox || 0);
  setVal("adp-rate-labels-json", r.rate_labels || "");

  setTimeout(() => {
    const campoScadenza = document.getElementById("adp-scadenza");
    const campoCompletamento = document.getElementById("adp-data");
    if (campoScadenza) {
      gestisciInputData(campoScadenza);
      creaDatePicker(campoScadenza);
    }
    if (campoCompletamento) {
      gestisciInputData(campoCompletamento);
      creaDatePicker(campoCompletamento);
    }
  }, 100);

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
  const isSemplice = !isCont && !isRate && !isCbx;

  // Nascondi DATA COMPLETAMENTO per tipo Semplice
  const dataCompletamentoGroup = document.getElementById(
    "data-completamento-group",
  );
  if (dataCompletamentoGroup) {
    dataCompletamentoGroup.style.display = isSemplice ? "none" : "";
  }

  // CHIUDI TUTTE LE SEZIONI prima di mostrarne una
  const sectNormale = document.getElementById("sect-importo-normale");
  const sectCont = document.getElementById("sect-importo-cont");
  const sectRate = document.getElementById("sect-importo-rate");
  const sectCheckbox = document.getElementById("sect-importo-checkbox");

  if (sectNormale) sectNormale.style.display = "none";
  if (sectCont) sectCont.style.display = "none";
  if (sectRate) sectRate.style.display = "none";
  if (sectCheckbox) sectCheckbox.style.display = "none";

  // Mostra la sezione corretta in base al tipo
  if (isCbx) {
    if (sectCheckbox) sectCheckbox.style.display = "block";
    _aggiornaPulsantiCheckbox(r.stato || "da_fare");
  } else if (isCont) {
    if (sectCont) sectCont.style.display = "block";
    setVal("adp-imp-iva", formattaNumeroItaliano(r.importo_iva));
    setVal("adp-imp-cont", formattaNumeroItaliano(r.importo_contabilita));
    const contCheck = document.getElementById("adp-cont-completata");
    if (contCheck) contCheck.checked = parseInt(r.cont_completata) === 1;
    _aggiornaColoriContabilita(r);
  } else if (isRate) {
    if (sectRate) sectRate.style.display = "block";
    setVal("adp-imp-saldo", formattaNumeroItaliano(r.importo_saldo));
    setVal("adp-imp-acc1", formattaNumeroItaliano(r.importo_acconto1));
    setVal("adp-imp-acc2", formattaNumeroItaliano(r.importo_acconto2));

    let lb = ["Saldo", "1° Acconto", "2° Acconto"];
    try {
      if (r.rate_labels) lb = JSON.parse(r.rate_labels);
    } catch (e) {}
    setTxt("rate-l0", `💰 ${lb[0]} (€)`);
    setTxt("rate-l1", `📥 ${lb[1]} (€)`);
    setTxt("rate-l2", `📥 ${lb[2]} (€)`);

    const rateContWrapper = document.getElementById(
      "rate-contabilita-checkbox-wrapper",
    );
    if (rateContWrapper) rateContWrapper.style.display = "";
    const rateContCheck = document.getElementById("adp-rate-cont-completata");
    if (rateContCheck)
      rateContCheck.checked = parseInt(r.cont_completata) === 1;
    _aggiornaColoriRateContabilita(r);
  } else if (isSemplice) {
    // Solo Scadenza: nessun importo, solo data scadenza
    if (sectNormale) sectNormale.style.display = "none";
    // Non mostrare importo
  }

  openModal("modal-adempimento");
}

// ─── CHECKBOX PILL UI ─────────────────────────────────────────
function _aggiornaPulsantiCheckbox(stato) {
  const btnDaFare = document.getElementById("cbx-modal-dafare");
  const btnNA = document.getElementById("cbx-modal-na");
  const btnCompl = document.getElementById("cbx-modal-completato");
  if (!btnDaFare || !btnNA || !btnCompl) return;

  [btnDaFare, btnNA, btnCompl].forEach((b) => {
    b.classList.remove(
      "cbx-modal-active-red",
      "cbx-modal-active-gray",
      "cbx-modal-active-green",
    );
    b.style.opacity = "0.5";
    b.style.transform = "scale(1)";
  });

  if (stato === "da_fare") {
    btnDaFare.classList.add("cbx-modal-active-red");
    btnDaFare.style.opacity = "1";
    btnDaFare.style.transform = "scale(1.05)";
  } else if (stato === "n_a") {
    btnNA.classList.add("cbx-modal-active-gray");
    btnNA.style.opacity = "1";
    btnNA.style.transform = "scale(1.05)";
  } else if (stato === "completato") {
    btnCompl.classList.add("cbx-modal-active-green");
    btnCompl.style.opacity = "1";
    btnCompl.style.transform = "scale(1.05)";
  }
}

function setCbxModalStato(nuovoStato) {
  setVal("adp-stato", nuovoStato);
  _aggiornaPulsantiCheckbox(nuovoStato);
}

// ─── COLORI CONTABILITÀ PURA ──────────────────────────────────
function _aggiornaColoriContabilita(r) {
  const ivaVal = document.getElementById("adp-imp-iva")?.value;
  const hasIva = ivaVal != null && ivaVal !== "";
  const contCheck = document.getElementById("adp-cont-completata");
  const contDone = contCheck
    ? contCheck.checked
    : parseInt(r?.cont_completata) === 1;

  let colorIva = "",
    colorCont = "";
  if (hasIva && contDone) colorIva = colorCont = "var(--green)";
  else if (hasIva || contDone) colorIva = colorCont = "var(--accent)";

  const ivaLabel = document.getElementById("label-imp-iva");
  const contLabel = document.getElementById("label-cont-completata");
  const contSpan = document.getElementById("label-imp-cont");
  if (ivaLabel) ivaLabel.style.color = colorIva;
  if (contLabel) contLabel.style.color = colorCont;
  if (contSpan) contSpan.style.color = colorCont;
}

function onContabilitaImportoChange() {
  _aggiornaColoriContabilita(null);
  coloraInputImporto(document.getElementById("adp-imp-iva"));
}

function coloraInputImporto(input) {
  if (!input) return;
  const raw = (input.value || "").replace(/\./g, "").replace(",", ".").trim();
  const num = parseFloat(raw);
  if (!input.value || isNaN(num)) {
    input.style.color = "";
    input.style.borderColor = "";
  } else if (num < 0) {
    input.style.color = "var(--red)";
    input.style.borderColor = "";
  } else {
    input.style.color = "var(--green)";
    input.style.borderColor = "";
  }
}

function formattaNumeroItaliano(valore) {
  if (valore === null || valore === undefined || valore === "") return "";
  const s = String(valore);
  const normalizzato = s.includes(",")
    ? s.replace(/\./g, "").replace(",", ".")
    : s;
  const numero = parseFloat(normalizzato);
  if (isNaN(numero)) return "";
  const negativo = numero < 0;
  const [intero, dec] = Math.abs(numero).toFixed(2).split(".");
  const interoFormattato = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const risultato = interoFormattato + "," + dec;
  return negativo ? "-" + risultato : risultato;
}

function parseItalianoFloat(str) {
  if (str === null || str === undefined || str === "") return null;
  const n = parseFloat(String(str).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

function formattaInputConSeparatori(input) {
  if (!input) return;
  const raw = input.value;
  if (!raw) return;
  const posCursore = input.selectionStart;
  const lunghezzaOriginale = raw.length;
  const negativo = raw.startsWith("-");
  let pulito = raw.replace(/\./g, "").replace(/[^0-9,-]/g, "");
  if (pulito.startsWith("-")) pulito = pulito.substring(1);
  const parti = pulito.split(",");
  let intero = parti[0];
  let decimale =
    parti.length > 1 ? parti.slice(1).join("").substring(0, 2) : null;
  intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  let formattato = negativo ? "-" + intero : intero;
  if (decimale !== null) formattato += "," + decimale;
  if (raw !== formattato) {
    input.value = formattato;
    const delta = formattato.length - lunghezzaOriginale;
    const nuovaPos = Math.max(0, posCursore + delta);
    try {
      input.setSelectionRange(nuovaPos, nuovaPos);
    } catch (e) {}
  }
}

function bloccaPuntoInput(e) {
  if (e.key === ".") {
    e.preventDefault();
    const input = e.target;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const val = input.value;
    if (!val.includes(",")) {
      input.value = val.substring(0, start) + "," + val.substring(end);
      input.setSelectionRange(start + 1, start + 1);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  if (e.key === "-") {
    const input = e.target;
    if (input.selectionStart !== 0 || input.value.includes("-")) {
      e.preventDefault();
    }
  }
}
function validaInputNumerico(input) {
  formattaInputConSeparatori(input);
  coloraInputImporto(input);
}

function convertiVirgolaInPunto(input) {
  const raw = input.value.trim();
  if (!raw || raw === "-") {
    input.value = "";
    coloraInputImporto(input);
    return;
  }
  const negativo = raw.startsWith("-");
  let pulito = raw.replace(/\./g, "").replace(/[^0-9,-]/g, "");
  if (pulito.startsWith("-")) pulito = pulito.substring(1);
  const parti = pulito.split(",");
  let intero = parti[0] || "0";
  let decimale =
    parti.length > 1 ? parti[1].substring(0, 2).padEnd(2, "0") : "00";
  intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  input.value = (negativo ? "-" : "") + intero + "," + decimale;
  coloraInputImporto(input);
}

function _aggiornaColoriRateContabilita(r) {
  const rateContCheck = document.getElementById("adp-rate-cont-completata");
  const contDone = rateContCheck
    ? rateContCheck.checked
    : parseInt(r?.cont_completata) === 1;
  const saldoVal = document.getElementById("adp-imp-saldo")?.value;
  const acc1Val = document.getElementById("adp-imp-acc1")?.value;
  const acc2Val = document.getElementById("adp-imp-acc2")?.value;
  const hasAnyRate =
    (saldoVal && saldoVal !== "") ||
    (acc1Val && acc1Val !== "") ||
    (acc2Val && acc2Val !== "");
  let color = "none";
  if (hasAnyRate && contDone) color = "both";
  else if (hasAnyRate || contDone) color = "one";
  const labelCont = document.getElementById("label-rate-cont");
  if (labelCont)
    labelCont.style.color =
      color === "both"
        ? "var(--green)"
        : color === "one"
          ? "var(--accent)"
          : "";
}

function onRateContabilitaChange() {
  _aggiornaColoriRateContabilita(null);
  ["adp-imp-saldo", "adp-imp-acc1", "adp-imp-acc2"].forEach((id) =>
    coloraInputImporto(document.getElementById(id)),
  );
}

function saveAdpStato() {
  const id = parseInt(getVal("adp-id"));
  const isCont = getVal("adp-is-contabilita") === "1";
  const isRate = getVal("adp-has-rate") === "1";
  const isCbx = getVal("adp-is-checkbox") === "1";
  const isSemplice = !isCont && !isRate && !isCbx;

  const data = {
    id,
    stato: getVal("adp-stato"),
    data_scadenza: daItalianaAISO(getVal("adp-scadenza")) || null,
    data_completamento: null,
    note: getVal("adp-note") || null,
    cont_completata: 0,
  };

  if (isCbx) {
    // Checkbox: nessun importo, solo stato
  } else if (isCont) {
    data.importo_iva = parseItalianoFloat(getVal("adp-imp-iva"));
    data.importo_contabilita = parseItalianoFloat(getVal("adp-imp-cont"));
    data.cont_completata = document.getElementById("adp-cont-completata")
      ?.checked
      ? 1
      : 0;
    if (data.stato === "completato")
      data.data_completamento =
        daItalianaAISO(getVal("adp-data")) || daItalianaAISO(oggiItaliano());
  } else if (isRate) {
    data.importo_saldo = parseItalianoFloat(getVal("adp-imp-saldo"));
    data.importo_acconto1 = parseItalianoFloat(getVal("adp-imp-acc1"));
    data.importo_acconto2 = parseItalianoFloat(getVal("adp-imp-acc2"));
    data.cont_completata = document.getElementById("adp-rate-cont-completata")
      ?.checked
      ? 1
      : 0;
    if (data.stato === "completato")
      data.data_completamento =
        daItalianaAISO(getVal("adp-data")) || daItalianaAISO(oggiItaliano());
  } else if (isSemplice) {
    // Solo Scadenza: nessun importo, nessuna data completamento
    data.importo = null;
    data.data_completamento = null;
  }

  socket.emit("update:adempimento_stato", data);
  closeModal("modal-adempimento");
}

function deleteAdpCliente() {
  if (!confirm("Rimuovere questo adempimento dallo scadenzario?")) return;
  const id = parseInt(getVal("adp-id"));
  socket.emit("delete:adempimento_cliente", { id });
}

// Esposizioni globali
window.openNuovoAdpDef = openNuovoAdpDef;
window.editAdpDef = editAdpDef;
window.deleteAdpDef = deleteAdpDef;
window.saveAdpDef = saveAdpDef;
window.onAdpTipoChange = onAdpTipoChange;
window.applyAdempimentiFiltriSearch = applyAdempimentiFiltriSearch;
window.resetAdempimentiFiltri = resetAdempimentiFiltri;
