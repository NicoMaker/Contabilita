// ═══════════════════════════════════════════════════════════════
// APPUNTI.JS — Gestione Block Notes
// ═══════════════════════════════════════════════════════════════

let appuntiFilter = {
  search: "",
  completato: "",
  priorita: "tutte",
  id_cliente: "",
};

function renderAppuntiPage() {
  console.log("📝 renderAppuntiPage chiamata");
  const content = document.getElementById("content");
  if (!content) {
    console.error("❌ Elemento #content non trovato");
    return;
  }

  content.innerHTML = `<div class="empty"><div class="empty-icon">📝</div><p>Caricamento appunti...</p></div>`;

  if (state.clienti && state.clienti.length > 0) {
    console.log("✅ Clienti già caricati:", state.clienti.length);
    renderAppuntiTopbar();
    socket.emit("get:appunti", appuntiFilter);
  } else {
    console.log("⏳ Caricamento clienti...");
    socket.emit("get:clienti", { anno: state.anno });
    socket.once("res:clienti", (data) => {
      if (data.success) {
        state.clienti = data.data;
        console.log("✅ Clienti caricati:", state.clienti.length);
        renderAppuntiTopbar();
        socket.emit("get:appunti", appuntiFilter);
      } else {
        console.error("❌ Errore caricamento clienti:", data.error);
        content.innerHTML = `<div class="empty"><div class="empty-icon">❌</div><p>Errore caricamento clienti</p></div>`;
      }
    });
  }
}

function renderAppuntiTopbar() {
  const topbarActions = document.getElementById("topbar-actions");
  if (!topbarActions) return;

  topbarActions.innerHTML = `
    <div class="search-wrap" style="width:200px">
      <span class="search-icon">🔍</span>
      <input class="input" id="appunti-search" placeholder="Cerca titolo o contenuto..." oninput="filterAppunti()" style="font-size:13px">
    </div>
    <select class="select" id="appunti-filtro-completato" onchange="filterAppunti()" style="width:130px">
      <option value="">📋 Tutti</option>
      <option value="0">⭕ Da fare</option>
      <option value="1">✅ Completati</option>
    </select>
    <select class="select" id="appunti-filtro-priorita" onchange="filterAppunti()" style="width:130px">
      <option value="tutte">🏷️ Tutte priorità</option>
      <option value="alta">🔴 Alta</option>
      <option value="media">🟡 Media</option>
      <option value="bassa">🟢 Bassa</option>
    </select>
    <select class="select" id="appunti-filtro-cliente" onchange="filterAppunti()" style="width:200px">
      <option value="">👥 Tutti i clienti</option>
      ${state.clienti.map((c) => `<option value="${c.id}">${escAttr(c.nome)}</option>`).join("")}
    </select>
    <button class="btn btn-primary" onclick="openNuovoAppunto()">+ Appunto</button>
    <button class="btn btn-print btn-sm" onclick="window.print()">🖨️</button>
  `;
}

function renderAppuntiTabella(appunti) {
  console.log(
    "📊 renderAppuntiTabella chiamata con",
    appunti?.length,
    "appunti",
  );
  const content = document.getElementById("content");
  if (!content) return;

  const prioritaIcon = { alta: "🔴", media: "🟡", bassa: "🟢" };
  const prioritaLabel = { alta: "Alta", media: "Media", bassa: "Bassa" };

  if (!appunti || appunti.length === 0) {
    content.innerHTML = `
      <div class="empty">
        <div class="empty-icon">📝</div>
        <p>Nessun appunto trovato</p>
        <button class="btn btn-primary" onclick="openNuovoAppunto()" style="margin-top:12px">+ Crea primo appunto</button>
      </div>`;
    return;
  }

  const rows = appunti
    .map(
      (a) => `
    <tr class="clickable" onclick="openAppunto(${a.id})" style="cursor:pointer">
      <td style="padding:12px 16px">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:18px">${a.completato ? "✅" : "📝"}</span>
          <div>
            <div style="font-weight:700">${escAttr(a.titolo)}</div>
            <div style="font-size:12px;color:var(--text3);margin-top:2px">${a.contenuto ? (a.contenuto.length > 60 ? a.contenuto.substring(0, 60) + "..." : a.contenuto) : ""}</div>
          </div>
        </div>
      </td>
      <td style="padding:12px 16px">${a.cliente_nome ? `<span class="badge b-${(a.cliente_nome?.charAt(0) || "").toLowerCase()}">👤 ${a.cliente_nome}</span>` : `<span class="badge-info">📌 Generale</span>`}</td>
      <td style="padding:12px 16px"><span class="badge-info" style="background:${prioritaIcon[a.priorita]}20;border-color:${prioritaIcon[a.priorita]}40">${prioritaIcon[a.priorita]} ${prioritaLabel[a.priorita]}</span></td>
      <td style="padding:12px 16px;font-family:var(--mono);font-size:12px">${a.data_scadenza ? formattaDataItaliana(a.data_scadenza) : "—"}</td>
      <td class="no-print" style="padding:12px 16px;white-space:nowrap" onclick="event.stopPropagation()">
        <button class="btn btn-xs btn-success" onclick="toggleAppuntoCompletato(${a.id}, ${!a.completato})" title="${a.completato ? "Segna da fare" : "Segna completato"}">${a.completato ? "⭕" : "✅"}</button>
        <button class="btn btn-xs btn-secondary" onclick="openAppunto(${a.id})" title="Modifica">✏️</button>
        <button class="btn btn-xs btn-danger" onclick="deleteAppunto(${a.id})" title="Elimina">🗑️</button>
      </td>
    </tr>
  `,
    )
    .join("");

  content.innerHTML = `
    <div class="table-wrap">
      <div class="table-header">
        <h3>Appunti <span style="font-size:13px;color:var(--text3);margin-left:8px">(${appunti.length})</span></h3>
      </div>
      <div class="table-scroll-wrap">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:var(--s2);border-bottom:1px solid var(--b0)">
              <th style="text-align:left;padding:12px 16px">Appunto</th>
              <th style="text-align:left;padding:12px 16px">Cliente</th>
              <th style="text-align:left;padding:12px 16px">Priorità</th>
              <th style="text-align:left;padding:12px 16px">Scadenza</th>
              <th style="text-align:left;padding:12px 16px" class="no-print">Azioni</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function filterAppunti() {
  const search = document.getElementById("appunti-search")?.value || "";
  const completato =
    document.getElementById("appunti-filtro-completato")?.value || "";
  const priorita =
    document.getElementById("appunti-filtro-priorita")?.value || "tutte";
  const id_cliente =
    document.getElementById("appunti-filtro-cliente")?.value || "";
  appuntiFilter = { search, completato, priorita, id_cliente };
  socket.emit("get:appunti", appuntiFilter);
}

function openNuovoAppunto() {
  document.getElementById("modal-appunto-title").textContent = "Nuovo Appunto";
  document.getElementById("appunto-id").value = "";
  document.getElementById("appunto-titolo").value = "";
  document.getElementById("appunto-contenuto").value = "";
  document.getElementById("appunto-cliente").value = "";
  document.getElementById("appunto-scadenza").value = "";
  document.getElementById("appunto-priorita").value = "media";

  const clienteSel = document.getElementById("appunto-cliente");
  if (clienteSel && state.clienti) {
    clienteSel.innerHTML =
      `<option value="">-- Nessuno (appunto generale) --</option>` +
      state.clienti
        .map((c) => `<option value="${c.id}">${escAttr(c.nome)}</option>`)
        .join("");
  }

  const scadenzaInput = document.getElementById("appunto-scadenza");
  if (scadenzaInput) {
    setTimeout(() => {
      if (typeof gestisciInputData === "function")
        gestisciInputData(scadenzaInput);
      if (typeof creaDatePicker === "function") creaDatePicker(scadenzaInput);
    }, 100);
  }
  openModal("modal-appunto");
}

function openAppunto(id) {
  socket.emit("get:appunto", { id });
  socket.once("res:appunto", ({ success, data }) => {
    if (!success || !data) return;
    document.getElementById("modal-appunto-title").textContent =
      "Modifica Appunto";
    document.getElementById("appunto-id").value = data.id;
    document.getElementById("appunto-titolo").value = data.titolo || "";
    document.getElementById("appunto-contenuto").value = data.contenuto || "";
    document.getElementById("appunto-cliente").value = data.id_cliente || "";
    document.getElementById("appunto-scadenza").value =
      formattaDataItaliana(data.data_scadenza) || "";
    document.getElementById("appunto-priorita").value =
      data.priorita || "media";

    const clienteSel = document.getElementById("appunto-cliente");
    if (clienteSel && state.clienti) {
      clienteSel.innerHTML =
        `<option value="">-- Nessuno (appunto generale) --</option>` +
        state.clienti
          .map(
            (c) =>
              `<option value="${c.id}" ${c.id == data.id_cliente ? "selected" : ""}>${escAttr(c.nome)}</option>`,
          )
          .join("");
    }

    const scadenzaInput = document.getElementById("appunto-scadenza");
    if (scadenzaInput) {
      setTimeout(() => {
        if (typeof gestisciInputData === "function")
          gestisciInputData(scadenzaInput);
        if (typeof creaDatePicker === "function") creaDatePicker(scadenzaInput);
      }, 100);
    }
    openModal("modal-appunto");
  });
}

function saveAppunto() {
  const id = document.getElementById("appunto-id").value;
  const data = {
    titolo: document.getElementById("appunto-titolo").value.trim(),
    contenuto: document.getElementById("appunto-contenuto").value.trim(),
    id_cliente: document.getElementById("appunto-cliente").value || null,
    data_scadenza:
      daItalianaAISO(document.getElementById("appunto-scadenza").value) || null,
    priorita: document.getElementById("appunto-priorita").value,
    completato: 0,
  };
  if (!data.titolo) {
    showNotif("Il titolo è obbligatorio", "error");
    return;
  }
  if (id) {
    data.id = parseInt(id);
    socket.emit("update:appunto", data);
  } else {
    socket.emit("create:appunto", data);
  }
  closeModal("modal-appunto");
}

function deleteAppunto(id) {
  if (confirm("Eliminare questo appunto?"))
    socket.emit("delete:appunto", { id });
}

function toggleAppuntoCompletato(id, completato) {
  socket.emit("toggle:appunto_completato", {
    id,
    completato: completato ? 1 : 0,
  });
}

function openCopiaAppunti() {
  let modal = document.getElementById("modal-copia-appunti");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal-copia-appunti";
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-title">📋 Copia Appunti tra Anni</div>
        <div class="infobox" style="margin-bottom:16px">
          Copia tutti gli appunti dall'anno di partenza all'anno di destinazione.<br>
          La data di scadenza viene incrementata di un anno.
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Anno di partenza</label>
            <input class="input" id="copia-appunti-da" type="number" value="${new Date().getFullYear() - 1}">
          </div>
          <div class="form-group">
            <label>Anno destinazione</label>
            <input class="input" id="copia-appunti-a" type="number" value="${new Date().getFullYear()}">
          </div>
        </div>
        <div class="form-group">
          <label>Filtra per cliente (opzionale)</label>
          <select class="select" id="copia-appunti-cliente">
            <option value="">-- Tutti i clienti --</option>
            ${state.clienti ? state.clienti.map((c) => `<option value="${c.id}">${escAttr(c.nome)}</option>`).join("") : ""}
          </select>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal('modal-copia-appunti')">Annulla</button>
          <button class="btn btn-primary" onclick="eseguiCopiaAppunti()">📋 Copia</button>
        </div>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) modal.classList.remove("open");
    });
  }

  const clienteSel = document.getElementById("copia-appunti-cliente");
  if (clienteSel && state.clienti) {
    clienteSel.innerHTML =
      `<option value="">-- Tutti i clienti --</option>` +
      state.clienti
        .map((c) => `<option value="${c.id}">${escAttr(c.nome)}</option>`)
        .join("");
  }

  openModal("modal-copia-appunti");
}

function eseguiCopiaAppunti() {
  const anno_da = parseInt(document.getElementById("copia-appunti-da").value);
  const anno_a = parseInt(document.getElementById("copia-appunti-a").value);
  const id_cliente = document.getElementById("copia-appunti-cliente").value;

  if (isNaN(anno_da) || isNaN(anno_a)) {
    showNotif("Anni non validi", "error");
    return;
  }

  socket.emit("copia:appunti_anno", {
    anno_da,
    anno_a,
    id_cliente: id_cliente || null,
  });
  closeModal("modal-copia-appunti");
}

// Socket listeners
if (typeof socket !== "undefined") {
  socket.on("res:appunti", ({ success, data }) => {
    console.log("📡 res:appunti ricevuto", success, data?.length);
    if (success && state.page === "appunti") {
      renderAppuntiTabella(data);
    }
  });
  socket.on("res:create:appunto", ({ success }) => {
    if (success) {
      filterAppunti();
      showNotif("Appunto creato con successo", "success");
    }
  });
  socket.on("res:update:appunto", ({ success }) => {
    if (success) {
      filterAppunti();
      showNotif("Appunto aggiornato", "success");
    }
  });
  socket.on("res:delete:appunto", ({ success }) => {
    if (success) {
      filterAppunti();
      showNotif("Appunto eliminato", "success");
    }
  });
  socket.on("res:toggle:appunto_completato", ({ success }) => {
    if (success) filterAppunti();
  });
  socket.on("res:copia:appunti_anno", ({ success, copiati }) => {
    if (success) {
      filterAppunti();
      showNotif(`✅ Copiati ${copiati} appunti`, "success");
    }
  });
  socket.on("broadcast:appunti_updated", () => {
    if (state.page === "appunti") filterAppunti();
  });
}

// Esposizioni globali
window.renderAppuntiPage = renderAppuntiPage;
window.filterAppunti = filterAppunti;
window.openNuovoAppunto = openNuovoAppunto;
window.openAppunto = openAppunto;
window.saveAppunto = saveAppunto;
window.deleteAppunto = deleteAppunto;
window.toggleAppuntoCompletato = toggleAppuntoCompletato;
window.openCopiaAppunti = openCopiaAppunti;
window.eseguiCopiaAppunti = eseguiCopiaAppunti;
