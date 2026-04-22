// ═══════════════════════════════════════════════════════════════
// GLOBALE.JS — Vista Globale scadenzario tutti i clienti
// ═══════════════════════════════════════════════════════════════

function calcolaGlobaleStats(data) {
  const totale = data.length;
  const comp = data.filter((r) => r.stato === "completato").length;
  const daF = data.filter((r) => r.stato === "da_fare").length;
  const inC = data.filter((r) => r.stato === "in_corso").length;
  const clientiSet = new Set(data.map((r) => r.cliente_id));
  const adpSet = new Set(data.map((r) => r.adempimento_nome));
  return {
    totale,
    comp,
    daF,
    inC,
    clienti: clientiSet.size,
    adempimenti: adpSet,
  };
}

function renderGlobalePage() {
  document.getElementById("topbar-actions").innerHTML = `
    <div class="year-sel">
      <button onclick="changeAnnoGlobale(-1)" title="Anno precedente">&#9664;</button>
      <span class="year-num">${state.anno}</span>
      <button onclick="changeAnnoGlobale(1)" title="Anno successivo">&#9654;</button>
    </div>
    <select class="select" id="glob-filtro-adp" style="width:210px;font-size:13px" onchange="applyGlobaleFiltri()" title="Filtra per tipo di adempimento">
      <option value="">📋 Tutti adempimenti</option>
    </select>
    <select class="select" id="glob-filtro-stato" style="width:155px;font-size:13px" onchange="applyGlobaleFiltri()" title="Filtra per stato adempimento">
      <option value="">🔵 Tutti stati</option>
      <option value="da_fare">⭕ Da fare</option>
      <option value="in_corso">🔄 In corso</option>
      <option value="completato">✅ Completato</option>
      <option value="n_a">➖ N/A</option>
    </select>
    <select class="select" id="glob-filtro-tipo" style="width:125px;font-size:13px" onchange="applyGlobaleFiltri()" title="Filtra per tipologia cliente">
      <option value="">👥 Tutti tipi</option>
      <option value="PF">👤 PF</option>
      <option value="SP">🤝 SP</option>
      <option value="SC">🏢 SC</option>
      <option value="ASS">🏛️ ASS</option>
    </select>
    <select class="select" id="glob-filtro-periodicita" style="width:155px;font-size:13px" onchange="applyGlobaleFiltri()" title="Filtra per periodicità contabile">
      <option value="">📅 Periodicità</option>
      <option value="mensile">📅 Mensile</option>
      <option value="trimestrale">📆 Trimestrale</option>
    </select>
    <div class="search-wrap" style="width:200px">
      <span class="search-icon">🔍</span>
      <input class="input" id="glob-search" placeholder="Cerca cliente..." oninput="applyGlobaleFiltriDebounced()" title="Cerca per nome cliente, CF o P.IVA" style="font-size:13px">
    </div>
    <button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" title="Azzera tutti i filtri e mostra tutto" style="font-size:13px">⟳ Tutti</button>
    <button class="btn btn-print btn-sm" onclick="window.print()" title="Stampa la vista globale" style="font-size:13px">🖨️ Stampa</button>`;

  setTimeout(() => initSearchableSelect("glob-filtro-adp"), 50);

  loadGlobale();
}

function changeAnnoGlobale(d) {
  state.anno += d;
  document
    .querySelectorAll(".year-num")
    .forEach((el) => (el.textContent = state.anno));
  loadGlobale();
}

function loadGlobale() {
  const filtri = {};
  const adpSel = document.getElementById("glob-filtro-adp")?.value;
  const statoSel = document.getElementById("glob-filtro-stato")?.value;
  const search = document.getElementById("glob-search")?.value;
  if (adpSel) filtri.adempimento = adpSel;
  if (statoSel) filtri.stato = statoSel;
  if (search) filtri.search = search;
  if (state.globalePreFiltroAdp) filtri.adempimento = state.globalePreFiltroAdp;
  if (typeof socket !== 'undefined') {
    socket.emit("get:scadenzario_globale", { anno: state.anno, filtri });
  }
}

const applyGlobaleFiltriDebounced = debounce(() => {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}, 300);

function applyGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  loadGlobale();
}

function applyGlobaleFiltriLocali() {
  if (state.scadGlobale) renderGlobaleTabella(state.scadGlobale);
}

function resetGlobaleFiltri() {
  state.globalePreFiltroAdp = "";
  [
    "glob-filtro-adp",
    "glob-filtro-stato",
    "glob-filtro-tipo",
    "glob-filtro-periodicita",
    "glob-filtro-cliente-stato",
    "glob-search",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      if (el._ssRefresh) el._ssRefresh();
    }
  });
  loadGlobale();
}

function renderGlobaleHeader() {
  const st = state.globaleStats;
  if (!st) return;
  const adpSel = document.getElementById("glob-filtro-adp");
  if (adpSel) {
    const current = state.globalePreFiltroAdp || adpSel.value;
    adpSel.innerHTML =
      `<option value="">📋 Tutti adempimenti</option>` +
      Array.from(st.adempimenti)
        .sort()
        .map(
          (a) =>
            `<option value="${escAttr(a)}" ${current === a ? "selected" : ""}>${a}</option>`,
        )
        .join("");

    if (!adpSel.dataset.ssinit) {
      initSearchableSelect("glob-filtro-adp");
    } else if (adpSel._ssRefresh) {
      adpSel._ssRefresh();
    }

    if (state.globalePreFiltroAdp) state.globalePreFiltroAdp = "";
  }
}

function navigaAdempimento(direzione) {
  const adpSel = document.getElementById("glob-filtro-adp");
  if (!adpSel || !state.globaleStats) return;
  const lista = Array.from(state.globaleStats.adempimenti).sort();
  const current = adpSel.value;
  const idx = lista.indexOf(current);
  let newIdx;
  if (direzione === -1) {
    newIdx = idx <= 0 ? lista.length - 1 : idx - 1;
  } else {
    newIdx = idx >= lista.length - 1 || idx === -1 ? 0 : idx + 1;
  }
  adpSel.value = lista[newIdx];
  if (adpSel._ssRefresh) adpSel._ssRefresh();
  applyGlobaleFiltri();
}

function clientePassaFiltroStato(periodi, filtroClienteStato) {
  if (!filtroClienteStato) return true;
  const hasInCorso = periodi.some((r) => r.stato === "in_corso");
  const hasDaFare = periodi.some((r) => r.stato === "da_fare");
  const hasCompletato = periodi.some((r) => r.stato === "completato");
  const hasNA = periodi.some((r) => r.stato === "n_a");
  const tuttiComp = periodi.every(
    (r) => r.stato === "completato" || r.stato === "n_a",
  );
  const nessunAvanz = periodi.every((r) => r.stato === "da_fare");

  switch (filtroClienteStato) {
    case "con_in_corso":
      return hasInCorso;
    case "senza_in_corso":
      return !hasInCorso;
    case "tutti_completati":
      return tuttiComp;
    case "con_da_fare":
      return hasDaFare;
    case "solo_da_fare":
      return nessunAvanz;
    case "non_completati":
      return !tuttiComp;
    case "con_na":
      return hasNA;
    default:
      return true;
  }
}

function renderGlobaleTabella(rawData) {
  const st = state.globaleStats;
  const filtroTipo = document.getElementById("glob-filtro-tipo")?.value || "";
  const filtroPer =
    document.getElementById("glob-filtro-periodicita")?.value || "";
  const filtroClienteStato =
    document.getElementById("glob-filtro-cliente-stato")?.value || "";

  // ⭐ Nota: i dati rawData contengono già le informazioni del cliente
  // dal backend (che ora prende la configurazione annuale)
  const data = rawData.filter((r) => {
    if (filtroTipo && r.cliente_tipologia_codice !== filtroTipo) return false;
    if (filtroPer && r.cliente_periodicita !== filtroPer) return false;
    return true;
  });

  const perc = st.totale > 0 ? Math.round((st.comp / st.totale) * 100) : 0;

  const adpSel = document.getElementById("glob-filtro-adp");
  const adpFiltroAttivo = adpSel?.value || "";
  const adpListaOrdinata = st.adempimenti
    ? Array.from(st.adempimenti).sort()
    : [];
  const adpIdx = adpListaOrdinata.indexOf(adpFiltroAttivo);

  const filtroClienteStatoLabels = {
    con_in_corso: "🔄 Con almeno 1 in corso",
    senza_in_corso: "✅ Senza in corso",
    tutti_completati: "🏆 Tutto completato",
    con_da_fare: "⭕ Con almeno 1 da fare",
    solo_da_fare: "🚨 Solo da fare",
    non_completati: "⚠️ Non al 100%",
    con_na: "➖ Con almeno 1 N/A",
  };
  const filtroClienteStatoBadge = filtroClienteStato
    ? `<div style="display:inline-flex;align-items:center;gap:6px;margin-top:8px;padding:5px 12px;background:var(--yellow)18;border:1px solid var(--yellow)44;border-radius:20px;font-size:12px;color:var(--yellow)">
        <span>Filtro clienti:</span>
        <strong>${filtroClienteStatoLabels[filtroClienteStato] || filtroClienteStato}</strong>
        <button onclick="document.getElementById('glob-filtro-cliente-stato').value='';applyGlobaleFiltriLocali()" style="background:none;border:none;color:var(--yellow);cursor:pointer;font-size:13px;padding:0 2px;line-height:1" title="Rimuovi filtro">✕</button>
      </div>`
    : "";

  const navAdpHtml =
    adpFiltroAttivo && adpListaOrdinata.length > 1
      ? `<div class="glob-nav-adp" style="display:flex;align-items:center;gap:8px;margin-top:12px;padding:10px 16px;background:var(--surface3);border-radius:var(--r-sm);border:1px solid var(--border2)">
        <button class="btn btn-sm btn-secondary" onclick="navigaAdempimento(-1)" title="Adempimento precedente" style="font-size:13px">&#9664; Prec.</button>
        <span style="flex:1;text-align:center;font-size:14px;font-weight:700;color:var(--accent)">${adpFiltroAttivo}</span>
        <span style="font-size:12px;color:var(--text3)">${adpIdx + 1} / ${adpListaOrdinata.length}</span>
        <button class="btn btn-sm btn-secondary" onclick="navigaAdempimento(1)" title="Adempimento successivo" style="font-size:13px">Succ. &#9654;</button>
        <button class="btn btn-sm btn-primary" onclick="resetGlobaleFiltri()" title="Torna a vedere tutti gli adempimenti" style="margin-left:8px;font-size:13px">✕ Tutti</button>
      </div>`
      : "";

  const headerCard = `<div class="globale-preview-card">
    <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;width:100%">
      <div class="gpc-left">
        <div class="gpc-globe" title="Vista globale di tutti i clienti">🌐</div>
        <div>
          <div class="gpc-title" style="font-size:17px">Vista Globale ${state.anno}</div>
          <div class="gpc-sub" style="font-size:13px">${st.clienti} clienti · ${st.adempimenti.size} tipi adempimenti</div>
          ${filtroClienteStatoBadge}
        </div>
      </div>
      <div class="gpc-stats">
        <div class="cpc-stat-item" title="Totale adempimenti"><div class="cpc-stat-num" style="color:var(--accent);font-size:24px">${st.totale}</div><div class="cpc-stat-lbl" style="font-size:11px">Totale</div></div>
        <div class="cpc-stat-item" title="Completati"><div class="cpc-stat-num" style="color:var(--green);font-size:24px">${st.comp}</div><div class="cpc-stat-lbl" style="font-size:11px">Comp.</div></div>
        <div class="cpc-stat-item" title="Da fare"><div class="cpc-stat-num" style="color:var(--red);font-size:24px">${st.daF}</div><div class="cpc-stat-lbl" style="font-size:11px">Da fare</div></div>
        <div class="cpc-stat-item" title="In corso"><div class="cpc-stat-num" style="color:var(--yellow);font-size:24px">${st.inC}</div><div class="cpc-stat-lbl" style="font-size:11px">In corso</div></div>
        <div class="cpc-stat-item" title="Percentuale completamento">
          <div class="cpc-stat-num" style="color:var(--green);font-size:24px">${perc}%</div>
          <div class="cpc-stat-lbl" style="font-size:11px">Progresso</div>
          <div class="mini-bar" style="margin-top:4px;width:70px"><div class="mini-fill" style="width:${perc}%"></div></div>
        </div>
      </div>
    </div>
    ${navAdpHtml}
  </div>`;

  // Raggruppa per adempimento
  const grouped = {};
  data.forEach((r) => {
    storeRow(r);
    const adpKey = r.adempimento_nome;
    if (!grouped[adpKey])
      grouped[adpKey] = {
        nome: r.adempimento_nome,
        codice: r.adempimento_codice,
        clienti: {},
      };
    const cliKey = r.cliente_id;
    if (!grouped[adpKey].clienti[cliKey])
      grouped[adpKey].clienti[cliKey] = {
        id: r.cliente_id,
        nome: r.cliente_nome,
        cf: r.cliente_cf,
        piva: r.cliente_piva,
        tipologia_codice: r.cliente_tipologia_codice,
        tipologia_colore: r.cliente_tipologia_colore,
        sottotipologia_nome: r.cliente_sottotipologia_nome,
        periodicita: r.cliente_periodicita,
        col2: r.cliente_col2,
        col3: r.cliente_col3,
        periodi: [],
      };
    grouped[adpKey].clienti[cliKey].periodi.push(r);
  });

  const col2Map = {
    privato: "Privato",
    ditta: "Ditta Ind.",
    socio: "Socio",
    professionista: "Prof.",
  };
  const col3Map = {
    ordinario: "Ord.",
    semplificato: "Sempl.",
    forfettario: "Forf.",
    ordinaria: "Ord.",
    semplificata: "Sempl.",
  };

  let content = "";

  Object.values(grouped).forEach((g) => {
    const clientiFiltrati = Object.values(g.clienti).filter((c) =>
      clientePassaFiltroStato(c.periodi, filtroClienteStato),
    );

    if (!clientiFiltrati.length) return;

    const allRows = clientiFiltrati.flatMap((c) => c.periodi);
    const compG = allRows.filter((r) => r.stato === "completato").length;
    const totG = allRows.length;
    const pG = totG > 0 ? Math.round((compG / totG) * 100) : 0;

    const clientiHtml = clientiFiltrati
      .map((c) => {
        const tipColor =
          c.tipologia_colore || getTipologiaColor(c.tipologia_codice);
        const avatar = getAvatar(c.nome);
        const compC = c.periodi.filter((r) => r.stato === "completato").length;
        const inCC = c.periodi.filter((r) => r.stato === "in_corso").length;
        const daFC = c.periodi.filter((r) => r.stato === "da_fare").length;
        const naC = c.periodi.filter((r) => r.stato === "n_a").length;
        const totC = c.periodi.length;
        const pC = totC > 0 ? Math.round((compC / totC) * 100) : 0;
        const pgColor =
          pC === 100
            ? "var(--green)"
            : pC > 50
              ? "var(--yellow)"
              : "var(--red)";

        const situazioneBadges = [];
        if (compC > 0)
          situazioneBadges.push(
            `<span style="font-size:10px;color:var(--green);background:var(--green)12;border:1px solid var(--green)33;border-radius:10px;padding:1px 6px" title="${compC} completati">✅ ${compC}</span>`,
          );
        if (inCC > 0)
          situazioneBadges.push(
            `<span style="font-size:10px;color:var(--yellow);background:var(--yellow)12;border:1px solid var(--yellow)33;border-radius:10px;padding:1px 6px" title="${inCC} in corso">🔄 ${inCC}</span>`,
          );
        if (daFC > 0)
          situazioneBadges.push(
            `<span style="font-size:10px;color:var(--red);background:var(--red)12;border:1px solid var(--red)33;border-radius:10px;padding:1px 6px" title="${daFC} da fare">⭕ ${daFC}</span>`,
          );
        if (naC > 0)
          situazioneBadges.push(
            `<span style="font-size:10px;color:var(--text3);background:var(--surface3);border:1px solid var(--border);border-radius:10px;padding:1px 6px" title="${naC} N/A">➖ ${naC}</span>`,
          );

        const parts = [];
        if (c.col2) parts.push(col2Map[c.col2] || c.col2);
        if (c.col3) parts.push(col3Map[c.col3] || c.col3);
        if (c.periodicita)
          parts.push(c.periodicita === "mensile" ? "Mens." : "Trim.");
        const classInfo = parts.length
          ? `<div style="font-size:10px;color:var(--text3);margin-top:2px;font-family:var(--mono)">${parts.join(" · ")}</div>`
          : "";

        const periodiHtml = c.periodi.map((r) => renderPeriodoPill(r)).join("");
        const isMensile = c.periodi.length > 4;

        return `<div class="glob-cliente-card">
        <div class="glob-cliente-header">
          <div class="gcr-avatar" style="border-color:${tipColor};color:${tipColor};background:${tipColor}15;font-size:13px" title="${escAttr(c.nome)}">${avatar}</div>
          <div style="flex:1;min-width:0">
            <div class="gcr-nome" style="font-size:14px">${escAttr(c.nome)}</div>
            <div class="gcr-cf" style="font-size:11px">${c.cf || c.piva || "-"}</div>
            ${classInfo}
            ${situazioneBadges.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px">${situazioneBadges.join("")}</div>` : ""}
          </div>
          <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">
            <span class="badge b-${(c.tipologia_codice || "").toLowerCase()}" style="font-size:11px" title="${TIPOLOGIE_INFO[c.tipologia_codice]?.desc || ""}">${c.tipologia_codice || "-"}</span>
            ${c.periodicita ? `<span class="badge-per" style="font-size:10px" title="Periodicità: ${c.periodicita}">${c.periodicita === "mensile" ? "📅" : "📆"} ${c.periodicita === "mensile" ? "Mens." : "Trim."}</span>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-left:14px">
            <div class="mini-bar" style="width:56px" title="${pC}% completato"><div class="mini-fill" style="width:${pC}%;background:${pgColor}"></div></div>
            <span style="font-size:11px;font-family:var(--mono);color:${pgColor};min-width:36px;text-align:right" title="${compC} completati su ${totC}">${compC}/${totC}</span>
          </div>
        </div>
        <div class="glob-cliente-periodi${isMensile ? " periodi-mensili" : ""}">${periodiHtml}</div>
      </div>`;
      })
      .join("");

    content += `<div class="table-wrap" style="margin-bottom:16px">
      <div class="table-header">
        <div style="display:flex;align-items:center;gap:12px;flex:1">
          <strong style="font-size:15px">${g.nome}</strong>
          <span style="font-family:var(--mono);font-size:11px;color:var(--text3)" title="Codice adempimento">${g.codice}</span>
          ${filtroClienteStato ? `<span style="font-size:11px;color:var(--text3);margin-left:8px">${clientiFiltrati.length} client${clientiFiltrati.length === 1 ? "e" : "i"} visibil${clientiFiltrati.length === 1 ? "e" : "i"}</span>` : ""}
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="mini-bar" style="width:90px" title="${pG}% completato"><div class="mini-fill" style="width:${pG}%"></div></div>
          <span style="font-size:12px;font-family:var(--mono);color:var(--text2)" title="${compG} completati su ${totG} (${pG}%)">${compG}/${totG} (${pG}%)</span>
        </div>
      </div>
      <div style="padding:12px;display:flex;flex-direction:column;gap:8px">${clientiHtml}</div>
    </div>`;
  });

  if (!content)
    content = `<div class="empty">
      <div class="empty-icon">🌐</div>
      <p style="font-size:15px">
        ${
          filtroClienteStato
            ? `Nessun cliente corrisponde al filtro "<strong>${filtroClienteStatoLabels[filtroClienteStato] || filtroClienteStato}</strong>" per ${state.anno}`
            : `Nessun adempimento trovato per ${state.anno}`
        }
      </p>
      ${filtroClienteStato ? `<button class="btn btn-sm btn-primary" onclick="document.getElementById('glob-filtro-cliente-stato').value='';applyGlobaleFiltriLocali()" style="margin-top:12px">⟳ Rimuovi filtro</button>` : ""}
    </div>`;

  document.getElementById("content").innerHTML = headerCard + content;
}

// Esponi funzioni globali
window.changeAnnoGlobale = changeAnnoGlobale;
window.applyGlobaleFiltri = applyGlobaleFiltri;
window.resetGlobaleFiltri = resetGlobaleFiltri;
window.navigaAdempimento = navigaAdempimento;
window.applyGlobaleFiltriLocali = applyGlobaleFiltriLocali;