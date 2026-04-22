// ═══════════════════════════════════════════════════════════════
// STATE.JS — Stato globale dell'applicazione
// ═══════════════════════════════════════════════════════════════

const state = {
  page: "dashboard",
  tipologie: [],
  clienti: [],
  adempimenti: [],
  selectedCliente: null,
  anno: new Date().getFullYear(),
  filtri: { stato: "tutti", categoria: "tutti" },
  scadenzario: [],
  scadGlobale: [],
  dashStats: null,
  dashSearch: "",
  dashFiltroCategoria: "tutti",
  dashFiltroClienteStato: "",
  dashFiltroStatoAdp: "",
  globalePreFiltroAdp: "",
  globaleStats: null,
  _dashRendered: false,
  adpInseriti: [],
  _currentClienteDettaglio: null,
  _pending: null,
  _gotoClienteId: null,
};