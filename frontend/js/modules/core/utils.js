// ═══════════════════════════════════════════════════════════════
// UTILS.JS — Funzioni di utilità generali
// ═══════════════════════════════════════════════════════════════

// ─── ROW STORE ────────────────────────────────────────────────
const _rowStore = {};

function storeRow(r) {
  _rowStore[r.id] = r;
  return r.id;
}

function openAdpById(id) {
  const r = _rowStore[id];
  if (!r) {
    console.warn("Row not found:", id);
    return;
  }
  openAdpModal(r);
}

// ─── TOGGLE RAPIDO COMPLETATO (click destro sulla pill) ───────
function toggleAdpCompletato(event, id) {
  event.preventDefault();
  event.stopPropagation();
  const r = _rowStore[id];
  if (!r) return;
  const nuovoStato = r.stato === "completato" ? "da_fare" : "completato";
  const data = {
    id,
    stato: nuovoStato,
    data_scadenza: r.data_scadenza || null,
    data_completamento:
      nuovoStato === "completato"
        ? new Date().toISOString().split("T")[0]
        : null,
    note: r.note || null,
    importo: r.importo || null,
    importo_saldo: r.importo_saldo || null,
    importo_acconto1: r.importo_acconto1 || null,
    importo_acconto2: r.importo_acconto2 || null,
    importo_iva: r.importo_iva || null,
    importo_contabilita: r.importo_contabilita || null,
    cont_completata: r.cont_completata || 0,
  };
  _rowStore[id] = {
    ...r,
    stato: nuovoStato,
    data_completamento: data.data_completamento,
  };
  socket.emit("update:adempimento_stato", data);
  showNotif(
    nuovoStato === "completato"
      ? "✅ Completato!"
      : "⭕ Ripristinato a Da fare",
    "success",
  );
}

// ─── IMPOSTA STATO CHECKBOX (tre bottoni nella pill) ──────────
function setCbxStato(event, id, nuovoStato) {
  event.preventDefault();
  event.stopPropagation();
  const r = _rowStore[id];
  if (!r) return;
  if (r.stato === nuovoStato) return; // già in quello stato
  const data = {
    id,
    stato: nuovoStato,
    data_scadenza: r.data_scadenza || null,
    data_completamento:
      nuovoStato === "completato"
        ? new Date().toISOString().split("T")[0]
        : null,
    note: r.note || null,
    importo: null,
    importo_saldo: null,
    importo_acconto1: null,
    importo_acconto2: null,
    importo_iva: null,
    importo_contabilita: null,
    cont_completata: 0,
  };
  _rowStore[id] = {
    ...r,
    stato: nuovoStato,
    data_completamento: data.data_completamento,
  };
  socket.emit("update:adempimento_stato", data);
  const icons = {
    completato: "✅ Fatto!",
    n_a: "➖ N/A",
    da_fare: "☐ Da fare",
  };
  showNotif(icons[nuovoStato] || "Aggiornato", "success");
}

// ─── TOGGLE CHECKBOX ADEMPIMENTO (click sulla checkbox pill) ──
function toggleCheckboxAdp(event, id) {
  event.preventDefault();
  event.stopPropagation();
  const r = _rowStore[id];
  if (!r) return;
  const nuovoStato = r.stato === "completato" ? "da_fare" : "completato";
  const data = {
    id,
    stato: nuovoStato,
    data_scadenza: r.data_scadenza || null,
    data_completamento:
      nuovoStato === "completato"
        ? new Date().toISOString().split("T")[0]
        : null,
    note: r.note || null,
    importo: null,
    importo_saldo: null,
    importo_acconto1: null,
    importo_acconto2: null,
    importo_iva: null,
    importo_contabilita: null,
    cont_completata: 0,
  };
  _rowStore[id] = {
    ...r,
    stato: nuovoStato,
    data_completamento: data.data_completamento,
  };
  socket.emit("update:adempimento_stato", data);
  showNotif(
    nuovoStato === "completato" ? "✅ Fatto!" : "☐ Annullato",
    "success",
  );
}

// ─── DEBOUNCE ─────────────────────────────────────────────────
function debounce(fn, ms) {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...a), ms);
  };
}

// ─── HTML ESCAPE ──────────────────────────────────────────────
function escAttr(s) {
  return (s || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ─── AVATAR ADATTIVO ──────────────────────────────────────────
function getAvatar(nome) {
  if (!nome || nome.trim() === "") return "??";
  const words = nome
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const wordCount = words.length;
  if (wordCount === 1) return words[0][0].toUpperCase();
  if (wordCount === 2) return (words[0][0] + words[1][0]).toUpperCase();
  const maxLetters = Math.min(wordCount, 3);
  let result = "";
  for (let i = 0; i < maxLetters; i++) result += words[i][0];
  return result.toUpperCase();
}

// ─── FONT SIZE AVATAR ─────────────────────────────────────────
function avatarFontSize(avatar, base) {
  const b = base || 13;
  const len = (avatar || "").length;
  if (len <= 2) return b + "px";
  if (len === 3) return Math.round(b * 0.78) + "px";
  return Math.round(b * 0.62) + "px";
}

// ─── TIPOLOGIA COLOR ──────────────────────────────────────────
function getTipologiaColor(tipCodice) {
  return (TIPOLOGIE_INFO[tipCodice] || {}).color || "var(--accent)";
}

// ─── SOTTOTIPO HELPERS ────────────────────────────────────────
function getCol3Options(tipCodice, col2Value) {
  if (tipCodice === "SP" || tipCodice === "ASS")
    return [
      { value: "ordinaria", label: "Ordinaria" },
      { value: "semplificata", label: "Semplificata" },
    ];
  if (tipCodice === "SC") return [{ value: "ordinaria", label: "Ordinaria" }];
  if (tipCodice === "PF") {
    if (!col2Value || col2Value === "privato" || col2Value === "socio")
      return null;
    return [
      { value: "ordinario", label: "Ordinario" },
      { value: "semplificato", label: "Semplificato" },
      { value: "forfettario", label: "Forfettario" },
    ];
  }
  return null;
}

function getSottotipoCode(tipCodice, col2, col3) {
  const key = `${tipCodice}|${col2 || ""}|${col3 || ""}`;
  return SOTTOTIPO_MAP[key] || null;
}

function getLabelSottotipologia(cliente) {
  if (
    cliente.sottotipologia_codice &&
    SOTTOTIPO_LABEL_MAP[cliente.sottotipologia_codice]
  )
    return SOTTOTIPO_LABEL_MAP[cliente.sottotipologia_codice];
  return cliente.sottotipologia_nome || null;
}

function getClassificazioneCompleta(c) {
  const parts = [];
  if (c.tipologia_codice) parts.push(c.tipologia_codice);
  if (c.col2_value) {
    const labels = {
      privato: "Privato",
      ditta: "Ditta Ind.",
      socio: "Socio",
      professionista: "Professionista",
    };
    parts.push(labels[c.col2_value] || c.col2_value);
  }
  if (c.col3_value) {
    const labels = {
      ordinario: "Ord.",
      semplificato: "Sempl.",
      forfettario: "Forf.",
      ordinaria: "Ord.",
      semplificata: "Sempl.",
    };
    parts.push(labels[c.col3_value] || c.col3_value);
  }
  if (c.periodicita)
    parts.push(
      c.periodicita === "mensile"
        ? "Mensile"
        : c.periodicita === "annuale"
          ? "Annuale"
          : "Trimestrale",
    );
  return parts.join(" · ");
}

// ─── PERIODO HELPERS ──────────────────────────────────────────
function getPeriodoLabel(r) {
  if (r.scadenza_tipo === "trimestrale") {
    const m = { 1: "Gen-Mar", 2: "Apr-Giu", 3: "Lug-Set", 4: "Ott-Dic" };
    return `${r.trimestre}° Trim. (${m[r.trimestre] || ""})`;
  }
  if (r.scadenza_tipo === "semestrale")
    return r.semestre === 1 ? "1° Sem. (Gen-Giu)" : "2° Sem. (Lug-Dic)";
  if (r.scadenza_tipo === "mensile") return MESI[(r.mese || 1) - 1] || "-";
  return "Annuale";
}

function getPeriodoShort(r) {
  if (r.scadenza_tipo === "trimestrale") return `T${r.trimestre}`;
  if (r.scadenza_tipo === "semestrale") return r.semestre === 1 ? "S1" : "S2";
  if (r.scadenza_tipo === "mensile") return MESI_SHORT[(r.mese || 1) - 1];
  return "Ann.";
}

// ─── MODAL HELPERS ────────────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add("open");
    // Scroll all'inizio del modal - prova sia l'overlay che il modal interno
    setTimeout(() => {
      modal.scrollTop = 0;
      // Prova anche a fare scroll sul modal interno
      const modalInner = modal.querySelector(".modal");
      if (modalInner) {
        modalInner.scrollTop = 0;
      }
      // Prova anche a fare scroll sulla finestra
      window.scrollTo(0, 0);
    }, 100);
  }
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove("open");
}

// ─── NOTIFICATIONS ────────────────────────────────────────────
function showNotif(msg, type = "info") {
  const container = document.getElementById("notif-container");
  const div = document.createElement("div");
  div.className = `notif ${type}`;
  div.innerHTML = `${type === "success" ? "✅" : type === "error" ? "❌" : "ℹ️"} ${msg}`;
  container.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// ─── SCROLL TO TOP ────────────────────────────────────────────
function scrollToTop() {
  const content = document.getElementById("content");
  if (content) content.scrollTop = 0;
}

// ─── DOWNLOAD DATABASE ────────────────────────────────────────
function scaricaDatabase() {
  showNotif("⏳ Download in corso...", "info");
  fetch("/api/download-db", { method: "GET" })
    .then((r) => {
      if (!r.ok)
        return r.json().then((e) => {
          throw new Error(e.error || "Download fallito");
        });
      return r.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gestionale.db";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotif("✅ Database scaricato!", "success");
    })
    .catch((e) => showNotif(`❌ Errore: ${e.message}`, "error"));
}

// ─── NUOVO ANNO ────────────────────────────────────────────────
const _ANNO_KEY = "gestionale_last_anno";
function checkNuovoAnno(anno) {
  const last = parseInt(localStorage.getItem(_ANNO_KEY) || "0");
  if (last && anno > last) {
    localStorage.setItem(_ANNO_KEY, anno);
    setTimeout(() => aprireDialogoNuovoAnno(anno, last), 800);
  } else if (!last) {
    localStorage.setItem(_ANNO_KEY, anno);
  }
}

function aprireDialogoNuovoAnno(annoNuovo, annoPrecedente) {
  let overlay = document.getElementById("modal-nuovo-anno");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "modal-nuovo-anno";
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal modal-sm">
        <div class="modal-title">🎉 Nuovo Anno <span id="nna-anno" style="color:var(--accent)"></span></div>
        <div class="infobox" style="margin-bottom:16px">
          Sei nel <strong id="nna-anno2"></strong>. Vuoi rivedere le categorie attive dei clienti prima di generare lo scadenzario?
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="closeModal('modal-nuovo-anno')">⏭️ Salta</button>
          <button class="btn btn-primary" onclick="closeModal('modal-nuovo-anno');renderPage('clienti')">👥 Vai ai Clienti</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.remove("open");
    });
  }
  document.getElementById("nna-anno").textContent = annoNuovo;
  document.getElementById("nna-anno2").textContent = annoNuovo;
  openModal("modal-nuovo-anno");
}
