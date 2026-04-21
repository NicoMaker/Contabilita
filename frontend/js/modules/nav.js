// ═══════════════════════════════════════════════════════════════
// NAV.JS — Navigazione e routing tra le pagine
// ═══════════════════════════════════════════════════════════════

// ─── INIT NAV ─────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll(".nav-item").forEach((el) => {
    if (el.dataset.page)
      el.addEventListener("click", () => {
        document
          .querySelectorAll(".nav-item")
          .forEach((x) => x.classList.remove("active"));
        el.classList.add("active");
        renderPage(el.dataset.page);
      });
  });

  document.getElementById("btn-scarica-db")?.addEventListener("click", (e) => {
    e.stopPropagation();
    scaricaDatabase();
  });

  // Chiusura modal su click overlay
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  });

  // Chiusura modal con Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document
        .querySelectorAll(".modal-overlay.open")
        .forEach((m) => m.classList.remove("open"));
  });
}

// ─── RENDER PAGE ──────────────────────────────────────────────
function renderPage(page) {
  state.page = page;
  state._dashRendered = false;

  scrollToTop();

  const titles = {
    dashboard: "Dashboard",
    clienti: "Clienti",
    scadenzario: "Scadenzario Cliente",
    scadenzario_globale: "Vista Globale",
    adempimenti: "Adempimenti Fiscali",
    tipologie: "Tipologie Clienti",
  };
  document.getElementById("page-title").textContent = titles[page] || page;

  if (page === "dashboard") {
    document.getElementById("topbar-actions").innerHTML = `
      <div class="year-sel">
        <button onclick="changeAnno(-1)" title="Anno precedente">&#9664;</button>
        <span class="year-num">${state.anno}</span>
        <button onclick="changeAnno(1)" title="Anno successivo">&#9654;</button>
      </div>
      <button class="btn btn-sm" style="background:var(--accent-dim);color:var(--accent);border:1px solid rgba(91,141,246,0.3);font-size:13px" onclick="setDashCat('tutti')" title="Mostra tutti gli adempimenti">📋 Tutti</button>
      <button class="btn btn-orange btn-sm no-print" onclick="openGeneraTutti()" title="Genera scadenzario per tutti i clienti dell'anno selezionato" style="font-size:13px">⚡ Genera Tutti</button>
      <button class="btn btn-cyan btn-sm no-print"   onclick="openCopiaTutti()" title="Copia adempimenti da un anno all'altro per tutti i clienti" style="font-size:13px">📋 Copia Anno</button>
      <button class="btn btn-print btn-sm"           onclick="window.print()" title="Stampa la pagina corrente" style="font-size:13px">🖨️ Stampa</button>`;
    socket.emit("get:stats", { anno: state.anno });
  } else if (page === "clienti") {
    state._pending = "clienti";
    document.getElementById("topbar-actions").innerHTML = `
      <div class="search-wrap" style="width:280px">
        <span class="search-icon">🔍</span>
        <input class="input" id="global-search-clienti" placeholder="Cerca nome, CF, P.IVA, email..." oninput="applyClientiFiltri()" style="font-size:13px">
      </div>
      <button class="btn btn-sm btn-primary" onclick="resetClientiFiltri()" title="Mostra tutti i clienti" style="font-size:13px">⟳ Tutti</button>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()" title="Stampa lista clienti" style="font-size:13px">🖨️ Stampa</button>
      <button class="btn btn-primary no-print" onclick="openNuovoCliente()" title="Aggiungi un nuovo cliente" style="font-size:13px">+ Nuovo Cliente</button>`;
    socket.emit("get:clienti");
  } else if (page === "scadenzario") {
    state._pending = "scadenzario";
    document.getElementById("topbar-actions").innerHTML = "";
    socket.emit("get:clienti");
  } else if (page === "scadenzario_globale") {
    renderGlobalePage();
  } else if (page === "adempimenti") {
    state._pending = "adempimenti";
    document.getElementById("topbar-actions").innerHTML = `
      <div class="search-wrap" style="width:280px">
        <span class="search-icon">🔍</span>
        <input class="input" id="global-search-adempimenti" placeholder="Cerca codice, nome, categoria..." oninput="applyAdempimentiFiltriSearch()" style="font-size:13px">
      </div>
      <select class="select" id="filter-adp-cat" style="width:170px;font-size:13px" onchange="applyAdempimentiFiltriSearch()" title="Filtra per categoria adempimento">
        <option value="">📋 Tutte le categorie</option>
        ${CATEGORIE.map((c) => `<option value="${c.codice}">${c.icona} ${c.nome}</option>`).join("")}
      </select>
      <button class="btn btn-sm btn-primary" onclick="resetAdempimentiFiltri()" title="Mostra tutti gli adempimenti" style="font-size:13px">⟳ Tutti</button>
      <button class="btn btn-primary no-print" onclick="openNuovoAdpDef()" title="Crea un nuovo tipo di adempimento" style="font-size:13px">+ Nuovo</button>`;
    socket.emit("get:adempimenti");
  } else if (page === "tipologie") {
    document.getElementById("topbar-actions").innerHTML = "";
    renderTipologiePage();
  }
}

function refreshPage() {
  renderPage(state.page);
}

// ─── CAMBIO ANNO (DASHBOARD) ──────────────────────────────────
function changeAnno(d) {
  state.anno += d;
  document
    .querySelectorAll(".year-num")
    .forEach((el) => (el.textContent = state.anno));
  if (state.page === "dashboard") {
    state._dashRendered = false;
    socket.emit("get:stats", { anno: state.anno });
  }
}
