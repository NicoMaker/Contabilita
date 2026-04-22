// ═══════════════════════════════════════════════════════════════
// ADEMPIMENTI.JS — Gestione definizioni adempimenti e modal stato
// ═══════════════════════════════════════════════════════════════

// ─── LISTA ADEMPIMENTI ────────────────────────────────────────
const applyAdempimentiFiltriSearch = debounce(() => {
  const q =
    document
      .getElementById("global-search-adempimenti")
      ?.value?.toLowerCase() || "";
  const cat = document.getElementById("filter-adp-cat")?.value || "";
  const filtered = state.adempimenti.filter((a) => {
    if (cat && a.categoria !== cat) return false;
    if (
      q &&
      !a.codice.toLowerCase().includes(q) &&
      !a.nome.toLowerCase().includes(q) &&
      !(a.categoria || "").toLowerCase().includes(q)
    )
      return false;
    return true;
  });
  renderAdempimentiTabella(filtered);
}, 300);

function resetAdempimentiFiltri() {
  const s = document.getElementById("global-search-adempimenti");
  const c = document.getElementById("filter-adp-cat");
  if (s) s.value = "";
  if (c) c.value = "";
  renderAdempimentiTabella(state.adempimenti);
}

function renderAdempimentiPage() {
  renderAdempimentiTabella(state.adempimenti);
}

function renderAdempimentiTabella(adempimenti) {
  const grouped = {};
  adempimenti.forEach((a) => {
    const cat = a.categoria || "ALTRI";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(a);
  });

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
    semestrale: "Scadenza semestrale (2 volte l'anno)",
    trimestrale: "Scadenza trimestrale (4 volte l'anno)",
    mensile: "Scadenza mensile (12 volte l'anno)",
  };

  // Counter totale
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

  html += `<div class="adp-def-grid">`;

  if (!adempimenti.length) {
    html += `<div class="empty"><div class="empty-icon">📋</div><p style="font-size:15px">Nessun adempimento trovato</p></div>`;
    html += `</div>`;
    document.getElementById("content").innerHTML = html;
    return;
  }

  Object.entries(grouped).forEach(([catCode, items]) => {
    const catInfo = CATEGORIE.find((x) => x.codice === catCode);
    const catColor = catInfo?.color || "#7c85a2";

    const cards = items
      .map((a) => {
        const flagsBadges = [];
        if (a.is_contabilita)
          flagsBadges.push(
            `<span class="adp-flag-badge" style="color:#22d3ee;background:#22d3ee15;border-color:#22d3ee33;font-size:11px" title="Adempimento di contabilità">📊 Cont.</span>`,
          );
        if (a.has_rate)
          flagsBadges.push(
            `<span class="adp-flag-badge" style="color:#34d399;background:#34d39915;border-color:#34d39933;font-size:11px" title="Adempimento con rate">💰 Rate</span>`,
          );

        return `<div class="adp-def-card" title="${escAttr(a.nome)} — ${a.categoria} — ${scadDesc[a.scadenza_tipo] || a.scadenza_tipo}">
        <div class="adp-def-card-top">
          <div class="adp-def-codice" style="font-size:13px" title="Codice identificativo">${a.codice}</div>
          <div style="display:flex;gap:5px">
            <button class="btn btn-xs btn-secondary" onclick="editAdpDef(${a.id})" title="Modifica">✏️</button>
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

    html += `<div class="adp-cat-group">
      <div class="adp-cat-header" style="border-left:3px solid ${catColor}">
        <span style="font-size:20px" title="${catInfo?.nome || catCode}">${catInfo?.icona || "📋"}</span>
        <span style="color:${catColor};font-weight:800;font-size:15px">${catCode}</span>
        ${catCode !== "TUTTI" ? `<span style="color:var(--text3);font-size:12px">${items.length} adempiment${items.length === 1 ? "o" : "i"}</span>` : ""}
      </div>
      <div class="adp-cat-cards">${cards}</div>
    </div>`;
  });

  html += `</div>`;
  document.getElementById("content").innerHTML = html;
}

// ─── MODAL ADEMPIMENTO DEF ────────────────────────────────────
function openNuovoAdpDef() {
  document.getElementById("modal-adp-def-title").textContent =
    "Nuovo Adempimento";
  document.getElementById("adp-def-id").value = "";
  document.getElementById("adp-def-codice").value = "";
  document.getElementById("adp-def-nome").value = "";
  document.getElementById("adp-def-desc").value = "";
  document.getElementById("adp-def-categoria").value = "TUTTI";
  document.getElementById("adp-def-scadenza").value = "annuale";
  document.getElementById("adp-def-contabilita").checked = false;
  document.getElementById("adp-def-rate").checked = false;
  document.getElementById("sect-rate-labels").style.display = "none";
  document.getElementById("adp-rate-l1").value = "Saldo";
  document.getElementById("adp-rate-l2").value = "1° Acconto";
  document.getElementById("adp-rate-l3").value = "2° Acconto";
  openModal("modal-adp-def");
}

function editAdpDef(id) {
  const a = state.adempimenti.find((x) => x.id === id);
  if (!a) return;
  document.getElementById("modal-adp-def-title").textContent =
    "Modifica Adempimento";
  document.getElementById("adp-def-id").value = a.id;
  document.getElementById("adp-def-codice").value = a.codice;
  document.getElementById("adp-def-nome").value = a.nome;
  document.getElementById("adp-def-desc").value = a.descrizione || "";
  document.getElementById("adp-def-categoria").value = a.categoria || "TUTTI";
  document.getElementById("adp-def-scadenza").value =
    a.scadenza_tipo || "annuale";
  document.getElementById("adp-def-contabilita").checked = !!a.is_contabilita;
  document.getElementById("adp-def-rate").checked = !!a.has_rate;
  let lb = ["Saldo", "1° Acconto", "2° Acconto"];
  try {
    if (a.rate_labels) lb = JSON.parse(a.rate_labels);
  } catch (e) {}
  document.getElementById("adp-rate-l1").value = lb[0] || "Saldo";
  document.getElementById("adp-rate-l2").value = lb[1] || "1° Acconto";
  document.getElementById("adp-rate-l3").value = lb[2] || "2° Acconto";
  onAdpFlagsChange();
  openModal("modal-adp-def");
}

function onAdpFlagsChange() {
  const isCont = document.getElementById("adp-def-contabilita").checked;
  const hasRate = document.getElementById("adp-def-rate").checked;
  if (isCont) document.getElementById("adp-def-rate").checked = false;
  if (hasRate) document.getElementById("adp-def-contabilita").checked = false;
  document.getElementById("sect-rate-labels").style.display = hasRate
    ? ""
    : "none";
}

function saveAdpDef() {
  const id = document.getElementById("adp-def-id").value;
  const codice = document
    .getElementById("adp-def-codice")
    .value.trim()
    .toUpperCase();
  const nome = document.getElementById("adp-def-nome").value.trim();
  if (!codice || !nome) {
    showNotif("Codice e nome sono obbligatori", "error");
    return;
  }
  const data = {
    codice,
    nome,
    descrizione: document.getElementById("adp-def-desc").value.trim() || null,
    categoria: document.getElementById("adp-def-categoria").value,
    scadenza_tipo: document.getElementById("adp-def-scadenza").value,
    is_contabilita: document.getElementById("adp-def-contabilita").checked
      ? 1
      : 0,
    has_rate: document.getElementById("adp-def-rate").checked ? 1 : 0,
  };
  if (data.has_rate)
    data.rate_labels = [
      document.getElementById("adp-rate-l1").value,
      document.getElementById("adp-rate-l2").value,
      document.getElementById("adp-rate-l3").value,
    ];
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
  document.getElementById("adp-id").value = r.id;
  document.getElementById("adp-nome-label").textContent =
    `${r.adempimento_nome} — ${getPeriodoLabel(r)}`;
  document.getElementById("adp-stato").value = r.stato || "da_fare";
  document.getElementById("adp-scadenza").value = r.data_scadenza || "";
  document.getElementById("adp-data").value = r.data_completamento || "";
  document.getElementById("adp-note").value = r.note || "";
  document.getElementById("adp-is-contabilita").value = r.is_contabilita || 0;
  document.getElementById("adp-has-rate").value = r.has_rate || 0;
  document.getElementById("adp-rate-labels-json").value = r.rate_labels || "";

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

  const isCont = isContabilita(r),
    isRate = hasRate(r);
  document.getElementById("sect-importo-normale").style.display =
    !isCont && !isRate ? "" : "none";
  document.getElementById("sect-importo-cont").style.display = isCont
    ? ""
    : "none";
  document.getElementById("sect-importo-rate").style.display =
    !isCont && isRate ? "" : "none";
  document.getElementById("adp-importo").value = r.importo || "";
  document.getElementById("adp-imp-iva").value = r.importo_iva || "";
  document.getElementById("adp-imp-cont").value = r.importo_contabilita || "";
  document.getElementById("adp-imp-saldo").value = r.importo_saldo || "";
  document.getElementById("adp-imp-acc1").value = r.importo_acconto1 || "";
  document.getElementById("adp-imp-acc2").value = r.importo_acconto2 || "";

  if (isRate) {
    let lb = ["Saldo", "1° Acconto", "2° Acconto"];
    try {
      if (r.rate_labels) lb = JSON.parse(r.rate_labels);
    } catch (e) {}
    document.getElementById("rate-l0").textContent = `💰 ${lb[0]} (€)`;
    document.getElementById("rate-l1").textContent = `📥 ${lb[1]} (€)`;
    document.getElementById("rate-l2").textContent = `📥 ${lb[2]} (€)`;
  }
  openModal("modal-adempimento");
}

function saveAdpStato() {
  const id = parseInt(document.getElementById("adp-id").value);
  const isCont = document.getElementById("adp-is-contabilita").value === "1";
  const isRate = document.getElementById("adp-has-rate").value === "1";
  const data = {
    id,
    stato: document.getElementById("adp-stato").value,
    data_scadenza: document.getElementById("adp-scadenza").value || null,
    data_completamento: document.getElementById("adp-data").value || null,
    note: document.getElementById("adp-note").value || null,
  };
  if (isCont) {
    data.importo_iva =
      parseFloat(document.getElementById("adp-imp-iva").value) || null;
    data.importo_contabilita =
      parseFloat(document.getElementById("adp-imp-cont").value) || null;
  } else if (isRate) {
    data.importo_saldo =
      parseFloat(document.getElementById("adp-imp-saldo").value) || null;
    data.importo_acconto1 =
      parseFloat(document.getElementById("adp-imp-acc1").value) || null;
    data.importo_acconto2 =
      parseFloat(document.getElementById("adp-imp-acc2").value) || null;
  } else {
    data.importo =
      parseFloat(document.getElementById("adp-importo").value) || null;
  }
  socket.emit("update:adempimento_stato", data);
}

function deleteAdpCliente() {
  if (!confirm("Rimuovere questo adempimento dallo scadenzario?")) return;
  const id = parseInt(document.getElementById("adp-id").value);
  socket.emit("delete:adempimento_cliente", { id });
}
