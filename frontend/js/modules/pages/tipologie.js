// ═══════════════════════════════════════════════════════════════
// TIPOLOGIE.JS — Pagina tipologie con logica Forfettario Annuale
// ═══════════════════════════════════════════════════════════════

function renderTipologiePage() {
  // ─── CONFIGURAZIONE PERCORSI ──────────────────────────────────
  const PERCORSI = {
    PF: [
      { sepLabel: "PRIVATO", col2Label: "Privato", col3Label: null, codice: "PF_PRIV", hasPer: false },
      { sepLabel: "SOCIO", col2Label: "Socio", col3Label: null, codice: "PF_SOCIO", hasPer: false },
      { sepLabel: "DITTA INDIVIDUALE", col2Label: "Ditta Individuale", col3Label: "Ordinario", codice: "PF_DITTA_ORD", hasPer: true },
      { sepLabel: null, col2Label: "Ditta Individuale", col3Label: "Semplificato", codice: "PF_DITTA_SEM", hasPer: true },
      { sepLabel: null, col2Label: "Ditta Individuale", col3Label: "Forfettario", codice: "PF_DITTA_FOR", hasPer: false, isForfettario: true },
      { sepLabel: "PROFESSIONISTA", col2Label: "Professionista", col3Label: "Ordinario", codice: "PF_PROF_ORD", hasPer: true },
      { sepLabel: null, col2Label: "Professionista", col3Label: "Semplificato", codice: "PF_PROF_SEM", hasPer: true },
      { sepLabel: null, col2Label: "Professionista", col3Label: "Forfettario", codice: "PF_PROF_FOR", hasPer: false, isForfettario: true },
    ],
    SP: [
      { sepLabel: null, col2Label: null, col3Label: "Ordinaria", codice: "SP_ORD", hasPer: true },
      { sepLabel: null, col2Label: null, col3Label: "Semplificata", codice: "SP_SEMP", hasPer: true },
    ],
    SC: [
      { sepLabel: null, col2Label: null, col3Label: "Ordinaria", codice: "SC_ORD", hasPer: true },
    ],
    ASS: [
      { sepLabel: null, col2Label: null, col3Label: "Ordinaria", codice: "ASS_ORD", hasPer: true },
      { sepLabel: null, col2Label: null, col3Label: "Semplificata", codice: "ASS_SEMP", hasPer: true },
    ],
  };

  const PERIODICITA_IVA = [
    { value: "mensile", label: "📅 Mensile", color: "#22d3ee" },
    { value: "trimestrale", label: "📆 Trimestrale", color: "#a78bfa" },
  ];

  const PERIODICITA_ANNUALE = [
    { value: "annuale", label: "🗓️ Annuale", color: "#94a3b8" }
  ];

  const tipColors = { PF: "#5b8df6", SP: "#a78bfa", SC: "#34d399", ASS: "#fbbf24" };
  const tipDesc = { PF: "Persona Fisica", SP: "Società di Persone", SC: "Società di Capitali", ASS: "Associazione" };
  const tipIcons = { PF: "👤", SP: "🤝", SC: "🏢", ASS: "🏛️" };

  const col2Colors = { "Privato": "#5b8df6", "Socio": "#a78bfa", "Ditta Individuale": "#fb923c", "Professionista": "#34d399" };
  const col3Colors = { "Ordinario": "#5b8df6", "Ordinaria": "#5b8df6", "Semplificato": "#22d3ee", "Semplificata": "#22d3ee", "Forfettario": "#fbbf24" };
  const sepColors = { "PRIVATO": "#5b8df6", "SOCIO": "#a78bfa", "DITTA INDIVIDUALE": "#fb923c", "PROFESSIONISTA": "#34d399" };

  // ─── HELPER RENDERING ─────────────────────────────────────────
  function step(num, label, color) {
    const c = color || "var(--accent)";
    return `
      <div class="tp-step">
        <div class="tp-num" style="background:${c}18;border-color:${c}44;color:${c}">${num}</div>
        <div class="tp-val">${label}</div>
      </div>`;
  }

  function arrow() { return `<span class="tp-arr">›</span>`; }

  function buildPercorsoRows(p, tipCodice, tipColor) {
    let html = "";
    
    // Scelta della periodicità:
    // 1. Se è forfettario -> Solo Annuale
    // 2. Se hasPer è true -> Mensile + Trimestrale
    // 3. Altrimenti -> Nessuna (es. Privato/Socio)
    let perRows = [null];
    if (p.isForfettario) {
      perRows = PERIODICITA_ANNUALE;
    } else if (p.hasPer) {
      perRows = PERIODICITA_IVA;
    }

    perRows.forEach((per) => {
      const parts = [];
      
      // Col 1: Tipologia
      parts.push(step(1, tipCodice, tipColor));
      
      // Col 2: Sottocategoria (se esiste)
      if (p.col2Label) {
        parts.push(arrow());
        parts.push(step(2, p.col2Label, col2Colors[p.col2Label]));
      }
      
      // Col 3: Regime (se esiste)
      if (p.col3Label) {
        parts.push(arrow());
        parts.push(step(3, p.col3Label, col3Colors[p.col3Label]));
      }
      
      // Col 4: Periodicità (se applicabile)
      if (per) {
        parts.push(arrow());
        parts.push(`
          <div class="tp-step">
            <div class="tp-num" style="background:${per.color}18;border-color:${per.color}44;color:${per.color}">4</div>
            <span class="tp-per" style="color:${per.color};border-color:${per.color}44;background:${per.color}11">${per.label}</span>
          </div>`);
      }

      // Codice univoco finale
      parts.push(`<span class="tp-codice" style="background:${tipColor}12;color:${tipColor};border:1px solid ${tipColor}30">${p.codice}</span>`);
      
      html += `<div class="tp-row">${parts.join("")}</div>`;
    });
    return html;
  }

  // ─── COSTRUZIONE LAYOUT ───────────────────────────────────────
  let html = `
    <div class="infobox" style="margin-bottom:20px">
      🗂️ <strong>Albero di Classificazione:</strong> I numeri indicano le colonne reali del database.
      <span style="margin-left:10px; opacity:0.7">1: Tipo | 2: Sottocategoria | 3: Regime | 4: Periodicità</span>
    </div>
    <div class="tp-grid">`;

  Object.entries(PERCORSI).forEach(([tipCodice, percorsi]) => {
    const tipColor = tipColors[tipCodice];
    
    // Conteggio totale righe generate
    const totalLines = percorsi.reduce((acc, curr) => {
      if (curr.isForfettario) return acc + 1;
      if (curr.hasPer) return acc + 2;
      return acc + 1;
    }, 0);

    html += `
      <div class="tp-card">
        <div class="tp-card-header" style="border-left:4px solid ${tipColor}">
          <div class="tp-badge" style="background:${tipColor}18;border:1px solid ${tipColor}44;color:${tipColor}">
            ${tipIcons[tipCodice]} ${tipCodice}
          </div>
          <div>
            <div class="tp-card-title">${tipDesc[tipCodice]}</div>
            <div class="tp-card-sub">${totalLines} percorsi configurati</div>
          </div>
        </div>
        <div class="tp-percorsi">`;

    percorsi.forEach((p) => {
      if (p.sepLabel) {
        const sc = sepColors[p.sepLabel] || tipColor;
        html += `<div class="tp-sep-label"><span style="color:${sc}">● ${p.sepLabel}</span></div>`;
      }
      html += buildPercorsoRows(p, tipCodice, tipColor);
    });

    html += `</div></div>`;
  });

  html += `</div>

  <style>
    .tp-grid { display:flex; flex-direction:column; gap:18px; }
    .tp-card { background:var(--surface); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
    .tp-card-header { display:flex; align-items:center; gap:14px; padding:14px 18px; background:var(--surface2); border-bottom:1px solid var(--border); }
    .tp-badge { display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:var(--r-sm); font-size:14px; font-weight:800; font-family:var(--mono); white-space:nowrap; }
    .tp-card-title { font-size:15px; font-weight:700; }
    .tp-card-sub { font-size:11px; color:var(--text3); margin-top:2px; }
    .tp-percorsi { padding:12px 16px; display:flex; flex-direction:column; gap:6px; }
    .tp-sep-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:10px 0 4px; border-bottom:1px solid var(--border); margin:6px 0 2px; opacity:0.8; }
    .tp-row { display:flex; align-items:center; flex-wrap:wrap; gap:4px; padding:8px 12px; background:var(--surface2); border:1px solid var(--border2); border-radius:8px; transition:all .15s ease; }
    .tp-row:hover { border-color:var(--accent); background:var(--surface3); transform: translateX(5px); }
    .tp-step { display:flex; align-items:center; gap:6px; }
    .tp-num { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; border:1px solid; flex-shrink:0; font-family:var(--mono); }
    .tp-val { font-size:12px; font-weight:600; color:var(--text); white-space:nowrap; }
    .tp-arr { color:var(--text3); font-size:18px; line-height:1; margin:0 2px; opacity:0.5; }
    .tp-per { display:inline-flex; align-items:center; gap:4px; padding:2px 10px; border:1px solid; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
    .tp-codice { font-family:var(--mono); font-size:10px; font-weight:700; padding:3px 8px; border-radius:4px; margin-left:auto; flex-shrink:0; letter-spacing:0.02em; }
  </style>`;

  document.getElementById("content").innerHTML = html;
}