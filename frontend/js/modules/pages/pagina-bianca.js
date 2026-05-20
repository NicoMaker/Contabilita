// ═══════════════════════════════════════════════════════════════
// PAGINA-BIANCA.JS — Gestione Pagina Bianca (appunti liberi)
// ═══════════════════════════════════════════════════════════════

let paginaBiancaFilter = {
  tipo: "studio",
  id_cliente: "",
  search: "",
};

let paginaBiancaCurrentEntry = null;
let paginaBiancaEditMode = false;
let paginaBiancaListenersRegistered = false;

// ═══════════════════════════════════════════════════════════════
// CLEANUP — Rimuove i listener quando si esce dalla pagina
// ═══════════════════════════════════════════════════════════════
function cleanupPaginaBianca() {
  if (typeof socket !== "undefined" && paginaBiancaListenersRegistered) {
    socket.off("res:pagina_bianca");
    socket.off("res:create:pagina_bianca");
    socket.off("res:update:pagina_bianca");
    socket.off("res:delete:pagina_bianca");
    paginaBiancaListenersRegistered = false;
  }
  
  // Reset variabili
  paginaBiancaFilter = {
    tipo: "studio",
    id_cliente: "",
    search: "",
  };
  paginaBiancaCurrentEntry = null;
  paginaBiancaEditMode = false;
  
  // Rimuovi eventuali modali aperti
  const modal = document.getElementById("modal-pagina-bianca");
  if (modal && modal.classList.contains("open")) {
    modal.classList.remove("open");
  }
}

// ═══════════════════════════════════════════════════════════════
// SETUP SOCKET LISTENERS (chiamato una sola volta all'avvio)
// ═══════════════════════════════════════════════════════════════
function setupPaginaBiancaSocketListeners() {
  if (typeof socket === "undefined") return;
  if (paginaBiancaListenersRegistered) return;
  
  socket.on("res:pagina_bianca", ({ success, data }) => {
    if (success && state.page === "pagina_bianca") {
      renderPaginaBiancaList(data);
    }
  });
  
  socket.on("res:create:pagina_bianca", ({ success }) => {
    if (success && state.page === "pagina_bianca") {
      filterPaginaBianca();
      showNotif("Appunto creato con successo", "success");
    } else if (success) {
      showNotif("Appunto creato con successo", "success");
    }
  });
  
  socket.on("res:update:pagina_bianca", ({ success }) => {
    if (success && state.page === "pagina_bianca") {
      filterPaginaBianca();
      showNotif("Appunto aggiornato", "success");
    } else if (success) {
      showNotif("Appunto aggiornato", "success");
    }
  });
  
  socket.on("res:delete:pagina_bianca", ({ success }) => {
    if (success && state.page === "pagina_bianca") {
      filterPaginaBianca();
      showNotif("Appunto eliminato", "success");
    } else if (success) {
      showNotif("Appunto eliminato", "success");
    }
  });
  
  paginaBiancaListenersRegistered = true;
}

// ═══════════════════════════════════════════════════════════════
// RENDER PAGINA
// ═══════════════════════════════════════════════════════════════
function renderPaginaBiancaPage() {
  // Assicura che i listener siano registrati
  setupPaginaBiancaSocketListeners();
  
  const content = document.getElementById("content");
  if (!content) return;

  // Costruisci le opzioni dei clienti per il filtro
  let clientiOptionsHtml = '<option value="">-- Tutti i clienti --</option>';
  if (state.clienti && state.clienti.length > 0) {
    clientiOptionsHtml += state.clienti.map(c => 
      `<option value="${c.id}" ${paginaBiancaFilter.id_cliente == c.id ? 'selected' : ''}>${escAttr(c.nome)}</option>`
    ).join("");
  }

  content.innerHTML = `
    <div class="pagina-bianca-container" style="max-width: 1200px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
        <div>
          <h1 style="font-size: 24px; font-weight: 800; letter-spacing: -0.02em;">📝 Pagina Bianca</h1>
          <p style="color: var(--text2); font-size: 14px; margin-top: 4px;">Appunti liberi, promemoria e note personali</p>
        </div>
        <button class="btn btn-primary" onclick="openPaginaBiancaEditor()" style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 18px;">✏️</span> Nuovo Appunto
        </button>
      </div>

      <div class="filtri-avanzati" style="margin-bottom: 20px; display: flex; gap: 12px; flex-wrap: wrap; align-items: flex-end;">
        <div style="min-width: 160px;">
          <label style="font-size: 12px; font-weight: 700; color: var(--text2); text-transform: uppercase;">Tipo</label>
          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <button id="pb-filtro-studio" class="btn btn-sm ${paginaBiancaFilter.tipo === 'studio' ? 'btn-primary' : 'btn-secondary'}" onclick="setPaginaBiancaTipo('studio')">🏢 Studio</button>
            <button id="pb-filtro-cliente" class="btn btn-sm ${paginaBiancaFilter.tipo === 'cliente' ? 'btn-primary' : 'btn-secondary'}" onclick="setPaginaBiancaTipo('cliente')">👤 Cliente</button>
          </div>
        </div>
        <div id="pb-cliente-select-wrapper" style="min-width: 220px; ${paginaBiancaFilter.tipo !== 'cliente' ? 'display: none;' : ''}">
          <label style="font-size: 12px; font-weight: 700; color: var(--text2); text-transform: uppercase;">Cliente</label>
          <select id="pb-filtro-cliente-select" class="select" style="margin-top: 4px;" onchange="filterPaginaBianca()">
            ${clientiOptionsHtml}
          </select>
        </div>
        <div style="flex: 1; min-width: 200px;">
          <label style="font-size: 12px; font-weight: 700; color: var(--text2); text-transform: uppercase;">Cerca</label>
          <input type="text" id="pb-search-input" class="input" placeholder="Cerca negli appunti..." value="${escAttr(paginaBiancaFilter.search)}" style="margin-top: 4px;" oninput="debounceFilterPaginaBianca()">
        </div>
        <button class="btn btn-sm btn-secondary" onclick="resetPaginaBiancaFiltri()" style="margin-bottom: 2px;">⟳ Reset</button>
      </div>

      <div id="pagina-bianca-list">
        <div style="text-align: center; padding: 60px; color: var(--text3);">
          <div style="font-size: 48px; margin-bottom: 16px;">📄</div>
          <p>Caricamento appunti...</p>
        </div>
      </div>
    </div>
  `;

  // Carica clienti se necessario
  if (!state.clienti || state.clienti.length === 0) {
    socket.emit("get:clienti", { anno: state.anno });
    socket.once("res:clienti", (data) => {
      if (data.success) {
        state.clienti = data.data;
        renderPaginaBiancaPage();
      }
    });
    return;
  }

  loadPaginaBiancaAppunti();
}

function setPaginaBiancaTipo(tipo) {
  paginaBiancaFilter.tipo = tipo;
  if (tipo === "studio") {
    paginaBiancaFilter.id_cliente = "";
  }
  renderPaginaBiancaPage();
}

function filterPaginaBianca() {
  const clienteSelect = document.getElementById("pb-filtro-cliente-select");
  if (clienteSelect) {
    paginaBiancaFilter.id_cliente = clienteSelect.value;
  }
  const searchInput = document.getElementById("pb-search-input");
  if (searchInput) {
    paginaBiancaFilter.search = searchInput.value;
  }
  loadPaginaBiancaAppunti();
}

const debounceFilterPaginaBianca = debounce(() => {
  filterPaginaBianca();
}, 300);

function resetPaginaBiancaFiltri() {
  paginaBiancaFilter = {
    tipo: "studio",
    id_cliente: "",
    search: "",
  };
  renderPaginaBiancaPage();
}

function loadPaginaBiancaAppunti() {
  if (typeof socket !== "undefined") {
    socket.emit("get:pagina_bianca", paginaBiancaFilter);
  }
}

function renderPaginaBiancaList(appunti) {
  const container = document.getElementById("pagina-bianca-list");
  if (!container) return;

  if (!appunti || appunti.length === 0) {
    container.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📝</div>
        <p>Nessun appunto trovato</p>
        <button class="btn btn-primary" onclick="openPaginaBiancaEditor()" style="margin-top: 12px;">+ Crea il tuo primo appunto</button>
      </div>
    `;
    return;
  }

  const html = `
    <div style="display: flex; flex-direction: column; gap: 16px;">
      ${appunti.map(a => `
        <div class="pagina-bianca-card" style="background: var(--surface1); border: 1px solid var(--border); border-radius: 14px; overflow: hidden; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.05);" 
             onmouseenter="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.1)'; this.style.transform='translateY(-2px)'" 
             onmouseleave="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.05)'; this.style.transform='translateY(0)'">
          
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; background: var(--surface2); border-bottom: 1px solid var(--border);">
            <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
              <span style="font-size: 24px;">${a.tipo === 'studio' ? '🏢' : '👤'}</span>
              <div>
                <div style="font-weight: 700; font-size: 16px;">${escAttr(a.titolo)}</div>
                <div style="font-size: 12px; color: var(--text3); margin-top: 2px;">
                  ${a.tipo === 'studio' ? 'Appunto Studio' : `Cliente: ${escAttr(a.cliente_nome || '—')}`}
                  ${a.data_creazione ? ` · ${formattaDataOraItaliana(a.data_creazione)}` : ''}
                </div>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-xs btn-secondary" onclick="event.stopPropagation(); openPaginaBiancaEditor(${a.id})" title="Modifica">✏️</button>
              <button class="btn btn-xs btn-danger" onclick="event.stopPropagation(); deletePaginaBiancaAppunto(${a.id})" title="Elimina">🗑️</button>
            </div>
          </div>
          
          <div style="padding: 20px;">
            <div style="color: var(--text1); line-height: 1.6; white-space: pre-wrap; word-break: break-word; max-height: 300px; overflow-y: auto;">
              ${escAttr(a.contenuto || '— Nessun contenuto —')}
            </div>
            ${a.allegati ? `<div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--border); font-size: 12px; color: var(--text3);">
              📎 Allegati: ${escAttr(a.allegati)}
            </div>` : ''}
          </div>
        </div>
      `).join("")}
    </div>
  `;

  container.innerHTML = html;
}

function openPaginaBiancaEditor(id = null) {
  paginaBiancaEditMode = !!id;
  paginaBiancaCurrentEntry = id;

  // Carica i clienti se necessario
  if (!state.clienti || state.clienti.length === 0) {
    socket.emit("get:clienti", { anno: state.anno });
    socket.once("res:clienti", (data) => {
      if (data.success) {
        state.clienti = data.data;
        showPaginaBiancaModal();
      }
    });
  } else {
    showPaginaBiancaModal();
  }
}

function showPaginaBiancaModal() {
  let modal = document.getElementById("modal-pagina-bianca");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-pagina-bianca";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal modal-lg" style="max-width: 800px;">
        <div class="modal-title">
          <span id="pb-modal-title">✏️ Nuovo Appunto</span>
        </div>
        <input type="hidden" id="pb-id">
        
        <div class="form-group">
          <label>Tipo Appunto <span class="required-star">*</span></label>
          <div style="display: flex; gap: 16px; margin-top: 8px;">
            <label class="flag-chip" style="cursor: pointer;">
              <input type="radio" name="pb-tipo" value="studio" checked onchange="onPaginaBiancaTipoChange()">
              <span>🏢 Appunto Studio</span>
            </label>
            <label class="flag-chip" style="cursor: pointer;">
              <input type="radio" name="pb-tipo" value="cliente" onchange="onPaginaBiancaTipoChange()">
              <span>👤 Appunto Cliente</span>
            </label>
          </div>
        </div>

        <div id="pb-cliente-group" class="form-group" style="display: none;">
          <label>Cliente Associato <span class="required-star">*</span></label>
          <select id="pb-id-cliente" class="select">
            <option value="">-- Seleziona un cliente --</option>
            ${state.clienti ? state.clienti.map(c => `<option value="${c.id}">${escAttr(c.nome)} (${c.tipologia_codice || '-'})</option>`).join("") : ""}
          </select>
        </div>

        <div class="form-group">
          <label>Titolo <span class="required-star">*</span></label>
          <input type="text" id="pb-titolo" class="input" placeholder="Titolo dell'appunto..." maxlength="200">
        </div>

        <div class="form-group">
          <label>Contenuto</label>
          <textarea id="pb-contenuto" class="input" rows="12" placeholder="Scrivi qui il tuo appunto...&#10;&#10;Puoi usare testo libero, note, promemoria, checklist, ecc." style="font-family: inherit; resize: vertical;"></textarea>
        </div>

        <div class="form-group">
          <label>Allegati / Riferimenti</label>
          <input type="text" id="pb-allegati" class="input" placeholder="Es: Documenti allegati, link, riferimenti, ecc.">
        </div>

        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal('modal-pagina-bianca')">Annulla</button>
          <button class="btn btn-primary" onclick="savePaginaBiancaAppunto()">💾 Salva Appunto</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
  }

  // Reset form
  document.getElementById("pb-id").value = "";
  document.getElementById("pb-titolo").value = "";
  document.getElementById("pb-contenuto").value = "";
  document.getElementById("pb-allegati").value = "";
  document.getElementById("pb-id-cliente").value = "";

  const radioStudio = document.querySelector('input[name="pb-tipo"][value="studio"]');
  const radioCliente = document.querySelector('input[name="pb-tipo"][value="cliente"]');
  if (radioStudio) radioStudio.checked = true;
  document.getElementById("pb-cliente-group").style.display = "none";
  document.getElementById("pb-modal-title").textContent = "✏️ Nuovo Appunto";

  // Se è in modifica, carica i dati
  if (paginaBiancaEditMode && paginaBiancaCurrentEntry) {
    socket.emit("get:pagina_bianca_singolo", { id: paginaBiancaCurrentEntry });
    socket.once("res:pagina_bianca_singolo", ({ success, data }) => {
      if (success && data) {
        document.getElementById("pb-id").value = data.id;
        document.getElementById("pb-titolo").value = data.titolo || "";
        document.getElementById("pb-contenuto").value = data.contenuto || "";
        document.getElementById("pb-allegati").value = data.allegati || "";
        document.getElementById("pb-modal-title").textContent = "✏️ Modifica Appunto";

        if (data.tipo === "cliente") {
          if (radioCliente) radioCliente.checked = true;
          document.getElementById("pb-cliente-group").style.display = "block";
          if (data.id_cliente) {
            document.getElementById("pb-id-cliente").value = data.id_cliente;
          }
        } else {
          if (radioStudio) radioStudio.checked = true;
          document.getElementById("pb-cliente-group").style.display = "none";
        }
      }
    });
  }

  openModal("modal-pagina-bianca");
}

function onPaginaBiancaTipoChange() {
  const tipo = document.querySelector('input[name="pb-tipo"]:checked')?.value;
  const clienteGroup = document.getElementById("pb-cliente-group");
  if (clienteGroup) {
    clienteGroup.style.display = tipo === "cliente" ? "block" : "none";
  }
}

function savePaginaBiancaAppunto() {
  const id = document.getElementById("pb-id").value;
  const tipo = document.querySelector('input[name="pb-tipo"]:checked')?.value;
  const titolo = document.getElementById("pb-titolo").value.trim();
  const contenuto = document.getElementById("pb-contenuto").value;
  const allegati = document.getElementById("pb-allegati").value;
  let id_cliente = null;

  if (!titolo) {
    showNotif("Il titolo è obbligatorio", "error");
    return;
  }

  if (tipo === "cliente") {
    id_cliente = document.getElementById("pb-id-cliente").value;
    if (!id_cliente) {
      showNotif("Seleziona un cliente per l'appunto", "error");
      return;
    }
    id_cliente = parseInt(id_cliente);
  }

  const data = {
    tipo,
    titolo,
    contenuto: contenuto || null,
    allegati: allegati || null,
    id_cliente: id_cliente || null,
  };

  if (id) {
    data.id = parseInt(id);
    socket.emit("update:pagina_bianca", data);
  } else {
    socket.emit("create:pagina_bianca", data);
  }

  closeModal("modal-pagina-bianca");
}

function deletePaginaBiancaAppunto(id) {
  if (confirm("Eliminare questo appunto definitivamente?")) {
    socket.emit("delete:pagina_bianca", { id });
  }
}

function openPaginaBiancaPerCliente(clienteId, clienteNome) {
  // Pulisci i filtri precedenti
  paginaBiancaFilter = {
    tipo: "cliente",
    id_cliente: String(clienteId),
    search: "",
  };
  
  // Naviga alla pagina
  document.querySelectorAll(".nav-item").forEach((x) => x.classList.remove("active"));
  const nav = document.querySelector('[data-page="pagina_bianca"]');
  if (nav) nav.classList.add("active");
  
  state.page = "pagina_bianca";
  document.getElementById("page-title").textContent = `📝 Pagina Bianca - ${clienteNome}`;
  
  // Assicura che i listener siano registrati prima di renderizzare
  setupPaginaBiancaSocketListeners();
  
  renderPaginaBiancaPage();
}

// ═══════════════════════════════════════════════════════════════
// INIZIALIZZAZIONE
// ═══════════════════════════════════════════════════════════════
// Registra i listener all'avvio del modulo
setupPaginaBiancaSocketListeners();

// ═══════════════════════════════════════════════════════════════
// ESPOSIZIONI GLOBALI
// ═══════════════════════════════════════════════════════════════
window.renderPaginaBiancaPage = renderPaginaBiancaPage;
window.setPaginaBiancaTipo = setPaginaBiancaTipo;
window.filterPaginaBianca = filterPaginaBianca;
window.resetPaginaBiancaFiltri = resetPaginaBiancaFiltri;
window.openPaginaBiancaEditor = openPaginaBiancaEditor;
window.savePaginaBiancaAppunto = savePaginaBiancaAppunto;
window.deletePaginaBiancaAppunto = deletePaginaBiancaAppunto;
window.onPaginaBiancaTipoChange = onPaginaBiancaTipoChange;
window.openPaginaBiancaPerCliente = openPaginaBiancaPerCliente;
window.debounceFilterPaginaBianca = debounceFilterPaginaBianca;
window.cleanupPaginaBianca = cleanupPaginaBianca;