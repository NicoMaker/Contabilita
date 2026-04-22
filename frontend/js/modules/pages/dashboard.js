// ═══════════════════════════════════════════════════════════════
// DASHBOARD.JS — Dashboard con statistiche e griglia adempimenti
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
    <div class="table-wrap">
      <div class="table-header no-print" style="flex-wrap:wrap;gap:10px">
        <h3 id="dash-adp-count-title">Adempimenti ${stats.anno}</h3>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;flex:1">
          <div class="dash-filtri-bar" style="display:flex;gap:6px;align-items:center;margin-left:auto;flex-wrap:wrap">
            <select class="select" id="dash-filtro-stato-adp" style="width:170px;font-size:13px" onchange="onDashFiltroStatoAdp()" title="Filtra per stato">
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
            <button class="btn btn-sm btn-primary" onclick="resetDashFiltri()" title="Azzera filtri">⟳ Tutti</button>
          </div>
        </div>
      </div>
      <div id="dash-adp-grid" style="padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px"></div>
    </div>`;
  state._dashRendered = true;
}

function onDashFiltroStatoAdp() {
  state.dashFiltroStatoAdp = document.getElementById("dash-filtro-stato-adp")?.value || "";
  if (state.dashStats) updateDashboardContent(state.dashStats);
}

function resetDashFiltri() {
  state.dashSearch = "";
  state.dashFiltroStatoAdp = "";
  ["dash-adp-search","dash-filtro-stato-adp"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (state.dashStats) updateDashboardContent(state.dashStats);
}

function adempimentoPassaFiltroStato(a, filtroStato) {
  if (!filtroStato) return true;
  const inCorso = Math.max(0, a.totale - a.completati - a.da_fare - (a.na || 0));
  const na = a.na || 0;
  switch (filtroStato) {
    case "da_fare":    return a.da_fare > 0;
    case "in_corso":   return inCorso > 0;
    case "completato": return a.completati > 0;
    case "n_a":        return na > 0;
    default:           return true;
  }
}

function updateDashboardContent(stats) {
  const allAdp = stats.adempimentiStats || [];
  const sq = (state.dashSearch || "").toLowerCase().trim();
  const ss = state.dashFiltroStatoAdp || "";

  const adpVis = allAdp.filter(a => {
    if (sq && !a.nome.toLowerCase().includes(sq) && !a.codice.toLowerCase().includes(sq)) return false;
    if (!adempimentoPassaFiltroStato(a, ss)) return false;
    return true;
  });

  const fT = adpVis.reduce((s, a) => s + a.totale, 0);
  const fC = adpVis.reduce((s, a) => s + a.completati, 0);
  const fD = adpVis.reduce((s, a) => s + a.da_fare, 0);
  const fI = adpVis.reduce((s, a) => s + Math.max(0, a.totale - a.completati - a.da_fare), 0);
  const fP = fT > 0 ? Math.round((fC / fT) * 100) : 0;
  const isF = sq !== "" || ss !== "";

  const se = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const si = (id, v) => { const e = document.getElementById(id); if (e) e.innerHTML = v; };

  si("ds-lbl-tot", `Adempimenti ${stats.anno}${isF ? ` <span style="font-size:10px;color:var(--yellow)">(filtro)</span>` : ""}`);
  se("ds-tot", fT);
  se("ds-comp", fC);
  se("ds-dafare", fD);
  se("ds-incorso", fI);
  se("ds-na", stats.na || 0);
  se("ds-perc", fP + "%");
  const dp = document.getElementById("ds-prog");
  if (dp) dp.style.width = fP + "%";

  const title = document.getElementById("dash-adp-count-title");
  if (title) title.innerHTML = `Adempimenti ${stats.anno} <span style="font-size:12px;font-weight:400;color:var(--text3);margin-left:6px">${adpVis.length}/${allAdp.length} — clicca per Vista Globale</span>`;

  const grid = document.getElementById("dash-adp-grid");
  if (!grid) return;

  if (!adpVis.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text3)">
      <div style="font-size:40px;margin-bottom:16px">📋</div>
      <div style="font-size:15px">Nessun adempimento trovato</div>
      <button class="btn btn-sm btn-primary" onclick="resetDashFiltri()" style="margin-top:14px">⟳ Rimuovi filtri</button>
    </div>`;
    return;
  }

  let html = "";
  adpVis.forEach(a => {
    const p = a.totale > 0 ? Math.round((a.completati / a.totale) * 100) : 0;
    const iC = Math.max(0, a.totale - a.completati - a.da_fare - (a.na || 0));
    const na = a.na || 0;
    const pgColor = p === 100 ? "var(--green)" : p > 50 ? "var(--yellow)" : "var(--red)";
    const hl = (col) => (ss ? `box-shadow:0 0 0 2px ${col};` : "");

    const statoBadges = [];
    if (a.completati > 0) statoBadges.push(`<span class="ds-badge" style="color:var(--green);background:var(--green)12;border-color:var(--green)33;${ss==="completato"?hl("var(--green)"):""}" title="${a.completati} completati">✅ ${a.completati}</span>`);
    if (iC > 0)           statoBadges.push(`<span class="ds-badge" style="color:var(--yellow);background:var(--yellow)12;border-color:var(--yellow)33;${ss==="in_corso"?hl("var(--yellow)"):""}" title="${iC} in corso">🔄 ${iC}</span>`);
    if (a.da_fare > 0)    statoBadges.push(`<span class="ds-badge" style="color:var(--red);background:var(--red)12;border-color:var(--red)33;${ss==="da_fare"?hl("var(--red)"):""}" title="${a.da_fare} da fare">⭕ ${a.da_fare}</span>`);
    if (na > 0)           statoBadges.push(`<span class="ds-badge" style="color:var(--text3);background:var(--surface3);border-color:var(--border);${ss==="n_a"?hl("var(--text3)"):""}" title="${na} N/A">➖ ${na}</span>`);

    html += `<div class="dash-adp-card" onclick="goVistaGlobaleAdp('${escAttr(a.nome)}')" title="Clicca per Vista Globale — ${escAttr(a.nome)}">
      <div class="dash-adp-card-top">
        <span class="adp-def-codice" style="font-size:13px">${a.codice}</span>
        <div class="mini-bar" style="width:60px"><div class="mini-fill" style="width:${p}%;background:${pgColor}"></div></div>
        <span style="font-size:11px;font-family:var(--mono);color:${pgColor};min-width:32px;text-align:right">${p}%</span>
      </div>
      <div class="dash-adp-nome" style="font-size:14px">${a.nome}</div>
      <div class="dash-adp-stats">
        <div class="dash-stat-chip" title="Totale"><span class="ds-num">${a.totale}</span><span class="ds-lbl">Tot.</span></div>
        <div class="dash-stat-chip" style="color:var(--green)" title="Completati"><span class="ds-num">${a.completati}</span><span class="ds-lbl">✓</span></div>
        <div class="dash-stat-chip" style="color:var(--red)" title="Da fare"><span class="ds-num">${a.da_fare}</span><span class="ds-lbl">⭕</span></div>
        ${iC > 0 ? `<div class="dash-stat-chip" style="color:var(--yellow)"><span class="ds-num">${iC}</span><span class="ds-lbl">🔄</span></div>` : ""}
        ${na > 0 ? `<div class="dash-stat-chip" style="color:var(--text3)"><span class="ds-num">${na}</span><span class="ds-lbl">➖</span></div>` : ""}
      </div>
      ${statoBadges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">${statoBadges.join("")}</div>` : ""}
    </div>`;
  });

  grid.innerHTML = html;
}

function renderDashboard(stats) {
  if (!state._dashRendered) buildDashboardShell(stats);
  updateDashboardContent(stats);
}

function onDashAdpSearch(val) {
  state.dashSearch = val;
  if (state.dashStats) updateDashboardContent(state.dashStats);
}

function goVistaGlobaleAdp(nome) {
  state.globalePreFiltroAdp = nome;
  document.querySelectorAll(".nav-item").forEach(x => x.classList.remove("active"));
  document.querySelector('[data-page="scadenzario_globale"]').classList.add("active");
  renderPage("scadenzario_globale");
}