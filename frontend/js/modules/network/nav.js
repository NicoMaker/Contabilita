// ═══════════════════════════════════════════════════════════════
// NAV.JS — Navigazione, routing e searchable select
// (versione responsive con supporto hamburger mobile)
// ═══════════════════════════════════════════════════════════════

// ─── SEARCHABLE SELECT ────────────────────────────────────────
function initSearchableSelect(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel || sel.dataset.ssinit) return;
  sel.dataset.ssinit = "1";
  sel.style.display = "none";

  const wrap = document.createElement("div");
  wrap.className = "ss-wrap";
  wrap.style.cssText = [
    "position:relative",
    "display:inline-block",
    `min-width:${sel.style.minWidth || "160px"}`,
    `max-width:${sel.style.maxWidth || "260px"}`,
    `width:${sel.style.width || "auto"}`,
  ].join(";");
  sel.parentNode.insertBefore(wrap, sel);
  wrap.appendChild(sel);

  const trigger = document.createElement("div");
  trigger.className = "ss-trigger input topbar-select";
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.innerHTML = `<span class="ss-trigger-label">${sel.options[sel.selectedIndex]?.text || "-- Seleziona --"}</span><span class="ss-arrow" style="font-size:10px;opacity:0.5;flex-shrink:0;transition:transform 0.15s">▼</span>`;
  wrap.insertBefore(trigger, sel);

  const panel = document.createElement("div");
  panel.className = "ss-panel";
  panel.setAttribute("role", "listbox");
  wrap.appendChild(panel);

  const searchInput = document.createElement("input");
  searchInput.placeholder = "🔍 Cerca...";
  searchInput.setAttribute("type", "text");
  searchInput.setAttribute("aria-label", "Cerca opzione");
  panel.appendChild(searchInput);

  const list = document.createElement("div");
  list.style.maxHeight = "280px";
  list.style.overflowY = "auto";
  panel.appendChild(list);

  function getAllOptions() {
    return Array.from(sel.options).map((o) => ({
      value: o.value,
      text: o.text,
    }));
  }
  function renderList(q) {
    const opts = getAllOptions();
    const filtered = q
      ? opts.filter((o) => o.text.toLowerCase().includes(q.toLowerCase()))
      : opts;
    list.innerHTML = "";
    if (!filtered.length) {
      list.innerHTML = `<div style="padding:14px;text-align:center;color:var(--t3);font-size:13px">Nessun risultato</div>`;
      return;
    }
    const frag = document.createDocumentFragment();
    filtered.forEach((o) => {
      const item = document.createElement("div");
      item.className =
        "ss-item" +
        (String(o.value) === String(sel.value) ? " ss-selected" : "");
      item.dataset.value = o.value;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(o.value) === String(sel.value));
      item.textContent = o.text;
      item.addEventListener("click", () => {
        sel.value = o.value;
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        trigger.querySelector(".ss-trigger-label").textContent = o.text;
        closePanel();
      });
      frag.appendChild(item);
    });
    list.appendChild(frag);
  }

  function openPanel() {
    document.querySelectorAll(".ss-panel[data-open]").forEach((p) => {
      if (p !== panel) _closeOtherPanel(p);
    });
    panel.style.display = "block";
    panel.dataset.open = "1";
    trigger.setAttribute("aria-expanded", "true");
    trigger.querySelector(".ss-arrow").style.transform = "rotate(180deg)";
    trigger.style.borderColor = "var(--accent)";
    searchInput.value = "";
    renderList("");
    requestAnimationFrame(() => {
      const wrapRect = wrap.getBoundingClientRect();
      const panelH = panel.offsetHeight;
      const spaceDown = window.innerHeight - wrapRect.bottom;
      if (spaceDown < panelH && wrapRect.top > panelH) {
        panel.style.top = "auto";
        panel.style.bottom = "calc(100% + 4px)";
      } else {
        panel.style.top = "calc(100% + 4px)";
        panel.style.bottom = "auto";
      }
      searchInput.focus();
    });
  }

  function closePanel() {
    panel.style.display = "none";
    delete panel.dataset.open;
    trigger.setAttribute("aria-expanded", "false");
    trigger.querySelector(".ss-arrow").style.transform = "rotate(0deg)";
    trigger.style.borderColor = "";
  }

  function _closeOtherPanel(p) {
    p.style.display = "none";
    delete p.dataset.open;
    const ow = p.closest(".ss-wrap");
    if (ow) {
      const ot = ow.querySelector(".ss-trigger");
      if (ot) {
        ot.setAttribute("aria-expanded", "false");
        const arr = ot.querySelector(".ss-arrow");
        if (arr) arr.style.transform = "rotate(0deg)";
        ot.style.borderColor = "";
      }
    }
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.style.display === "none" ? openPanel() : closePanel();
  });
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      panel.style.display === "none" ? openPanel() : closePanel();
    }
  });
  searchInput.addEventListener("input", () => renderList(searchInput.value));
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closePanel();
      trigger.focus();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = list.querySelectorAll(".ss-item");
      const focused = list.querySelector(".ss-item:focus");
      let idx = focused ? Array.from(items).indexOf(focused) : -1;
      idx =
        e.key === "ArrowDown"
          ? Math.min(idx + 1, items.length - 1)
          : Math.max(idx - 1, 0);
      if (items[idx]) items[idx].focus();
    }
  });
  document.addEventListener("click", (e) => {
    const filtroPanel = e.target.closest(
      '.tip-filtro-panel, #tip-filtro-panel, #dash-tip-filtro-panel, #glob-tip-filtro-panel, [id*="tip-filtro-container"]',
    );
    if (!wrap.contains(e.target) && !filtroPanel) closePanel();
  });
  sel._ssRefresh = function () {
    const opt = sel.options[sel.selectedIndex];
    if (opt) trigger.querySelector(".ss-trigger-label").textContent = opt.text;
    if (panel.dataset.open) renderList(searchInput.value);
  };
}

// ─── INIT NAV ─────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll(".nav-item").forEach((el) => {
    if (!el.dataset.page) return;
    el.addEventListener("click", () => {
      document
        .querySelectorAll(".nav-item")
        .forEach((x) => x.classList.remove("active"));
      el.classList.add("active");
      renderPage(el.dataset.page);
      if (window.mobileSidebar && window.mobileSidebar.isOpen())
        window.mobileSidebar.close();
    });
  });

  document.getElementById("btn-scarica-db")?.addEventListener("click", (e) => {
    e.stopPropagation();
    scaricaDatabase();
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      const filtroPanel = e.target.closest(
        '.tip-filtro-panel, #tip-filtro-panel, #dash-tip-filtro-panel, #glob-tip-filtro-panel, [id*="tip-filtro-container"], .tip-percorso-chip, .tip-gruppo-header, .tip-btn-all, .tip-btn-none',
      );
      if (e.target === overlay && !filtroPanel)
        overlay.classList.remove("open");
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape")
      document
        .querySelectorAll(".modal-overlay.open")
        .forEach((m) => m.classList.remove("open"));
  });

  setupDecimalInputs();
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
    appunti: "Appunti",
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
    // ═══ PAGINA APPUNTI ═══
    document.getElementById("topbar-actions").innerHTML = "";
    if (typeof renderAppuntiPage === "function") {
      renderAppuntiPage();
    } else {
      console.error("❌ renderAppuntiPage non definita!");
      document.getElementById("content").innerHTML =
        `<div class="empty"><div class="empty-icon">❌</div><p>Errore: modulo appunti non caricato</p><button class="btn btn-primary" onclick="location.reload()">⟳ Ricarica</button></div>`;
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
