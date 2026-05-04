// ═══════════════════════════════════════════════════════════════
// DASHBOARD.JS — Dashboard con statistiche e clienti senza adempimenti
// ═══════════════════════════════════════════════════════════════

function buildDashboardShell(stats) {
  document.getElementById("content").innerHTML = `
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin-bottom:24px">
      <div class="stat-card"><div class="stat-label">Clienti Attivi</div><div class="stat-value v-blue">${stats.totClienti}</div></div>
      <div class="stat-card"><div class="stat-label" id="ds-lbl-tot">Adempimenti ${stats.anno}</div><div class="stat-value" id="ds-tot">-</div></div>
      <div class="stat-card"><div class="stat-label">Completati</div><div class="stat-value v-green" id="ds-comp">-</div><div class="prog-bar"><div class="prog-fill green" id="ds-prog" style="width:0%"></div></div><div class="stat-sub" id="ds-perc">0%</div></div>
      <div class="stat-card"><div class="stat-label">Da Fare</div><div class="stat-value v-yellow" id="ds-dafare">-</div></div>
      <div class="stat-card"><div class="stat-label">In Corso</div><div class="stat-value v-purple" id="ds-incorso">-</div></div>
      <div class="stat-card"><div class="stat-label">N/A</div><div class="stat-value" style="color:var(--text3)" id="ds-na">${stats.na || 0}</div></div>
    </div>
    
    <!-- ⭐ CLIENTI SENZA ADEMPIMENTI -->
    <div class="table-wrap" style="margin-bottom:20px" id="clienti-senza-adp-section">
      <div class="table-header">
        <h3>⚠️ Clienti senza adempimenti per l'anno ${stats.anno}</h3>
        <div>
          <button class="btn btn-sm btn-primary" onclick="apriApplicaAdempimentiPerVuoti()" style="background: var(--orange); border-color: var(--orange);">
            ✨ Assegna adempimenti
          </button>
        </div>
      </div>
      <div id="clienti-senza-adp-list" style="padding: 16px; min-height: 100px;">
        <div style="text-align: center; padding: 20px; color: var(--text3);">
          ⏳ Caricamento clienti...
        </div>
      </div>
    </div>
    
    <!-- ⭐ FILTRO TIPOLOGIE CLIENTI (DASHBOARD) -->
    <div class="dash-tip-filtro-wrap" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--s2);border:1px solid var(--b0);border-radius:var(--r-sm);cursor:pointer;" onclick="toggleDashTipFiltroPanel(event)">
        <span style="font-size:12px;font-weight:700;color:var(--t2);text-transform:uppercase;letter-spacing:.06em">🏷️ Filtra per Tipologia Clienti</span>
        <span id="dash-tip-filtro-count" style="display:none;align-items:center;justify-content:center;min-width:20px;height:20px;padding:0 6px;background:var(--red);color:#fff;border-radius:10px;font-size:11px;font-weight:700">0</span>
        <span id="dash-tip-filtro-warning" style="font-size:11px;color:var(--red);font-weight:700;display:none">⚠️ Nessuno selezionato</span>
        <div id="dash-tip-filtro-toggle-btn" style="margin-left:auto" onclick="event.stopPropagation()">
          <button class="btn btn-xs btn-secondary" onclick="toggleDashTipFiltroPanel(event)">▼ Espandi</button>
        </div>
      </div>
      <div id="dash-tip-filtro-container" style="display:none;margin-top:8px"></div>
    </div>

    <!-- ⭐ Applica Adempimenti Esistenti a Clienti -->
    <div class="table-wrap" style="margin-bottom:20px">
      <div class="table-header">
        <h3>📋 Applica Adempimenti Esistenti a Clienti</h3>
        <div>
          <button class="btn btn-primary" onclick="openApplicaAdempimenti()" style="background: var(--purple); border-color: var(--purple);">
            ✨ Applica Adempimenti
          </button>
        </div>
      </div>
      <div style="padding: 16px; background: var(--surface2); border-radius: 8px; margin: 12px; font-size: 13px; color: var(--text2);">
        💡 Seleziona <strong>uno o più adempimenti</strong> e <strong>uno o più clienti</strong>. 
        Gli adempimenti già presenti vengono conservati.
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-header no-print" style="flex-wrap:wrap;gap:10px">
        <h3 id="dash-adp-count-title">Adempimenti ${stats.anno}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1">
          <div class="dash-filtri-bar" style="display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap">
            <select class="select" id="dash-filtro-stato-adp" style="width:170px;font-size:13px" onchange="onDashFiltroStatoAdp()">
              <option value="">🔵 Tutti gli stati</option>
              <option value="da_fare">⭕ Da fare</option>
              <option value="in_corso">🔄 In corso</option>
              <option value="completato">✅ Completato</option>
              <option value="n_a">➖ N/A</option>
            </select>
            <div class="search-wrap" style="width:220px">
              <span class="search-icon">🔍</span>
              <input class="input" id="dash-adp-search" placeholder="Cerca nome, codice..." oninput="onDashAdpSearch(this.value)" style="font-size:13px">
            </div>
            <button class="btn btn-sm btn-primary" onclick="resetDashFiltri()">⟳ Tutti</button>
          </div>
        </div>
      </div>
      <div id="dash-adp-grid" style="padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px"></div>
    </div>`;
  
  state._dashRendered = true;
  caricaClientiSenzaAdempimenti();
  
  // Initialize tipologie filter after dashboard is built
  setTimeout(function() {
    if (typeof initializeTipologieFilter === "function") {
      initializeTipologieFilter();
    }
    _refreshDashTipFiltroPanel();
    _aggiornaDashTipFiltroCounter();
  }, 100);
}

// ⭐ CARICA CLIENTI SENZA ADEMPIMENTI
function caricaClientiSenzaAdempimenti() {
  if (!socket) return;
  socket.emit("get:clienti_senza_adempimenti", { anno: state.anno });
}

// ⭐ RENDER CLIENTI SENZA ADEMPIMENTI
function renderClientiSenzaAdempimenti(clienti) {
  var container = document.getElementById("clienti-senza-adp-list");
  if (!container) return;
  
  if (!clienti || clienti.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--green); background: var(--green)08; border-radius: 8px;">' +
      '✅ Tutti i clienti hanno almeno un adempimento per l\'anno ' + state.anno + '!' +
      '</div>';
    return;
  }
  
  var html = '<div style="display: flex; flex-direction: column; gap: 12px;">' +
    '<div style="font-size: 13px; color: var(--orange); padding: 8px 12px; background: var(--orange)08; border-radius: 6px;">' +
    '⚠️ ' + clienti.length + ' clienti senza alcun adempimento' +
    '</div>' +
    '<div style="display: flex; flex-direction: column; gap: 8px;">';
  
  for (var i = 0; i < clienti.length; i++) {
    var c = clienti[i];
    var tipColor = c.tipologia_colore || '#5b8df6';
    var avatar = getAvatar(c.nome);
    html += '<div class="cliente-senza-adp-row" style="' +
      'display: flex; align-items: center; justify-content: space-between; background: var(--s2); border: 1px solid var(--b1); border-radius: 10px; padding: 12px 16px; gap: 12px;">' +
      '<div style="display: flex; align-items: center; gap: 12px; flex: 1;">' +
      '<div class="cliente-avatar-sm" style="width: 40px; height: 40px; border-radius: 10px; background: ' + tipColor + '22; border: 2px solid ' + tipColor + '; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px;">' + avatar + '</div>' +
      '<div><div style="font-weight: 700; font-size: 15px;">' + escAttr(c.nome) + '</div>' +
      '<div style="font-size: 12px; color: var(--t2);">' + (c.tipologia_codice || '-') + ' · ' + (c.email || 'nessuna email') + '</div></div>' +
      '</div>' +
      '<button class="btn btn-primary btn-sm" onclick="goToClienteScadenzarioDiretto(' + c.id + ')" style="white-space: nowrap;">📅 Vai al Cliente</button>' +
      '</div>';
  }
  
  html += '</div></div>';
  container.innerHTML = html;
}

// ⭐ VAI DIRETTAMENTE ALLO SCADENZARIO DEL CLIENTE
function goToClienteScadenzarioDiretto(clienteId) {
  var cliente = null;
  if (state.clienti) {
    for (var i = 0; i < state.clienti.length; i++) {
      if (state.clienti[i].id === clienteId) {
        cliente = state.clienti[i];
        break;
      }
    }
  }
  
  if (cliente) {
    state.selectedCliente = cliente;
    document.querySelectorAll(".nav-item").forEach(function(x) { x.classList.remove("active"); });
    var scadNav = document.querySelector('[data-page="scadenzario"]');
    if (scadNav) scadNav.classList.add("active");
    renderPage("scadenzario");
  } else {
    state._gotoClienteId = clienteId;
    state._pending = "scadenzario";
    socket.emit("get:clienti", { anno: state.anno });
    document.querySelectorAll(".nav-item").forEach(function(x) { x.classList.remove("active"); });
    var scadNav2 = document.querySelector('[data-page="scadenzario"]');
    if (scadNav2) scadNav2.classList.add("active");
    renderPage("scadenzario");
  }
}

// ⭐ APRI MODAL APPLICA ADEMPIMENTI CON CLIENTI VUOTI PRESELEZIONATI
function apriApplicaAdempimentiPerVuoti() {
  socket.emit("get:clienti_senza_adempimenti", { anno: state.anno });
  socket.once("res:clienti_senza_adempimenti", function(data) {
    if (data.success && data.data && data.data.length > 0) {
      var clientiVuotiIds = [];
      for (var i = 0; i < data.data.length; i++) {
        clientiVuotiIds.push(data.data[i].id);
      }
      
      if (!state.adempimenti || state.adempimenti.length === 0) {
        socket.emit("get:adempimenti");
        socket.once("res:adempimenti", function(adpData) {
          if (adpData.success) {
            state.adempimenti = adpData.data;
            apriModalConPreselezione(clientiVuotiIds);
          }
        });
      } else {
        apriModalConPreselezione(clientiVuotiIds);
      }
    } else {
      showNotif("Nessun cliente senza adempimenti da assegnare", "info");
    }
  });
}

function apriModalConPreselezione(clientiVuotiIds) {
  socket.emit("get:clienti", { anno: state.anno });
  socket.once("res:clienti", function(data) {
    if (data.success) {
      state.clienti = data.data;
      renderApplicaAdempimentiModal();
      renderApplicaClientiList();
      
      setTimeout(function() {
        var checkboxes = document.querySelectorAll(".applica-cliente-checkbox");
        for (var i = 0; i < checkboxes.length; i++) {
          var cb = checkboxes[i];
          if (clientiVuotiIds.indexOf(parseInt(cb.value)) !== -1) {
            cb.checked = true;
          }
        }
        
        var infoBox = document.querySelector("#modal-applica-adempimenti .infobox");
        if (infoBox) {
          infoBox.innerHTML = '✅ <strong>' + clientiVuotiIds.length + '</strong> clienti senza adempimenti sono stati preselezionati.<br>📌 Scegli gli adempimenti da assegnare e premi "Applica".';
          infoBox.style.background = "var(--orange)18";
          infoBox.style.borderColor = "var(--orange)";
          infoBox.style.color = "var(--orange)";
        }
      }, 100);
      
      document.getElementById("applica-adempimenti-anno").value = state.anno;
      openModal("modal-applica-adempimenti");
    }
  });
}

// ⭐ APRE MODAL APPLICA ADEMPIMENTI GENERICO
function openApplicaAdempimenti() {
  if (!state.adempimenti || state.adempimenti.length === 0) {
    socket.emit("get:adempimenti");
    socket.once("res:adempimenti", function(data) {
      if (data.success) {
        state.adempimenti = data.data;
        renderApplicaAdempimentiModal();
      }
    });
  } else {
    renderApplicaAdempimentiModal();
  }
  
  socket.emit("get:clienti", { anno: state.anno });
  socket.once("res:clienti", function(data) {
    if (data.success) {
      state.clienti = data.data;
      renderApplicaClientiList();
    }
  });
  
  var infoBox = document.querySelector("#modal-applica-adempimenti .infobox");
  if (infoBox) {
    infoBox.innerHTML = '✅ Seleziona <strong>uno o più adempimenti</strong> e <strong>uno o più clienti</strong>.<br>📌 Gli adempimenti già presenti vengono conservati.';
    infoBox.style.background = "";
    infoBox.style.borderColor = "";
    infoBox.style.color = "";
  }
  
  document.getElementById("applica-adempimenti-anno").value = state.anno;
  openModal("modal-applica-adempimenti");
}

function renderApplicaAdempimentiModal() {
  var container = document.getElementById("applica-adp-list");
  if (!container) return;
  if (!state.adempimenti || state.adempimenti.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;">📋 Nessun adempimento</div>';
    return;
  }
  
  var adpOrdinati = [];
  for (var i = 0; i < state.adempimenti.length; i++) {
    adpOrdinati.push(state.adempimenti[i]);
  }
  adpOrdinati.sort(function(a, b) { return a.nome.localeCompare(b.nome); });
  
  var html = '<div style="display:flex;flex-wrap:wrap;">';
  for (var j = 0; j < adpOrdinati.length; j++) {
    var adp = adpOrdinati[j];
    html += '<label class="flag-chip" style="margin:4px;padding:6px 12px;font-size:13px;width:calc(33% - 8px);">' +
      '<input type="checkbox" class="applica-adp-checkbox" value="' + adp.id + '">' +
      '<span><strong>' + adp.codice + '</strong> — ' + adp.nome + '</span>' +
      '</label>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function renderApplicaClientiList() {
  var container = document.getElementById("applica-clienti-list");
  if (!container) return;
  if (!state.clienti || state.clienti.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;">👥 Nessun cliente</div>';
    return;
  }
  
  var soloAttivi = true;
  var attiviCheck = document.getElementById("applica-clienti-solo-attivi");
  if (attiviCheck && attiviCheck.checked === false) soloAttivi = false;
  
  var clientiFiltrati = [];
  for (var i = 0; i < state.clienti.length; i++) {
    var c = state.clienti[i];
    if (!soloAttivi || c.attivo === 1) clientiFiltrati.push(c);
  }
  
  var searchInput = document.getElementById("applica-clienti-search");
  if (searchInput && searchInput.value) {
    var searchTerm = searchInput.value.toLowerCase();
    var temp = [];
    for (var j = 0; j < clientiFiltrati.length; j++) {
      var cl = clientiFiltrati[j];
      if ((cl.nome && cl.nome.toLowerCase().indexOf(searchTerm) !== -1) || 
          (cl.codice_fiscale && cl.codice_fiscale.toLowerCase().indexOf(searchTerm) !== -1)) {
        temp.push(cl);
      }
    }
    clientiFiltrati = temp;
  }
  
  clientiFiltrati.sort(function(a, b) { return a.nome.localeCompare(b.nome); });
  
  var html = '<div style="display:flex;flex-wrap:wrap;">';
  for (var k = 0; k < clientiFiltrati.length; k++) {
    var cli = clientiFiltrati[k];
    html += '<label class="flag-chip" style="margin:4px;padding:6px 12px;font-size:13px;width:calc(33% - 8px);">' +
      '<input type="checkbox" class="applica-cliente-checkbox" value="' + cli.id + '">' +
      '<span>👤 ' + cli.nome + (cli.tipologia_codice ? ' (' + cli.tipologia_codice + ')' : '') + '</span>' +
      '</label>';
  }
  html += '</div>';
  container.innerHTML = html;
}

function filtraClientiApplica() { renderApplicaClientiList(); }
function toggleSelezionaTuttiAdpApplica() {
  var sel = document.getElementById("applica-adp-seleziona-tutti");
  var checked = sel ? sel.checked : false;
  var cbs = document.querySelectorAll(".applica-adp-checkbox");
  for (var i = 0; i < cbs.length; i++) cbs[i].checked = checked;
}
function toggleSelezionaTuttiClientiApplica() {
  var sel = document.getElementById("applica-clienti-seleziona-tutti");
  var checked = sel ? sel.checked : false;
  var cbs = document.querySelectorAll(".applica-cliente-checkbox");
  for (var i = 0; i < cbs.length; i++) cbs[i].checked = checked;
}
function resetSelezioneAdpApplica() {
  var cbs = document.querySelectorAll(".applica-adp-checkbox");
  for (var i = 0; i < cbs.length; i++) cbs[i].checked = false;
  var sel = document.getElementById("applica-adp-seleziona-tutti");
  if (sel) sel.checked = false;
}
function getSelectedAdempimentiApplica() {
  var selected = [];
  var cbs = document.querySelectorAll(".applica-adp-checkbox:checked");
  for (var i = 0; i < cbs.length; i++) selected.push(parseInt(cbs[i].value));
  return selected;
}
function getSelectedClientiApplica() {
  var selected = [];
  var cbs = document.querySelectorAll(".applica-cliente-checkbox:checked");
  for (var i = 0; i < cbs.length; i++) selected.push(parseInt(cbs[i].value));
  return selected;
}
function eseguiApplicaAdempimenti() {
  var adpIds = getSelectedAdempimentiApplica();
  var clientiIds = getSelectedClientiApplica();
  var annoElem = document.getElementById("applica-adempimenti-anno");
  var anno = annoElem ? parseInt(annoElem.value) : state.anno;
  if (adpIds.length === 0) { showNotif("Seleziona almeno un adempimento", "error"); return; }
  if (clientiIds.length === 0) { showNotif("Seleziona almeno un cliente", "error"); return; }
  socket.emit("applica:adempimenti_a_clienti", { adempimenti_ids: adpIds, clienti_ids: clientiIds, anno: anno });
  closeModal("modal-applica-adempimenti");
}

// ⭐ GO TO VISTA GLOBALE CON FILTRO
function goVistaGlobaleAdp(nome) {
  var filterValue = nome;
  state.globalePreFiltroAdp = filterValue;
  
  document.querySelectorAll(".nav-item").forEach(function(x) { x.classList.remove("active"); });
  var globaleNavItem = document.querySelector('[data-page="scadenzario_globale"]');
  if (globaleNavItem) globaleNavItem.classList.add("active");
  
  state.dashSearch = "";
  state.dashFiltroStatoAdp = "";
  
  renderPage("scadenzario_globale");
}

// ⭐ STATISTICHE E ALTRO
function onDashFiltroStatoAdp() {
  var el = document.getElementById("dash-filtro-stato-adp");
  state.dashFiltroStatoAdp = el ? el.value : "";
  if (state.dashStats) updateDashboardContent(state.dashStats);
}

// ⭐ TIPOLOGIE FILTER PANEL FUNCTIONS
var _dashTipFiltroPanelOpen = false;

function toggleDashTipFiltroPanel(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  _dashTipFiltroPanelOpen = !_dashTipFiltroPanelOpen;
  _aggiornaDashPanelVisibility();
}

function closeDashTipFiltroPanel(event) {
  if (event) { event.stopPropagation(); event.preventDefault(); }
  _dashTipFiltroPanelOpen = false;
  _aggiornaDashPanelVisibility();
}

function _aggiornaDashPanelVisibility() {
  var container = document.getElementById("dash-tip-filtro-container");
  if (!container) return;
  container.style.display = _dashTipFiltroPanelOpen ? "block" : "none";
  var btn = document.getElementById("dash-tip-filtro-toggle-btn");
  if (btn) {
    btn.innerHTML = _dashTipFiltroPanelOpen
      ? '<button class="btn btn-xs btn-secondary" onclick="closeDashTipFiltroPanel(event)">✕ Chiudi</button>'
      : '<button class="btn btn-xs btn-secondary" onclick="toggleDashTipFiltroPanel(event)">▼ Espandi</button>';
  }
}

function _aggiornaDashTipFiltroCounter() {
  var badge = document.getElementById("dash-tip-filtro-count");
  var warning = document.getElementById("dash-tip-filtro-warning");
  if (!badge) return;
  
  var keys = typeof _getActiveFiltroKeys === "function" ? _getActiveFiltroKeys() : new Set();
  var allKeys = typeof window._getAllKeys === "function" ? window._getAllKeys() : [];
  var isNone = (typeof _isManualNessuno === "function" ? _isManualNessuno() : false) || keys.size === 0;
  var isAll = !isNone && keys.size === allKeys.length;
  
  if (isNone) {
    badge.textContent = "0";
    badge.style.display = "inline-flex";
    badge.style.background = "var(--red)";
    if (warning) warning.style.display = "inline";
  } else if (isAll) {
    badge.textContent = "";
    badge.style.display = "none";
    if (warning) warning.style.display = "none";
  } else {
    badge.textContent = keys.size;
    badge.style.display = "inline-flex";
    badge.style.background = "var(--accent)";
    if (warning) warning.style.display = "none";
  }
}

function _refreshDashTipFiltroPanel() {
  var container = document.getElementById("dash-tip-filtro-container");
  if (!container || !_dashTipFiltroPanelOpen) return;
  if (typeof renderTipologieFiltroPanel === "function") {
    var tmp = document.createElement("div");
    tmp.innerHTML = renderTipologieFiltroPanel();
    container.innerHTML = "";
    container.appendChild(tmp.firstChild);
    
    // Aggiungi event listener per i cambiamenti dei checkbox nel pannello
    container.querySelectorAll('input[type="checkbox"]').forEach(function(cb) {
      cb.addEventListener('change', function() {
        setTimeout(function() {
          if (state.dashStats) updateDashboardContent(state.dashStats);
        }, 100);
      });
    });
  }
  container.style.display = "block";
  _aggiornaDashTipFiltroCounter();
  
  // Apply dashboard filters after tipologie change
  setTimeout(function() {
    if (state.dashStats) updateDashboardContent(state.dashStats);
  }, 100);
}

function resetDashFiltri() {
  state.dashSearch = "";
  state.dashFiltroStatoAdp = "";
  var searchEl = document.getElementById("dash-adp-search");
  if (searchEl) searchEl.value = "";
  var statoEl = document.getElementById("dash-filtro-stato-adp");
  if (statoEl) statoEl.value = "";
  
  // Reset tipologie filter
  if (typeof initializeTipologieFilter === "function") initializeTipologieFilter();
  _refreshDashTipFiltroPanel();
  _aggiornaDashTipFiltroCounter();
  
  if (state.dashStats) updateDashboardContent(state.dashStats);
}

function adempimentoPassaFiltroStato(a, ss) {
  if (!ss) return true;
  var inCorso = a.totale - a.completati - a.da_fare - (a.na || 0);
  var na = a.na || 0;
  if (ss === "da_fare") return a.da_fare > 0;
  if (ss === "in_corso") return inCorso > 0;
  if (ss === "completato") return a.completati > 0;
  if (ss === "n_a") return na > 0;
  return true;
}

function clientePassaFiltroTipologieDashboard(adempimento) {
  // Per la dashboard, controlliamo se l'adempimento ha clienti che passano il filtro
  // Se non ci sono filtri attivi o sono tutti selezionati, passa tutto
  var activeFiltroKeys = typeof _getActiveFiltroKeys === "function" ? _getActiveFiltroKeys() : new Set();
  var allKeys = typeof window._getAllKeys === "function" ? window._getAllKeys() : [];
  var isNone = (typeof _isManualNessuno === "function" ? _isManualNessuno() : false) || activeFiltroKeys.size === 0;
  var isAll = !isNone && activeFiltroKeys.size === allKeys.length;
  
  if (isNone) return false;
  if (isAll) return true;
  
  // Se l'adempimento ha un cliente_tipologia_codice, verifichiamolo
  if (adempimento.cliente_tipologia_codice) {
    var tipCod = adempimento.cliente_tipologia_codice;
    var keysArray = Array.from(activeFiltroKeys);
    for (var i = 0; i < keysArray.length; i++) {
      var key = keysArray[i];
      var parts = key.split("|");
      var kTip = parts[0];
      if (kTip === tipCod) return true;
    }
    return false;
  }
  
  return true;
}

function updateDashboardContent(stats) {
  var allAdp = stats.adempimentiStats || [];
  var sq = (state.dashSearch || "").toLowerCase();
  var ss = state.dashFiltroStatoAdp || "";
  
  var adpVis = [];
  for (var i = 0; i < allAdp.length; i++) {
    var a = allAdp[i];
    if (sq && a.nome.toLowerCase().indexOf(sq) === -1 && a.codice.toLowerCase().indexOf(sq) === -1) continue;
    if (!adempimentoPassaFiltroStato(a, ss)) continue;
    if (!clientePassaFiltroTipologieDashboard(a)) continue;
    adpVis.push(a);
  }
  
  var fT = 0, fC = 0, fD = 0, fI = 0;
  for (var j = 0; j < adpVis.length; j++) {
    var aa = adpVis[j];
    fT += aa.totale;
    fC += aa.completati;
    fD += aa.da_fare;
    fI += (aa.totale - aa.completati - aa.da_fare);
  }
  var fP = fT > 0 ? Math.round((fC / fT) * 100) : 0;
  var isF = sq !== "" || ss !== "";
  
  var lblTot = document.getElementById("ds-lbl-tot");
  if (lblTot) lblTot.innerHTML = 'Adempimenti ' + stats.anno + (isF ? ' <span style="font-size:10px;color:var(--yellow)">(filtro)</span>' : '');
  
  var totEl = document.getElementById("ds-tot");
  if (totEl) totEl.textContent = fT;
  var compEl = document.getElementById("ds-comp");
  if (compEl) compEl.textContent = fC;
  var dafareEl = document.getElementById("ds-dafare");
  if (dafareEl) dafareEl.textContent = fD;
  var incorsoEl = document.getElementById("ds-incorso");
  if (incorsoEl) incorsoEl.textContent = fI;
  var percEl = document.getElementById("ds-perc");
  if (percEl) percEl.textContent = fP + "%";
  var progEl = document.getElementById("ds-prog");
  if (progEl) progEl.style.width = fP + "%";
  
  var titleEl = document.getElementById("dash-adp-count-title");
  if (titleEl) titleEl.innerHTML = 'Adempimenti ' + stats.anno + ' <span style="font-size:12px;font-weight:400;color:var(--text3);margin-left:6px">' + adpVis.length + '/' + allAdp.length + '</span>';
  
  var grid = document.getElementById("dash-adp-grid");
  if (!grid) return;
  
  if (adpVis.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text3)"><div style="font-size:40px;margin-bottom:16px">📋</div><div>Nessun adempimento</div></div>';
    return;
  }
  
  var html = "";
  for (var k = 0; k < adpVis.length; k++) {
    var adpItem = adpVis[k];
    var p = adpItem.totale > 0 ? Math.round((adpItem.completati / adpItem.totale) * 100) : 0;
    var iC = Math.max(0, adpItem.totale - adpItem.completati - adpItem.da_fare - (adpItem.na || 0));
    var pgColor = p === 100 ? "var(--green)" : p > 50 ? "var(--yellow)" : "var(--red)";
    html += '<div class="dash-adp-card" onclick="goVistaGlobaleAdp(\'' + adpItem.nome.replace(/'/g, "\\'") + '\')">' +
      '<div class="dash-adp-card-top">' +
      '<span class="adp-def-codice">' + adpItem.codice + '</span>' +
      '<div class="mini-bar" style="width:60px"><div class="mini-fill" style="width:' + p + '%;background:' + pgColor + '"></div></div>' +
      '<span style="font-size:11px;font-family:var(--mono);color:' + pgColor + '">' + p + '%</span>' +
      '</div>' +
      '<div class="dash-adp-nome">' + adpItem.nome + '</div>' +
      '<div class="dash-adp-stats">' +
      '<div class="dash-stat-chip"><span class="ds-num">' + adpItem.totale + '</span><span class="ds-lbl">Tot.</span></div>' +
      '<div class="dash-stat-chip" style="color:var(--green)"><span class="ds-num">' + adpItem.completati + '</span><span class="ds-lbl">✓</span></div>' +
      '<div class="dash-stat-chip" style="color:var(--red)"><span class="ds-num">' + adpItem.da_fare + '</span><span class="ds-lbl">⭕</span></div>' +
      (iC > 0 ? '<div class="dash-stat-chip" style="color:var(--yellow)"><span class="ds-num">' + iC + '</span><span class="ds-lbl">🔄</span></div>' : '') +
      '</div></div>';
  }
  grid.innerHTML = html;
}

function renderDashboard(stats) {
  if (!state._dashRendered) buildDashboardShell(stats);
  
  // Store stats for tipologie filter
  state.dashStats = stats;
  
  updateDashboardContent(stats);
  
  // Initialize tipologie filter
  if (typeof initializeTipologieFilter === "function") {
    initializeTipologieFilter();
  }
  _refreshDashTipFiltroPanel();
  _aggiornaDashTipFiltroCounter();
}

function onDashAdpSearch(val) { 
  state.dashSearch = val; 
  if (state.dashStats) updateDashboardContent(state.dashStats); 
}

// ⭐ LISTENER SOCKET
if (typeof socket !== "undefined") {
  socket.on("res:clienti_senza_adempimenti", function(data) {
    if (data.success) renderClientiSenzaAdempimenti(data.data);
  });
  socket.on("res:applica:adempimenti_a_clienti", function(data) {
    if (data.success) {
      var msg = "✅ Applicati " + data.inseriti + " adempimenti a " + data.clienti + " clienti";
      if (data.dettagli && data.dettagli.skipped > 0) msg += " — " + data.dettagli.skipped + " già esistenti";
      showNotif(msg, "success");
      socket.emit("get:stats", { anno: state.anno });
      caricaClientiSenzaAdempimenti();
    } else {
      showNotif("❌ Errore: " + (data.error || "Operazione fallita"), "error");
    }
  });
}

// Esponi funzioni globali
window.openApplicaAdempimenti = openApplicaAdempimenti;
window.filtraClientiApplica = filtraClientiApplica;
window.toggleSelezionaTuttiAdpApplica = toggleSelezionaTuttiAdpApplica;
window.toggleSelezionaTuttiClientiApplica = toggleSelezionaTuttiClientiApplica;
window.resetSelezioneAdpApplica = resetSelezioneAdpApplica;
window.eseguiApplicaAdempimenti = eseguiApplicaAdempimenti;
window.apriApplicaAdempimentiPerVuoti = apriApplicaAdempimentiPerVuoti;
window.goToClienteScadenzarioDiretto = goToClienteScadenzarioDiretto;
window.caricaClientiSenzaAdempimenti = caricaClientiSenzaAdempimenti;
window.goVistaGlobaleAdp = goVistaGlobaleAdp;
window.onDashFiltroStatoAdp = onDashFiltroStatoAdp;
window.resetDashFiltri = resetDashFiltri;
window.onDashAdpSearch = onDashAdpSearch;
window.toggleDashTipFiltroPanel = toggleDashTipFiltroPanel;
window.closeDashTipFiltroPanel = closeDashTipFiltroPanel;
window._aggiornaDashPanelVisibility = _aggiornaDashPanelVisibility;
window._aggiornaDashTipFiltroCounter = _aggiornaDashTipFiltroCounter;
window._refreshDashTipFiltroPanel = _refreshDashTipFiltroPanel;