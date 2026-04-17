const socket = io();
const MESI = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];
const TIPOLOGIE_CODICI = ["PF", "SP", "SC", "ASS"];
const STATI = {
  da_fare: "⭕ Da fare",
  in_corso: "🔄 In corso",
  completato: "✅ Completato",
  n_a: "➖ N/A",
};

let state = {
  page: "dashboard",
  tipologie: [],
  clienti: [],
  adempimenti: [],
  selectedCliente: null,
  anno: new Date().getFullYear(),
  filtri: { stato: "tutti", tipologia: "tutti", search: "", adempimento: "" },
  scadenzario: [],
  scadGlobale: [],
};

// ─── CONNESSIONE ──────────────────────────────────────────────────────────
socket.on("connect", () => {
  document.getElementById("conn-status").textContent = "● Online";
  document.getElementById("conn-status").style.color = "var(--green)";
  socket.emit("get:tipologie");
  renderPage("dashboard");
});
socket.on("disconnect", () => {
  document.getElementById("conn-status").textContent = "● Offline";
  document.getElementById("conn-status").style.color = "var(--red)";
});
socket.on("notify", ({ type, msg }) => showNotif(msg, type));

// ─── RISPOSTA TIPOLOGIE ───────────────────────────────────────────────────
socket.on("res:tipologie", ({ success, data }) => {
  if (success) {
    state.tipologie = data;
    populateTipologiaSelect();
    buildAdpDefTipologieChips();
  }
});

// ─── RISPOSTA CLIENTI ──────────────────────────────────────────────────────
socket.on("res:clienti", ({ success, data }) => {
  if (!success) return;
  state.clienti = data;
  if (state._pending === "clienti") {
    state._pending = null;
    renderClientiPage();
  }
  if (state._pending === "scadenzario") {
    state._pending = null;
    renderScadenzarioPage();
  }
});

// ─── RISPOSTA ADEMPIMENTI ─────────────────────────────────────────────────
socket.on("res:adempimenti", ({ success, data }) => {
  if (success) state.adempimenti = data;
  if (state._pending === "adempimenti") {
    state._pending = null;
    renderAdempimentiPage();
  }
});

// ─── RISPOSTA STATS ──────────────────────────────────────────────────────
socket.on("res:stats", ({ success, data }) => {
  if (success) renderDashboard(data);
});

// ─── RISPOSTA SCADENZARIO ─────────────────────────────────────────────────
socket.on("res:scadenzario", ({ success, data }) => {
  if (success) {
    state.scadenzario = data;
    renderScadenzarioTabella(data);
  }
});

socket.on("res:scadenzario_globale", ({ success, data }) => {
  if (success) {
    state.scadGlobale = data;
    renderGlobaleTabella(data);
  }
});

// ─── RISPOSTA CRUD CLIENTE ────────────────────────────────────────────────
socket.on("res:create:cliente", ({ success, id }) => {
  if (success) {
    closeModal("modal-cliente");
    state._pending = "clienti";
    socket.emit("get:clienti");
  }
});
socket.on("res:update:cliente", ({ success }) => {
  if (success) {
    closeModal("modal-cliente");
    refreshPage();
  }
});
socket.on("res:delete:cliente", ({ success }) => {
  if (success) refreshPage();
});

// ─── RISPOSTA CRUD ADEMPIMENTO DEF ────────────────────────────────────────
socket.on("res:create:adempimento", ({ success, error }) => {
  if (success) {
    closeModal("modal-adp-def");
    state._pending = "adempimenti";
    socket.emit("get:adempimenti");
  } else showNotif(error, "error");
});
socket.on("res:update:adempimento", ({ success, error }) => {
  if (success) {
    closeModal("modal-adp-def");
    state._pending = "adempimenti";
    socket.emit("get:adempimenti");
  } else showNotif(error, "error");
});
socket.on("res:delete:adempimento", ({ success }) => {
  if (success) {
    state._pending = "adempimenti";
    socket.emit("get:adempimenti");
  }
});

// ─── RISPOSTA SCADENZARIO OPS ────────────────────────────────────────────
socket.on("res:genera:scadenzario", ({ success }) => {
  if (success && state.selectedCliente) loadScadenzario();
});
socket.on("res:copia:scadenzario", ({ success }) => {
  if (success) {
    closeModal("modal-copia");
    loadScadenzario();
  }
});
socket.on("res:update:adempimento_stato", ({ success }) => {
  if (success) {
    closeModal("modal-adempimento");
    loadScadenzario();
  }
});
socket.on("res:delete:adempimento_cliente", ({ success }) => {
  if (success) {
    closeModal("modal-adempimento");
    loadScadenzario();
  }
});
socket.on("res:add:adempimento_cliente", ({ success }) => {
  if (success) {
    closeModal("modal-add-adp");
    loadScadenzario();
  }
});

// ─── NAVIGAZIONE ─────────────────────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach((el) => {
  el.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item")
      .forEach((x) => x.classList.remove("active"));
    el.classList.add("active");
    renderPage(el.dataset.page);
  });
});

function renderPage(page) {
  state.page = page;
  const titles = {
    dashboard: "Dashboard",
    clienti: "Clienti",
    scadenzario: "Scadenzario Cliente",
    scadenzario_globale: "Vista Globale",
    adempimenti: "Adempimenti Fiscali",
    tipologie: "Tipologie Cliente",
  };
  document.getElementById("page-title").textContent = titles[page] || page;

  if (page === "dashboard") {
    document.getElementById("topbar-actions").innerHTML = `
      <div class="year-sel">
        <button onclick="changeAnno(-1)">◀</button>
        <span class="year-num">${state.anno}</span>
        <button onclick="changeAnno(1)">▶</button>
      </div>
      <button class="btn btn-print btn-sm" onclick="printPage()">🖨️ Stampa</button>`;
    socket.emit("get:stats", { anno: state.anno });
  } else if (page === "clienti") {
    state._pending = "clienti";
    document.getElementById("topbar-actions").innerHTML = "";
    socket.emit("get:clienti");
  } else if (page === "scadenzario") {
    state._pending = "scadenzario";
    document.getElementById("topbar-actions").innerHTML = "";
    socket.emit("get:clienti");
  } else if (page === "scadenzario_globale") {
    renderGlobalePage();
  } else if (page === "adempimenti") {
    state._pending = "adempimenti";
    socket.emit("get:adempimenti");
  } else if (page === "tipologie") {
    document.getElementById("topbar-actions").innerHTML = "";
    renderTipologiePage();
  }
}

function refreshPage() {
  renderPage(state.page);
}
function changeAnno(d) {
  state.anno += d;
  refreshPage();
}

// ─── PRINT ───────────────────────────────────────────────────────────────
function printPage() {
  window.print();
}

function printScadenzario(nomeCliente, anno) {
  const ph = document.getElementById("print-header-ph");
  if (ph) {
    ph.style.display = "block";
    ph.innerHTML = `<div style="margin-bottom:8px"><strong>Studio Commerciale — Scadenzario Fiscale</strong></div>
    <div>Cliente: <strong>${nomeCliente}</strong> | Anno: <strong>${anno}</strong> | Data stampa: ${new Date().toLocaleDateString("it-IT")}</div>`;
  }
  window.print();
  if (ph) ph.style.display = "none";
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────
function renderDashboard(stats) {
  const perc =
    stats.totAdempimenti > 0
      ? Math.round((stats.completati / stats.totAdempimenti) * 100)
      : 0;
  document.getElementById("content").innerHTML = `
    <div class="print-header" id="print-header-ph" style="display:none"></div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Clienti Totali</div>
        <div class="stat-value v-blue">${stats.totClienti}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Adempimenti ${stats.anno}</div>
        <div class="stat-value">${stats.totAdempimenti}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Completati</div>
        <div class="stat-value v-green">${stats.completati}</div>
        <div class="prog-bar"><div class="prog-fill green" style="width:${perc}%"></div></div>
        <div class="stat-sub">${perc}% del totale</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Da Fare</div>
        <div class="stat-value v-yellow">${stats.daFare}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">In Corso</div>
        <div class="stat-value v-purple">${stats.inCorso || 0}</div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-header"><h3>📊 Clienti per Tipologia — ${stats.anno}</h3></div>
      <table>
        <thead><tr><th>Tipologia</th><th>Codice</th><th>N° Clienti</th></tr></thead>
        <tbody>
          ${stats.perTipologia
            .map(
              (t) => `
            <tr>
              <td><strong>${t.nome}</strong></td>
              <td><span class="badge b-${t.codice.toLowerCase()}">${t.codice}</span></td>
              <td><strong style="font-family:var(--mono)">${t.n}</strong></td>
            </tr>`,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

// ─── CLIENTI PAGE ─────────────────────────────────────────────────────────
function renderClientiPage() {
  document.getElementById("topbar-actions").innerHTML = `
    <div class="search-wrap" style="width:230px">
      <span class="search-icon">🔍</span>
      <input class="input" id="search-q" placeholder="Cerca nome, CF, P.IVA, email..." oninput="applyClientiFiltri()">
    </div>
    <select class="select" id="filter-tipo" style="width:140px" onchange="applyClientiFiltri()">
      <option value="">Tutte tipologie</option>
      <option value="PF">PF – Persona Fisica</option>
      <option value="SP">SP – Soc. Persone</option>
      <option value="SC">SC – Soc. Capitali</option>
      <option value="ASS">ASS – Associazione</option>
    </select>
    <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
    <button class="btn btn-primary no-print" onclick="openNuovoCliente()">+ Nuovo Cliente</button>
  `;
  renderClientiTabella(state.clienti);
}

function applyClientiFiltri() {
  const q = (document.getElementById("search-q")?.value || "").toLowerCase();
  const tipo = document.getElementById("filter-tipo")?.value || "";
  const filtered = state.clienti.filter((c) => {
    const matchQ =
      !q ||
      c.nome.toLowerCase().includes(q) ||
      (c.codice_fiscale || "").toLowerCase().includes(q) ||
      (c.partita_iva || "").includes(q) ||
      (c.email || "").toLowerCase().includes(q);
    const matchT = !tipo || c.tipologia_codice === tipo;
    return matchQ && matchT;
  });
  renderClientiTabella(filtered);
}

function renderClientiTabella(clienti) {
  const tbody = clienti.length
    ? clienti
        .map(
          (c) => `
    <tr>
      <td><strong>${c.nome}</strong></td>
      <td><span class="badge b-${(c.tipologia_codice || "").toLowerCase()}">${c.tipologia_codice || "-"}</span></td>
      <td class="td-dim">${c.sottotipologia_nome || "-"}</td>
      <td class="td-mono td-dim">${c.codice_fiscale || c.partita_iva || "-"}</td>
      <td class="td-dim">${c.email || "-"}</td>
      <td class="td-dim">${c.telefono || "-"}</td>
      <td class="col-actions no-print">
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-secondary" onclick="editCliente(${c.id})" title="Modifica">✏️</button>
          <button class="btn btn-sm btn-success" onclick="goScadenzario(${c.id})" title="Scadenzario">📅</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCliente(${c.id},'${esc(c.nome)}')" title="Elimina">🗑️</button>
        </div>
      </td>
    </tr>`,
        )
        .join("")
    : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato</p></div></td></tr>`;

  document.getElementById("content").innerHTML = `
    <div class="print-header">
      <strong>Studio Commerciale — Elenco Clienti</strong><br>
      Data stampa: ${new Date().toLocaleDateString("it-IT")} — Totale: ${clienti.length} clienti
    </div>
    <div class="table-wrap">
      <div class="table-header no-print">
        <h3>Clienti (${clienti.length})</h3>
      </div>
      <table>
        <thead><tr><th>Nome</th><th>Tipo</th><th>Sottotipo</th><th>CF / P.IVA</th><th>Email</th><th>Telefono</th><th class="no-print">Azioni</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

// ─── SCADENZARIO CLIENTE ──────────────────────────────────────────────────
function renderScadenzarioPage() {
  const opts = state.clienti
    .map(
      (c) =>
        `<option value="${c.id}" ${state.selectedCliente?.id === c.id ? "selected" : ""}>[${c.tipologia_codice}] ${c.nome}</option>`,
    )
    .join("");

  document.getElementById("topbar-actions").innerHTML = `
    <select class="select" id="sel-cliente" style="width:250px" onchange="onClienteChange()">
      <option value="">-- Seleziona Cliente --</option>${opts}
    </select>
    <div class="year-sel">
      <button onclick="changeAnnoScad(-1)">◀</button>
      <span class="year-num">${state.anno}</span>
      <button onclick="changeAnnoScad(1)">▶</button>
    </div>
  `;

  if (state.selectedCliente) loadScadenzario();
  else {
    document.getElementById("content").innerHTML = `
      <div class="empty"><div class="empty-icon">📅</div><p>Seleziona un cliente per visualizzare il suo scadenzario</p></div>`;
  }
}

function onClienteChange() {
  const id = parseInt(document.getElementById("sel-cliente").value);
  state.selectedCliente = state.clienti.find((c) => c.id === id) || null;
  if (state.selectedCliente) loadScadenzario();
}

function changeAnnoScad(d) {
  state.anno += d;
  document
    .querySelectorAll(".year-num")
    .forEach((el) => (el.textContent = state.anno));
  if (state.selectedCliente) loadScadenzario();
}

function loadScadenzario() {
  socket.emit("get:scadenzario", {
    id_cliente: state.selectedCliente.id,
    anno: state.anno,
    filtro_stato: state.filtri.stato,
    filtro_adempimento: state.filtri.adempimento,
  });
}

function renderScadenzarioTabella(righe) {
  const c = state.selectedCliente;
  const tot = righe.length;
  const comp = righe.filter((r) => r.stato === "completato").length;
  const daF = righe.filter((r) => r.stato === "da_fare").length;
  const inC = righe.filter((r) => r.stato === "in_corso").length;
  const na = righe.filter((r) => r.stato === "n_a").length;
  const perc = tot > 0 ? Math.round((comp / tot) * 100) : 0;

  // raggruppamento per adempimento
  const grouped = {};
  righe.forEach((r) => {
    if (!grouped[r.codice]) grouped[r.codice] = [];
    grouped[r.codice].push(r);
  });

  const tbody =
    Object.entries(grouped)
      .map(([codice, rows]) => {
        return rows
          .map((r, idx) => {
            let periodo = "";
            if (
              r.scadenza_tipo === "trimestrale" ||
              r.scadenza_tipo === "semestrale"
            ) {
              periodo = r.trimestre
                ? r.scadenza_tipo === "semestrale"
                  ? `S${r.trimestre}`
                  : `T${r.trimestre}`
                : "-";
            } else if (r.scadenza_tipo === "mensile") {
              periodo = r.mese ? MESI[r.mese - 1] : "-";
            } else {
              periodo = "Annuale";
            }
            return `
        <tr class="clickable s-${r.stato}" onclick="openAdpModal(${r.id},'${r.stato}','${r.data_scadenza || ""}','${r.data_completamento || ""}','${r.importo || ""}','${esc(r.note || "")}','${esc(r.adempimento_nome)}')">
          ${
            idx === 0
              ? `<td rowspan="${rows.length}" style="border-right:1px solid var(--border);font-weight:700;vertical-align:top;padding-top:14px">
            <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">${codice}</span><br>
            <span style="font-size:12px">${r.adempimento_nome}</span>
          </td>`
              : ""
          }
          <td>${periodo}</td>
          <td><span class="badge b-${r.stato}">${STATI[r.stato] || r.stato}</span></td>
          <td class="td-mono td-dim">${r.importo ? "€ " + parseFloat(r.importo).toFixed(2) : "-"}</td>
          <td class="td-mono td-dim" style="font-size:11px">${r.data_scadenza || "-"}</td>
          <td class="td-mono td-dim" style="font-size:11px">${r.data_completamento || "-"}</td>
          <td class="td-dim" style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis">${r.note || ""}</td>
        </tr>`;
          })
          .join("");
      })
      .join("") ||
    `<tr><td colspan="7"><div class="empty"><div class="empty-icon">📋</div><p>Nessun adempimento trovato.<br>Clicca <strong>⚡ Genera</strong> per creare lo scadenzario.</p></div></td></tr>`;

  document.getElementById("content").innerHTML = `
    <div class="print-header" id="scad-print-hdr">
      <strong>Studio Commerciale — Scadenzario Fiscale</strong><br>
      Cliente: <strong>${c.nome}</strong> | Anno: <strong>${state.anno}</strong> | Data stampa: ${new Date().toLocaleDateString("it-IT")}
    </div>

    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;flex-wrap:wrap">
      <div>
        <div style="font-size:18px;font-weight:800">${c.nome}</div>
        <div style="font-size:12px;color:var(--text2)">${c.tipologia_nome}${c.sottotipologia_nome ? " · " + c.sottotipologia_nome : ""} | CF/PIVA: ${c.codice_fiscale || c.partita_iva || "—"}</div>
      </div>
      <div style="flex:1"></div>
      <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-purple" onclick="openAddAdp(${c.id})">➕ Adempimento</button>
        <button class="btn btn-sm btn-secondary" onclick="openCopia(${c.id})">📋 Copia anno</button>
        <button class="btn btn-sm btn-primary" onclick="generaScad(${c.id})">⚡ Genera ${state.anno}</button>
        <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>
      </div>
    </div>

    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Totale</div><div class="stat-value v-blue">${tot}</div></div>
      <div class="stat-card"><div class="stat-label">Completati</div><div class="stat-value v-green">${comp}</div><div class="prog-bar"><div class="prog-fill green" style="width:${perc}%"></div></div></div>
      <div class="stat-card"><div class="stat-label">Da Fare</div><div class="stat-value v-yellow">${daF}</div></div>
      <div class="stat-card"><div class="stat-label">In Corso</div><div class="stat-value v-purple">${inC}</div></div>
      <div class="stat-card"><div class="stat-label">N/A</div><div class="stat-value" style="color:var(--text3)">${na}</div></div>
    </div>

    <div class="filtri-bar no-print">
      <label>Filtra:</label>
      <select class="select" style="width:160px" id="f-stato" onchange="applyScadFiltri()">
        <option value="tutti">Tutti gli stati</option>
        <option value="da_fare">⭕ Da fare</option>
        <option value="in_corso">🔄 In corso</option>
        <option value="completato">✅ Completato</option>
        <option value="n_a">➖ N/A</option>
      </select>
      <div class="search-wrap" style="width:220px">
        <span class="search-icon">🔍</span>
        <input class="input" id="f-adp" placeholder="Cerca adempimento..." oninput="applyScadFiltri()" value="${state.filtri.adempimento}">
      </div>
      <button class="btn btn-sm btn-secondary" onclick="resetScadFiltri()">✕ Reset</button>
    </div>

    <div class="table-wrap">
      <div class="table-header no-print"><h3>Scadenzario ${state.anno}</h3>
        <span style="font-size:11px;color:var(--text3)">💡 Clicca su una riga per aggiornare</span>
      </div>
      <table>
        <thead><tr><th>Adempimento</th><th>Periodo</th><th>Stato</th><th>Importo</th><th>Scadenza</th><th>Completato</th><th>Note</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>
    <p class="no-print" style="font-size:11px;color:var(--text3);margin-top:8px">💡 Clicca su una riga per modificare stato, importo, note. Il tasto 🗑️ rimuove l'adempimento dallo scadenzario.</p>
  `;

  // Ripristina filtri selezionati
  if (document.getElementById("f-stato"))
    document.getElementById("f-stato").value = state.filtri.stato;
}

function applyScadFiltri() {
  state.filtri.stato = document.getElementById("f-stato")?.value || "tutti";
  state.filtri.adempimento = document.getElementById("f-adp")?.value || "";
  loadScadenzario();
}

function resetScadFiltri() {
  state.filtri.stato = "tutti";
  state.filtri.adempimento = "";
  loadScadenzario();
}

function generaScad(id) {
  if (
    !confirm(
      `Generare/rigenera lo scadenzario ${state.anno} per questo cliente? Le righe esistenti verranno sovrascritte.`,
    )
  )
    return;
  socket.emit("genera:scadenzario", { id_cliente: id, anno: state.anno });
}

// ─── VISTA GLOBALE ────────────────────────────────────────────────────────
function renderGlobalePage() {
  document.getElementById("topbar-actions").innerHTML = `
    <div class="year-sel">
      <button onclick="changeAnnoGlobale(-1)">◀</button>
      <span class="year-num">${state.anno}</span>
      <button onclick="changeAnnoGlobale(1)">▶</button>
    </div>
    <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
  `;
  renderGlobaleFiltri();
  socket.emit("get:scadenzario_globale", {
    anno: state.anno,
    filtro_stato: state.filtri.stato,
    filtro_tipologia: state.filtri.tipologia,
  });
}

function changeAnnoGlobale(d) {
  state.anno += d;
  document
    .querySelectorAll(".year-num")
    .forEach((el) => (el.textContent = state.anno));
  socket.emit("get:scadenzario_globale", {
    anno: state.anno,
    filtro_stato: state.filtri.stato,
    filtro_tipologia: state.filtri.tipologia,
  });
}

function renderGlobaleFiltri() {
  document.getElementById("content").innerHTML = `
    <div class="print-header">
      <strong>Studio Commerciale — Vista Globale Adempimenti ${state.anno}</strong><br>
      Data stampa: ${new Date().toLocaleDateString("it-IT")}
    </div>
    <div class="filtri-bar no-print">
      <label>Stato:</label>
      <select class="select" style="width:160px" id="fg-stato" onchange="applyGlobaleFiltri()">
        <option value="tutti">Tutti</option>
        <option value="da_fare">⭕ Da fare</option>
        <option value="in_corso">🔄 In corso</option>
        <option value="completato">✅ Completato</option>
        <option value="n_a">➖ N/A</option>
      </select>
      <label>Tipologia:</label>
      <select class="select" style="width:160px" id="fg-tipo" onchange="applyGlobaleFiltri()">
        <option value="tutti">Tutte</option>
        <option value="PF">PF</option>
        <option value="SP">SP</option>
        <option value="SC">SC</option>
        <option value="ASS">ASS</option>
      </select>
      <div class="search-wrap" style="width:220px">
        <span class="search-icon">🔍</span>
        <input class="input" id="fg-search" placeholder="Cerca cliente o adempimento..." oninput="applyGlobaleFiltriSearch()">
      </div>
    </div>
    <div id="globale-content"><div class="empty"><div class="empty-icon">⏳</div><p>Caricamento...</p></div></div>
  `;
  if (document.getElementById("fg-stato"))
    document.getElementById("fg-stato").value = state.filtri.stato;
  if (document.getElementById("fg-tipo"))
    document.getElementById("fg-tipo").value = state.filtri.tipologia;
}

function applyGlobaleFiltri() {
  state.filtri.stato = document.getElementById("fg-stato")?.value || "tutti";
  state.filtri.tipologia = document.getElementById("fg-tipo")?.value || "tutti";
  socket.emit("get:scadenzario_globale", {
    anno: state.anno,
    filtro_stato: state.filtri.stato,
    filtro_tipologia: state.filtri.tipologia,
  });
}

function applyGlobaleFiltriSearch() {
  const q = (document.getElementById("fg-search")?.value || "").toLowerCase();
  const filtered = state.scadGlobale.filter(
    (r) =>
      r.cliente_nome.toLowerCase().includes(q) ||
      r.adempimento_nome.toLowerCase().includes(q) ||
      r.codice.toLowerCase().includes(q),
  );
  renderGlobaleTabella(filtered, false);
}

function renderGlobaleTabella(righe, save = true) {
  if (save) state.scadGlobale = righe;
  const container = document.getElementById("globale-content");
  if (!container) return;

  // Raggruppa per cliente
  const perCliente = {};
  righe.forEach((r) => {
    if (!perCliente[r.id_cliente])
      perCliente[r.id_cliente] = {
        nome: r.cliente_nome,
        tipo: r.tipologia_codice,
        righe: [],
      };
    perCliente[r.id_cliente].righe.push(r);
  });

  if (!Object.keys(perCliente).length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>Nessun risultato</p></div>`;
    return;
  }

  const html = Object.entries(perCliente)
    .map(([id, cl]) => {
      const comp = cl.righe.filter((r) => r.stato === "completato").length;
      const perc = Math.round((comp / cl.righe.length) * 100);
      const tbody = cl.righe
        .map((r) => {
          let periodo = "";
          if (r.trimestre)
            periodo =
              r.scadenza_tipo === "semestrale"
                ? `S${r.trimestre}`
                : `T${r.trimestre}`;
          else if (r.mese) periodo = MESI[r.mese - 1];
          else periodo = "Ann.";
          return `<tr>
        <td class="td-mono" style="font-size:10px;color:var(--accent)">${r.codice}</td>
        <td>${r.adempimento_nome}</td>
        <td style="font-size:11px">${periodo}</td>
        <td><span class="badge b-${r.stato}">${STATI[r.stato] || r.stato}</span></td>
        <td class="td-mono td-dim">${r.importo ? "€ " + parseFloat(r.importo).toFixed(2) : "-"}</td>
        <td class="td-mono td-dim" style="font-size:11px">${r.data_completamento || "-"}</td>
      </tr>`;
        })
        .join("");
      return `
      <div class="table-wrap" style="margin-bottom:16px">
        <div class="table-header" style="cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">
          <span class="badge b-${(cl.tipo || "").toLowerCase()}" style="margin-right:6px">${cl.tipo}</span>
          <h3>${cl.nome}</h3>
          <span style="font-size:11px;color:var(--text3);margin-right:8px">${cl.righe.length} adempimenti · ${comp} completati (${perc}%)</span>
          <div class="prog-bar" style="width:100px;display:inline-block;vertical-align:middle"><div class="prog-fill green" style="width:${perc}%"></div></div>
          <span style="margin-left:8px;color:var(--text3);font-size:11px">▾</span>
        </div>
        <div>
          <table>
            <thead><tr><th>Codice</th><th>Adempimento</th><th>Periodo</th><th>Stato</th><th>Importo</th><th>Completato</th></tr></thead>
            <tbody>${tbody}</tbody>
          </table>
        </div>
      </div>`;
    })
    .join("");

  container.innerHTML = html;
}

// ─── ADEMPIMENTI PAGE (CRUD) ──────────────────────────────────────────────
function renderAdempimentiPage() {
  document.getElementById("topbar-actions").innerHTML = `
    <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
    <button class="btn btn-primary no-print" onclick="openNuovoAdpDef()">+ Nuovo</button>
  `;

  const adpPerTipo = {};
  TIPOLOGIE_CODICI.forEach((t) => (adpPerTipo[t] = []));
  adpPerTipo["TUTTI"] = [];

  state.adempimenti.forEach((a) => {
    const tipologie = JSON.parse(a.tipologie_applicabili || "[]");
    if (tipologie.length === 4 || tipologie.length === 0)
      adpPerTipo["TUTTI"].push(a);
    else
      tipologie.forEach((t) => {
        if (adpPerTipo[t]) adpPerTipo[t].push(a);
      });
  });

  // Filtra per rimuovere duplicati
  const seen = new Set();
  const rows =
    state.adempimenti
      .map((a) => {
        const tipologie = JSON.parse(a.tipologie_applicabili || "[]");
        return `<tr>
      <td><span style="font-family:var(--mono);font-weight:700;color:var(--accent)">${a.codice}</span></td>
      <td><strong>${a.nome}</strong></td>
      <td class="td-dim" style="font-size:12px">${a.descrizione || "-"}</td>
      <td>${tipologie.map((t) => `<span class="badge b-${t.toLowerCase()}" style="margin-right:2px">${t}</span>`).join("")}</td>
      <td><span style="font-family:var(--mono);font-size:11px;color:var(--text2)">${a.scadenza_tipo || "-"}</span></td>
      <td class="col-actions no-print">
        <div style="display:flex;gap:5px">
          <button class="btn btn-xs btn-secondary" onclick="editAdpDef(${a.id})">✏️</button>
          <button class="btn btn-xs btn-danger" onclick="deleteAdpDef(${a.id},'${esc(a.nome)}')">🗑️</button>
        </div>
      </td>
    </tr>`;
      })
      .join("") ||
    `<tr><td colspan="6"><div class="empty"><div class="empty-icon">📋</div><p>Nessun adempimento</p></div></td></tr>`;

  document.getElementById("content").innerHTML = `
    <div class="print-header">
      <strong>Studio Commerciale — Adempimenti Fiscali</strong><br>
      Data stampa: ${new Date().toLocaleDateString("it-IT")} — Totale: ${state.adempimenti.length} adempimenti
    </div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Adempimenti Fiscali (${state.adempimenti.length})</h3></div>
      <table>
        <thead><tr><th>Codice</th><th>Nome</th><th>Descrizione</th><th>Tipologie</th><th>Cadenza</th><th class="no-print">Azioni</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─── TIPOLOGIE PAGE ───────────────────────────────────────────────────────
function renderTipologiePage() {
  const cards = state.tipologie
    .map((t) => {
      const subs = t.sottotipologie || [];
      const color =
        {
          PF: "var(--accent)",
          SP: "var(--purple)",
          SC: "var(--green)",
          ASS: "var(--yellow)",
        }[t.codice] || "var(--accent)";
      return `
      <div class="tipo-card">
        <div class="tipo-codice" style="color:${color}">${t.codice}</div>
        <div class="tipo-nome">${t.nome}</div>
        <div class="tipo-desc">${t.descrizione || ""}</div>
        <div class="divider"></div>
        <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Sottotipologie</div>
        <div style="display:flex;flex-direction:column;gap:4px">
          ${subs.map((s) => `<div style="font-size:12px;padding:4px 8px;background:var(--surface2);border-radius:5px;border-left:2px solid ${color}">${s.nome}</div>`).join("")}
        </div>
      </div>`;
    })
    .join("");
  document.getElementById("content").innerHTML =
    `<div class="tipo-cards">${cards}</div>`;
}

// ─── MODAL CLIENTE ────────────────────────────────────────────────────────
function loadTipologie() {
  socket.emit("get:tipologie");
}

function populateTipologiaSelect() {
  const sel = document.getElementById("c-tipologia");
  if (!sel) return;
  sel.innerHTML = state.tipologie
    .map((t) => `<option value="${t.id}">${t.codice} – ${t.nome}</option>`)
    .join("");
  onTipologiaChange();
}

function onTipologiaChange() {
  const tipId = parseInt(document.getElementById("c-tipologia")?.value);
  const tip = state.tipologie.find((t) => t.id === tipId);
  const sel = document.getElementById("c-sottotipologia");
  if (!sel || !tip) return;
  sel.innerHTML =
    '<option value="">-- Nessuna --</option>' +
    (tip.sottotipologie || [])
      .map((s) => `<option value="${s.id}">${s.nome}</option>`)
      .join("");
}

function openNuovoCliente() {
  document.getElementById("modal-cliente-title").textContent = "Nuovo Cliente";
  document.getElementById("cliente-id").value = "";
  [
    "c-nome",
    "c-cf",
    "c-piva",
    "c-email",
    "c-tel",
    "c-indirizzo",
    "c-note",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("new-cliente-info").style.display = "block";
  populateTipologiaSelect();
  openModal("modal-cliente");
}

function editCliente(id) {
  socket.once("res:cliente", ({ success, data }) => {
    if (!success || !data) return;
    document.getElementById("modal-cliente-title").textContent =
      "Modifica Cliente";
    document.getElementById("cliente-id").value = data.id;
    document.getElementById("c-nome").value = data.nome || "";
    document.getElementById("c-cf").value = data.codice_fiscale || "";
    document.getElementById("c-piva").value = data.partita_iva || "";
    document.getElementById("c-email").value = data.email || "";
    document.getElementById("c-tel").value = data.telefono || "";
    document.getElementById("c-indirizzo").value = data.indirizzo || "";
    document.getElementById("c-note").value = data.note || "";
    document.getElementById("new-cliente-info").style.display = "none";
    populateTipologiaSelect();
    document.getElementById("c-tipologia").value = data.id_tipologia;
    onTipologiaChange();
    setTimeout(() => {
      document.getElementById("c-sottotipologia").value =
        data.id_sottotipologia || "";
    }, 60);
    openModal("modal-cliente");
  });
  socket.emit("get:cliente", { id });
}

function saveCliente() {
  const id = document.getElementById("cliente-id").value;
  const data = {
    nome: document.getElementById("c-nome").value.trim(),
    id_tipologia: parseInt(document.getElementById("c-tipologia").value),
    id_sottotipologia:
      document.getElementById("c-sottotipologia").value || null,
    codice_fiscale:
      document.getElementById("c-cf").value.trim().toUpperCase() || null,
    partita_iva: document.getElementById("c-piva").value.trim() || null,
    email: document.getElementById("c-email").value.trim() || null,
    telefono: document.getElementById("c-tel").value.trim() || null,
    indirizzo: document.getElementById("c-indirizzo").value.trim() || null,
    note: document.getElementById("c-note").value.trim() || null,
  };
  if (!data.nome) {
    showNotif("Il nome è obbligatorio", "error");
    return;
  }
  if (id) {
    data.id = parseInt(id);
    socket.emit("update:cliente", data);
  } else socket.emit("create:cliente", data);
}

function deleteCliente(id, nome) {
  if (confirm(`Eliminare "${nome}"?`)) socket.emit("delete:cliente", { id });
}

function goScadenzario(id) {
  state.selectedCliente = state.clienti.find((c) => c.id === id) || null;
  document
    .querySelectorAll(".nav-item")
    .forEach((x) => x.classList.remove("active"));
  document.querySelector('[data-page="scadenzario"]').classList.add("active");
  state._pending = "scadenzario";
  socket.emit("get:clienti");
}

// ─── MODAL ADEMPIMENTO (scadenzario) ──────────────────────────────────────
function openAdpModal(id, stato, scadenza, data, importo, note, nome) {
  document.getElementById("adp-id").value = id;
  document.getElementById("adp-stato").value = stato;
  document.getElementById("adp-scadenza").value = scadenza || "";
  document.getElementById("adp-data").value = data || "";
  document.getElementById("adp-importo").value = importo || "";
  document.getElementById("adp-note").value = note || "";
  document.getElementById("adp-nome-label").textContent = nome || "";
  openModal("modal-adempimento");
}

function saveAdpStato() {
  socket.emit("update:adempimento_stato", {
    id: parseInt(document.getElementById("adp-id").value),
    stato: document.getElementById("adp-stato").value,
    data_scadenza: document.getElementById("adp-scadenza").value || null,
    data_completamento: document.getElementById("adp-data").value || null,
    importo: document.getElementById("adp-importo").value || null,
    note: document.getElementById("adp-note").value || null,
  });
}

function deleteAdpCliente() {
  const id = parseInt(document.getElementById("adp-id").value);
  if (confirm("Rimuovere questo adempimento dallo scadenzario?")) {
    socket.emit("delete:adempimento_cliente", { id });
  }
}

// ─── MODAL ADEMPIMENTO DEF ────────────────────────────────────────────────
let _selectedTipologie = [];

function buildAdpDefTipologieChips() {
  const container = document.getElementById("adp-def-tipologie");
  if (!container) return;
  container.innerHTML = TIPOLOGIE_CODICI.map(
    (t) => `
    <div class="chip" id="chip-${t}" onclick="toggleChip('${t}')">${t}</div>`,
  ).join("");
}

function toggleChip(codice) {
  const idx = _selectedTipologie.indexOf(codice);
  if (idx >= 0) _selectedTipologie.splice(idx, 1);
  else _selectedTipologie.push(codice);
  TIPOLOGIE_CODICI.forEach((t) => {
    const ch = document.getElementById("chip-" + t);
    if (!ch) return;
    ch.className =
      "chip" + (_selectedTipologie.includes(t) ? ` selected-${t}` : "");
  });
}

function openNuovoAdpDef() {
  document.getElementById("modal-adp-def-title").textContent =
    "Nuovo Adempimento";
  document.getElementById("adp-def-id").value = "";
  document.getElementById("adp-def-codice").value = "";
  document.getElementById("adp-def-nome").value = "";
  document.getElementById("adp-def-desc").value = "";
  document.getElementById("adp-def-scadenza").value = "annuale";
  _selectedTipologie = [];
  buildAdpDefTipologieChips();
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
  document.getElementById("adp-def-scadenza").value =
    a.scadenza_tipo || "annuale";
  try {
    _selectedTipologie = JSON.parse(a.tipologie_applicabili) || [];
  } catch {
    _selectedTipologie = [];
  }
  buildAdpDefTipologieChips();
  _selectedTipologie.forEach((t) => {
    const ch = document.getElementById("chip-" + t);
    if (ch) ch.className = `chip selected-${t}`;
  });
  openModal("modal-adp-def");
}

function saveAdpDef() {
  const id = document.getElementById("adp-def-id").value;
  const data = {
    codice: document
      .getElementById("adp-def-codice")
      .value.trim()
      .toUpperCase(),
    nome: document.getElementById("adp-def-nome").value.trim(),
    descrizione: document.getElementById("adp-def-desc").value.trim() || null,
    scadenza_tipo: document.getElementById("adp-def-scadenza").value,
    tipologie_applicabili: _selectedTipologie,
  };
  if (!data.codice || !data.nome) {
    showNotif("Codice e Nome sono obbligatori", "error");
    return;
  }
  if (!data.tipologie_applicabili.length) {
    showNotif("Seleziona almeno una tipologia", "error");
    return;
  }
  if (id) {
    data.id = parseInt(id);
    socket.emit("update:adempimento", data);
  } else socket.emit("create:adempimento", data);
}

function deleteAdpDef(id, nome) {
  if (
    confirm(
      `Eliminare l'adempimento "${nome}"?\nVerrà disattivato ma non cancellato.`,
    )
  ) {
    socket.emit("delete:adempimento", { id });
  }
}

// ─── COPIA SCADENZARIO ────────────────────────────────────────────────────
function openCopia(id) {
  document.getElementById("copia-cliente-id").value = id;
  document.getElementById("copia-da").value = state.anno - 1;
  document.getElementById("copia-a").value = state.anno;
  openModal("modal-copia");
}
function eseguiCopia() {
  socket.emit("copia:scadenzario", {
    id_cliente: parseInt(document.getElementById("copia-cliente-id").value),
    anno_da: parseInt(document.getElementById("copia-da").value),
    anno_a: parseInt(document.getElementById("copia-a").value),
  });
}

// ─── AGGIUNGI ADEMPIMENTO ─────────────────────────────────────────────────
function openAddAdp(id) {
  document.getElementById("add-adp-cliente-id").value = id;
  const sel = document.getElementById("add-adp-select");
  sel.innerHTML = state.adempimenti
    .map((a) => `<option value="${a.id}">[${a.codice}] ${a.nome}</option>`)
    .join("");
  document.getElementById("add-adp-trim").value = "";
  document.getElementById("add-adp-mese").value = "";
  openModal("modal-add-adp");
}
function eseguiAddAdp() {
  socket.emit("add:adempimento_cliente", {
    id_cliente: parseInt(document.getElementById("add-adp-cliente-id").value),
    id_adempimento: parseInt(document.getElementById("add-adp-select").value),
    anno: state.anno,
    trimestre: document.getElementById("add-adp-trim").value || null,
    mese: document.getElementById("add-adp-mese").value || null,
  });
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add("open");
}
function closeModal(id) {
  document.getElementById(id).classList.remove("open");
}

document.querySelectorAll(".modal-overlay").forEach((el) => {
  el.addEventListener("click", (e) => {
    if (e.target === el) el.classList.remove("open");
  });
});

// ─── UTILS ───────────────────────────────────────────────────────────────
function esc(s) {
  return (s || "").replace(/'/g, "\\'").replace(/\n/g, " ");
}

function showNotif(msg, type = "info") {
  const icons = { success: "✅", info: "ℹ️", error: "❌" };
  const el = document.createElement("div");
  el.className = `notif ${type}`;
  el.innerHTML = `<span>${icons[type] || "•"}</span><span>${msg}</span>`;
  document.getElementById("notif-container").appendChild(el);
  setTimeout(() => el.remove(), 3800);
}
