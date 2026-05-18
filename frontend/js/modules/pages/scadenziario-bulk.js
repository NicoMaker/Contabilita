// ═══════════════════════════════════════════════════════════════
// SCADENZARIO-BULK.JS — Eliminazione multipla righe scadenzario
//                        + Modale Aggiungi/Elimina adempimento
//                          per singolo cliente
//
// ─── FUNZIONALITÀ ────────────────────────────────────────────
//  A) BULK-ROW  — selezione checkbox sulle righe della tabella
//     • toggleScadBulkMode()        apre/chiude la modalità
//     • toggleSelezionaTuttiBulk()  seleziona/deseleziona tutto
//     • eliminaBulkScadenzario()    invia elimina:adempimenti_cliente_bulk
//
//  B) MODALE AGGIUNGI / ELIMINA ADEMPIMENTO
//     • switchAddAdpTab(tab)         'aggiungi' | 'elimina'
//     • popolaDelAdpList()           riempie la lista "Elimina"
//                                    con gli adempimenti già presenti
//     • toggleSelezionaTuttiDelAdp() seleziona/deseleziona tutto Elimina
//     • eseguiEliminaAdpCliente()    invia elimina:adempimenti_cliente_bulk
//                                    usando gli id_adempimento selezionati
//                                    (raccoglie tutti i record del cliente/anno)
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════
//  A) BULK-ROW MODE
// ══════════════════════════════════════════════════════════════

var _scadBulkMode = false;

function toggleScadBulkMode() {
  _scadBulkMode = !_scadBulkMode;
  _aggiornaUIBulkMode();
}

function _aggiornaUIBulkMode() {
  var btnToggle  = document.getElementById("btn-scad-bulk-toggle");
  var barraAzioni = document.getElementById("scad-bulk-barra");

  if (btnToggle) {
    if (_scadBulkMode) {
      btnToggle.textContent    = "✖ Annulla selezione";
      btnToggle.style.background   = "var(--surface3)";
      btnToggle.style.color        = "var(--text2)";
      btnToggle.style.borderColor  = "var(--border)";
    } else {
      btnToggle.textContent    = "☑ Seleziona per eliminare";
      btnToggle.style.background   = "";
      btnToggle.style.color        = "";
      btnToggle.style.borderColor  = "";
    }
  }

  if (barraAzioni) {
    barraAzioni.style.display = _scadBulkMode ? "flex" : "none";
  }

  document.querySelectorAll(".scad-bulk-checkbox-col").forEach(function (el) {
    el.style.display = _scadBulkMode ? "" : "none";
  });

  if (!_scadBulkMode) {
    document.querySelectorAll(".scad-row-checkbox").forEach(function (cb) {
      cb.checked = false;
    });
    _aggiornaBulkCounter();
  }
}

function toggleSelezionaTuttiBulk() {
  var checkboxes = document.querySelectorAll(".scad-row-checkbox");
  var tuttiChecked = Array.from(checkboxes).every(function (cb) { return cb.checked; });
  checkboxes.forEach(function (cb) { cb.checked = !tuttiChecked; });
  _aggiornaBulkCounter();
}

function _aggiornaBulkCounter() {
  var n       = document.querySelectorAll(".scad-row-checkbox:checked").length;
  var btn     = document.getElementById("btn-scad-bulk-elimina");
  var counter = document.getElementById("scad-bulk-counter");
  if (counter) counter.textContent = n + " selezionat" + (n === 1 ? "o" : "i");
  if (btn) {
    btn.disabled     = n === 0;
    btn.style.opacity = n === 0 ? "0.5" : "1";
  }
}

function eliminaBulkScadenzario() {
  var checkboxes = document.querySelectorAll(".scad-row-checkbox:checked");
  var ids = Array.from(checkboxes).map(function (cb) { return parseInt(cb.value); });

  if (ids.length === 0) {
    showNotif("Seleziona almeno un adempimento", "error");
    return;
  }

  if (!confirm(
    "Eliminerai " + ids.length + " adempiment" + (ids.length === 1 ? "o" : "i") +
    " dal cliente.\n\nL'operazione è irreversibile. Confermi?"
  )) return;

  var cliente = state.selectedCliente;
  var anno    = state.anno;

  socket.emit("elimina:adempimenti_cliente_bulk", {
    ids_righe:  ids,
    id_cliente: cliente ? cliente.id : null,
    anno:       anno,
  });
}

// ─── SOCKET LISTENER bulk-row ─────────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  if (typeof socket === "undefined") return;

  socket.on("res:elimina:adempimenti_cliente_bulk", function (data) {
    if (data.success) {
      showNotif(
        "🗑️ Eliminat" + (data.eliminati === 1 ? "o" : "i") + " " + data.eliminati +
        " adempiment" + (data.eliminati === 1 ? "o" : "i"),
        "success"
      );
      _scadBulkMode = false;
      _aggiornaUIBulkMode();
      if (typeof loadScadenzario === "function") loadScadenzario();
    } else {
      showNotif("❌ Errore: " + (data.error || "Eliminazione fallita"), "error");
    }
  });
});

// ─── PATCH renderScadenzarioTabella ──────────────────────────
function patchScadBulk() {
  var tabella = document.querySelector(".scad-table, #scad-tabella, table.adp-table");
  if (!tabella) return;
  if (tabella.dataset.bulkPatched) return;
  tabella.dataset.bulkPatched = "1";

  _iniettaColonnaCheckbox(tabella);
  _iniettaBarraAzioni();
  _iniettaBotoneTopbar();

  if (_scadBulkMode) _aggiornaUIBulkMode();
}

function _iniettaColonnaCheckbox(tabella) {
  var thead = tabella.querySelector("thead tr");
  if (thead) {
    var th = document.createElement("th");
    th.className  = "scad-bulk-checkbox-col";
    th.style.cssText = "width:36px;text-align:center;padding:4px;display:none";
    th.innerHTML  = '<input type="checkbox" title="Seleziona tutti" onchange="toggleSelezionaTuttiBulk()" style="cursor:pointer;width:15px;height:15px">';
    thead.insertBefore(th, thead.firstChild);
  }

  tabella.querySelectorAll("tbody tr[data-id]").forEach(function (tr) {
    var rigaId = tr.dataset.id;
    var td = document.createElement("td");
    td.className  = "scad-bulk-checkbox-col";
    td.style.cssText = "width:36px;text-align:center;padding:4px 8px;display:none;vertical-align:middle";
    td.innerHTML  = '<input type="checkbox" class="scad-row-checkbox" value="' + rigaId +
                    '" onchange="_aggiornaBulkCounter()" style="cursor:pointer;width:15px;height:15px">';
    tr.insertBefore(td, tr.firstChild);
  });
}

function _iniettaBarraAzioni() {
  var vecchia = document.getElementById("scad-bulk-barra");
  if (vecchia) vecchia.remove();

  var wrapper =
    document.querySelector(".scad-wrapper, #scad-content-wrapper, .content-inner") ||
    document.getElementById("content");
  if (!wrapper) return;

  var barra = document.createElement("div");
  barra.id = "scad-bulk-barra";
  barra.style.cssText = [
    "display:none",
    "align-items:center",
    "gap:10px",
    "padding:10px 14px",
    "background:var(--surface2)",
    "border:1px solid var(--red)",
    "border-radius:var(--radius)",
    "margin-bottom:12px",
    "flex-wrap:wrap",
  ].join(";");

  barra.innerHTML = [
    '<span id="scad-bulk-counter" style="font-size:13px;font-weight:700;color:var(--text)">0 selezionati</span>',
    '<button class="btn btn-sm" onclick="toggleSelezionaTuttiBulk()" style="font-size:12px">☑ Seleziona tutti</button>',
    '<button id="btn-scad-bulk-elimina" class="btn btn-sm" onclick="eliminaBulkScadenzario()" disabled',
    '  style="background:var(--red);color:#fff;border-color:var(--red);font-size:12px;opacity:0.5">',
    "🗑️ Elimina selezionati</button>",
    '<span style="flex:1"></span>',
    '<button class="btn btn-sm btn-secondary" onclick="toggleScadBulkMode()" style="font-size:12px">✖ Annulla</button>',
  ].join("");

  var tabella = document.querySelector(".scad-table, #scad-tabella, table.adp-table");
  if (tabella && tabella.parentNode === wrapper) {
    wrapper.insertBefore(barra, tabella);
  } else {
    wrapper.insertBefore(barra, wrapper.firstChild);
  }
}

function _iniettaBotoneTopbar() {
  if (document.getElementById("btn-scad-bulk-toggle")) return;
  var topbarActions = document.getElementById("topbar-actions");
  if (!topbarActions) return;

  var btn = document.createElement("button");
  btn.id            = "btn-scad-bulk-toggle";
  btn.className     = "btn btn-sm no-print";
  btn.style.cssText = "font-size:13px;border:1px solid var(--red);color:var(--red);background:transparent";
  btn.textContent   = "☑ Seleziona per eliminare";
  btn.onclick       = toggleScadBulkMode;
  topbarActions.appendChild(btn);
}


// ══════════════════════════════════════════════════════════════
//  B) MODALE AGGIUNGI / ELIMINA ADEMPIMENTO
// ══════════════════════════════════════════════════════════════

// Stato corrente della tab attiva nella modale
var _addAdpTabAttiva = "aggiungi";

/**
 * Cambia tab nella modale (chiamata dai pulsanti tab dell'HTML)
 * @param {'aggiungi'|'elimina'} tab
 */
function switchAddAdpTab(tab) {
  _addAdpTabAttiva = tab;

  var panelAdd = document.getElementById("tab-panel-aggiungi");
  var panelDel = document.getElementById("tab-panel-elimina");
  var btnAdd   = document.getElementById("tab-add-adp-btn");
  var btnDel   = document.getElementById("tab-del-adp-btn");

  if (!panelAdd || !panelDel) return;

  if (tab === "aggiungi") {
    panelAdd.style.display = "";
    panelDel.style.display = "none";
    if (btnAdd) { btnAdd.style.background = "var(--accent)";   btnAdd.style.color = "#fff"; }
    if (btnDel) { btnDel.style.background = "var(--surface2)"; btnDel.style.color = "var(--text2)"; }
  } else {
    panelAdd.style.display = "none";
    panelDel.style.display = "";
    if (btnAdd) { btnAdd.style.background = "var(--surface2)"; btnAdd.style.color = "var(--text2)"; }
    if (btnDel) { btnDel.style.background = "var(--red)";      btnDel.style.color = "#fff"; }
    // Popola la lista "Elimina" ogni volta che si apre la tab
    popolaDelAdpList();
  }
}

/**
 * Popola #del-adp-list con gli adempimenti già presenti per
 * il cliente + anno correntemente selezionati.
 *
 * Usa state.scadenzario (già caricato) per ricavare i dati:
 * raggruppa per id_adempimento e mostra una riga per adempimento
 * (non per singola riga mese/trimestre: quando elimini un adempimento
 * vengono eliminati tutti i suoi periodi per quel cliente/anno).
 */
function popolaDelAdpList() {
  var container = document.getElementById("del-adp-list");
  var annoInput = document.getElementById("del-adp-anno");
  var avviso    = document.getElementById("del-adp-avviso");
  var btnElim   = document.getElementById("btn-esegui-elimina-adp");
  var chkTutti  = document.getElementById("del-adp-seleziona-tutti");

  if (!container) return;

  // Sincronizza l'anno con il campo "aggiungi"
  var anno = parseInt(document.getElementById("add-adp-anno")?.value) || state.anno;
  if (annoInput) annoInput.value = anno;

  // Recupera le righe dello scadenzario del cliente per l'anno
  var righe = (state.scadenzario || []).filter(function (r) {
    return parseInt(r.anno) === anno;
  });

  // Raggruppa per id_adempimento: una checkbox per adempimento, non per periodo
  var adpMap = {};
  righe.forEach(function (r) {
    var adpId = r.id_adempimento;
    if (!adpMap[adpId]) {
      adpMap[adpId] = {
        id_adempimento: adpId,
        nome:      r.adempimento_nome,
        codice:    r.adempimento_codice,
        ids_righe: [],
      };
    }
    adpMap[adpId].ids_righe.push(r.id);
  });

  var adpList = Object.values(adpMap).sort(function(a,b){
    return a.nome.localeCompare(b.nome);
  });

  if (avviso) avviso.style.display = adpList.length > 0 ? "" : "none";
  if (chkTutti) { chkTutti.checked = false; chkTutti.indeterminate = false; }

  if (adpList.length === 0) {
    container.innerHTML =
      '<div style="padding:14px;text-align:center;color:var(--text3);font-size:13px">' +
      'Nessun adempimento presente per questo cliente / anno</div>';
    if (btnElim) { btnElim.disabled = true; btnElim.style.opacity = "0.5"; }
    return;
  }

  container.innerHTML = "";
  adpList.forEach(function (adp) {
    var label = document.createElement("label");
    label.className   = "flag-chip";
    label.style.cssText =
      "display:flex;align-items:center;gap:8px;padding:7px 10px;" +
      "margin-bottom:4px;border-radius:6px;cursor:pointer;transition:background .12s";
    label.innerHTML =
      '<input type="checkbox" class="del-adp-checkbox"' +
      ' data-ids="' + adp.ids_righe.join(",") + '"' +
      ' data-id-adp="' + adp.id_adempimento + '"' +
      ' onchange="_aggiornaDelAdpCounter()"' +
      ' style="width:15px;height:15px;cursor:pointer">' +
      '<span style="font-size:13px;font-weight:600">' + adp.nome + '</span>' +
      '<span style="font-size:11px;color:var(--text3);margin-left:auto;font-family:var(--mono)">' +
        adp.codice +
      '</span>' +
      '<span style="font-size:10px;color:var(--text3);white-space:nowrap">' +
        '(' + adp.ids_righe.length + ' ' + (adp.ids_righe.length === 1 ? "periodo" : "periodi") + ')' +
      '</span>';
    container.appendChild(label);
  });

  _aggiornaDelAdpCounter();
}

function _aggiornaDelAdpCounter() {
  var n   = document.querySelectorAll(".del-adp-checkbox:checked").length;
  var btn = document.getElementById("btn-esegui-elimina-adp");
  var chk = document.getElementById("del-adp-seleziona-tutti");

  if (btn) {
    btn.disabled      = n === 0;
    btn.style.opacity = n === 0 ? "0.5" : "1";
  }

  if (chk) {
    var tot = document.querySelectorAll(".del-adp-checkbox").length;
    chk.checked       = tot > 0 && n === tot;
    chk.indeterminate = n > 0 && n < tot;
  }
}

function toggleSelezionaTuttiDelAdp() {
  var chkAll = document.getElementById("del-adp-seleziona-tutti");
  var stato  = chkAll ? chkAll.checked : false;
  document.querySelectorAll(".del-adp-checkbox").forEach(function (cb) {
    cb.checked = stato;
  });
  _aggiornaDelAdpCounter();
}

/**
 * Esegue l'eliminazione degli adempimenti selezionati nella tab "Elimina".
 * Raccoglie tutti gli ids_righe (adempimenti_cliente.id) corrispondenti
 * agli adempimenti spuntati, poi invia elimina:adempimenti_cliente_bulk.
 * Il backend ignora silenziosamente gli id non presenti nel DB.
 */
function eseguiEliminaAdpCliente() {
  var checked = document.querySelectorAll(".del-adp-checkbox:checked");
  if (checked.length === 0) {
    showNotif("Seleziona almeno un adempimento", "error");
    return;
  }

  var ids_righe = [];
  checked.forEach(function (cb) {
    var parts = cb.dataset.ids ? cb.dataset.ids.split(",") : [];
    parts.forEach(function (id) {
      var n = parseInt(id);
      if (!isNaN(n)) ids_righe.push(n);
    });
  });

  if (ids_righe.length === 0) {
    showNotif("Nessun record da eliminare", "error");
    return;
  }

  var nAdp     = checked.length;
  var nPeriodi = ids_righe.length;
  var anno     = parseInt(document.getElementById("del-adp-anno")?.value) || state.anno;
  var msg =
    "Eliminerai " + nAdp + " adempiment" + (nAdp === 1 ? "o" : "i") +
    " (" + nPeriodi + " " + (nPeriodi === 1 ? "periodo" : "periodi") + ")" +
    " per l'anno " + anno + ".\n\nL'operazione è irreversibile. Confermi?";

  if (!confirm(msg)) return;

  var cliente = state.selectedCliente;

  socket.emit("elimina:adempimenti_cliente_bulk", {
    ids_righe:  ids_righe,
    id_cliente: cliente ? cliente.id : null,
    anno:       anno,
  });

  closeModal("modal-add-adp");
  // Resetta la tab per la prossima apertura
  _addAdpTabAttiva = "aggiungi";
  switchAddAdpTab("aggiungi");
}


// ══════════════════════════════════════════════════════════════
//  ESPOSIZIONE GLOBALE
// ══════════════════════════════════════════════════════════════

window.toggleScadBulkMode          = toggleScadBulkMode;
window.toggleSelezionaTuttiBulk    = toggleSelezionaTuttiBulk;
window._aggiornaBulkCounter        = _aggiornaBulkCounter;
window.eliminaBulkScadenzario      = eliminaBulkScadenzario;
window.patchScadBulk               = patchScadBulk;

window.switchAddAdpTab             = switchAddAdpTab;
window.popolaDelAdpList            = popolaDelAdpList;
window._aggiornaDelAdpCounter      = _aggiornaDelAdpCounter;
window.toggleSelezionaTuttiDelAdp  = toggleSelezionaTuttiDelAdp;
window.eseguiEliminaAdpCliente     = eseguiEliminaAdpCliente;