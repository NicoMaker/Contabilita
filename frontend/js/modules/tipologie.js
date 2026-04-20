// ═══════════════════════════════════════════════════════════════
// TIPOLOGIE.JS — Pagina tipologie con albero percorsi completo
// ═══════════════════════════════════════════════════════════════

function renderTipologiePage() {
  // ─── PERCORSI REALI ───────────────────────────────────────────
  // hasPer: false → 1 sola riga, nessuna col4
  // hasPer: true  → 2 righe (Mensile + Trimestrale)
  //
  // PF_PRIV  → 1 PF › 2 Privato                    (no col3, no col4)
  // PF_SOCIO → 1 PF › 2 Socio                      (no col3, no col4)
  // PF_DITTA → 1 PF › 2 Ditta › 3 Regime › 4 Per  (×2 per regime = 6 righe)
  // PF_PROF  → 1 PF › 2 Prof  › 3 Regime › 4 Per  (×2 per regime = 6 righe)
  // SP       → 1 SP › 3 Regime › 4 Per             (4 righe)
  // SC       → 1 SC › 3 Ord   › 4 Per              (2 righe)
  // ASS      → 1 ASS › 3 Regime › 4 Per            (4 righe)
  const PERCORSI = {
    PF: [
      { sepLabel: "PRIVATO",           col2Label: "Privato",           col3Label: null,           codice: "PF_PRIV",      hasPer: false },
      { sepLabel: "SOCIO",             col2Label: "Socio",             col3Label: null,           codice: "PF_SOCIO",     hasPer: false },
      { sepLabel: "DITTA INDIVIDUALE", col2Label: "Ditta Individuale", col3Label: "Ordinario",    codice: "PF_DITTA_ORD", hasPer: true },
      { sepLabel: null,                col2Label: "Ditta Individuale", col3Label: "Semplificato", codice: "PF_DITTA_SEM", hasPer: true },
      { sepLabel: null,                col2Label: "Ditta Individuale", col3Label: "Forfettario",  codice: "PF_DITTA_FOR", hasPer: true },
      { sepLabel: "PROFESSIONISTA",    col2Label: "Professionista",    col3Label: "Ordinario",    codice: "PF_PROF_ORD",  hasPer: true },
      { sepLabel: null,                col2Label: "Professionista",    col3Label: "Semplificato", codice: "PF_PROF_SEM",  hasPer: true },
      { sepLabel: null,                col2Label: "Professionista",    col3Label: "Forfettario",  codice: "PF_PROF_FOR",  hasPer: true },
    ],
    SP: [
      { sepLabel: null, col2Label: null, col3Label: "Ordinaria",    codice: "SP_ORD",  hasPer: true },
      { sepLabel: null, col2Label: null, col3Label: "Semplificata", codice: "SP_SEMP", hasPer: true },
    ],
    SC: [
      { sepLabel: null, col2Label: null, col3Label: "Ordinaria",    codice: "SC_ORD",  hasPer: true },
    ],
    ASS: [
      { sepLabel: null, col2Label: null, col3Label: "Ordinaria",    codice: "ASS_ORD",  hasPer: true },
      { sepLabel: null, col2Label: null, col3Label: "Semplificata", codice: "ASS_SEMP", hasPer: true },
    ],
  };

  const PERIODICITA = [
    { value: "mensile",     label: "📅 Mensile",     color: "#22d3ee" },
    { value: "trimestrale", label: "📆 Trimestrale", color: "#a78bfa" },
  ];

  const tipColors = { PF: "#5b8df6", SP: "#a78bfa", SC: "#34d399", ASS: "#fbbf24" };
  const tipDesc   = { PF: "Persona Fisica", SP: "Società di Persone", SC: "Società di Capitali", ASS: "Associazione" };
  const tipIcons  = { PF: "👤", SP: "🤝", SC: "🏢", ASS: "🏛️" };

  const col2Colors = {
    "Privato":           "#5b8df6",
    "Socio":             "#a78bfa",
    "Ditta Individuale": "#fb923c",
    "Professionista":    "#34d399",
  };
  const col3Colors = {
    "Ordinario":    "#5b8df6", "Ordinaria":    "#5b8df6",
    "Semplificato": "#22d3ee", "Semplificata": "#22d3ee",
    "Forfettario":  "#fbbf24",
  };
  const sepColors = {
    "PRIVATO":           "#5b8df6",
    "SOCIO":             "#a78bfa",
    "DITTA INDIVIDUALE": "#fb923c",
    "PROFESSIONISTA":    "#34d399",
  };

  function step(num, label, color) {
    const c = color || "var(--accent)";
    return `<div class="tp-step">
      <div class="tp-num" style="background:${c}18;border-color:${c}44;color:${c}">${num}</div>
      <div class="tp-val">${label}</div>
    </div>`;
  }

  function arrow() { return `<span class="tp-arr">›</span>`; }

  function buildPercorsoRows(p, tipCodice, tipColor) {
    let html = "";
    const perRows = p.hasPer ? PERIODICITA : [null];
    perRows.forEach(per => {
      const parts = [];
      // Col 1 — sempre
      parts.push(step(1, tipCodice, tipColor));
      // Col 2 — solo se presente
      if (p.col2Label) {
        parts.push(arrow());
        parts.push(step(2, p.col2Label, col2Colors[p.col2Label] || "#7c85a2"));
      }
      // Col 3 — solo se presente
      if (p.col3Label) {
        parts.push(arrow());
        parts.push(step(3, p.col3Label, col3Colors[p.col3Label] || "#7c85a2"));
      }
      // Col 4 — solo se hasPer
      if (per) {
        parts.push(arrow());
        parts.push(`<div class="tp-step">
          <div class="tp-num" style="background:${per.color}18;border-color:${per.color}44;color:${per.color}">4</div>
          <span class="tp-per" style="color:${per.color};border-color:${per.color}44;background:${per.color}11">${per.label}</span>
        </div>`);
      }
      // Codice (a destra)
      parts.push(`<span class="tp-codice" style="background:${tipColor}12;color:${tipColor};border:1px solid ${tipColor}30">${p.codice}</span>`);
      html += `<div class="tp-row">${parts.join("")}</div>`;
    });
    return html;
  }

  // ─── BUILD HTML ───────────────────────────────────────────────
  let html = `
    <div class="infobox" style="margin-bottom:20px">
      🗂️ Tutti i percorsi di classificazione possibili. I numeri cerchiati indicano sempre la colonna reale:
      <strong style="color:var(--accent)">1</strong> Tipologia ·
      <strong style="color:#fb923c">2</strong> Sottocategoria ·
      <strong style="color:#5b8df6">3</strong> Regime ·
      <strong style="color:#22d3ee">4</strong> Periodicità
    </div>
    <div class="tp-grid">`;

  Object.entries(PERCORSI).forEach(([tipCodice, percorsi]) => {
    const tipColor    = tipColors[tipCodice];
    const totalePaths = percorsi.reduce((n, p) => n + (p.hasPer ? 2 : 1), 0);

    html += `<div class="tp-card">
      <div class="tp-card-header" style="border-left:4px solid ${tipColor}">
        <div class="tp-badge" style="background:${tipColor}18;border:1px solid ${tipColor}44;color:${tipColor}">${tipIcons[tipCodice]} ${tipCodice}</div>
        <div>
          <div class="tp-card-title">${tipDesc[tipCodice]}</div>
          <div class="tp-card-sub">${totalePaths} percorsi possibili</div>
        </div>
      </div>
      <div class="tp-percorsi">`;

    percorsi.forEach(p => {
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
    .tp-percorsi { padding:12px 16px; display:flex; flex-direction:column; gap:5px; }
    .tp-sep-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:8px 0 4px; border-bottom:1px solid var(--border); margin:4px 0 2px; }
    .tp-row { display:flex; align-items:center; flex-wrap:wrap; gap:3px; padding:7px 10px; background:var(--surface2); border:1px solid var(--border2); border-radius:7px; transition:border-color .12s, background .12s; }
    .tp-row:hover { border-color:var(--accent); background:var(--surface3); }
    .tp-step { display:flex; align-items:center; gap:5px; }
    .tp-num { width:19px; height:19px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; border:1px solid; flex-shrink:0; font-family:var(--mono); }
    .tp-val { font-size:12px; font-weight:600; color:var(--text); white-space:nowrap; }
    .tp-arr { color:var(--text3); font-size:16px; line-height:1; margin:0 2px; }
    .tp-per { display:inline-flex; align-items:center; gap:4px; padding:2px 9px; border:1px solid; border-radius:20px; font-size:11px; font-weight:700; white-space:nowrap; }
    .tp-codice { font-family:var(--mono); font-size:10px; font-weight:700; padding:2px 7px; border-radius:4px; margin-left:auto; flex-shrink:0; }
  </style>`;

  document.getElementById("content").innerHTML = html;
}