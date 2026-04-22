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
  if (!nome) return "??";
  const words = nome
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return words
    .map((w) => w[0])
    .join("")
    .toUpperCase();
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
        : c.periodicita === "trimestrale"
          ? "Trimestrale"
          : c.periodicita,
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

function isContabilita(r) {
  return (
    parseInt(r.is_contabilita) === 1 ||
    r.is_contabilita === true ||
    r.is_contabilita === 1
  );
}

function hasRate(r) {
  return parseInt(r.has_rate) === 1 || r.has_rate === true || r.has_rate === 1;
}

// ─── MODAL HELPERS ────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id)?.classList.add("open");
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
    .then((response) => {
      if (!response.ok)
        return response.json().then((err) => {
          throw new Error(err.error || "Download fallito");
        });
      return response.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gestionale.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      showNotif("✅ Database scaricato!", "success");
    })
    .catch((error) => showNotif(`❌ Errore: ${error.message}`, "error"));
}
