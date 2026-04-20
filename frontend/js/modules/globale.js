// ═══════════════════════════════════════════════════════════════
// GLOBALE.JS — Vista Globale scadenzario tutti i clienti
// ═══════════════════════════════════════════════════════════════

function calcolaGlobaleStats(data) {
  const totale = data.length;
  const comp   = data.filter(r => r.stato === "completato").length;
  const daF    = data.filter(r => r.stato === "da_fare").length;
  const inC    = data.filter(r => r.stato === "in_corso").length;
  const clientiSet = new Set(data.map(r => r.cliente_id));
  const adpSet     = new Set(data.map(r => r.adempimento_nome));
  return { totale, comp, daF, inC, clienti: clientiSet.size, adempimenti: adpSet };
}

function renderGlobalePage() {
  document.getElementById("topbar-actions").innerHTML = `
    <div class="year-sel">
      <button onclick="changeAnnoGlobale(-1)">&#9664;</button>
      <span class="year-num">${state.anno}</span>
      <button onclick="changeAnnoGlobale(1)">&#9654;</button>
    </div>
    <select class="select" id="glob-filtro-adp" style="width:190px" onchange="applyGlobaleFiltri()">
      <option value="">Tutti adempimenti</option>
    </select>
    <select class="select" id="glob-filtro-stato" style="width:135px" onchange="applyGlobaleFiltri()">
      <option value="">Tutti stati</option>
      <option value="da_fare">⭕ Da fare</option><option value="in_corso">🔄 In corso</option>
      <option value="completato">✅ Completato</option><option value="n_a">➖ N/A</option>
    </select>
    <select class="select" id="glob-filtro-tipo" style="width:110px" onchange="applyGlobaleFiltri()">
      <option value="">Tutti tipi</option>
      <option value="PF">PF</option><option value="SP">SP</option>
      <option value="SC">SC</option><option value="ASS">ASS</option>
    </select>
    <select class="select" id="glob-filtro-periodicita" style="width:130px" onchange="applyGlobaleFiltri()">
      <option value="">Periodicità</option>
      <option value="mensile">📅 Mensile</option><option value="trimestrale">📆 Trimestrale</option>
    </select>
    <div class="search-wrap" style="width:190px">
      <span class="search-icon">🔍</span>
      <input class="input" id="glob-search" placeholder="Cerca cliente..." oninput="applyGlobaleFiltriDebounced()">
    </div>
    <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>`;
  loadGlobale();
}

function changeAnnoGlobale(d) {
  state.anno += d;
  document.querySelectorAll(".year-num").forEach(el => el.textContent = state.anno);
  loadGlobale();
}

function loadGlobale() {
  const filtri = {};
  const adpSel   = document.getElementById("glob-filtro-adp")?.value;
  const statoSel = document.getElementById("glob-filtro-stato")?.value;
  const search   = document.getElementById("glob-search")?.value;
  if (adpSel)   filtri.adempimento = adpSel;
  if (statoSel) filtri.stato = statoSel;
  if (search)   filtri.search = search;
  if (state.globalePreFiltroAdp) filtri.adempimento = state.globalePreFiltroAdp;
  socket.emit("get:scadenzario_globale", { anno: state.anno, filtri });
}

const applyGlobaleFiltriDebounced = debounce(() => {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}, 300);

function applyGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}

function renderGlobaleHeader() {
  const st = state.globaleStats;
  if (!st) return;
  const adpSel = document.getElementById("glob-filtro-adp");
  if (adpSel) {
    const current = state.globalePreFiltroAdp || adpSel.value;
    adpSel.innerHTML = `<option value="">Tutti adempimenti</option>` +
      Array.from(st.adempimenti).sort()
        .map(a => `<option value="${escAttr(a)}" ${current===a?"selected":""}>${a}</option>`)
        .join("");
    if (state.globalePreFiltroAdp) state.globalePreFiltroAdp = "";
  }
}

function renderGlobaleTabella(rawData) {
  const st = state.globaleStats;
  const filtroTipo = document.getElementById("glob-filtro-tipo")?.value || "";
  const filtroPer  = document.getElementById("glob-filtro-periodicita")?.value || "";
  const data = rawData.filter(r => {
    if (filtroTipo && r.cliente_tipologia_codice !== filtroTipo) return false;
    if (filtroPer  && r.cliente_periodicita !== filtroPer) return false;
    return true;
  });

  const perc = st.totale > 0 ? Math.round((st.comp / st.totale) * 100) : 0;
  const headerCard = `<div class="globale-preview-card">
    <div class="gpc-left">
      <div class="gpc-globe">🌐</div>
      <div>
        <div class="gpc-title">Vista Globale ${state.anno}</div>
        <div class="gpc-sub">${st.clienti} clienti · ${st.adempimenti.size} tipi adempimenti</div>
      </div>
    </div>
    <div class="gpc-stats">
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--accent)">${st.totale}</div><div class="cpc-stat-lbl">Totale</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${st.comp}</div><div class="cpc-stat-lbl">Comp.</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--red)">${st.daF}</div><div class="cpc-stat-lbl">Da fare</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--yellow)">${st.inC}</div><div class="cpc-stat-lbl">In corso</div></div>
      <div class="cpc-stat-item"><div class="cpc-stat-num" style="color:var(--green)">${perc}%</div><div class="cpc-stat-lbl">Progresso</div><div class="mini-bar" style="margin-top:4px;width:60px"><div class="mini-fill" style="width:${perc}%"></div></div></div>
    </div>
  </div>`;

  // Raggruppa per adempimento → poi per cliente con tutti i periodi
  const grouped = {};
  data.forEach(r => {
    storeRow(r);
    const adpKey = r.adempimento_nome;
    if (!grouped[adpKey])
      grouped[adpKey] = { nome: r.adempimento_nome, codice: r.adempimento_codice, categoria: r.categoria, clienti: {} };
    const cliKey = r.cliente_id;
    if (!grouped[adpKey].clienti[cliKey])
      grouped[adpKey].clienti[cliKey] = {
        id: r.cliente_id, nome: r.cliente_nome, cf: r.cliente_cf, piva: r.cliente_piva,
        tipologia_codice: r.cliente_tipologia_codice, tipologia_colore: r.cliente_tipologia_colore,
        sottotipologia_nome: r.cliente_sottotipologia_nome, periodicita: r.cliente_periodicita,
        col2: r.cliente_col2, col3: r.cliente_col3, periodi: [],
      };
    grouped[adpKey].clienti[cliKey].periodi.push(r);
  });

  const col2Map = { privato: "Privato", ditta: "Ditta Ind.", socio: "Socio", professionista: "Prof." };
  const col3Map = { ordinario: "Ord.", semplificato: "Sempl.", forfettario: "Forf.", ordinaria: "Ord.", semplificata: "Sempl." };

  let content = "";
  Object.values(grouped).forEach(g => {
    const allRows = Object.values(g.clienti).flatMap(c => c.periodi);
    const compG = allRows.filter(r => r.stato === "completato").length;
    const totG  = allRows.length;
    const pG    = totG > 0 ? Math.round((compG / totG) * 100) : 0;
    const catInfo  = CATEGORIE.find(x => x.codice === g.categoria);
    const catColor = catInfo?.color || "var(--accent)";

    const clientiHtml = Object.values(g.clienti).map(c => {
      const tipColor = c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
      const avatar   = (c.nome || "?").charAt(0).toUpperCase();
      const compC = c.periodi.filter(r => r.stato === "completato").length;
      const totC  = c.periodi.length;
      const pC    = totC > 0 ? Math.round((compC / totC) * 100) : 0;
      const pgColor = pC === 100 ? "var(--green)" : pC > 50 ? "var(--yellow)" : "var(--red)";

      const parts = [];
      if (c.col2) parts.push(col2Map[c.col2] || c.col2);
      if (c.col3) parts.push(col3Map[c.col3] || c.col3);
      if (c.periodicita) parts.push(c.periodicita === "mensile" ? "Mens." : "Trim.");
      const classInfo = parts.length
        ? `<div style="font-size:9px;color:var(--text3);margin-top:2px;font-family:var(--mono)">${parts.join(" · ")}</div>`
        : "";

      const periodiHtml = c.periodi.map(r => renderPeriodoPill(r)).join("");
      const isMensile = c.periodi.length > 4;

      return `<div class="glob-cliente-card">
        <div class="glob-cliente-header">
          <div class="gcr-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}15">${avatar}</div>
          <div style="flex:1;min-width:0">
            <div class="gcr-nome">${escAttr(c.nome)}</div>
            <div class="gcr-cf">${c.cf || c.piva || "-"}</div>
            ${classInfo}
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">
            <span class="badge b-${(c.tipologia_codice||"").toLowerCase()}">${c.tipologia_codice||"-"}</span>
            ${c.periodicita ? `<span class="badge-per" style="font-size:9px">${c.periodicita==="mensile"?"📅":"📆"} ${c.periodicita==="mensile"?"Mens.":"Trim."}</span>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-left:12px">
            <div class="mini-bar" style="width:50px"><div class="mini-fill" style="width:${pC}%;background:${pgColor}"></div></div>
            <span style="font-size:10px;font-family:var(--mono);color:${pgColor}">${compC}/${totC}</span>
          </div>
        </div>
        <div class="glob-cliente-periodi${isMensile ? " periodi-mensili" : ""}">${periodiHtml}</div>
      </div>`;
    }).join("");

    content += `<div class="table-wrap" style="margin-bottom:14px">
      <div class="table-header">
        <div style="display:flex;align-items:center;gap:10px;flex:1">
          <span style="font-size:16px">${catInfo?.icona || "📋"}</span>
          <div>
            <span style="font-family:var(--mono);font-size:11px;color:${catColor};font-weight:700">${g.codice}</span>
            <strong style="margin-left:8px">${g.nome}</strong>
            <span class="badge b-categoria" style="margin-left:8px;color:${catColor};background:${catColor}15">${g.categoria}</span>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <div class="mini-bar" style="width:80px"><div class="mini-fill" style="width:${pG}%"></div></div>
          <span style="font-size:11px;font-family:var(--mono);color:var(--text2)">${compG}/${totG} (${pG}%)</span>
        </div>
      </div>
      <div style="padding:10px;display:flex;flex-direction:column;gap:6px">${clientiHtml}</div>
    </div>`;
  });

  if (!content)
    content = `<div class="empty"><div class="empty-icon">🌐</div><p>Nessun adempimento trovato per ${state.anno}</p></div>`;

  document.getElementById("content").innerHTML = headerCard + content;
}