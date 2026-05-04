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

  // ── Ordine alfabetico per nome ─────────────────────────────
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
  // NOTA: #adp-def-categoria rimosso — non presente nell'HTML del modal
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
  // NOTA: #adp-def-categoria rimosso — non presente nell'HTML del modal
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
    // categoria rimossa: campo non presente nel modal HTML
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

  // ── Visibilità sezioni importo ─────────────────────────────
  setDisplay(
    "sect-importo-normale",
    !isCont && !isRate && !isCbx ? "" : "none",
  );
  setDisplay("sect-importo-cont", isCont && !isCbx ? "" : "none");
  setDisplay("sect-importo-rate", isRate && !isCbx ? "" : "none");
  setDisplay("sect-importo-checkbox", isCbx ? "" : "none");

  setVal("adp-importo", formattaNumeroItaliano(r.importo));
  setVal("adp-imp-iva", formattaNumeroItaliano(r.importo_iva));
  setVal("adp-imp-cont", formattaNumeroItaliano(r.importo_contabilita));
  setVal("adp-imp-saldo", formattaNumeroItaliano(r.importo_saldo));
  setVal("adp-imp-acc1", formattaNumeroItaliano(r.importo_acconto1));
  setVal("adp-imp-acc2", formattaNumeroItaliano(r.importo_acconto2));

  // ── Colora subito tutti gli input importo all'apertura ────
  [
    "adp-importo",
    "adp-imp-iva",
    "adp-imp-cont",
    "adp-imp-saldo",
    "adp-imp-acc1",
    "adp-imp-acc2",
  ].forEach((id) => {
    coloraInputImporto(document.getElementById(id));
  });

  // ── Checkbox contabilità: SOLO per adempimenti con RATE ───
  const rateContWrapper = document.getElementById(
    "rate-contabilita-checkbox-wrapper",
  );
  if (rateContWrapper) {
    rateContWrapper.style.display = isRate && !isCbx ? "" : "none";
  }

  // ── Checkbox contabilità: MOSTRIAMO per adempimenti contabilità puri
  const contCheckWrapper = document.getElementById(
    "contabilita-checkbox-wrapper",
  );
  if (contCheckWrapper) {
    contCheckWrapper.style.display = isCont && !isCbx ? "" : "none";
  }

  // ── Impostazione valori rate + contabilità ─────────────────
  if (isRate && !isCbx) {
    const rateContCheck = document.getElementById("adp-rate-cont-completata");
    if (rateContCheck)
      rateContCheck.checked = parseInt(r.cont_completata) === 1;
    _aggiornaColoriRateContabilita(r);
  }

  // ── Impostazione valori contabilità pura ──────────────────
  if (isCont && !isCbx) {
    const contCheck = document.getElementById("adp-cont-completata");
    if (contCheck) contCheck.checked = parseInt(r.cont_completata) === 1;
    _aggiornaColoriContabilita(r);
  }

  // ── Rate: personalizza label ───────────────────────────────
  if (isRate && !isCont && !isCbx) {
    let lb = ["Saldo", "1° Acconto", "2° Acconto"];
    try {
      if (r.rate_labels) lb = JSON.parse(r.rate_labels);
    } catch (e) {}
    setTxt("rate-l0", `💰 ${lb[0]} (€)`);
    setTxt("rate-l1", `📥 ${lb[1]} (€)`);
    setTxt("rate-l2", `📥 ${lb[2]} (€)`);
  }

  // ── Checkbox: aggiorna UI pulsanti ─────────────────────────
  if (isCbx) {
    _aggiornaPulsantiCheckbox(r.stato || "da_fare");
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

  let colorIva = "";
  let colorCont = "";

  if (hasIva && contDone) {
    colorIva = colorCont = "var(--green)";
  } else if (hasIva || contDone) {
    colorIva = colorCont = "var(--accent)";
  }

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

// ─── COLORAZIONE INPUT IN BASE AL SEGNO ──────────────────────
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

// ─── FORMATTAZIONE NUMERO IN FORMATO ITALIANO ────────────────
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

// ─── FORMATTA NUMERO CON COLORE PER DISPLAY ──────────────────
function formattaNumeroConColore(valore, elemento) {
  if (valore === null || valore === undefined || valore === "") {
    if (elemento) {
      elemento.textContent = "";
      elemento.style.color = "";
    }
    return "";
  }
  const _sc = String(valore);
  const numero = parseFloat(
    _sc.includes(",") ? _sc.replace(/\./g, "").replace(",", ".") : _sc,
  );
  if (isNaN(numero)) {
    if (elemento) {
      elemento.textContent = valore;
      elemento.style.color = "";
    }
    return valore;
  }
  const formattato = formattaNumeroItaliano(numero);
  if (elemento) {
    elemento.textContent = formattato;
    elemento.style.color = numero < 0 ? "var(--red)" : "var(--green)";
  }
  return formattato;
}

// ─── HELPER: converte stringa italiana in numero JS ──────────
function parseItalianoFloat(str) {
  if (str === null || str === undefined || str === "") return null;
  const n = parseFloat(String(str).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// ─── FORMATTA INPUT NUMERICO CON SEPARATORI MIGLIAIA ─────────
function formattaInputConSeparatori(input) {
  if (!input) return;
  const raw = input.value;
  if (!raw) return;

  const posCursore = input.selectionStart;
  const lunghezzaOriginale = raw.length;

  const negativo = raw.startsWith("-");
  let pulito = raw.replace(/[^0-9,-]/g, "");

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

// ─── BLOCCA IL PUNTO NEGLI INPUT NUMERICI ────────────────────
function bloccaPuntoInput(e) {
  if (e.key === ".") e.preventDefault();
}

// ─── VALIDAZIONE INPUT NUMERICO ──────────────────────────────
function validaInputNumerico(input) {
  formattaInputConSeparatori(input);
  coloraInputImporto(input);
}

// ─── FORMATTAZIONE FINALE AL BLUR ────────────────────────────
function convertiVirgolaInPunto(input) {
  const raw = input.value.trim();
  if (!raw) {
    input.value = "";
    coloraInputImporto(input);
    return;
  }

  const negativo = raw.startsWith("-");
  let pulito = raw.replace(/[^0-9,-]/g, "");

  const parti = pulito.split(",");
  let intero = parti[0] || "0";
  let decimale =
    parti.length > 1 ? parti[1].substring(0, 2).padEnd(2, "0") : "00";

  intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  input.value = (negativo ? "-" : "") + intero + "," + decimale;
  coloraInputImporto(input);
}

// ─── COLORI RATE + CONTABILITÀ ────────────────────────────────
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
  ["adp-imp-saldo", "adp-imp-acc1", "adp-imp-acc2"].forEach((id) => {
    coloraInputImporto(document.getElementById(id));
  });
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
    // Checkbox: nessun importo, stato già in data.stato
  } else if (isCont) {
    data.importo_iva = parseItalianoFloat(getVal("adp-imp-iva"));
    data.importo_contabilita = parseItalianoFloat(getVal("adp-imp-cont"));
    data.cont_completata = document.getElementById("adp-cont-completata")
      ?.checked
      ? 1
      : 0;
  } else if (isRate) {
    data.importo_saldo = parseItalianoFloat(getVal("adp-imp-saldo"));
    data.importo_acconto1 = parseItalianoFloat(getVal("adp-imp-acc1"));
    data.importo_acconto2 = parseItalianoFloat(getVal("adp-imp-acc2"));
    data.cont_completata = document.getElementById("adp-rate-cont-completata")
      ?.checked
      ? 1
      : 0;
  } else {
    data.importo = parseItalianoFloat(getVal("adp-importo"));
  }

  socket.emit("update:adempimento_stato", data);
}

// ─── ELIMINA ADEMPIMENTO CLIENTE ──────────────────────────────
function deleteAdpCliente() {
  if (!confirm("Rimuovere questo adempimento dallo scadenzario?")) return;
  const id = parseInt(getVal("adp-id"));
  socket.emit("delete:adempimento_cliente", { id });
}

// ─── VALIDAZIONE INPUT NUMERICO (PERMETTE NEGATIVI) ──────────────
function validaInputNumerico(input) {
  let value = input.value;
  if (!value) {
    coloraInputImporto(input);
    return;
  }
  
  // Permetti il segno meno all'inizio
  let negativo = false;
  if (value.startsWith("-")) {
    negativo = true;
    value = value.substring(1);
  }
  
  // Sostituisci virgole con punti
  value = value.replace(/,/g, ".");
  
  // Rimuovi tutto tranne numeri e punto
  value = value.replace(/[^0-9.]/g, "");
  
  // Assicura un solo punto decimale
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  
  // Riaggiungi il segno meno se necessario e se c'è un numero
  if (negativo && value !== "") {
    value = "-" + value;
  }
  
  input.value = value;
  coloraInputImporto(input);
}

// ─── FORMATTAZIONE FINALE AL BLUR (CONVERTI VIRGOLA IN PUNTO E FORMATTA) ──
function convertiVirgolaInPunto(input) {
  let raw = input.value.trim();
  if (!raw || raw === "-") {
    input.value = "";
    coloraInputImporto(input);
    return;
  }

  // Gestisci il segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }

  // Sostituisci virgole con punti e rimuovi caratteri non numerici tranne punto
  let pulito = raw.replace(/,/g, ".");
  pulito = pulito.replace(/[^0-9.]/g, "");
  
  const parti = pulito.split(".");
  let intero = parti[0] || "0";
  let decimale = parti.length > 1 ? parti[1].substring(0, 2).padEnd(2, "0") : "00";
  
  // Rimuovi zeri non significativi dall'intero per evitare "000" → "0"
  intero = intero.replace(/^0+/, "");
  if (intero === "") intero = "0";
  
  // Formatta l'intero con i separatori delle migliaia
  intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  // Ricostruisci il valore
  let risultato = intero + "," + decimale;
  if (negativo && parseFloat(intero.replace(/\./g, "")) > 0) {
    risultato = "-" + risultato;
  }
  
  input.value = risultato;
  coloraInputImporto(input);
}

// ─── FORMATTA INPUT CON SEPARATORI MIGLIAIA (DURANTE DIGITAZIONE) ─────
function formattaInputConSeparatori(input) {
  let raw = input.value;
  if (!raw) return;
  
  // Salva posizione cursore
  const posCursore = input.selectionStart;
  const lunghezzaOriginale = raw.length;
  
  // Gestisci segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }
  
  // Pulisci: rimuovi tutto tranne numeri e virgola/punto
  let pulito = raw.replace(/[^0-9,.]/g, "");
  
  // Sostituisci virgole con punti per parsing
  pulito = pulito.replace(/,/g, ".");
  
  const parti = pulito.split(".");
  let intero = parti[0];
  let decimale = parti.length > 1 ? parti[1].substring(0, 2) : null;
  
  // Rimuovi zeri non significativi dall'intero
  intero = intero.replace(/^0+/, "");
  if (intero === "") intero = "0";
  
  // Formatta intero con separatori migliaia
  intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  let formattato = negativo ? "-" + intero : intero;
  if (decimale !== null) {
    formattato += "," + decimale;
  }
  
  if (raw !== formattato) {
    input.value = formattato;
    // Aggiusta posizione cursore
    const delta = formattato.length - lunghezzaOriginale;
    const nuovaPos = Math.max(0, posCursore + delta);
    try {
      input.setSelectionRange(nuovaPos, nuovaPos);
    } catch (e) {}
  }
}

// ─── BLOCCA PUNTO (non blocca il segno meno) ─────────────────────
function bloccaPuntoInput(e) {
  // Permetti il segno meno
  if (e.key === ".") {
    e.preventDefault();
  }
  // Permetti il segno meno solo all'inizio
  if (e.key === "-") {
    const input = e.target;
    if (input.selectionStart !== 0 || input.value.includes("-")) {
      e.preventDefault();
    }
  }
}

// ─── COLORAZIONE INPUT IN BASE AL SEGNO ──────────────────────
function coloraInputImporto(input) {
  if (!input) return;
  let raw = input.value;
  if (!raw) {
    input.style.color = "";
    input.style.borderColor = "";
    return;
  }
  
  // Gestisci il segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }
  
  // Converti formato italiano in numero
  let normalized = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  
  if (isNaN(num)) {
    input.style.color = "";
    input.style.borderColor = "";
  } else if (negativo || num < 0) {
    input.style.color = "var(--red)";
    input.style.borderColor = "";
  } else {
    input.style.color = "var(--green)";
    input.style.borderColor = "";
  }
}

// ─── HELPER: converte stringa italiana in numero JS ──────────
function parseItalianoFloat(str) {
  if (str === null || str === undefined || str === "") return null;
  // Gestisci il segno meno
  let negativo = false;
  let cleanStr = String(str);
  if (cleanStr.startsWith("-")) {
    negativo = true;
    cleanStr = cleanStr.substring(1);
  }
  // Sostituisci punto migliaia e virgola decimale
  const numStr = cleanStr.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(numStr);
  if (isNaN(num)) return null;
  return negativo ? -num : num;
}

// ─── VALIDAZIONE INPUT NUMERICO (PERMETTE NEGATIVI) ──────────────
function validaInputNumerico(input) {
  let value = input.value;
  if (!value) {
    coloraInputImporto(input);
    return;
  }
  
  // Permetti il segno meno all'inizio
  let negativo = false;
  if (value.startsWith("-")) {
    negativo = true;
    value = value.substring(1);
  }
  
  // Sostituisci virgole con punti
  value = value.replace(/,/g, ".");
  
  // Rimuovi tutto tranne numeri e punto
  value = value.replace(/[^0-9.]/g, "");
  
  // Assicura un solo punto decimale
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  
  // Riaggiungi il segno meno se necessario e se c'è un numero
  if (negativo && value !== "" && value !== ".") {
    value = "-" + value;
  }
  
  input.value = value;
  coloraInputImporto(input);
}

// ─── FORMATTAZIONE FINALE AL BLUR ────────────────────────────
function convertiVirgolaInPunto(input) {
  let raw = input.value.trim();
  if (!raw || raw === "-") {
    input.value = "";
    coloraInputImporto(input);
    return;
  }

  // Gestisci il segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }

  // Sostituisci virgole con punti e rimuovi caratteri non numerici tranne punto
  let pulito = raw.replace(/,/g, ".");
  pulito = pulito.replace(/[^0-9.]/g, "");
  
  if (!pulito || pulito === ".") {
    input.value = "";
    coloraInputImporto(input);
    return;
  }
  
  const parti = pulito.split(".");
  let intero = parti[0] || "0";
  let decimale = parti.length > 1 ? parti[1].substring(0, 2).padEnd(2, "0") : "00";
  
  // Rimuovi zeri non significativi dall'intero
  intero = intero.replace(/^0+/, "");
  if (intero === "") intero = "0";
  
  // Formatta l'intero con i separatori delle migliaia
  intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  // Ricostruisci il valore
  let risultato = intero + "," + decimale;
  if (negativo) {
    risultato = "-" + risultato;
  }
  
  input.value = risultato;
  coloraInputImporto(input);
}

// ─── FORMATTA INPUT CON SEPARATORI MIGLIAIA ──────────────────
function formattaInputConSeparatori(input) {
  let raw = input.value;
  if (!raw) return;
  
  // Salva posizione cursore
  const posCursore = input.selectionStart;
  const lunghezzaOriginale = raw.length;
  
  // Gestisci segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }
  
  // Pulisci: rimuovi tutto tranne numeri e virgola/punto
  let pulito = raw.replace(/[^0-9,.]/g, "");
  
  // Sostituisci virgole con punti per parsing
  pulito = pulito.replace(/,/g, ".");
  
  if (!pulito || pulito === ".") {
    return;
  }
  
  const parti = pulito.split(".");
  let intero = parti[0];
  let decimale = parti.length > 1 ? parti[1].substring(0, 2) : null;
  
  // Rimuovi zeri non significativi dall'intero
  intero = intero.replace(/^0+/, "");
  if (intero === "") intero = "0";
  
  // Formatta intero con separatori migliaia
  intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  
  let formattato = negativo ? "-" + intero : intero;
  if (decimale !== null && decimale !== "") {
    formattato += "," + decimale;
  }
  
  if (raw !== formattato) {
    input.value = formattato;
    // Aggiusta posizione cursore
    const delta = formattato.length - lunghezzaOriginale;
    const nuovaPos = Math.max(0, posCursore + delta);
    try {
      input.setSelectionRange(nuovaPos, nuovaPos);
    } catch (e) {}
  }
}

// ─── BLOCCA PUNTO (NON BLOCCA IL SEGNO MENO) ─────────────────
function bloccaPuntoInput(e) {
  // Permetti il segno meno
  if (e.key === "-") {
    const input = e.target;
    // Permetti il meno solo se è all'inizio e non c'è già un meno
    if (input.selectionStart !== 0 || input.value.includes("-")) {
      e.preventDefault();
    }
    return;
  }
  // Blocca il punto (virgola già gestita separatamente)
  if (e.key === ".") {
    e.preventDefault();
  }
}

// ─── COLORAZIONE INPUT IN BASE AL SEGNO ──────────────────────
function coloraInputImporto(input) {
  if (!input) return;
  let raw = input.value;
  if (!raw) {
    input.style.color = "";
    input.style.borderColor = "";
    return;
  }
  
  // Gestisci il segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }
  
  // Se dopo il meno non c'è niente, non colorare
  if (!raw) {
    input.style.color = "";
    input.style.borderColor = "";
    return;
  }
  
  // Converti formato italiano in numero
  let normalized = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  
  if (isNaN(num)) {
    input.style.color = "";
    input.style.borderColor = "";
  } else if (negativo) {
    input.style.color = "var(--red)";
    input.style.borderColor = "";
  } else {
    input.style.color = "var(--green)";
    input.style.borderColor = "";
  }
}

// ─── HELPER: converte stringa italiana in numero JS ──────────
function parseItalianoFloat(str) {
  if (str === null || str === undefined || str === "") return null;
  // Gestisci il segno meno
  let negativo = false;
  let cleanStr = String(str).trim();
  if (cleanStr.startsWith("-")) {
    negativo = true;
    cleanStr = cleanStr.substring(1);
  }
  // Se dopo il meno non c'è niente, restituisci null
  if (!cleanStr) return null;
  // Sostituisci punto migliaia e virgola decimale
  const numStr = cleanStr.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(numStr);
  if (isNaN(num)) return null;
  return negativo ? -num : num;
}

// ─── BLOCCA PUNTO MA PERMETTE IL SEGNO MENO ─────────────────────
function bloccaPuntoInput(e) {
  // Permetti il segno meno (deve poterlo scrivere)
  if (e.key === "-") {
    const input = e.target;
    // Permetti il meno solo se è all'inizio (posizione 0) e non c'è già un meno
    if (input.selectionStart !== 0 || input.value.includes("-")) {
      e.preventDefault();
    }
    return; // Non bloccare il meno
  }
  
  // Blocca il punto (usa la virgola come separatore decimale)
  if (e.key === ".") {
    e.preventDefault();
  }
}

// ─── VALIDAZIONE INPUT NUMERICO (PERMETTE NEGATIVI) ──────────────
function validaInputNumerico(input) {
  let value = input.value;
  if (!value) {
    coloraInputImporto(input);
    return;
  }
  
  // Permetti il segno meno all'inizio
  let negativo = false;
  if (value.startsWith("-")) {
    negativo = true;
    value = value.substring(1);
  }
  
  // Sostituisci virgole con punti
  value = value.replace(/,/g, ".");
  
  // Rimuovi tutto tranne numeri e punto
  value = value.replace(/[^0-9.]/g, "");
  
  // Assicura un solo punto decimale
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  
  // Riaggiungi il segno meno se necessario e se c'è un numero
  if (negativo && value !== "" && value !== "." && value !== "0") {
    value = "-" + value;
  }
  
  input.value = value;
  coloraInputImporto(input);
}

// ─── FORMATTAZIONE FINALE AL BLUR ────────────────────────────
function convertiVirgolaInPunto(input) {
  let raw = input.value.trim();
  if (!raw || raw === "-") {
    input.value = "";
    coloraInputImporto(input);
    return;
  }

  // Gestisci il segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }
  
  // Se dopo il meno non c'è niente
  if (!raw) {
    input.value = "";
    coloraInputImporto(input);
    return;
  }

  // Sostituisci virgole con punti e rimuovi caratteri non numerici tranne punto
  let pulito = raw.replace(/,/g, ".");
  pulito = pulito.replace(/[^0-9.]/g, "");
  
  if (!pulito || pulito === ".") {
    input.value = "";
    coloraInputImporto(input);
    return;
  }
  
  const parti = pulito.split(".");
  let intero = parti[0] || "0";
  let decimale = parti.length > 1 ? parti[1].substring(0, 2).padEnd(2, "0") : "00";
  
  // Rimuovi zeri non significativi dall'intero
  intero = intero.replace(/^0+/, "");
  if (intero === "") intero = "0";
  
  // Formatta l'intero con i separatori delle migliaia (SOLO se è lungo > 3)
  if (intero.length > 3) {
    intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  
  // Ricostruisci il valore
  let risultato = intero + "," + decimale;
  if (negativo && parseFloat(intero.replace(/\./g, "")) !== 0) {
    risultato = "-" + risultato;
  }
  
  input.value = risultato;
  coloraInputImporto(input);
}

// ─── FORMATTA INPUT CON SEPARATORI MIGLIAIA ──────────────────
function formattaInputConSeparatori(input) {
  let raw = input.value;
  if (!raw) return;
  
  // Salva posizione cursore
  const posCursore = input.selectionStart;
  const lunghezzaOriginale = raw.length;
  
  // Gestisci segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }
  
  // Se c'è solo il meno, non formattare
  if (!raw) return;
  
  // Pulisci: rimuovi tutto tranne numeri e virgola/punto
  let pulito = raw.replace(/[^0-9,.]/g, "");
  
  // Sostituisci virgole con punti per parsing
  pulito = pulito.replace(/,/g, ".");
  
  if (!pulito || pulito === ".") {
    return;
  }
  
  const parti = pulito.split(".");
  let intero = parti[0];
  let decimale = parti.length > 1 ? parti[1].substring(0, 2) : null;
  
  // Rimuovi zeri non significativi dall'intero
  intero = intero.replace(/^0+/, "");
  if (intero === "") intero = "0";
  
  // Formatta intero con separatori migliaia
  if (intero.length > 3) {
    intero = intero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  }
  
  let formattato = negativo ? "-" + intero : intero;
  if (decimale !== null && decimale !== "") {
    formattato += "," + decimale;
  }
  
  if (raw !== formattato) {
    input.value = formattato;
    // Aggiusta posizione cursore
    const delta = formattato.length - lunghezzaOriginale;
    const nuovaPos = Math.max(0, posCursore + delta);
    try {
      input.setSelectionRange(nuovaPos, nuovaPos);
    } catch (e) {}
  }
}

// ─── COLORAZIONE INPUT IN BASE AL SEGNO ──────────────────────
function coloraInputImporto(input) {
  if (!input) return;
  let raw = input.value;
  if (!raw) {
    input.style.color = "";
    input.style.borderColor = "";
    return;
  }
  
  // Gestisci il segno meno
  let negativo = false;
  if (raw.startsWith("-")) {
    negativo = true;
    raw = raw.substring(1);
  }
  
  // Se dopo il meno non c'è niente, non colorare
  if (!raw) {
    input.style.color = "";
    input.style.borderColor = "";
    return;
  }
  
  // Converti formato italiano in numero
  let normalized = raw.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalized);
  
  if (isNaN(num)) {
    input.style.color = "";
    input.style.borderColor = "";
  } else if (negativo) {
    input.style.color = "var(--red)";
  } else {
    input.style.color = "var(--green)";
  }
}

// ─── HELPER: converte stringa italiana in numero JS ──────────
function parseItalianoFloat(str) {
  if (str === null || str === undefined || str === "") return null;
  // Gestisci il segno meno
  let negativo = false;
  let cleanStr = String(str).trim();
  if (cleanStr.startsWith("-")) {
    negativo = true;
    cleanStr = cleanStr.substring(1);
  }
  // Se dopo il meno non c'è niente, restituisci null
  if (!cleanStr) return null;
  // Sostituisci punto migliaia e virgola decimale
  const numStr = cleanStr.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(numStr);
  if (isNaN(num)) return null;
  return negativo ? -num : num;
}