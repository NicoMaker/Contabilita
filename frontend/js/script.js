// ═══════════════════════════════════════════════════════════════
// SCRIPT.JS — Entry point: tutti i moduli sono già caricati
//             dall'HTML nell'ordine corretto. Qui si avvia l'app.
// ═══════════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", () => {
  initNav();
});

// Aggiungi la funzione toggleClienteSelect globalmente
window.toggleClienteSelect = function () {
  const generaPer = document.getElementById("custom-adp-genera-per")?.value;
  const clienteDiv = document.getElementById("custom-adp-cliente-div");
  if (clienteDiv) {
    clienteDiv.style.display = generaPer === "selezionati" ? "block" : "none";
  }
};

// Ascolta i cambiamenti del checkbox "solo attivi" nel modal applica adempimenti
document.addEventListener("change", function (e) {
  if (e.target.id === "applica-clienti-solo-attivi") {
    renderApplicaClientiList();
  }
});

// Assicura che le funzioni siano globali
window.caricaClientiSenzaAdempimenti =
  window.caricaClientiSenzaAdempimenti ||
  function () {
    if (socket && state.page === "dashboard") {
      socket.emit("get:clienti_senza_adempimenti", { anno: state.anno });
    }
  };

// ═══════════════════════════════════════════════════════════════
// FUNZIONE RENDER PAGE (MODIFICATA CON PAGINA BIANCA)
// ═══════════════════════════════════════════════════════════════
function renderPage(page) {
  // Pulisci la pagina bianca se stai uscendo da essa
  if (state.page === "pagina_bianca" && page !== "pagina_bianca") {
    if (typeof cleanupPaginaBianca === "function") {
      cleanupPaginaBianca();
    }
  }

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
    appunti: "Appunti",
    pagina_bianca: "Pagina Bianca",
  };
  document.getElementById("page-title").textContent = titles[page] || page;

  document.querySelectorAll(".nav-item").forEach((el) => {
    el.setAttribute(
      "aria-current",
      el.dataset.page === page ? "page" : "false",
    );
  });

  if (page === "dashboard") {
    document.getElementById("topbar-actions").innerHTML =
      `<div class="year-sel"><button onclick="changeAnno(-1)" title="Anno precedente">&#9664;</button><span class="year-num">${state.anno}</span><button onclick="changeAnno(1)" title="Anno successivo">&#9654;</button></div><button class="btn btn-sm" style="background:var(--accent-d);color:var(--accent);border:1px solid rgba(91,141,246,0.3);font-size:13px" onclick="setDashCat('tutti')" title="Mostra tutti">📋 Tutti</button><button class="btn btn-cyan btn-sm no-print" onclick="openCopiaTutti()" style="font-size:13px">📋 Copia</button><button class="btn btn-print btn-sm" onclick="window.print()" style="font-size:13px">🖨️</button>`;
    socket.emit("get:stats", { anno: state.anno });
  } else if (page === "clienti") {
    state._pending = "clienti";
    document.getElementById("topbar-actions").innerHTML =
      `<div class="search-wrap" style="width:240px"><span class="search-icon">🔍</span><input class="input" id="global-search-clienti" placeholder="Cerca nome, CF, P.IVA…" oninput="applyClientiFiltri()" style="font-size:13px"></div><button class="btn btn-sm btn-primary" onclick="resetClientiFiltri()" style="font-size:13px">⟳</button><button class="btn btn-print btn-sm no-print" onclick="window.print()" style="font-size:13px">🖨️</button><button class="btn btn-primary no-print" onclick="openNuovoCliente()" style="font-size:13px">+ Cliente</button>`;
    setTimeout(() => {
      if (typeof applyClientiFiltriImmediate === "function")
        applyClientiFiltriImmediate();
      else {
        const anno =
          parseInt(document.getElementById("filter-anno")?.value) ||
          new Date().getFullYear();
        socket.emit("get:clienti", { anno });
      }
    }, 50);
  } else if (page === "scadenzario") {
    state._pending = "scadenzario";
    document.getElementById("topbar-actions").innerHTML = "";
    socket.emit("get:clienti");
  } else if (page === "scadenzario_globale") {
    renderGlobalePage();
  } else if (page === "adempimenti") {
    state._pending = "adempimenti";
    document.getElementById("topbar-actions").innerHTML =
      `<div class="search-wrap" style="width:260px"><span class="search-icon">🔍</span><input class="input" id="global-search-adempimenti" placeholder="Cerca codice o nome…" oninput="applyAdempimentiFiltriSearch()" style="font-size:13px"></div><button class="btn btn-sm btn-primary" onclick="resetAdempimentiFiltri()" style="font-size:13px">⟳</button><button class="btn btn-primary no-print" onclick="openNuovoAdpDef()" style="font-size:13px">+ Nuovo</button>`;
    socket.emit("get:adempimenti");
  } else if (page === "tipologie") {
    document.getElementById("topbar-actions").innerHTML = "";
    renderTipologiePage();
  } else if (page === "appunti") {
    document.getElementById("topbar-actions").innerHTML = "";
    if (typeof renderAppuntiPage === "function") {
      renderAppuntiPage();
    } else {
      console.error("❌ renderAppuntiPage non definita!");
      document.getElementById("content").innerHTML =
        `<div class="empty"><div class="empty-icon">❌</div><p>Errore: modulo appunti non caricato</p><button class="btn btn-primary" onclick="location.reload()">⟳ Ricarica</button></div>`;
    }
  } else if (page === "pagina_bianca") {
    document.getElementById("topbar-actions").innerHTML = "";
    if (typeof renderPaginaBiancaPage === "function") {
      renderPaginaBiancaPage();
    } else {
      console.error("❌ renderPaginaBiancaPage non definita!");
      document.getElementById("content").innerHTML =
        `<div class="empty"><div class="empty-icon">❌</div><p>Errore: modulo pagina bianca non caricato</p><button class="btn btn-primary" onclick="location.reload()">⟳ Ricarica</button></div>`;
    }
  }
}

function refreshPage() {
  renderPage(state.page);
}

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

function setupDecimalInputs() {
  document.querySelectorAll('input[type="number"]').forEach(setupDecimalInput);
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.tagName === "INPUT" && node.type === "number")
            setupDecimalInput(node);
          if (node.querySelectorAll)
            node
              .querySelectorAll('input[type="number"]')
              .forEach(setupDecimalInput);
        }
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// Esposizioni globali
window.initNav = initNav;
window.renderPage = renderPage;
window.refreshPage = refreshPage;
window.changeAnno = changeAnno;
window.setupDecimalInputs = setupDecimalInputs;
window.initSearchableSelect = initSearchableSelect;
