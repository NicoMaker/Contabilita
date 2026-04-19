const socket = io();

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MESI_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
const STATI = { da_fare:'⭕ Da fare', in_corso:'🔄 In corso', completato:'✅ Completato', n_a:'➖ N/A' };

const CATEGORIE = [
  { codice:'IVA',          nome:'💰 IVA',          icona:'💰', color:'#fbbf24' },
  { codice:'DICHIARAZIONI',nome:'📄 Dichiarazioni', icona:'📄', color:'#5b8df6' },
  { codice:'PREVIDENZA',   nome:'🏦 Previdenza',    icona:'🏦', color:'#34d399' },
  { codice:'LAVORO',       nome:'👔 Lavoro',         icona:'👔', color:'#a78bfa' },
  { codice:'TRIBUTI',      nome:'🏛️ Tributi',       icona:'🏛️', color:'#f87171' },
  { codice:'BILANCIO',     nome:'📊 Bilancio',       icona:'📊', color:'#22d3ee' },
];
const CAT_TUTTI = { codice:'TUTTI', nome:'📌 Tutti', icona:'📌', color:'#fb923c' };

// ─── STORE GLOBALE RIGHE per evitare problemi escape in onclick ───────────
let _rowStore = {}; // id → oggetto riga completo

function storeRow(r) {
  _rowStore[r.id] = r;
  return r.id;
}

function openAdpById(id) {
  const r = _rowStore[id];
  if (!r) return;
  openAdpModal(
    r.id, r.stato,
    r.data_scadenza||'', r.data_completamento||'',
    r.importo||'', r.note||'',
    r.adempimento_nome + ' – ' + getPeriodoLabel(r),
    r.is_contabilita||0, r.has_rate||0,
    r.importo_saldo||'', r.importo_acconto1||'', r.importo_acconto2||'',
    r.importo_iva||'', r.importo_contabilita||'',
    r.rate_labels||''
  );
}

let state = {
  page:'dashboard', tipologie:[], clienti:[], adempimenti:[],
  selectedCliente:null, anno:new Date().getFullYear(),
  filtri:{ stato:'tutti', categoria:'tutti', search:'', adempimento:'' },
  scadenzario:[], scadGlobale:[],
  dashStats:null, dashCatAttiva:null, dashSearch:'',
  dashAdpAttivo:null,      // adempimento selezionato nel pannello laterale
  dashAdpSearch:'',        // ricerca nel pannello laterale adempimento
  dashAdpFiltroStato:'tutti',
};

function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }

// ─── CONNESSIONE ──────────────────────────────────────────────────────────
socket.on('connect', () => {
  document.getElementById('conn-status').textContent='● Online';
  document.getElementById('conn-status').style.color='var(--green)';
  socket.emit('get:tipologie');
  renderPage('dashboard');
});
socket.on('disconnect', () => {
  document.getElementById('conn-status').textContent='● Offline';
  document.getElementById('conn-status').style.color='var(--red)';
});
socket.on('notify', ({type,msg}) => showNotif(msg, type));

// ─── RISPOSTE ─────────────────────────────────────────────────────────────
socket.on('res:tipologie', ({success,data}) => {
  if (success) { state.tipologie=data; populateTipologiaSelect(); }
});

socket.on('res:clienti', ({success,data}) => {
  if (!success) return;
  state.clienti = data;
  if (state._pending==='clienti') { state._pending=null; renderClientiPage(); }
  else if (state._pending==='scadenzario') { state._pending=null; renderScadenzarioPage(); }
  else if (state.page==='clienti') renderClientiPage();
});

socket.on('res:adempimenti', ({success,data}) => {
  if (success) state.adempimenti=data;
  if (state._pending==='adempimenti') { state._pending=null; renderAdempimentiPage(); }
  else if (state.page==='adempimenti') renderAdempimentiPage();
  const sel=document.getElementById('add-adp-select');
  if (sel&&success) { sel.innerHTML=data.map(a=>`<option value="${a.id}">[${a.categoria}] ${a.codice} – ${a.nome}</option>`).join(''); updatePeriodoOptions(); }
});

socket.on('res:stats', ({success,data}) => { if(success){state.dashStats=data;renderDashboard(data);} });
socket.on('res:scadenzario', ({success,data}) => { if(success){state.scadenzario=data;renderScadenzarioTabella(data);} });
socket.on('res:scadenzario_globale', ({success,data}) => { if(success){state.scadGlobale=data;renderGlobaleTabella(data);} });

socket.on('res:create:cliente', ({success}) => { if(success){closeModal('modal-cliente');state._pending='clienti';socket.emit('get:clienti');} });
socket.on('res:update:cliente', ({success}) => { if(success){closeModal('modal-cliente');refreshPage();} });
socket.on('res:delete:cliente', ({success}) => { if(success) refreshPage(); });

socket.on('res:create:adempimento', ({success,error}) => {
  if(success){closeModal('modal-adp-def');state._pending='adempimenti';socket.emit('get:adempimenti');}
  else showNotif(error,'error');
});
socket.on('res:update:adempimento', ({success,error}) => {
  if(success){closeModal('modal-adp-def');state._pending='adempimenti';socket.emit('get:adempimenti');}
  else showNotif(error,'error');
});
socket.on('res:delete:adempimento', ({success}) => { if(success){state._pending='adempimenti';socket.emit('get:adempimenti');} });

socket.on('res:genera:scadenzario', ({success}) => { if(success&&state.selectedCliente) loadScadenzario(); });
socket.on('res:genera:tutti', ({success}) => { if(success) closeModal('modal-genera-tutti'); });
socket.on('res:copia:scadenzario', ({success}) => { if(success){closeModal('modal-copia');loadScadenzario();} });
socket.on('res:copia:tutti', ({success}) => { if(success) closeModal('modal-copia'); });

socket.on('res:update:adempimento_stato', ({success}) => {
  if(success){
    closeModal('modal-adempimento');
    if(state.page==='scadenzario') loadScadenzario();
    if(state.page==='scadenzario_globale') applyGlobaleSearch();
    if(state.page==='dashboard') socket.emit('get:stats',{anno:state.anno});
  }
});
socket.on('res:delete:adempimento_cliente', ({success}) => {
  if(success){
    closeModal('modal-adempimento');
    if(state.page==='scadenzario') loadScadenzario();
    if(state.page==='scadenzario_globale') applyGlobaleSearch();
  }
});
socket.on('res:add:adempimento_cliente', ({success}) => { if(success){closeModal('modal-add-adp');loadScadenzario();} });

// ─── NAVIGAZIONE ─────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(el => {
  el.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    el.classList.add('active');
    renderPage(el.dataset.page);
  });
});

function renderPage(page) {
  state.page = page;
  const titles = { dashboard:'Dashboard', clienti:'Clienti', scadenzario:'Scadenzario Cliente', scadenzario_globale:'Vista Globale', adempimenti:'Adempimenti Fiscali', tipologie:'Tipologie Clienti' };
  document.getElementById('page-title').textContent = titles[page]||page;

  if (page==='dashboard') {
    document.getElementById('topbar-actions').innerHTML=`
      <div class="search-wrap" style="width:200px"><span class="search-icon">🔍</span><input class="input" id="dash-search-top" placeholder="Cerca cliente..." oninput="onDashSearch(this.value)"></div>
      <div class="year-sel"><button onclick="changeAnno(-1)">◀</button><span class="year-num">${state.anno}</span><button onclick="changeAnno(1)">▶</button></div>
      <button class="btn btn-orange btn-sm no-print" onclick="openGeneraTutti()">⚡ Genera Tutti</button>
      <button class="btn btn-cyan btn-sm no-print" onclick="openCopiaTutti()">📋 Copia Anno</button>
      <button class="btn btn-print btn-sm" onclick="window.print()">🖨️ Stampa</button>`;
    socket.emit('get:stats',{anno:state.anno});

  } else if (page==='clienti') {
    state._pending='clienti';
    document.getElementById('topbar-actions').innerHTML=`
      <div class="search-wrap" style="width:280px"><span class="search-icon">🔍</span><input class="input" id="global-search-clienti" placeholder="Cerca nome, CF, P.IVA, email..." oninput="applyClientiFiltri()"></div>
      <select class="select" id="filter-tipo" style="width:150px" onchange="applyClientiFiltri()">
        <option value="">Tutte tipologie</option>
        <option value="PF">PF – Persona Fisica</option><option value="SP">SP – Soc. Persone</option>
        <option value="SC">SC – Soc. Capitali</option><option value="ASS">ASS – Associazione</option>
      </select>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
      <button class="btn btn-primary no-print" onclick="openNuovoCliente()">+ Nuovo Cliente</button>`;
    socket.emit('get:clienti');

  } else if (page==='scadenzario') {
    state._pending='scadenzario';
    document.getElementById('topbar-actions').innerHTML='';
    socket.emit('get:clienti');

  } else if (page==='scadenzario_globale') {
    renderGlobalePage();

  } else if (page==='adempimenti') {
    state._pending='adempimenti';
    document.getElementById('topbar-actions').innerHTML=`
      <div class="search-wrap" style="width:280px"><span class="search-icon">🔍</span><input class="input" id="global-search-adempimenti" placeholder="Cerca codice, nome, categoria..." oninput="applyAdempimentiFiltri()"></div>
      <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>
      <button class="btn btn-primary no-print" onclick="openNuovoAdpDef()">+ Nuovo</button>`;
    socket.emit('get:adempimenti');

  } else if (page==='tipologie') {
    document.getElementById('topbar-actions').innerHTML='';
    renderTipologiePage();
  }
}

function refreshPage() { renderPage(state.page); }
function changeAnno(d) {
  state.anno+=d;
  document.querySelectorAll('.year-num').forEach(el=>el.textContent=state.anno);
  if(state.page==='dashboard') socket.emit('get:stats',{anno:state.anno});
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────
function onDashSearch(val) { state.dashSearch=val; if(state.dashStats) renderDashboard(state.dashStats); }

function renderDashboard(stats) {
  const perc = stats.totAdempimenti>0 ? Math.round((stats.completati/stats.totAdempimenti)*100) : 0;
  const catMap = {};
  (stats.perCategoria||[]).forEach(c=>{ catMap[c.categoria]=c; });
  const adpByCat = {};
  (stats.adempimentiStats||[]).forEach(a=>{ if(!adpByCat[a.categoria]) adpByCat[a.categoria]=[]; adpByCat[a.categoria].push(a); });
  const clientiByCat = {};
  (stats.clientiPerCategoria||[]).forEach(c=>{ if(!clientiByCat[c.categoria]) clientiByCat[c.categoria]=[]; if(!clientiByCat[c.categoria].find(x=>x.id===c.id)) clientiByCat[c.categoria].push(c); });

  const tuttiCats = [...CATEGORIE];
  if (catMap['TUTTI']) tuttiCats.push(CAT_TUTTI);

  // ── Griglia adempimenti totali (tutte le categorie, tutti gli adempimenti)
  const allAdp = stats.adempimentiStats || [];
  const search = (state.dashSearch||'').toLowerCase();
  const adpSearch = (state.dashAdpSearch||'').toLowerCase();

  // Filtra adempimenti
  let adpFiltrati = allAdp;
  if (state.dashCatAttiva) adpFiltrati = allAdp.filter(a => a.categoria === state.dashCatAttiva);

  // Costruisci la sezione griglia adempimenti con ricerca integrata
  const adpGridRows = adpFiltrati
    .filter(a => !adpSearch || a.nome.toLowerCase().includes(adpSearch) || a.codice.toLowerCase().includes(adpSearch) || a.categoria.toLowerCase().includes(adpSearch))
    .map(a => {
      const p = a.totale>0 ? Math.round((a.completati/a.totale)*100) : 0;
      const isActive = state.dashAdpAttivo && state.dashAdpAttivo.id === a.id;
      return `<tr class="adp-grid-row ${isActive?'adp-row-active':''}" onclick="onDashAdpClick(${a.id})" style="cursor:pointer">
        <td><span style="font-family:var(--mono);font-size:10px;color:var(--accent)">${a.codice}</span></td>
        <td><strong style="font-size:13px">${a.nome}</strong></td>
        <td><span class="badge b-categoria">${a.categoria}</span></td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--text2)">${a.totale}</td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--green)">${a.completati}</td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--red)">${a.da_fare}</td>
        <td style="min-width:90px">
          <div style="display:flex;align-items:center;gap:6px">
            <div class="mini-bar" style="width:60px"><div class="mini-fill" style="width:${p}%"></div></div>
            <span style="font-size:10px;font-family:var(--mono);color:var(--text3)">${p}%</span>
          </div>
        </td>
      </tr>`;
    }).join('') || `<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3)">Nessun adempimento trovato</td></tr>`;

  // ── Cards categoria
  const cardsHtml = tuttiCats.map(cat => {
    const cs = catMap[cat.codice]||{totale:0,completati:0,da_fare:0};
    const isActive = state.dashCatAttiva===cat.codice;
    return `<div class="dash-cat-card ${isActive?'active':''}" style="--card-color:${cat.color}" onclick="toggleDashCat('${cat.codice}')">
      <div class="dash-cat-icon">${cat.icona}</div>
      <div class="dash-cat-nome">${cat.nome}</div>
      <div class="dash-cat-stats">
        <span class="dash-cat-pill">${cs.totale} tot.</span>
        <span class="dash-cat-pill done">✅ ${cs.completati}</span>
        <span class="dash-cat-pill todo">⭕ ${cs.da_fare}</span>
      </div>
    </div>`;
  }).join('');

  // ── Pannello laterale adempimento selezionato
  let pannelloHtml = '';
  if (state.dashAdpAttivo) {
    const a = state.dashAdpAttivo;
    // Prende i clienti che hanno questo adempimento dalla stats.clientiPerCategoria
    // Ma per il pannello dettaglio servono le righe dell'adempimento_cliente:
    // usiamo scadGlobale se disponibile, altrimenti mostriamo pulsante per caricare
    pannelloHtml = buildPannelloAdp(a, stats);
  }

  const layoutStyle = state.dashAdpAttivo
    ? 'display:grid;grid-template-columns:1fr 420px;gap:20px;align-items:start'
    : '';

  document.getElementById('content').innerHTML=`
    <div class="print-header"><strong>Studio Commerciale — Dashboard ${stats.anno}</strong><br>Stampa: ${new Date().toLocaleDateString('it-IT')}</div>
    <div class="stats-grid" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
      <div class="stat-card"><div class="stat-label">Clienti Attivi</div><div class="stat-value v-blue">${stats.totClienti}</div></div>
      <div class="stat-card"><div class="stat-label">Adempimenti ${stats.anno}</div><div class="stat-value">${stats.totAdempimenti}</div></div>
      <div class="stat-card"><div class="stat-label">Completati</div><div class="stat-value v-green">${stats.completati}</div><div class="prog-bar"><div class="prog-fill green" style="width:${perc}%"></div></div><div class="stat-sub">${perc}%</div></div>
      <div class="stat-card"><div class="stat-label">Da Fare</div><div class="stat-value v-yellow">${stats.daFare}</div></div>
      <div class="stat-card"><div class="stat-label">In Corso</div><div class="stat-value v-purple">${stats.inCorso||0}</div></div>
      <div class="stat-card"><div class="stat-label">N/A</div><div class="stat-value" style="color:var(--text3)">${stats.na||0}</div></div>
    </div>

    <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:10px;letter-spacing:0.08em">Categorie — clicca per filtrare</div>
    <div class="dash-cards-grid">${cardsHtml}</div>

    <div style="${layoutStyle}">
      <div>
        <div class="table-wrap">
          <div class="table-header no-print" style="gap:10px">
            <h3>Adempimenti ${state.dashCatAttiva ? '— '+state.dashCatAttiva : '— Tutti'} (${adpFiltrati.length})</h3>
            <div class="search-wrap" style="width:220px"><span class="search-icon">🔍</span><input class="input" id="dash-adp-search" placeholder="Cerca adempimento..." value="${(state.dashAdpSearch||'').replace(/"/g,'&quot;')}" oninput="onDashAdpSearch(this.value)"></div>
            ${state.dashCatAttiva ? `<button class="btn btn-xs btn-secondary" onclick="state.dashCatAttiva=null;state.dashAdpAttivo=null;if(state.dashStats)renderDashboard(state.dashStats)">✕ Reset filtro</button>` : ''}
          </div>
          <table>
            <thead><tr>
              <th>Codice</th><th>Nome</th><th>Categoria</th>
              <th style="color:var(--text2)">Tot.</th>
              <th style="color:var(--green)">✅ Comp.</th>
              <th style="color:var(--red)">⭕ Da fare</th>
              <th>Avanz.</th>
            </tr></thead>
            <tbody id="dash-adp-tbody">${adpGridRows}</tbody>
          </table>
        </div>
      </div>
      ${pannelloHtml}
    </div>`;
}

function buildPannelloAdp(a, stats) {
  // Clienti per questa categoria dalla stats
  const clientiCat = (stats.clientiPerCategoria||[]).filter(c => c.categoria === a.categoria);
  const filtroStato = state.dashAdpFiltroStato || 'tutti';
  const searchC = (state.dashSearch||'').toLowerCase();

  // Le righe dettagliate per adempimento non sono in stats,
  // quindi mostro un pannello con i clienti + pulsante per aprire il modale direttamente dallo scadenzario
  const filteredClienti = clientiCat.filter(c => {
    if (searchC && !(c.nome||'').toLowerCase().includes(searchC)) return false;
    return true;
  });

  const catObj = [...CATEGORIE, CAT_TUTTI].find(c=>c.codice===a.categoria)||{color:'var(--accent)',icona:'📋'};
  const p = a.totale>0 ? Math.round((a.completati/a.totale)*100) : 0;

  const clientiRows = filteredClienti.length
    ? filteredClienti.map(c => `
        <div class="pannello-cliente-row" onclick="goScadenzario(${c.id})" title="Vai allo scadenzario di ${(c.nome||'').replace(/"/g,'&quot;')}">
          <span class="badge b-${(c.tipologia_codice||'').toLowerCase()}" style="flex-shrink:0">${c.tipologia_codice||'-'}</span>
          <span style="flex:1;font-size:12px;font-weight:600">${c.nome}</span>
          <span style="font-size:10px;color:var(--text3)">${c.sottotipologia_nome||''}</span>
          <span style="font-size:10px;color:var(--accent)">→</span>
        </div>`).join('')
    : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">Nessun cliente con questa categoria</div>`;

  return `<div class="pannello-adp" style="position:sticky;top:0">
    <div style="display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid var(--border);background:var(--surface2);border-radius:12px 12px 0 0;border-left:4px solid ${catObj.color}">
      <span style="font-size:20px">${catObj.icona}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;color:var(--text3);font-family:var(--mono)">${a.codice}</div>
        <div style="font-size:14px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.nome}</div>
      </div>
      <button class="btn btn-xs btn-secondary" onclick="state.dashAdpAttivo=null;if(state.dashStats)renderDashboard(state.dashStats)">✕</button>
    </div>

    <div style="padding:14px 18px;border-bottom:1px solid var(--border);background:var(--surface)">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div style="text-align:center;padding:8px;background:var(--surface2);border-radius:8px">
          <div style="font-size:10px;color:var(--text3);text-transform:uppercase">Totale</div>
          <div style="font-size:18px;font-weight:800;font-family:var(--mono)">${a.totale}</div>
        </div>
        <div style="text-align:center;padding:8px;background:rgba(52,211,153,0.07);border-radius:8px">
          <div style="font-size:10px;color:var(--green);text-transform:uppercase">✅ Comp.</div>
          <div style="font-size:18px;font-weight:800;font-family:var(--mono);color:var(--green)">${a.completati}</div>
        </div>
        <div style="text-align:center;padding:8px;background:rgba(248,113,113,0.07);border-radius:8px">
          <div style="font-size:10px;color:var(--red);text-transform:uppercase">⭕ Da fare</div>
          <div style="font-size:18px;font-weight:800;font-family:var(--mono);color:var(--red)">${a.da_fare}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div class="prog-bar" style="flex:1;height:8px"><div class="prog-fill green" style="width:${p}%"></div></div>
        <span style="font-size:11px;font-family:var(--mono);color:var(--text2)">${p}%</span>
      </div>
    </div>

    <div style="padding:10px 18px;border-bottom:1px solid var(--border);background:var(--surface)">
      <div style="font-size:10px;font-weight:700;color:var(--text3);text-transform:uppercase;margin-bottom:6px">
        Clienti con categoria ${a.categoria} (${filteredClienti.length})
      </div>
      <div style="font-size:10px;color:var(--text3);margin-bottom:8px">Clicca un cliente per aprire il suo scadenzario</div>
    </div>
    <div style="max-height:400px;overflow-y:auto;background:var(--surface);border-radius:0 0 12px 12px;border:1px solid var(--border);border-top:none">
      ${clientiRows}
    </div>
  </div>`;
}

function onDashAdpSearch(val) {
  state.dashAdpSearch = val;
  if(state.dashStats) renderDashboard(state.dashStats);
}

function onDashAdpClick(adpId) {
  const a = (state.dashStats?.adempimentiStats||[]).find(x=>x.id===adpId);
  if (!a) return;
  if (state.dashAdpAttivo && state.dashAdpAttivo.id === adpId) {
    state.dashAdpAttivo = null;
  } else {
    state.dashAdpAttivo = a;
    state.dashCatAttiva = a.categoria; // filtra anche le cards
  }
  if(state.dashStats) renderDashboard(state.dashStats);
}

function toggleDashCat(codice) {
  state.dashCatAttiva = state.dashCatAttiva===codice ? null : codice;
  state.dashAdpAttivo = null;
  state.dashSearch='';
  if (state.dashStats) renderDashboard(state.dashStats);
}

// ─── CLIENTI ──────────────────────────────────────────────────────────────
const applyClientiFiltriDB = debounce(()=>{
  const q=document.getElementById('global-search-clienti')?.value||'';
  const t=document.getElementById('filter-tipo')?.value||'';
  socket.emit('get:clienti',{search:q,tipologia:t});
}, 300);
function applyClientiFiltri() { applyClientiFiltriDB(); }
function renderClientiPage() { renderClientiTabella(state.clienti); }

function renderClientiTabella(clienti) {
  const tbody = clienti.length
    ? clienti.map(c=>`<tr>
        <td><strong>${c.nome}</strong></td>
        <td><span class="badge b-${(c.tipologia_codice||'').toLowerCase()}">${c.tipologia_codice||'-'}</span></td>
        <td class="td-dim">${c.sottotipologia_nome||'-'}</td>
        <td class="td-mono td-dim">${c.codice_fiscale||c.partita_iva||'-'}</td>
        <td class="td-dim">${c.email||'-'}</td>
        <td class="td-dim">${c.telefono||'-'}</td>
        <td class="col-actions no-print"><div style="display:flex;gap:5px">
          <button class="btn btn-sm btn-secondary" onclick="editCliente(${c.id})">✏️</button>
          <button class="btn btn-sm btn-success" onclick="goScadenzario(${c.id})">📅</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCliente(${c.id},'${(c.nome||'').replace(/'/g,"\\'")}')">🗑️</button>
        </div></td>
      </tr>`).join('')
    : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">👥</div><p>Nessun cliente trovato</p></div></td></tr>`;
  document.getElementById('content').innerHTML=`
    <div class="print-header"><strong>Studio Commerciale — Elenco Clienti</strong><br>Stampa: ${new Date().toLocaleDateString('it-IT')} — Tot: ${clienti.length}</div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Clienti (${clienti.length})</h3></div>
      <table><thead><tr><th>Nome</th><th>Tipo</th><th>Sottotipo</th><th>CF / P.IVA</th><th>Email</th><th>Telefono</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>`;
}

// ─── SCADENZARIO ──────────────────────────────────────────────────────────
function renderScadenzarioPage() {
  const opts = state.clienti.map(c=>`<option value="${c.id}" ${state.selectedCliente?.id===c.id?'selected':''}>[${c.tipologia_codice}] ${c.nome}</option>`).join('');
  document.getElementById('topbar-actions').innerHTML=`
    <select class="select" id="sel-cliente" style="width:250px" onchange="onClienteChange()">
      <option value="">-- Seleziona Cliente --</option>${opts}
    </select>
    <div class="year-sel"><button onclick="changeAnnoScad(-1)">◀</button><span class="year-num">${state.anno}</span><button onclick="changeAnnoScad(1)">▶</button></div>
    <div class="search-wrap" style="width:200px"><span class="search-icon">🔍</span><input class="input" id="scad-search" placeholder="Cerca adempimento..." oninput="applyScadSearch()"></div>`;
  if (state.selectedCliente) loadScadenzario();
  else document.getElementById('content').innerHTML=`<div class="empty"><div class="empty-icon">📅</div><p>Seleziona un cliente</p></div>`;
}

function onClienteChange() {
  const id=parseInt(document.getElementById('sel-cliente').value);
  state.selectedCliente=state.clienti.find(c=>c.id===id)||null;
  if(state.selectedCliente) loadScadenzario();
}
function changeAnnoScad(d) { state.anno+=d; document.querySelectorAll('.year-num').forEach(el=>el.textContent=state.anno); if(state.selectedCliente) loadScadenzario(); }

function loadScadenzario() {
  const sv=document.getElementById('scad-search')?.value||'';
  const st=document.getElementById('f-stato')?.value||'tutti';
  socket.emit('get:scadenzario',{id_cliente:state.selectedCliente.id,anno:state.anno,filtro_stato:st,filtro_adempimento:sv});
}
const applyScadSearchDB = debounce(loadScadenzario,300);
function applyScadSearch() { applyScadSearchDB(); }
function applyScadFiltri() { loadScadenzario(); }
function resetScadFiltri() {
  if(document.getElementById('f-stato')) document.getElementById('f-stato').value='tutti';
  if(document.getElementById('scad-search')) document.getElementById('scad-search').value='';
  loadScadenzario();
}

// ─── PERIODO LABEL ────────────────────────────────────────────────────────
function getPeriodoLabel(r) {
  if(r.scadenza_tipo==='trimestrale') { const m={1:'Gen–Mar',2:'Apr–Giu',3:'Lug–Set',4:'Ott–Dic'}; return `${r.trimestre}° Trim. (${m[r.trimestre]||''})`; }
  if(r.scadenza_tipo==='semestrale') return r.semestre===1?'1° Sem. (Gen–Giu)':'2° Sem. (Lug–Dic)';
  if(r.scadenza_tipo==='mensile') return MESI[r.mese-1]||'-';
  return 'Annuale';
}

// ─── IMPORTO CELL ─────────────────────────────────────────────────────────
function renderImportoCell(r) {
  if (r.is_contabilita) {
    const iva = r.importo_iva ? `€${parseFloat(r.importo_iva).toFixed(2)}` : '-';
    const cont = r.importo_contabilita ? `€${parseFloat(r.importo_contabilita).toFixed(2)}` : '-';
    return `<div class="importi-cell"><div class="imp-row"><span class="imp-lbl">IVA:</span><span class="imp-val">${iva}</span></div><div class="imp-row"><span class="imp-lbl">Cont.:</span><span class="imp-val">${cont}</span></div></div>`;
  }
  if (r.has_rate) {
    let labels=['Saldo','1°Acc.','2°Acc.'];
    try{if(r.rate_labels)labels=JSON.parse(r.rate_labels);}catch(e){}
    const s=r.importo_saldo?`€${parseFloat(r.importo_saldo).toFixed(2)}`:'-';
    const a1=r.importo_acconto1?`€${parseFloat(r.importo_acconto1).toFixed(2)}`:'-';
    const a2=r.importo_acconto2?`€${parseFloat(r.importo_acconto2).toFixed(2)}`:'-';
    return `<div class="importi-cell"><div class="imp-row"><span class="imp-lbl">${labels[0]}:</span><span class="imp-val">${s}</span></div><div class="imp-row"><span class="imp-lbl">${labels[1]}:</span><span class="imp-val">${a1}</span></div><div class="imp-row"><span class="imp-lbl">${labels[2]}:</span><span class="imp-val">${a2}</span></div></div>`;
  }
  return r.importo ? `€ ${parseFloat(r.importo).toFixed(2)}` : '-';
}

// ─── RENDER SCADENZARIO TABELLA ───────────────────────────────────────────
// FIX: usa _rowStore per evitare problemi con escape di caratteri speciali negli onclick
function renderScadenzarioTabella(righe) {
  _rowStore = {}; // reset store
  const c=state.selectedCliente;
  const tot=righe.length, comp=righe.filter(r=>r.stato==='completato').length;
  const daF=righe.filter(r=>r.stato==='da_fare').length, inC=righe.filter(r=>r.stato==='in_corso').length, na=righe.filter(r=>r.stato==='n_a').length;
  const perc=tot>0?Math.round((comp/tot)*100):0;

  // Salva tutte le righe nello store
  righe.forEach(r => storeRow(r));

  // Raggruppa per adempimento
  const grouped={};
  righe.forEach(r=>{ if(!grouped[r.id_adempimento]) grouped[r.id_adempimento]=[]; grouped[r.id_adempimento].push(r); });
  Object.values(grouped).forEach(rows=>rows.sort((a,b)=>(a.trimestre||0)-(b.trimestre||0)||(a.semestre||0)-(b.semestre||0)||(a.mese||0)-(b.mese||0)));

  const tbody = Object.entries(grouped).map(([adpId,rows])=>{
    const r0=rows[0];
    const isMulti = r0.scadenza_tipo==='mensile'||r0.scadenza_tipo==='trimestrale';

    const totR=rows.length, compR=rows.filter(x=>x.stato==='completato').length;
    const percR=totR>0?Math.round((compR/totR)*100):0;

    const flagsBadge = (r0.is_contabilita?`<span class="badge" style="background:var(--cyan-dim);color:var(--cyan);font-size:9px">📊 CONT.</span>`:'')+(r0.has_rate?`<span class="badge" style="background:var(--green-dim);color:var(--green);font-size:9px">💰 RATE</span>`:'');

    const adpLabel = `<td style="border-right:1px solid var(--border);font-weight:700;vertical-align:top;padding-top:12px;min-width:180px">
      <span style="font-family:var(--mono);font-size:11px;color:var(--accent)">${r0.codice}</span><br>
      <span style="font-size:12px">${r0.adempimento_nome}</span><br>
      <span class="badge b-categoria" style="margin-top:4px">${r0.categoria||'-'}</span>
      ${flagsBadge?'<br><div style="margin-top:4px;display:flex;gap:3px;flex-wrap:wrap">'+flagsBadge+'</div>':''}
    </td>`;

    if (isMulti) {
      // FIX: usa openAdpById(id) invece di stringa con tutti i parametri
      const periodiHtml = rows.map(rx=>{
        storeRow(rx);
        const pl = r0.scadenza_tipo==='mensile' ? MESI_SHORT[rx.mese-1] : `T${rx.trimestre}`;
        const badge = `<span class="badge b-${rx.stato}" style="font-size:8px;padding:1px 5px">${pl}</span>`;
        return `<span onclick="event.stopPropagation();openAdpById(${rx.id})" style="cursor:pointer;display:inline-block;margin:2px">${badge}</span>`;
      }).join('');

      return `<tr>
        ${adpLabel}
        <td colspan="5">
          <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div style="flex:1">
              <div style="font-size:10px;color:var(--text3);margin-bottom:6px">${r0.scadenza_tipo==='mensile'?'12 mesi':'4 trimestri'} — clicca un periodo per modificare</div>
              <div style="display:flex;flex-wrap:wrap;gap:3px">${periodiHtml}</div>
            </div>
            <div style="text-align:right;min-width:80px">
              <div style="font-size:11px;color:var(--text2);margin-bottom:4px">${compR}/${totR} completati</div>
              <div class="prog-bar" style="width:80px"><div class="prog-fill green" style="width:${percR}%"></div></div>
              <div style="font-size:10px;color:var(--text3);margin-top:3px">${percR}%</div>
            </div>
          </div>
        </td>
      </tr>`;
    }

    // FIX righe annuali/semestrali: usa openAdpById(id) — sicuro con qualsiasi nome
    return rows.map((rx,idx)=>{
      storeRow(rx);
      const periodo=getPeriodoLabel(rx);
      return `<tr class="clickable s-${rx.stato}" onclick="openAdpById(${rx.id})">
        ${idx===0?adpLabel:'<td style="border-right:1px solid var(--border)"></td>'}
        <td>${periodo}</td>
        <td><span class="badge b-${rx.stato}">${STATI[rx.stato]||rx.stato}</span></td>
        <td>${renderImportoCell(rx)}</td>
        <td class="td-mono td-dim" style="font-size:11px">${rx.data_scadenza||'-'}</td>
        <td class="td-mono td-dim" style="font-size:11px">${rx.data_completamento||'-'}</td>
        <td class="td-dim" style="font-size:11px;max-width:100px;overflow:hidden;text-overflow:ellipsis">${rx.note||''}</td>
      </tr>`;
    }).join('');
  }).join('')||`<tr><td colspan="7"><div class="empty"><div class="empty-icon">📋</div><p>Nessun adempimento.<br>Clicca <strong>⚡ Genera</strong>.</p></div></td></tr>`;

  document.getElementById('content').innerHTML=`
    <div class="print-header"><strong>Studio Commerciale — Scadenzario</strong><br>Cliente: <strong>${c.nome}</strong> | Anno: <strong>${state.anno}</strong> | Stampa: ${new Date().toLocaleDateString('it-IT')}</div>
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;flex-wrap:wrap">
      <div>
        <div style="font-size:18px;font-weight:800">${c.nome}</div>
        <div style="font-size:12px;color:var(--text2)">${c.tipologia_nome||''}${c.sottotipologia_nome?' · '+c.sottotipologia_nome:''}</div>
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
      <label>Filtra:</label>
      <select class="select" style="width:150px" id="f-stato" onchange="applyScadFiltri()">
        <option value="tutti">Tutti</option><option value="da_fare">⭕ Da fare</option>
        <option value="in_corso">🔄 In corso</option><option value="completato">✅ Completato</option>
        <option value="n_a">➖ N/A</option>
      </select>
      <button class="btn btn-sm btn-secondary" onclick="resetScadFiltri()">✕ Reset</button>
    </div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Scadenzario ${state.anno}</h3></div>
      <table><thead><tr><th>Adempimento</th><th>Periodo</th><th>Stato</th><th>Importo</th><th>Scadenza</th><th>Completato</th><th>Note</th></tr></thead>
      <tbody>${tbody}</tbody></table>
    </div>`;
  if(document.getElementById('f-stato')) document.getElementById('f-stato').value=state.filtri.stato;
}

function generaScad(id) {
  if(confirm(`Generare/rigenera scadenzario ${state.anno}?\nAdempimenti non-da_fare vengono conservati.`))
    socket.emit('genera:scadenzario',{id_cliente:id,anno:state.anno});
}

// ─── GENERA TUTTI & COPIA TUTTI ───────────────────────────────────────────
function openGeneraTutti() { document.getElementById('genera-tutti-anno').value=state.anno; openModal('modal-genera-tutti'); }
function eseguiGeneraTutti() { const anno=parseInt(document.getElementById('genera-tutti-anno').value); if(!anno)return; socket.emit('genera:tutti',{anno}); }

function openCopiaTutti() {
  document.getElementById('copia-cliente-id').value='';
  document.getElementById('copia-modalita').value='tutti';
  document.getElementById('copia-info').innerHTML='📋 Copia scadenzario per <strong>tutti i clienti</strong> con stato "Da fare".';
  document.getElementById('copia-da').value=state.anno-1;
  document.getElementById('copia-a').value=state.anno;
  openModal('modal-copia');
}

function eseguiCopia() {
  const modalita=document.getElementById('copia-modalita').value;
  const anno_da=parseInt(document.getElementById('copia-da').value);
  const anno_a=parseInt(document.getElementById('copia-a').value);
  if(modalita==='tutti') socket.emit('copia:tutti',{anno_da,anno_a});
  else socket.emit('copia:scadenzario',{id_cliente:parseInt(document.getElementById('copia-cliente-id').value),anno_da,anno_a});
}

// ─── VISTA GLOBALE ────────────────────────────────────────────────────────
function renderGlobalePage() {
  document.getElementById('topbar-actions').innerHTML=`
    <div class="search-wrap" style="width:240px"><span class="search-icon">🔍</span><input class="input" id="global-search-globale" placeholder="Cerca cliente, adempimento..." oninput="applyGlobaleSearch()"></div>
    <div class="year-sel"><button onclick="changeAnnoGlobale(-1)">◀</button><span class="year-num">${state.anno}</span><button onclick="changeAnnoGlobale(1)">▶</button></div>
    <button class="btn btn-print btn-sm no-print" onclick="window.print()">🖨️ Stampa</button>`;
  renderGlobaleFiltri(); loadGlobale();
}

function loadGlobale() {
  socket.emit('get:scadenzario_globale',{anno:state.anno,filtro_stato:state.filtri.stato,filtro_categoria:state.filtri.categoria,search:document.getElementById('global-search-globale')?.value||''});
}
function changeAnnoGlobale(d) { state.anno+=d; document.querySelectorAll('.year-num').forEach(el=>el.textContent=state.anno); loadGlobale(); }

function renderGlobaleFiltri() {
  document.getElementById('content').innerHTML=`
    <div class="print-header"><strong>Studio Commerciale — Vista Globale ${state.anno}</strong><br>Stampa: ${new Date().toLocaleDateString('it-IT')}</div>
    <div class="filtri-bar no-print">
      <label>Stato:</label>
      <select class="select" style="width:150px" id="fg-stato" onchange="applyGlobaleFiltri()">
        <option value="tutti">Tutti</option><option value="da_fare">⭕ Da fare</option>
        <option value="in_corso">🔄 In corso</option><option value="completato">✅ Completato</option><option value="n_a">➖ N/A</option>
      </select>
      <label>Categoria:</label>
      <select class="select" style="width:160px" id="fg-categoria" onchange="applyGlobaleFiltri()">
        <option value="tutti">Tutte</option>
        ${CATEGORIE.map(c=>`<option value="${c.codice}">${c.icona} ${c.nome}</option>`).join('')}
        <option value="TUTTI">📌 TUTTI</option>
      </select>
    </div>
    <div id="globale-content"><div class="empty">⏳ Caricamento...</div></div>`;
  if(document.getElementById('fg-stato')) document.getElementById('fg-stato').value=state.filtri.stato;
  if(document.getElementById('fg-categoria')) document.getElementById('fg-categoria').value=state.filtri.categoria;
}

function applyGlobaleFiltri() {
  state.filtri.stato=document.getElementById('fg-stato')?.value||'tutti';
  state.filtri.categoria=document.getElementById('fg-categoria')?.value||'tutti';
  loadGlobale();
}
const applyGlobaleSearchDB = debounce(loadGlobale,300);
function applyGlobaleSearch() { applyGlobaleSearchDB(); }

function renderGlobaleTabella(righe) {
  // Salva righe nello store per click sicuro
  righe.forEach(r => storeRow(r));

  const container=document.getElementById('globale-content');
  if(!container) return;
  const perCliente={};
  righe.forEach(r=>{ if(!perCliente[r.id_cliente]) perCliente[r.id_cliente]={nome:r.cliente_nome,tipo:r.tipologia_codice,righe:[]}; perCliente[r.id_cliente].righe.push(r); });

  if(!Object.keys(perCliente).length) { container.innerHTML=`<div class="empty"><div class="empty-icon">📋</div><p>Nessun risultato</p></div>`; return; }

  const html=Object.entries(perCliente).map(([id,cl])=>{
    const comp=cl.righe.filter(r=>r.stato==='completato').length;
    const daF=cl.righe.filter(r=>r.stato==='da_fare').length;
    const perc=cl.righe.length>0?Math.round((comp/cl.righe.length)*100):0;

    const groupedAdp={};
    cl.righe.forEach(r=>{
      if(!groupedAdp[r.id_adempimento]) groupedAdp[r.id_adempimento]={nome:r.adempimento_nome,codice:r.codice,categoria:r.categoria,scad:r.scadenza_tipo,totale:0,completati:0,da_fare:0,righe:[]};
      groupedAdp[r.id_adempimento].totale++;
      if(r.stato==='completato') groupedAdp[r.id_adempimento].completati++;
      if(r.stato==='da_fare') groupedAdp[r.id_adempimento].da_fare++;
      groupedAdp[r.id_adempimento].righe.push(r);
    });

    const adpRows=Object.values(groupedAdp).map(adp=>{
      const p2=adp.totale>0?Math.round((adp.completati/adp.totale)*100):0;
      const isMulti=adp.scad==='mensile'||adp.scad==='trimestrale';

      let periodoCell=`${adp.totale} periodi`;
      if(isMulti) {
        const pills=adp.righe.sort((a,b)=>(a.mese||0)-(b.mese||0)||(a.trimestre||0)-(b.trimestre||0)).map(rx=>{
          const pl=adp.scad==='mensile'?MESI_SHORT[rx.mese-1]:`T${rx.trimestre}`;
          // FIX: usa openAdpById
          return `<span class="badge b-${rx.stato}" style="font-size:8px;padding:1px 5px;margin:1px;cursor:pointer" onclick="openAdpById(${rx.id})">${pl}</span>`;
        }).join('');
        periodoCell=`<div style="display:flex;flex-wrap:wrap;gap:1px">${pills}</div>`;
      }

      return `<tr>
        <td class="td-mono" style="font-size:10px;color:var(--accent)">${adp.codice}</td>
        <td><strong>${adp.nome}</strong></td>
        <td><span class="badge b-categoria">${adp.categoria||'-'}</span></td>
        <td>${periodoCell}</td>
        <td>
          <span class="badge b-completato">${adp.completati} ✅</span>
          <span class="badge b-da_fare" style="margin-left:3px">${adp.da_fare} ⭕</span>
        </td>
        <td><div style="display:flex;align-items:center;gap:6px"><div class="mini-bar" style="width:60px"><div class="mini-fill" style="width:${p2}%"></div></div><span style="font-size:10px;font-family:var(--mono);color:var(--text3)">${p2}%</span></div></td>
      </tr>`;
    }).join('');

    return `<div class="table-wrap" style="margin-bottom:14px">
      <div class="table-header" style="cursor:pointer" onclick="toggleSection(this)">
        <span class="badge b-${(cl.tipo||'').toLowerCase()}" style="margin-right:6px">${cl.tipo}</span>
        <h3>${cl.nome}</h3>
        <span style="font-size:11px;color:var(--text3);margin-right:8px">${cl.righe.length} adempimenti · ✅${comp} · ⭕${daF}</span>
        <div class="mini-bar" style="width:70px;display:inline-block"><div class="mini-fill" style="width:${perc}%"></div></div>
        <span style="font-size:10px;font-family:var(--mono);color:var(--text3);margin-left:4px">${perc}%</span>
        <span class="toggle-arrow" style="margin-left:8px">▾</span>
      </div>
      <div class="section-body">
        <table><thead><tr><th>Codice</th><th>Adempimento</th><th>Categoria</th><th>Periodi</th><th>Stato</th><th>Avanzamento</th></tr></thead>
        <tbody>${adpRows}</tbody></table>
      </div>
    </div>`;
  }).join('');

  container.innerHTML=html;
}

function toggleSection(header) {
  const body=header.nextElementSibling, arrow=header.querySelector('.toggle-arrow');
  if(body.style.display==='none'){body.style.display='';if(arrow)arrow.textContent='▾';}
  else{body.style.display='none';if(arrow)arrow.textContent='▸';}
}

// ─── ADEMPIMENTI ──────────────────────────────────────────────────────────
const applyAdpFiltriDB=debounce(()=>{
  const q=document.getElementById('global-search-adempimenti')?.value||'';
  socket.emit('get:adempimenti',{search:q});
},300);
function applyAdempimentiFiltri(){applyAdpFiltriDB();}
function renderAdempimentiPage(){renderAdempimentiTabella(state.adempimenti);}

function renderAdempimentiTabella(adempimenti) {
  const rows=adempimenti.map(a=>{
    const flags=[];
    if(a.is_contabilita) flags.push(`<span class="badge" style="background:var(--cyan-dim);color:var(--cyan);font-size:9px">📊 CONT.</span>`);
    if(a.has_rate) flags.push(`<span class="badge" style="background:var(--green-dim);color:var(--green);font-size:9px">💰 RATE</span>`);
    const scadLabel={annuale:'1×/anno',semestrale:'2×/anno',trimestrale:'4×/anno',mensile:'12×/anno'};
    return `<tr>
      <td><span style="font-family:var(--mono);font-weight:700;color:var(--accent)">${a.codice}</span></td>
      <td><strong>${a.nome}</strong></td>
      <td class="td-dim" style="font-size:12px">${a.descrizione||'-'}</td>
      <td><span class="badge b-categoria">${a.categoria||'-'}</span></td>
      <td><span style="font-family:var(--mono);font-size:11px">${a.scadenza_tipo||'-'}</span></td>
      <td><span class="badge" style="background:var(--accent-dim);color:var(--accent);font-size:10px">${scadLabel[a.scadenza_tipo]||a.scadenza_tipo}</span></td>
      <td>${flags.join(' ')||'-'}</td>
      <td class="col-actions no-print"><div style="display:flex;gap:4px">
        <button class="btn btn-xs btn-secondary" onclick="editAdpDef(${a.id})">✏️</button>
        <button class="btn btn-xs btn-danger" onclick="deleteAdpDef(${a.id},'${(a.nome||'').replace(/'/g,"\\'")}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('')||`<tr><td colspan="8"><div class="empty">📋 Nessun adempimento trovato</div></td></tr>`;

  document.getElementById('content').innerHTML=`
    <div class="print-header"><strong>Studio Commerciale — Adempimenti</strong><br>Stampa: ${new Date().toLocaleDateString('it-IT')} — Tot: ${adempimenti.length}</div>
    <div class="infobox" style="margin-bottom:16px">💡 Ogni nuovo adempimento viene automaticamente assegnato a tutti i clienti con la categoria corrispondente.</div>
    <div class="table-wrap">
      <div class="table-header no-print"><h3>Adempimenti (${adempimenti.length})</h3></div>
      <table><thead><tr><th>Codice</th><th>Nome</th><th>Descrizione</th><th>Categoria</th><th>Cadenza</th><th>Periodi/anno</th><th>Flags</th><th class="no-print">Azioni</th></tr></thead>
      <tbody>${rows}</tbody></table>
    </div>`;
}

// ─── TIPOLOGIE ────────────────────────────────────────────────────────────
function renderTipologiePage() {
  const colors={PF:'var(--accent)',SP:'var(--purple)',SC:'var(--green)',ASS:'var(--yellow)'};
  const cards=state.tipologie.map(t=>{
    const color=colors[t.codice]||'var(--accent)';
    const subs=(t.sottotipologie||[]).map(s=>{
      if(s.is_separator) return `<div style="font-size:10px;color:var(--text3);margin:8px 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em">${s.nome}</div>`;
      return `<div style="font-size:12px;padding:4px 8px;background:var(--surface2);border-radius:5px;border-left:2px solid ${color};margin-bottom:4px">${s.nome}</div>`;
    }).join('');
    return `<div class="tipo-card"><div class="tipo-codice" style="color:${color}">${t.codice}</div><div class="tipo-nome">${t.nome}</div><div class="tipo-desc">${t.descrizione||''}</div><div class="divider"></div>${subs}</div>`;
  }).join('');
  document.getElementById('content').innerHTML=`<div class="tipo-cards">${cards}</div>`;
}

// ─── MODAL CLIENTE ────────────────────────────────────────────────────────
function populateTipologiaSelect() {
  const sel=document.getElementById('c-tipologia'); if(!sel)return;
  sel.innerHTML=state.tipologie.map(t=>`<option value="${t.id}">${t.codice} – ${t.nome}</option>`).join('');
  onTipologiaChange();
}

function onTipologiaChange() {
  const tipId=parseInt(document.getElementById('c-tipologia')?.value);
  const tip=state.tipologie.find(t=>t.id===tipId);
  const sel=document.getElementById('c-sottotipologia'); if(!sel||!tip)return;
  sel.innerHTML='<option value="">-- Nessuna --</option>'+(tip.sottotipologie||[]).map(s=>{
    if(s.is_separator) return `<option disabled>── ${s.nome} ──</option>`;
    return `<option value="${s.id}">${s.nome}</option>`;
  }).join('');
}

function renderCategorieSelect(attuali=[]) {
  const container=document.getElementById('categorie-attive'); if(!container)return;
  container.innerHTML=CATEGORIE.map(cat=>`
    <label style="display:inline-flex;align-items:center;gap:8px;margin:4px 8px 4px 0;padding:8px 12px;background:var(--surface2);border-radius:var(--r-sm);cursor:pointer;border:1px solid ${attuali.includes(cat.codice)?'var(--accent)':'var(--border)'};transition:all 0.12s">
      <input type="checkbox" value="${cat.codice}" ${attuali.includes(cat.codice)?'checked':''} style="accent-color:var(--accent)" onchange="this.parentElement.style.borderColor=this.checked?'var(--accent)':'var(--border)'">
      <span>${cat.icona} ${cat.nome}</span>
    </label>`).join('');
}

function getSelectedCategorie() { return Array.from(document.querySelectorAll('#categorie-attive input')).filter(cb=>cb.checked).map(cb=>cb.value); }

function openNuovoCliente() {
  document.getElementById('modal-cliente-title').textContent='Nuovo Cliente';
  document.getElementById('cliente-id').value='';
  ['c-nome','c-cf','c-piva','c-email','c-tel','c-indirizzo','c-note'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  renderCategorieSelect(['IVA','DICHIARAZIONI','PREVIDENZA','LAVORO','TRIBUTI','BILANCIO']);
  populateTipologiaSelect(); openModal('modal-cliente');
}

function editCliente(id) {
  socket.once('res:cliente',({success,data})=>{
    if(!success||!data)return;
    document.getElementById('modal-cliente-title').textContent='Modifica Cliente';
    document.getElementById('cliente-id').value=data.id;
    document.getElementById('c-nome').value=data.nome||'';
    document.getElementById('c-cf').value=data.codice_fiscale||'';
    document.getElementById('c-piva').value=data.partita_iva||'';
    document.getElementById('c-email').value=data.email||'';
    document.getElementById('c-tel').value=data.telefono||'';
    document.getElementById('c-indirizzo').value=data.indirizzo||'';
    document.getElementById('c-note').value=data.note||'';
    const cat=JSON.parse(data.categorie_attive||'["IVA","DICHIARAZIONI","PREVIDENZA","LAVORO","TRIBUTI","BILANCIO"]');
    renderCategorieSelect(cat);
    populateTipologiaSelect();
    document.getElementById('c-tipologia').value=data.id_tipologia;
    onTipologiaChange();
    setTimeout(()=>{ document.getElementById('c-sottotipologia').value=data.id_sottotipologia||''; },60);
    openModal('modal-cliente');
  });
  socket.emit('get:cliente',{id});
}

function saveCliente() {
  const id=document.getElementById('cliente-id').value;
  const data={
    nome:document.getElementById('c-nome').value.trim(),
    id_tipologia:parseInt(document.getElementById('c-tipologia').value),
    id_sottotipologia:document.getElementById('c-sottotipologia').value||null,
    codice_fiscale:document.getElementById('c-cf').value.trim().toUpperCase()||null,
    partita_iva:document.getElementById('c-piva').value.trim()||null,
    email:document.getElementById('c-email').value.trim()||null,
    telefono:document.getElementById('c-tel').value.trim()||null,
    indirizzo:document.getElementById('c-indirizzo').value.trim()||null,
    note:document.getElementById('c-note').value.trim()||null,
    categorie_attive:getSelectedCategorie(),
  };
  if(!data.nome){showNotif('Il nome è obbligatorio','error');return;}
  if(!data.categorie_attive.length){showNotif('Seleziona almeno una categoria','error');return;}
  if(id){data.id=parseInt(id);socket.emit('update:cliente',data);}
  else socket.emit('create:cliente',data);
}

function deleteCliente(id,nome) { if(confirm(`Eliminare "${nome}"?`)) socket.emit('delete:cliente',{id}); }

function goScadenzario(id) {
  state.selectedCliente=state.clienti.find(c=>c.id===id)||null;
  if (!state.selectedCliente) {
    // clienti non ancora caricati: carica e poi vai
    state._gotoClienteId = id;
    state._pending='scadenzario';
    socket.emit('get:clienti');
  } else {
    document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
    document.querySelector('[data-page="scadenzario"]').classList.add('active');
    renderPage('scadenzario');
  }
}

// ─── MODAL ADEMPIMENTO STATO ──────────────────────────────────────────────
function openAdpModal(id,stato,scadenza,dataComp,importo,note,nome,isContabilita,hasRate,impSaldo,impAcc1,impAcc2,impIva,impCont,rateLabels) {
  document.getElementById('adp-id').value=id;
  document.getElementById('adp-stato').value=stato;
  document.getElementById('adp-scadenza').value=scadenza||'';
  document.getElementById('adp-data').value=dataComp||'';
  document.getElementById('adp-note').value=note||'';
  document.getElementById('adp-nome-label').textContent=nome||'';
  document.getElementById('adp-is-contabilita').value=isContabilita||0;
  document.getElementById('adp-has-rate').value=hasRate||0;
  document.getElementById('adp-rate-labels-json').value=rateLabels||'';

  const showNorm=!isContabilita&&!hasRate;
  document.getElementById('sect-importo-normale').style.display=showNorm?'':'none';
  document.getElementById('sect-importo-rate').style.display=hasRate?'':'none';
  document.getElementById('sect-importo-cont').style.display=isContabilita?'':'none';

  if(showNorm) document.getElementById('adp-importo').value=importo||'';
  if(hasRate) {
    let labels=['Saldo (€)','1° Acconto (€)','2° Acconto (€)'];
    try{if(rateLabels){const l=JSON.parse(rateLabels);labels=l.map(x=>x+' (€)');}}catch(e){}
    document.getElementById('rate-l0').textContent=labels[0];
    document.getElementById('rate-l1').textContent=labels[1];
    document.getElementById('rate-l2').textContent=labels[2];
    document.getElementById('adp-imp-saldo').value=impSaldo||'';
    document.getElementById('adp-imp-acc1').value=impAcc1||'';
    document.getElementById('adp-imp-acc2').value=impAcc2||'';
  }
  if(isContabilita) {
    document.getElementById('adp-imp-iva').value=impIva||'';
    document.getElementById('adp-imp-cont').value=impCont||'';
  }
  openModal('modal-adempimento');
}

function saveAdpStato() {
  const isC=parseInt(document.getElementById('adp-is-contabilita').value);
  const hasR=parseInt(document.getElementById('adp-has-rate').value);
  const payload={
    id:parseInt(document.getElementById('adp-id').value),
    stato:document.getElementById('adp-stato').value,
    data_scadenza:document.getElementById('adp-scadenza').value||null,
    data_completamento:document.getElementById('adp-data').value||null,
    note:document.getElementById('adp-note').value||null,
    importo:null, importo_saldo:null, importo_acconto1:null, importo_acconto2:null, importo_iva:null, importo_contabilita:null,
  };
  if(!isC&&!hasR) payload.importo=document.getElementById('adp-importo').value||null;
  if(hasR){payload.importo_saldo=document.getElementById('adp-imp-saldo').value||null;payload.importo_acconto1=document.getElementById('adp-imp-acc1').value||null;payload.importo_acconto2=document.getElementById('adp-imp-acc2').value||null;}
  if(isC){payload.importo_iva=document.getElementById('adp-imp-iva').value||null;payload.importo_contabilita=document.getElementById('adp-imp-cont').value||null;}
  socket.emit('update:adempimento_stato',payload);
}

function deleteAdpCliente() { if(confirm('Rimuovere questo adempimento?')) socket.emit('delete:adempimento_cliente',{id:parseInt(document.getElementById('adp-id').value)}); }

// ─── MODAL ADEMPIMENTO DEF ────────────────────────────────────────────────
function onAdpFlagsChange() {
  const hasCont=document.getElementById('adp-def-contabilita').checked;
  const hasRate=document.getElementById('adp-def-rate').checked;
  if(hasCont) document.getElementById('adp-def-rate').checked=false;
  if(hasRate) document.getElementById('adp-def-contabilita').checked=false;
  document.getElementById('sect-rate-labels').style.display=document.getElementById('adp-def-rate').checked?'':'none';
}

function openNuovoAdpDef() {
  document.getElementById('modal-adp-def-title').textContent='Nuovo Adempimento';
  ['adp-def-id','adp-def-codice','adp-def-nome','adp-def-desc'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('adp-def-scadenza').value='annuale';
  document.getElementById('adp-def-categoria').value='TUTTI';
  document.getElementById('adp-def-contabilita').checked=false;
  document.getElementById('adp-def-rate').checked=false;
  document.getElementById('adp-rate-l1').value='Saldo';
  document.getElementById('adp-rate-l2').value='1° Acconto';
  document.getElementById('adp-rate-l3').value='2° Acconto';
  document.getElementById('sect-rate-labels').style.display='none';
  openModal('modal-adp-def');
}

function editAdpDef(id) {
  const a=state.adempimenti.find(x=>x.id===id); if(!a)return;
  document.getElementById('modal-adp-def-title').textContent='Modifica Adempimento';
  document.getElementById('adp-def-id').value=a.id;
  document.getElementById('adp-def-codice').value=a.codice;
  document.getElementById('adp-def-nome').value=a.nome;
  document.getElementById('adp-def-desc').value=a.descrizione||'';
  document.getElementById('adp-def-scadenza').value=a.scadenza_tipo||'annuale';
  document.getElementById('adp-def-categoria').value=a.categoria||'TUTTI';
  document.getElementById('adp-def-contabilita').checked=!!a.is_contabilita;
  document.getElementById('adp-def-rate').checked=!!a.has_rate;
  if(a.rate_labels){try{const l=JSON.parse(a.rate_labels);document.getElementById('adp-rate-l1').value=l[0]||'Saldo';document.getElementById('adp-rate-l2').value=l[1]||'1° Acconto';document.getElementById('adp-rate-l3').value=l[2]||'2° Acconto';}catch(e){}}
  document.getElementById('sect-rate-labels').style.display=a.has_rate?'':'none';
  openModal('modal-adp-def');
}

function saveAdpDef() {
  const id=document.getElementById('adp-def-id').value;
  const isC=document.getElementById('adp-def-contabilita').checked;
  const hasR=document.getElementById('adp-def-rate').checked;
  const data={
    codice:document.getElementById('adp-def-codice').value.trim().toUpperCase(),
    nome:document.getElementById('adp-def-nome').value.trim(),
    descrizione:document.getElementById('adp-def-desc').value.trim()||null,
    scadenza_tipo:document.getElementById('adp-def-scadenza').value,
    categoria:document.getElementById('adp-def-categoria').value,
    is_contabilita:isC,
    has_rate:hasR,
    rate_labels:hasR?[document.getElementById('adp-rate-l1').value||'Saldo',document.getElementById('adp-rate-l2').value||'1° Acconto',document.getElementById('adp-rate-l3').value||'2° Acconto']:null,
  };
  if(!data.codice||!data.nome){showNotif('Codice e Nome obbligatori','error');return;}
  if(id){data.id=parseInt(id);socket.emit('update:adempimento',data);}
  else socket.emit('create:adempimento',data);
}

function deleteAdpDef(id,nome) { if(confirm(`Eliminare "${nome}"?`)) socket.emit('delete:adempimento',{id}); }

// ─── COPIA SCADENZARIO SINGOLO ────────────────────────────────────────────
function openCopia(id) {
  document.getElementById('copia-cliente-id').value=id;
  document.getElementById('copia-modalita').value='cliente';
  document.getElementById('copia-info').innerHTML='📋 Copia scadenzario per questo cliente. I dati vengono copiati con stato "Da fare".';
  document.getElementById('copia-da').value=state.anno-1;
  document.getElementById('copia-a').value=state.anno;
  openModal('modal-copia');
}

// ─── AGGIUNGI ADEMPIMENTO ─────────────────────────────────────────────────
function openAddAdp(id) {
  document.getElementById('add-adp-cliente-id').value=id;
  document.getElementById('add-adp-anno').value=state.anno;
  const sel=document.getElementById('add-adp-select');
  sel.innerHTML=state.adempimenti.map(a=>`<option value="${a.id}">[${a.categoria}] ${a.codice} – ${a.nome}</option>`).join('');
  updatePeriodoOptions(); openModal('modal-add-adp');
}

function updatePeriodoOptions() {
  const selAdp=document.getElementById('add-adp-select'),selP=document.getElementById('add-adp-periodo');
  if(!selAdp||!selP)return;
  const adp=state.adempimenti.find(a=>a.id===parseInt(selAdp.value));if(!adp)return;
  let opts='<option value="">— Seleziona —</option>';
  if(adp.scadenza_tipo==='trimestrale') opts+=`<option value="trimestre_1">1° Trim. (Gen–Mar)</option><option value="trimestre_2">2° Trim. (Apr–Giu)</option><option value="trimestre_3">3° Trim. (Lug–Set)</option><option value="trimestre_4">4° Trim. (Ott–Dic)</option>`;
  else if(adp.scadenza_tipo==='semestrale') opts+=`<option value="semestre_1">1° Semestre</option><option value="semestre_2">2° Semestre</option>`;
  else if(adp.scadenza_tipo==='mensile') MESI.forEach((m,i)=>{opts+=`<option value="mese_${i+1}">${m}</option>`;});
  else opts+=`<option value="annuale">Annuale</option>`;
  selP.innerHTML=opts;
}

function eseguiAddAdp() {
  const pv=document.getElementById('add-adp-periodo').value;
  let trimestre=null,semestre=null,mese=null;
  if(pv.startsWith('trimestre_'))trimestre=parseInt(pv.split('_')[1]);
  else if(pv.startsWith('semestre_'))semestre=parseInt(pv.split('_')[1]);
  else if(pv.startsWith('mese_'))mese=parseInt(pv.split('_')[1]);
  socket.emit('add:adempimento_cliente',{
    id_cliente:parseInt(document.getElementById('add-adp-cliente-id').value),
    id_adempimento:parseInt(document.getElementById('add-adp-select').value),
    anno:parseInt(document.getElementById('add-adp-anno').value)||state.anno,
    trimestre,semestre,mese,
  });
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(el=>{ el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open');}); });

function showNotif(msg,type='info') {
  const icons={success:'✅',info:'ℹ️',error:'❌'};
  const el=document.createElement('div');
  el.className=`notif ${type}`;
  el.innerHTML=`<span>${icons[type]||'•'}</span><span>${msg}</span>`;
  document.getElementById('notif-container').appendChild(el);
  setTimeout(()=>el.remove(),3800);
}