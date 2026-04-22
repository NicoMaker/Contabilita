// ═══════════════════════════════════════════════════════════════
// CONSTANTS.JS — Costanti globali dell'applicazione
// ═══════════════════════════════════════════════════════════════

const MESI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

const MESI_SHORT = [
  "Gen",
  "Feb",
  "Mar",
  "Apr",
  "Mag",
  "Giu",
  "Lug",
  "Ago",
  "Set",
  "Ott",
  "Nov",
  "Dic",
];

const STATI = {
  da_fare: "⭕ Da fare",
  in_corso: "🔄 In corso",
  completato: "✅ Completato",
  n_a: "➖ N/A",
};

const CATEGORIE = [
  { codice: "IVA", nome: "💰 IVA", icona: "💰", color: "#fbbf24" },
  {
    codice: "DICHIARAZIONI",
    nome: "📄 Dichiarazioni",
    icona: "📄",
    color: "#5b8df6",
  },
  {
    codice: "PREVIDENZA",
    nome: "🏦 Previdenza",
    icona: "🏦",
    color: "#34d399",
  },
  { codice: "LAVORO", nome: "👔 Lavoro", icona: "👔", color: "#a78bfa" },
  { codice: "TRIBUTI", nome: "🏛️ Tributi", icona: "🏛️", color: "#f87171" },
  { codice: "BILANCIO", nome: "📊 Bilancio", icona: "📊", color: "#22d3ee" },
];

const SOTTOTIPO_LABEL_MAP = {
  PF_PRIV: "Privato",
  PF_DITTA_ORD: "Ditta Ind. – Ordinario",
  PF_DITTA_SEM: "Ditta Ind. – Semplificato",
  PF_DITTA_FOR: "Ditta Ind. – Forfettario",
  PF_SOCIO: "Socio",
  PF_PROF_ORD: "Professionista – Ordinario",
  PF_PROF_SEM: "Professionista – Semplificato",
  PF_PROF_FOR: "Professionista – Forfettario",
  SP_ORD: "Soc. Persone – Ordinaria",
  SP_SEMP: "Soc. Persone – Semplificata",
  SC_ORD: "Soc. Capitali – Ordinaria",
  ASS_ORD: "Associazione – Ordinaria",
  ASS_SEMP: "Associazione – Semplificata",
};

const COL2_OPTIONS = {
  PF: [
    { value: "privato", label: "Privato" },
    { value: "ditta", label: "Ditta Individuale" },
    { value: "socio", label: "Socio" },
    { value: "professionista", label: "Professionista" },
  ],
  SP: null,
  SC: null,
  ASS: null,
};

const SOTTOTIPO_MAP = {
  "PF|privato|": "PF_PRIV",
  "PF|ditta|ordinario": "PF_DITTA_ORD",
  "PF|ditta|semplificato": "PF_DITTA_SEM",
  "PF|ditta|forfettario": "PF_DITTA_FOR",
  "PF|socio|": "PF_SOCIO",
  "PF|professionista|ordinario": "PF_PROF_ORD",
  "PF|professionista|semplificato": "PF_PROF_SEM",
  "PF|professionista|forfettario": "PF_PROF_FOR",
  "SP||ordinaria": "SP_ORD",
  "SP||semplificata": "SP_SEMP",
  "SC||ordinaria": "SC_ORD",
  "ASS||ordinaria": "ASS_ORD",
  "ASS||semplificata": "ASS_SEMP",
};

const TIPOLOGIE_INFO = {
  PF: { color: "#5b8df6", desc: "Persona Fisica", icon: "👤" },
  SP: { color: "#a78bfa", desc: "Società di Persone", icon: "🤝" },
  SC: { color: "#34d399", desc: "Società di Capitali", icon: "🏢" },
  ASS: { color: "#fbbf24", desc: "Associazione", icon: "🏛️" },
};
