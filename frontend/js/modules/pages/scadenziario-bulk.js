// ═══════════════════════════════════════════════════════════════
// SCADENZARIO-BULK.JS — Eliminazione multipla adempimenti per
//                        singolo cliente nella pagina Scadenzario
//
// Come funziona:
//   1. In modalità "Elimina" le righe mostrano una checkbox
//   2. Si selezionano le righe da eliminare
//   3. Il bottone "🗑️ Elimina selezionati" chiama eliminaBulkScadenzario()
//   4. Il server cancella solo le righe presenti (ignora le altre)
//
// Include anche il socket listener per res:elimina:adempimenti_cliente_bulk
// ═══════════════════════════════════════════════════════════════

// ─── STATO ────────────────────────────────────────────────────
var _scadBulkMode = false; // true = modalità selezione multipla attiva

// ─── TOGGLE MODALITÀ BULK ─────────────────────────────────────
function toggleScadBulkMode() {
  _scadBulkMode = !_scadBulkMode;
  _aggiornaUIBulkMode();
}

function _aggiornaUIBulkMode() {
  var btnToggle = document.getElementById("btn-scad-bulk-toggle");
  var barraAzioni = document.getElementById("scad-bulk-barra");

  if (btnToggle) {
    if (_scadBulkMode) {
      btnToggle.textContent = "✖ Annulla selezione";
      btnToggle.style.background = "var(--surface3)";
      btnToggle.style.color = "var(--text2)";
      btnToggle.style.borderColor = "var(--border)";
    } else {
      btnToggle.textContent = "☑ Seleziona per eliminare";
      btnToggle.style.background = "";
      btnToggle.style.color = "";
      btnToggle.style.borderColor = "";
    }
  }

  if (barraAzioni) {
    barraAzioni.style.display = _scadBulkMode ? "flex" : "none";
  }

  // Mostra/nascondi colonna checkbox nella tabella
  document.querySelectorAll(".scad-bulk-checkbox-col").forEach(function (el) {
    el.style.display = _scadBulkMode ? "" : "none";
  });

  // Deseleziona tutto quando si esce dalla modalità
  if (!_scadBulkMode) {
    document.querySelectorAll(".scad-row-checkbox").forEach(function (cb) {
      cb.checked = false;
    });
    _aggiornaBulkCounter();
  }
}

// ─── SELEZIONA TUTTI / DESELEZIONA TUTTI ──────────────────────
function toggleSelezionaTuttiBulk() {
  var checkboxes = document.querySelectorAll(".scad-row-checkbox");
  var tuttiChecked = Array.from(checkboxes).every(function (cb) {
    return cb.checked;
  });
  checkboxes.forEach(function (cb) {
    cb.checked = !tuttiChecked;
  });
  _aggiornaBulkCounter();
}

// ─── AGGIORNA COUNTER ─────────────────────────────────────────
function _aggiornaBulkCounter() {
  var n = document.querySelectorAll(".scad-row-checkbox:checked").length;
  var btn = document.getElementById("btn-scad-bulk-elimina");
  var counter = document.getElementById("scad-bulk-counter");
  if (counter) counter.textContent = n + " selezionat" + (n === 1 ? "o" : "i");
  if (btn) {
    btn.disabled = n === 0;
    btn.style.opacity = n === 0 ? "0.5" : "1";
  }
}

// ─── ESEGUI ELIMINAZIONE BULK ─────────────────────────────────
function eliminaBulkScadenzario() {
  var checkboxes = document.querySelectorAll(".scad-row-checkbox:checked");
  var ids = Array.from(checkboxes).map(function (cb) {
    return parseInt(cb.value);
  });

  if (ids.length === 0) {
    showNotif("Seleziona almeno un adempimento", "error");
    return;
  }

  if (
    !confirm(
      "Eliminerai " +
        ids.length +
        " adempiment" +
        (ids.length === 1 ? "o" : "i") +
        " dal cliente.\n\nL'operazione è irreversibile. Confermi?"
    )
  )
    return;

  var cliente = state.selectedCliente;
  var anno = state.anno;

  socket.emit("elimina:adempimenti_cliente_bulk", {
    ids_righe: ids,
    id_cliente: cliente ? cliente.id : null,
    anno: anno,
  });
}

// ─── SOCKET LISTENER ──────────────────────────────────────────
// Ascolta la risposta del server e ricarica lo scadenzario
document.addEventListener("DOMContentLoaded", function () {
  if (typeof socket === "undefined") return;

  socket.on("res:elimina:adempimenti_cliente_bulk", function (data) {
    if (data.success) {
      showNotif(
        "🗑️ Eliminat" +
          (data.eliminati === 1 ? "o" : "i") +
          " " +
          data.eliminati +
          " adempiment" +
          (data.eliminati === 1 ? "o" : "i"),
        "success"
      );
      // Esci dalla modalità bulk e ricarica
      _scadBulkMode = false;
      _aggiornaUIBulkMode();
      if (typeof loadScadenzario === "function") loadScadenzario();
    } else {
      showNotif(
        "❌ Errore: " + (data.error || "Eliminazione fallita"),
        "error"
      );
    }
  });
});

// ─── PATCH renderScadenzarioTabella ───────────────────────────
// Intercetta il render originale per iniettare:
//   • Colonna checkbox (nascosta per default)
//   • Barra azioni bulk sopra la tabella
//   • Bottone toggle nella topbar (se presente)
//
// NOTA: questa funzione si attacca DOPO che renderScadenzarioTabella
// ha già scritto il DOM, tramite MutationObserver sulla div #content.
// Alternativa: chiama patchScadBulk() dal tuo renderScadenzarioTabella.

function patchScadBulk() {
  var tabella = document.querySelector(".scad-table, #scad-tabella, table.adp-table");
  if (!tabella) return;

  // Evita doppio patch
  if (tabella.dataset.bulkPatched) return;
  tabella.dataset.bulkPatched = "1";

  _iniettaColonnaCheckbox(tabella);
  _iniettaBarraAzioni();
  _iniettaBotoneTopbar();

  // Ripristina stato se eravamo già in bulk mode
  if (_scadBulkMode) {
    _aggiornaUIBulkMode();
  }
}

function _iniettaColonnaCheckbox(tabella) {
  // Header: aggiungi TH checkbox come prima colonna
  var thead = tabella.querySelector("thead tr");
  if (thead) {
    var th = document.createElement("th");
    th.className = "scad-bulk-checkbox-col";
    th.style.cssText =
      "width:36px;text-align:center;padding:4px;display:none";
    th.innerHTML =
      '<input type="checkbox" title="Seleziona tutti" onchange="toggleSelezionaTuttiBulk()" style="cursor:pointer;width:15px;height:15px">';
    thead.insertBefore(th, thead.firstChild);
  }

  // Body: aggiungi TD checkbox per ogni riga
  tabella.querySelectorAll("tbody tr[data-id]").forEach(function (tr) {
    var rigaId = tr.dataset.id;
    var td = document.createElement("td");
    td.className = "scad-bulk-checkbox-col";
    td.style.cssText =
      "width:36px;text-align:center;padding:4px 8px;display:none;vertical-align:middle";
    td.innerHTML =
      '<input type="checkbox" class="scad-row-checkbox" value="' +
      rigaId +
      '" onchange="_aggiornaBulkCounter()" style="cursor:pointer;width:15px;height:15px">';
    tr.insertBefore(td, tr.firstChild);
  });
}

function _iniettaBarraAzioni() {
  // Rimuovi barra precedente se esiste
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

  // Inserisce prima della tabella o all'inizio del wrapper
  var tabella = document.querySelector(
    ".scad-table, #scad-tabella, table.adp-table"
  );
  if (tabella && tabella.parentNode === wrapper) {
    wrapper.insertBefore(barra, tabella);
  } else {
    wrapper.insertBefore(barra, wrapper.firstChild);
  }
}

function _iniettaBotoneTopbar() {
  // Se non c'è già il bottone bulk nella topbar, lo crea
  if (document.getElementById("btn-scad-bulk-toggle")) return;

  var topbarActions = document.getElementById("topbar-actions");
  if (!topbarActions) return;

  var btn = document.createElement("button");
  btn.id = "btn-scad-bulk-toggle";
  btn.className = "btn btn-sm no-print";
  btn.style.cssText =
    "font-size:13px;border:1px solid var(--red);color:var(--red);background:transparent";
  btn.textContent = "☑ Seleziona per eliminare";
  btn.onclick = toggleScadBulkMode;

  topbarActions.appendChild(btn);
}

// ─── ESPOSIZIONE GLOBALE ──────────────────────────────────────
window.toggleScadBulkMode = toggleScadBulkMode;
window.toggleSelezionaTuttiBulk = toggleSelezionaTuttiBulk;
window._aggiornaBulkCounter = _aggiornaBulkCounter;
window.eliminaBulkScadenzario = eliminaBulkScadenzario;
window.patchScadBulk = patchScadBulk;