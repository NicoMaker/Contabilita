const socket = io();

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

const STATI = {
  da_fare: '⭕ Da fare',
  in_corso: '🔄 In corso',
  completato: '✅ Completato',
  n_a: '➖ N/A',
};

const CATEGORIE_DISPONIBILI = [
  { codice: 'IVA', nome: '💰 IVA', icona: '💰' },
  { codice: 'DICHIARAZIONI', nome: '📄 Dichiarazioni', icona: '📄' },
  { codice: 'PREVIDENZA', nome: '🏦 Previdenza', icona: '🏦' },
  { codice: 'LAVORO', nome: '👔 Lavoro', icona: '👔' },
  { codice: 'TRIBUTI', nome: '🏛️ Tributi', icona: '🏛️' },
  { codice: 'BILANCIO', nome: '📊 Bilancio', icona: '📊' },
];

let state = {
  page: 'dashboard',
  tipologie: [],
  clienti: [],
  adempimenti: [],
  selectedCliente: null,
  anno: new Date().getFullYear(),
  filtri: { stato: 'tutti', categoria: 'tutti', search: '', adempimento: '' },
  scadenzario: [],
  scadGlobale: [],
};

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ─── CONNESSIONE ──────────────────────────────────────────────────────────
socket.on('connect', () => {
  document.getElementById('conn-status').textContent = '● Online';
  document.getElementById('conn-status').style.color = 'var(--green)';
  socket.emit('get:tipologie');
  renderPage('dashboard');
});

socket.on('disconnect', () => {
  document.getElementById('conn-status').textContent = '● Offline';
  document.getElementById('conn-status').style.color = 'var(--red)';
});

socket.on('notify', ({ type, msg }) => showNotif(msg, type));

// ─── RISPOSTE ─────────────────────────────────────────────────────────────
socket.on('res:tipologie', ({ success, data }) => {
  if (success) {
    state.tipologie = data;
    populateTipologiaSelect();
  }
});

socket.on('res:clienti', ({ success, data }) => {
  if (!success) return;
  state.clienti = data;
  if (state._pending === 'clienti') {
    state._pending = null;
    renderClientiPage();
  }
  if (state._pending === 'scadenzario') {
    state._pending = null;
    renderScadenzarioPage();
  }
});

socket.on('res:adempimenti', ({ success, data }) => {
  if (success) state.adempimenti = data;
  if (state._pending === 'adempimenti') {
    state._pending = null;
    renderAdempimentiPage();
  }
  // Aggiorna anche il select nel modal aggiungi adempimento se aperto
  const sel = document.getElementById('add-adp-select');
  if (sel && success) {
    sel.innerHTML = data.map(a =>
      `<option value="${a.id}">[${a.categoria}] ${a.codice} - ${a.nome}</option>`
    ).join('');
  }
});

socket.on('res:stats', ({ success, data }) => {
  if (success) renderDashboard(data);
});

socket.on('res:scadenzario', ({ success, data }) => {
  if (success) {
    state.scadenzario = data;
    renderScadenzarioTabella(data);
  }
});

socket.on('res:scadenzario_globale', ({ success, data }) => {
  if (success) {
    state.scadGlobale = data;
    renderGlobaleTabella(data);
  }
});

socket.on('res:create:cliente', ({ success }) => {
  if (success) {
    closeModal('modal-cliente');
    state._pending = 'clienti';
    socket.emit('get:clienti');
  }
});

socket.on('res:update:cliente', ({ success }) => {
  if (success) {
    closeModal('modal-cliente');
    refreshPage();
  }
});

socket.on('res:delete:cliente', ({ success }) => {
  if (success) refreshPage();
});

socket.on('res:create:adempimento', ({ success, error }) => {
  if (success) {
    closeModal('modal-adp-def');
    state._pending = 'adempimenti';
    socket.emit('get:adempimenti');
  } else showNotif(error, 'error');
});

socket.on('res:update:adempimento', ({ success, error }) => {
  if (success) {
    closeModal('modal-adp-def');
    state._pending = 'adempimenti';
    socket.emit('get:adempimenti');
  } else showNotif(error, 'error');
});

socket.on('res:delete:adempimento', ({ success }) => {
  if (success) {
    state._pending = 'adempimenti';
    socket.emit('get:adempimenti');
  }
});

socket.on('res:genera:scadenzario', ({ success }) => {
  if (success && state.selectedCliente) loadScadenzario();
});

socket.on('res:copia:scadenzario', ({ success }) => {
  if (success) {
    closeModal('modal-copia');
    loadScadenzario();
  }
});

socket.on('res:update:adempimento_stato', ({ success }) => {
  if (success) {
    closeModal('modal-adempimento');
    if (state.page === 'scadenzario') loadScadenzario();
    if (state.page === 'scadenzario_globale') applyGlobaleSearch();
  }
});

socket.on('res:delete:adempimento_cliente', ({ success }) => {
  if (success) {
    closeModal('modal-adempimento');
    if (state.page === 'scadenzario') loadScadenzario();
    if (state.page === 'scadenzario_globale') applyGlobaleSearch();
  }
});

socket.on('res:add:adempimento_cliente', ({ success }) => {
  if (success) {
    closeModal('modal-add-adp');
    loadScadenzario();
  }
});

// ─── NAVIGAZIONE ─────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
    renderPage(el.dataset.page);
  });
});

function renderPage(page) {
  state.page = page;
  const titles = {
    dashboard: 'Dashboard',
    clienti: 'Clienti',
    scadenzario: 'Scadenzario Cliente',
    scadenzario_globale: 'Vista Globale',
    adempimenti: 'Adempimenti Fiscali',
    tipologie: 'Tipologie Clienti',
  };
  document.getElementById('page-title').textContent = titles[page] || page;

  if (page === 'dashboard') {
    document.getElementById('topbar-actions').innerHTML = `
      <div class="search-wrap" style="width:260px">
        <span class="search-icon">🔍</span>
        <input class="input" id="dash-search" placeholder="Cerca nella dashboard..." oninput="applyDashSearch()">
      </div>
      <div class="year-sel">
        <button onclick="changeAnno(-1)">◀</button>
        <span class="year-num">${state.anno}</span>
        <button onclick="changeAnno(1)">▶</button>
      </div>
      <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>`;
    socket.emit('get:stats', { anno: state.anno, search: '' });

  } else if (page === 'clienti') {
    state._pending = 'clienti';
    document.getElementById('topbar-actions').innerHTML = `
      <div class="search-wrap" style="width:300px">
        <span class="search-icon">🔍</span>
        <input class="input" id="global-search-clienti" placeholder="Cerca nome, CF, P.IVA, email, telefono..." oninput="applyClientiFiltri()">
      </div>
      <select class="select" id="filter-tipo" style="width:150px" onchange="applyClientiFiltri()">
        <option value="">Tutte tipologie</option>
        <option value="PF">PF – Persona Fisica</option>
        <option value="SP">SP – Soc. Persone</option>
        <option value="SC">SC – Soc. Capitali</option>
        <option value="ASS">ASS – Associazione</option>
      </select>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
      <button class="btn btn-primary no-print" onclick="openNuovoCliente()">+ Nuovo Cliente</button>
    `;
    socket.emit('get:clienti');

  } else if (page === 'scadenzario') {
    state._pending = 'scadenzario';
    document.getElementById('topbar-actions').innerHTML = '';
    socket.emit('get:clienti');

  } else if (page === 'scadenzario_globale') {
    renderGlobalePage();

  } else if (page === 'adempimenti') {
    state._pending = 'adempimenti';
    document.getElementById('topbar-actions').innerHTML = `
      <div class="search-wrap" style="width:300px">
        <span class="search-icon">🔍</span>
        <input class="input" id="global-search-adempimenti" placeholder="Cerca codice, nome, categoria..." oninput="applyAdempimentiFiltri()">
      </div>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
      <button class="btn btn-primary no-print" onclick="openNuovoAdpDef()">+ Nuovo</button>
    `;
    socket.emit('get:adempimenti');

  } else if (page === 'tipologie') {
    document.getElementById('topbar-actions').innerHTML = '';
    renderTipologiePage();
  }
}

function refreshPage() {
  renderPage(state.page);
}

function changeAnno(d) {
  state.anno += d;
  document.querySelectorAll('.year-num').forEach(el => el.textContent = state.anno);
  socket.emit('get:stats', { anno: state.anno, search: document.getElementById('dash-search')?.value || '' });
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────
function applyDashSearch() {
  const search = document.getElementById('dash-search')?.value || '';
  socket.emit('get:stats', { anno: state.anno, search });
}

function renderDashboard(stats) {
  const perc = stats.totAdempimenti > 0 ? Math.round((stats.completati / stats.totAdempimenti) * 100) : 0;
  const percNA = stats.totAdempimenti > 0 ? Math.round((stats.na / stats.totAdempimenti) * 100) : 0;

  const scadenzeHtml = stats.scadenzeAperte && stats.scadenzeAperte.length
    ? stats.scadenzeAperte.map(s => `
        <tr>
          <td><strong>${s.nome}</strong></td>
          <td style="text-align:right"><span class="badge b-da_fare">${s.n} aperti</span></td>
        </tr>`).join('')
    : `<tr><td colspan="2"><div class="empty" style="padding:20px">✅ Nessuna scadenza aperta</div></td></tr>`;

  document.getElementById('content').innerHTML = `
    <div class="print-header" style="display:none"></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Clienti Attivi</div><div class="stat-value v-blue">${stats.totClienti}</div></div>
      <div class="stat-card"><div class="stat-label">Adempimenti ${stats.anno}</div><div class="stat-value">${stats.totAdempimenti}</div></div>
      <div class="stat-card">
        <div class="stat-label">Completati</div>
        <div class="stat-value v-green">${stats.completati}</div>
        <div class="prog-bar"><div class="prog-fill green" style="width:${perc}%"></div></div>
        <div class="stat-sub">${perc}% del totale</div>
      </div>
      <div class="stat-card"><div class="stat-label">Da Fare</div><div class="stat-value v-yellow">${stats.daFare}</div></div>
      <div class="stat-card"><div class="stat-label">In Corso</div><div class="stat-value v-purple">${stats.inCorso || 0}</div></div>
      <div class="stat-card"><div class="stat-label">N/A</div><div class="stat-value" style="color:var(--text3)">${stats.na || 0}</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:8px">
      <div class="table-wrap">
        <div class="table-header"><h3>📊 Clienti per Tipologia — ${stats.anno}</h3></div>
        <table><thead><tr><th>Tipologia</th><th>Codice</th><th>N° Clienti</th></tr></thead>
        <tbody>${stats.perTipologia.map(t => `
          <tr>
            <td><strong>${t.nome}</strong></td>
            <td><span class="badge b-${t.codice.toLowerCase()}">${t.codice}</span></td>
            <td><strong>${t.n}</strong></td>
          </tr>`).join('')}
        </tbody></table>
      </div>
      <div class="table-wrap">
        <div class="table-header"><h3>⚠️ Clienti con più scadenze aperte</h3></div>
        <table><thead><tr><th>Cliente</th><th>Scadenze</th></tr></thead>
        <tbody>${scadenzeHtml}</tbody></table>
      </div>
    </div>
  `;
}

// ─── CLIENTI ──────────────────────────────────────────────────────────────
const applyClientiFiltriDebounced = debounce(function() {
  const q = document.getElementById('global-search-clienti')?.value || '';
  const tipo = document.getElementById('filter-tipo')?.value || '';
  socket.emit('get:clienti', { search: q, tipologia: tipo });
}, 300);

function applyClientiFiltri() {
  applyClientiFiltriDebounced();
}

function renderClientiPage() {
  renderClientiTabella(state.clienti);
}

function renderClientiTabella(clienti) {
  const tbody = clienti.length
    ? clienti.map(c => `
    <tr>
      <td><strong>${c.nome}</strong></td>
      <td><span class="badge b-${(c.tipologia_codice || '').toLowerCase()}">${c.tipologia_codice || '-'}</span></td>
      <td class="td-dim">${c.sottotipologia_nome || '-'}</td>
      <td class="td-mono td-dim">${c.codice_fiscale || c.partita_iva || '-'}</td>
      <td class="td-dim">${c.email || '-'}</td>
      <td class="td-dim">${c.telefono || '-'}</td>
      <td class="col-actions no-print">
        <div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-secondary" onclick="editCliente(${c.id})">✏️</button>
          <button class="btn btn-sm btn-success" onclick="goScadenzario(${c.id})">📅</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCliente(${c.id},'${esc(c.nome)}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('')
    : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato</p></div></td></tr>`;

  document.getElementById('content').innerHTML = `
    <div class="print-header"><strong>Studio Commerciale — Elenco Clienti</strong><br>Data stampa: ${new Date().toLocaleDateString('it-IT')} — Totale: ${clienti.length} clienti</div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Clienti (${clienti.length})</h3></div>
      <table><thead><tr><th>Nome</th><th>Tipo</th><th>Sottotipo</th><th>CF / P.IVA</th><th>Email</th><th>Telefono</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>`;
}

// ─── SCADENZARIO CLIENTE ──────────────────────────────────────────────────
function renderScadenzarioPage() {
  const opts = state.clienti.map(c =>
    `<option value="${c.id}" ${state.selectedCliente?.id === c.id ? 'selected' : ''}>[${c.tipologia_codice}] ${c.nome}</option>`
  ).join('');

  document.getElementById('topbar-actions').innerHTML = `
    <select class="select" id="sel-cliente" style="width:260px" onchange="onClienteChange()">
      <option value="">-- Seleziona Cliente --</option>${opts}
    </select>
    <div class="year-sel">
      <button onclick="changeAnnoScad(-1)">◀</button>
      <span class="year-num">${state.anno}</span>
      <button onclick="changeAnnoScad(1)">▶</button>
    </div>
    <div class="search-wrap" style="width:220px">
      <span class="search-icon">🔍</span>
      <input class="input" id="scad-search" placeholder="Cerca adempimento..." oninput="applyScadSearch()">
    </div>
  `;

  if (state.selectedCliente) loadScadenzario();
  else document.getElementById('content').innerHTML = `<div class="empty"><div class="empty-icon">📅</div><p>Seleziona un cliente per visualizzare il suo scadenzario</p></div>`;
}

function onClienteChange() {
  const id = parseInt(document.getElementById('sel-cliente').value);
  state.selectedCliente = state.clienti.find(c => c.id === id) || null;
  if (state.selectedCliente) loadScadenzario();
}

function changeAnnoScad(d) {
  state.anno += d;
  document.querySelectorAll('.year-num').forEach(el => el.textContent = state.anno);
  if (state.selectedCliente) loadScadenzario();
}

function loadScadenzario() {
  const searchVal = document.getElementById('scad-search')?.value || '';
  const statoVal = document.getElementById('f-stato')?.value || 'tutti';
  state.filtri.adempimento = searchVal;
  state.filtri.stato = statoVal;
  socket.emit('get:scadenzario', {
    id_cliente: state.selectedCliente.id,
    anno: state.anno,
    filtro_stato: statoVal,
    filtro_adempimento: searchVal,
  });
}

const applyScadSearchDebounced = debounce(loadScadenzario, 300);

function applyScadSearch() {
  applyScadSearchDebounced();
}

function applyScadFiltri() {
  loadScadenzario();
}

function resetScadFiltri() {
  state.filtri.stato = 'tutti';
  if (document.getElementById('f-stato')) document.getElementById('f-stato').value = 'tutti';
  if (document.getElementById('scad-search')) document.getElementById('scad-search').value = '';
  loadScadenzario();
}

// ─── LABEL PERIODO con nomi mesi reali ───────────────────────────────────
function getPeriodoLabel(r) {
  if (r.scadenza_tipo === 'trimestrale') {
    const mesiTrim = { 1: 'Gen–Mar', 2: 'Apr–Giu', 3: 'Lug–Set', 4: 'Ott–Dic' };
    return `${r.trimestre}° Trim. (${mesiTrim[r.trimestre] || ''})`;
  }
  if (r.scadenza_tipo === 'semestrale') {
    return r.semestre === 1 ? '1° Sem. (Gen–Giu)' : '2° Sem. (Lug–Dic)';
  }
  if (r.scadenza_tipo === 'mensile') return MESI[r.mese - 1];
  return 'Annuale';
}

function getPeriodoLabelShort(r) {
  if (r.scadenza_tipo === 'trimestrale') return `${r.trimestre}° Trim.`;
  if (r.scadenza_tipo === 'semestrale') return r.semestre === 1 ? '1° Sem.' : '2° Sem.';
  if (r.scadenza_tipo === 'mensile') return MESI[r.mese - 1];
  return 'Annuale';
}

function renderScadenzarioTabella(righe) {
  const c = state.selectedCliente;
  const tot = righe.length;
  const comp = righe.filter(r => r.stato === 'completato').length;
  const daF = righe.filter(r => r.stato === 'da_fare').length;
  const inC = righe.filter(r => r.stato === 'in_corso').length;
  const na = righe.filter(r => r.stato === 'n_a').length;
  const perc = tot > 0 ? Math.round((comp / tot) * 100) : 0;

  // Raggruppa per adempimento (codice)
  const grouped = {};
  righe.forEach(r => {
    const key = r.id_adempimento;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(r);
  });

  // Ordina ogni gruppo per periodo
  Object.values(grouped).forEach(rows => {
    rows.sort((a, b) => {
      if (a.trimestre && b.trimestre) return a.trimestre - b.trimestre;
      if (a.semestre && b.semestre) return a.semestre - b.semestre;
      if (a.mese && b.mese) return a.mese - b.mese;
      return 0;
    });
  });

  const tbody = Object.entries(grouped).map(([adpId, rows]) => {
    return rows.map((r, idx) => {
      const periodo = getPeriodoLabel(r);
      const statoClass = `s-${r.stato}`;
      return `<tr class="clickable ${statoClass}" onclick="openAdpModal(${r.id},'${r.stato}','${r.data_scadenza || ''}','${r.data_completamento || ''}','${r.importo || ''}','${esc(r.note || '')}','${esc(r.adempimento_nome)}')">
        ${idx === 0 ? `<td rowspan="${rows.length}" style="border-right:1px solid var(--border);font-weight:700;vertical-align:top;padding-top:14px">
          <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r.codice}</span><br>
          <span style="font-size:12px">${r.adempimento_nome}</span><br>
          <span class="badge b-categoria" style="font-size:9px;margin-top:4px">${r.categoria || '-'}</span>
        </td>` : ''}
        <td>${periodo}</td>
        <td><span class="badge b-${r.stato}">${STATI[r.stato] || r.stato}</span></td>
        <td class="td-mono td-dim">${r.importo ? '€ ' + parseFloat(r.importo).toFixed(2) : '-'}</td>
        <td class="td-mono td-dim" style="font-size:11px">${r.data_scadenza || '-'}</td>
        <td class="td-mono td-dim" style="font-size:11px">${r.data_completamento || '-'}</td>
        <td class="td-dim" style="font-size:11px;max-width:120px;overflow:hidden;text-overflow:ellipsis">${r.note || ''}</td>
      </tr>`;
    }).join('');
  }).join('') || `<tr><td colspan="7"><div class="empty"><div class="empty-icon">📋</div><p>Nessun adempimento trovato.<br>Clicca <strong>⚡ Genera</strong> per creare lo scadenzario.</p></div></td></tr>`;

  document.getElementById('content').innerHTML = `
    <div class="print-header"><strong>Studio Commerciale — Scadenzario Fiscale</strong><br>Cliente: <strong>${c.nome}</strong> | Anno: <strong>${state.anno}</strong> | Data stampa: ${new Date().toLocaleDateString('it-IT')}</div>
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;flex-wrap:wrap">
      <div>
        <div style="font-size:18px;font-weight:800">${c.nome}</div>
        <div style="font-size:12px;color:var(--text2)">${c.tipologia_nome}${c.sottotipologia_nome ? ' · ' + c.sottotipologia_nome : ''}</div>
      </div>
      <div style="flex:1"></div>
      <div class="no-print" style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-purple" onclick="openAddAdp(${c.id})">➕ Adempimento</button>
        <button class="btn btn-sm btn-secondary" onclick="openCopia(${c.id})">📋 Copia anno</button>
        <button class="btn btn-sm btn-primary" onclick="generaScad(${c.id})">⚡ Genera ${state.anno}</button>
        <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>
      </div>
    </div>
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Totale</div><div class="stat-value v-blue">${tot}</div></div>
      <div class="stat-card"><div class="stat-label">Completati</div><div class="stat-value v-green">${comp}</div><div class="prog-bar"><div class="prog-fill green" style="width:${perc}%"></div></div></div>
      <div class="stat-card"><div class="stat-label">Da Fare</div><div class="stat-value v-yellow">${daF}</div></div>
      <div class="stat-card"><div class="stat-label">In Corso</div><div class="stat-value v-purple">${inC}</div></div>
      <div class="stat-card"><div class="stat-label">N/A</div><div class="stat-value" style="color:var(--text3)">${na}</div></div>
    </div>
    <div class="filtri-bar no-print">
      <label>Filtra stato:</label>
      <select class="select" style="width:160px" id="f-stato" onchange="applyScadFiltri()">
        <option value="tutti">Tutti</option>
        <option value="da_fare">⭕ Da fare</option>
        <option value="in_corso">🔄 In corso</option>
        <option value="completato">✅ Completato</option>
        <option value="n_a">➖ N/A</option>
      </select>
      <button class="btn btn-sm btn-secondary" onclick="resetScadFiltri()">✕ Reset</button>
    </div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Scadenzario ${state.anno}</h3></div>
      <table><thead><tr><th>Adempimento</th><th>Periodo</th><th>Stato</th><th>Importo</th><th>Scadenza</th><th>Completato</th><th>Note</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>
  `;
  if (document.getElementById('f-stato')) document.getElementById('f-stato').value = state.filtri.stato;
}

function generaScad(id) {
  if (confirm(`Generare/rigenera lo scadenzario ${state.anno} per questo cliente?\nGli adempimenti già presenti (completati/in corso) verranno conservati.`))
    socket.emit('genera:scadenzario', { id_cliente: id, anno: state.anno });
}

// ─── VISTA GLOBALE ────────────────────────────────────────────────────────
function renderGlobalePage() {
  document.getElementById('topbar-actions').innerHTML = `
    <div class="search-wrap" style="width:250px">
      <span class="search-icon">🔍</span>
      <input class="input" id="global-search-globale" placeholder="Cerca cliente, adempimento..." oninput="applyGlobaleSearch()">
    </div>
    <div class="year-sel">
      <button onclick="changeAnnoGlobale(-1)">◀</button>
      <span class="year-num">${state.anno}</span>
      <button onclick="changeAnnoGlobale(1)">▶</button>
    </div>
    <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
  `;
  renderGlobaleFiltri();
  loadGlobale();
}

function loadGlobale() {
  socket.emit('get:scadenzario_globale', {
    anno: state.anno,
    filtro_stato: state.filtri.stato,
    filtro_categoria: state.filtri.categoria,
    search: document.getElementById('global-search-globale')?.value || '',
  });
}

function changeAnnoGlobale(d) {
  state.anno += d;
  document.querySelectorAll('.year-num').forEach(el => el.textContent = state.anno);
  loadGlobale();
}

function renderGlobaleFiltri() {
  document.getElementById('content').innerHTML = `
    <div class="print-header"><strong>Studio Commerciale — Vista Globale Adempimenti ${state.anno}</strong><br>Data stampa: ${new Date().toLocaleDateString('it-IT')}</div>
    <div class="filtri-bar no-print">
      <label>Stato:</label>
      <select class="select" style="width:160px" id="fg-stato" onchange="applyGlobaleFiltri()">
        <option value="tutti">Tutti</option><option value="da_fare">⭕ Da fare</option>
        <option value="in_corso">🔄 In corso</option><option value="completato">✅ Completato</option>
        <option value="n_a">➖ N/A</option>
      </select>
      <label>Categoria:</label>
      <select class="select" style="width:160px" id="fg-categoria" onchange="applyGlobaleFiltri()">
        <option value="tutti">Tutte</option>
        ${CATEGORIE_DISPONIBILI.map(c => `<option value="${c.codice}">${c.icona} ${c.nome}</option>`).join('')}
        <option value="TUTTI">📌 TUTTI</option>
      </select>
    </div>
    <div id="globale-content"><div class="empty">⏳ Caricamento...</div></div>
  `;
  if (document.getElementById('fg-stato')) document.getElementById('fg-stato').value = state.filtri.stato;
  if (document.getElementById('fg-categoria')) document.getElementById('fg-categoria').value = state.filtri.categoria;
}

function applyGlobaleFiltri() {
  state.filtri.stato = document.getElementById('fg-stato')?.value || 'tutti';
  state.filtri.categoria = document.getElementById('fg-categoria')?.value || 'tutti';
  loadGlobale();
}

const applyGlobaleSearchDebounced = debounce(loadGlobale, 300);

function applyGlobaleSearch() {
  applyGlobaleSearchDebounced();
}

function renderGlobaleTabella(righe) {
  const container = document.getElementById('globale-content');
  if (!container) return;

  const perCliente = {};
  righe.forEach(r => {
    if (!perCliente[r.id_cliente]) perCliente[r.id_cliente] = { nome: r.cliente_nome, tipo: r.tipologia_codice, righe: [] };
    perCliente[r.id_cliente].righe.push(r);
  });

  if (!Object.keys(perCliente).length) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📋</div><p>Nessun risultato trovato</p></div>`;
    return;
  }

  const html = Object.entries(perCliente).map(([id, cl]) => {
    const comp = cl.righe.filter(r => r.stato === 'completato').length;
    const perc = cl.righe.length > 0 ? Math.round((comp / cl.righe.length) * 100) : 0;
    const tbody = cl.righe.map(r => {
      const periodo = getPeriodoLabel(r);
      return `<tr class="clickable" onclick="openAdpModal(${r.id},'${r.stato}','${r.data_scadenza || ''}','${r.data_completamento || ''}','${r.importo || ''}','${esc(r.note || '')}','${esc(r.adempimento_nome)}')">
        <td class="td-mono" style="font-size:10px;color:var(--accent)">${r.codice}</td>
        <td>${r.adempimento_nome}</td>
        <td><span class="badge b-categoria">${r.categoria || '-'}</span></td>
        <td style="font-size:12px">${periodo}</td>
        <td><span class="badge b-${r.stato}">${STATI[r.stato] || r.stato}</span></td>
        <td class="td-mono td-dim">${r.importo ? '€ ' + parseFloat(r.importo).toFixed(2) : '-'}</td>
        <td class="td-mono td-dim">${r.data_completamento || '-'}</td>
      </tr>`;
    }).join('');

    return `<div class="table-wrap" style="margin-bottom:16px">
      <div class="table-header" style="cursor:pointer" onclick="toggleSection(this)">
        <span class="badge b-${(cl.tipo || '').toLowerCase()}" style="margin-right:6px">${cl.tipo}</span>
        <h3>${cl.nome}</h3>
        <span style="font-size:11px;color:var(--text3);margin-right:8px">${cl.righe.length} adempimenti · ${comp} completati (${perc}%)</span>
        <div class="prog-bar" style="width:100px;display:inline-block"><div class="prog-fill green" style="width:${perc}%"></div></div>
        <span class="toggle-arrow" style="margin-left:8px">▾</span>
      </div>
      <div class="section-body">
        <table><thead><tr><th>Codice</th><th>Adempimento</th><th>Categoria</th><th>Periodo</th><th>Stato</th><th>Importo</th><th>Completato</th></tr></thead>
        <tbody>${tbody}</tbody></table>
      </div>
    </div>`;
  }).join('');

  container.innerHTML = html;
}

function toggleSection(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('.toggle-arrow');
  if (body.style.display === 'none') {
    body.style.display = '';
    if (arrow) arrow.textContent = '▾';
  } else {
    body.style.display = 'none';
    if (arrow) arrow.textContent = '▸';
  }
}

// ─── ADEMPIMENTI ──────────────────────────────────────────────────────────
const applyAdempimentiFiltriDebounced = debounce(function() {
  const q = document.getElementById('global-search-adempimenti')?.value || '';
  socket.emit('get:adempimenti', { search: q });
}, 300);

function applyAdempimentiFiltri() {
  applyAdempimentiFiltriDebounced();
}

function renderAdempimentiPage() {
  renderAdempimentiTabella(state.adempimenti);
}

function renderAdempimentiTabella(adempimenti) {
  const rows = adempimenti.map(a => `
    <tr>
      <td><span style="font-family:var(--mono);font-weight:700;color:var(--accent)">${a.codice}</span></td>
      <td><strong>${a.nome}</strong></td>
      <td class="td-dim">${a.descrizione || '-'}</td>
      <td><span class="badge b-categoria">${a.categoria || '-'}</span></td>
      <td><span style="font-family:var(--mono);font-size:11px">${a.scadenza_tipo || '-'}</span></td>
      <td><span class="badge" style="background:rgba(91,141,246,0.1);color:var(--accent);font-size:10px">${getScadenzaLabel(a.scadenza_tipo)}</span></td>
      <td class="col-actions no-print">
        <div style="display:flex;gap:5px">
          <button class="btn btn-xs btn-secondary" onclick="editAdpDef(${a.id})">✏️</button>
          <button class="btn btn-xs btn-danger" onclick="deleteAdpDef(${a.id},'${esc(a.nome)}')">🗑️</button>
        </div>
      </td>
    </tr>`).join('') || `<tr><td colspan="7"><div class="empty">📋 Nessun adempimento trovato</div></td></tr>`;

  document.getElementById('content').innerHTML = `
    <div class="print-header"><strong>Studio Commerciale — Adempimenti Fiscali</strong><br>Data stampa: ${new Date().toLocaleDateString('it-IT')} — Totale: ${adempimenti.length}</div>
    <div class="infobox" style="margin-bottom:16px">
      💡 <strong>Nota:</strong> Quando crei un nuovo adempimento, viene automaticamente assegnato a tutti i clienti con la categoria corrispondente per l'anno corrente e il prossimo.
    </div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Adempimenti (${adempimenti.length})</h3></div>
      <table><thead><tr><th>Codice</th><th>Nome</th><th>Descrizione</th><th>Categoria</th><th>Cadenza</th><th>Periodi/anno</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

function getScadenzaLabel(tipo) {
  const labels = { annuale: '1×/anno', semestrale: '2×/anno', trimestrale: '4×/anno', mensile: '12×/anno' };
  return labels[tipo] || tipo;
}

// ─── TIPOLOGIE CLIENTI ────────────────────────────────────────────────────
function renderTipologiePage() {
  const cards = state.tipologie.map(t => {
    const subs = t.sottotipologie || [];
    const color = { PF: 'var(--accent)', SP: 'var(--purple)', SC: 'var(--green)', ASS: 'var(--yellow)' }[t.codice] || 'var(--accent)';
    return `<div class="tipo-card">
      <div class="tipo-codice" style="color:${color}">${t.codice}</div>
      <div class="tipo-nome">${t.nome}</div>
      <div class="tipo-desc">${t.descrizione || ''}</div>
      <div class="divider"></div>
      <div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:700">Sottotipologie</div>
      <div>${subs.map(s => `<div style="font-size:12px;padding:4px 8px;background:var(--surface2);border-radius:5px;border-left:2px solid ${color};margin-bottom:4px">${s.nome}</div>`).join('')}</div>
    </div>`;
  }).join('');
  document.getElementById('content').innerHTML = `<div class="tipo-cards">${cards}</div>`;
}

// ─── MODAL CLIENTE ────────────────────────────────────────────────────────
function populateTipologiaSelect() {
  const sel = document.getElementById('c-tipologia');
  if (!sel) return;
  sel.innerHTML = state.tipologie.map(t => `<option value="${t.id}">${t.codice} – ${t.nome}</option>`).join('');
  onTipologiaChange();
}

function onTipologiaChange() {
  const tipId = parseInt(document.getElementById('c-tipologia')?.value);
  const tip = state.tipologie.find(t => t.id === tipId);
  const sel = document.getElementById('c-sottotipologia');
  if (!sel || !tip) return;
  sel.innerHTML = '<option value="">-- Nessuna --</option>' +
    (tip.sottotipologie || []).map(s => `<option value="${s.id}">${s.nome}</option>`).join('');
}

function renderCategorieSelect(categorieAttuali = []) {
  const container = document.getElementById('categorie-attive');
  if (!container) return;
  container.innerHTML = CATEGORIE_DISPONIBILI.map(cat => `
    <label class="categoria-chip" style="display:inline-flex;align-items:center;gap:8px;margin:4px 8px 4px 0;padding:8px 12px;background:var(--surface2);border-radius:var(--r-sm);cursor:pointer;border:1px solid ${categorieAttuali.includes(cat.codice) ? 'var(--accent)' : 'var(--border)'}">
      <input type="checkbox" value="${cat.codice}" ${categorieAttuali.includes(cat.codice) ? 'checked' : ''} style="accent-color:var(--accent)" onchange="this.parentElement.style.borderColor=this.checked?'var(--accent)':'var(--border)'">
      <span>${cat.icona} ${cat.nome}</span>
    </label>`).join('');
}

function getSelectedCategorie() {
  const checkboxes = document.querySelectorAll('#categorie-attive input');
  return Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
}

function openNuovoCliente() {
  document.getElementById('modal-cliente-title').textContent = 'Nuovo Cliente';
  document.getElementById('cliente-id').value = '';
  ['c-nome','c-cf','c-piva','c-email','c-tel','c-indirizzo','c-note'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderCategorieSelect(['IVA','DICHIARAZIONI','PREVIDENZA','LAVORO','TRIBUTI','BILANCIO']);
  populateTipologiaSelect();
  openModal('modal-cliente');
}

function editCliente(id) {
  socket.once('res:cliente', ({ success, data }) => {
    if (!success || !data) return;
    document.getElementById('modal-cliente-title').textContent = 'Modifica Cliente';
    document.getElementById('cliente-id').value = data.id;
    document.getElementById('c-nome').value = data.nome || '';
    document.getElementById('c-cf').value = data.codice_fiscale || '';
    document.getElementById('c-piva').value = data.partita_iva || '';
    document.getElementById('c-email').value = data.email || '';
    document.getElementById('c-tel').value = data.telefono || '';
    document.getElementById('c-indirizzo').value = data.indirizzo || '';
    document.getElementById('c-note').value = data.note || '';
    const categorieAttuali = JSON.parse(data.categorie_attive || '["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]');
    renderCategorieSelect(categorieAttuali);
    populateTipologiaSelect();
    document.getElementById('c-tipologia').value = data.id_tipologia;
    onTipologiaChange();
    setTimeout(() => {
      document.getElementById('c-sottotipologia').value = data.id_sottotipologia || '';
    }, 60);
    openModal('modal-cliente');
  });
  socket.emit('get:cliente', { id });
}

function saveCliente() {
  const id = document.getElementById('cliente-id').value;
  const data = {
    nome: document.getElementById('c-nome').value.trim(),
    id_tipologia: parseInt(document.getElementById('c-tipologia').value),
    id_sottotipologia: document.getElementById('c-sottotipologia').value || null,
    codice_fiscale: document.getElementById('c-cf').value.trim().toUpperCase() || null,
    partita_iva: document.getElementById('c-piva').value.trim() || null,
    email: document.getElementById('c-email').value.trim() || null,
    telefono: document.getElementById('c-tel').value.trim() || null,
    indirizzo: document.getElementById('c-indirizzo').value.trim() || null,
    note: document.getElementById('c-note').value.trim() || null,
    categorie_attive: getSelectedCategorie(),
  };
  if (!data.nome) { showNotif('Il nome è obbligatorio', 'error'); return; }
  if (data.categorie_attive.length === 0) { showNotif('Seleziona almeno una categoria', 'error'); return; }
  if (id) { data.id = parseInt(id); socket.emit('update:cliente', data); }
  else socket.emit('create:cliente', data);
}

function deleteCliente(id, nome) {
  if (confirm(`Eliminare "${nome}"?`)) socket.emit('delete:cliente', { id });
}

function goScadenzario(id) {
  state.selectedCliente = state.clienti.find(c => c.id === id) || null;
  document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
  document.querySelector('[data-page="scadenzario"]').classList.add('active');
  state._pending = 'scadenzario';
  socket.emit('get:clienti');
}

// ─── MODAL ADEMPIMENTO STATO ──────────────────────────────────────────────
function openAdpModal(id, stato, scadenza, data, importo, note, nome) {
  document.getElementById('adp-id').value = id;
  document.getElementById('adp-stato').value = stato;
  document.getElementById('adp-scadenza').value = scadenza || '';
  document.getElementById('adp-data').value = data || '';
  document.getElementById('adp-importo').value = importo || '';
  document.getElementById('adp-note').value = note || '';
  document.getElementById('adp-nome-label').textContent = nome || '';
  openModal('modal-adempimento');
}

function saveAdpStato() {
  socket.emit('update:adempimento_stato', {
    id: parseInt(document.getElementById('adp-id').value),
    stato: document.getElementById('adp-stato').value,
    data_scadenza: document.getElementById('adp-scadenza').value || null,
    data_completamento: document.getElementById('adp-data').value || null,
    importo: document.getElementById('adp-importo').value || null,
    note: document.getElementById('adp-note').value || null,
  });
}

function deleteAdpCliente() {
  const id = parseInt(document.getElementById('adp-id').value);
  if (confirm('Rimuovere questo adempimento dallo scadenzario?'))
    socket.emit('delete:adempimento_cliente', { id });
}

// ─── MODAL ADEMPIMENTO DEF ────────────────────────────────────────────────
function openNuovoAdpDef() {
  document.getElementById('modal-adp-def-title').textContent = 'Nuovo Adempimento';
  document.getElementById('adp-def-id').value = '';
  document.getElementById('adp-def-codice').value = '';
  document.getElementById('adp-def-nome').value = '';
  document.getElementById('adp-def-desc').value = '';
  document.getElementById('adp-def-scadenza').value = 'annuale';
  document.getElementById('adp-def-categoria').value = 'TUTTI';
  openModal('modal-adp-def');
}

function editAdpDef(id) {
  const a = state.adempimenti.find(x => x.id === id);
  if (!a) return;
  document.getElementById('modal-adp-def-title').textContent = 'Modifica Adempimento';
  document.getElementById('adp-def-id').value = a.id;
  document.getElementById('adp-def-codice').value = a.codice;
  document.getElementById('adp-def-nome').value = a.nome;
  document.getElementById('adp-def-desc').value = a.descrizione || '';
  document.getElementById('adp-def-scadenza').value = a.scadenza_tipo || 'annuale';
  document.getElementById('adp-def-categoria').value = a.categoria || 'TUTTI';
  openModal('modal-adp-def');
}

function saveAdpDef() {
  const id = document.getElementById('adp-def-id').value;
  const data = {
    codice: document.getElementById('adp-def-codice').value.trim().toUpperCase(),
    nome: document.getElementById('adp-def-nome').value.trim(),
    descrizione: document.getElementById('adp-def-desc').value.trim() || null,
    scadenza_tipo: document.getElementById('adp-def-scadenza').value,
    categoria: document.getElementById('adp-def-categoria').value,
  };
  if (!data.codice || !data.nome) { showNotif('Codice e Nome obbligatori', 'error'); return; }
  if (id) { data.id = parseInt(id); socket.emit('update:adempimento', data); }
  else socket.emit('create:adempimento', data);
}

function deleteAdpDef(id, nome) {
  if (confirm(`Eliminare "${nome}"?\nL'adempimento non comparirà più nei nuovi scadenzari, ma le voci già create restano.`))
    socket.emit('delete:adempimento', { id });
}

// ─── COPIA SCADENZARIO ────────────────────────────────────────────────────
function openCopia(id) {
  document.getElementById('copia-cliente-id').value = id;
  document.getElementById('copia-da').value = state.anno - 1;
  document.getElementById('copia-a').value = state.anno;
  openModal('modal-copia');
}

function eseguiCopia() {
  socket.emit('copia:scadenzario', {
    id_cliente: parseInt(document.getElementById('copia-cliente-id').value),
    anno_da: parseInt(document.getElementById('copia-da').value),
    anno_a: parseInt(document.getElementById('copia-a').value),
  });
}

// ─── AGGIUNGI ADEMPIMENTO ─────────────────────────────────────────────────
function openAddAdp(id) {
  document.getElementById('add-adp-cliente-id').value = id;
  const sel = document.getElementById('add-adp-select');
  sel.innerHTML = state.adempimenti.map(a =>
    `<option value="${a.id}">[${a.categoria}] ${a.codice} - ${a.nome}</option>`
  ).join('');
  document.getElementById('add-adp-periodo').value = '';
  // Aggiorna le opzioni periodo in base al tipo di scadenza selezionato
  updatePeriodoOptions();
  openModal('modal-add-adp');
}

function updatePeriodoOptions() {
  const selAdp = document.getElementById('add-adp-select');
  const selPeriodo = document.getElementById('add-adp-periodo');
  if (!selAdp || !selPeriodo) return;

  const adpId = parseInt(selAdp.value);
  const adp = state.adempimenti.find(a => a.id === adpId);
  if (!adp) return;

  let options = '<option value="">— Seleziona periodo —</option>';

  if (adp.scadenza_tipo === 'trimestrale') {
    options += `
      <option value="trimestre_1">1° Trimestre (Gen–Mar)</option>
      <option value="trimestre_2">2° Trimestre (Apr–Giu)</option>
      <option value="trimestre_3">3° Trimestre (Lug–Set)</option>
      <option value="trimestre_4">4° Trimestre (Ott–Dic)</option>`;
  } else if (adp.scadenza_tipo === 'semestrale') {
    options += `
      <option value="semestre_1">1° Semestre (Gen–Giu)</option>
      <option value="semestre_2">2° Semestre (Lug–Dic)</option>`;
  } else if (adp.scadenza_tipo === 'mensile') {
    MESI.forEach((m, i) => {
      options += `<option value="mese_${i + 1}">${m}</option>`;
    });
  } else {
    options += `<option value="annuale">Annuale</option>`;
  }

  selPeriodo.innerHTML = options;
}

function eseguiAddAdp() {
  const periodoVal = document.getElementById('add-adp-periodo').value;
  let trimestre = null, semestre = null, mese = null;

  if (periodoVal.startsWith('trimestre_')) trimestre = parseInt(periodoVal.split('_')[1]);
  else if (periodoVal.startsWith('semestre_')) semestre = parseInt(periodoVal.split('_')[1]);
  else if (periodoVal.startsWith('mese_')) mese = parseInt(periodoVal.split('_')[1]);

  socket.emit('add:adempimento_cliente', {
    id_cliente: parseInt(document.getElementById('add-adp-cliente-id').value),
    id_adempimento: parseInt(document.getElementById('add-adp-select').value),
    anno: state.anno,
    trimestre,
    semestre,
    mese,
  });
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => {
    if (e.target === el) el.classList.remove('open');
  });
});

function esc(s) {
  return (s || '').replace(/'/g, "\\'").replace(/\n/g, ' ');
}

function showNotif(msg, type = 'info') {
  const icons = { success: '✅', info: 'ℹ️', error: '❌' };
  const el = document.createElement('div');
  el.className = `notif ${type}`;
  el.innerHTML = `<span>${icons[type] || '•'}</span><span>${msg}</span>`;
  document.getElementById('notif-container').appendChild(el);
  setTimeout(() => el.remove(), 3800);
}