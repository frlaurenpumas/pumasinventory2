// Variable d'état globale
let currentAdherentC2 = null;
let allInventoryCache = [];
let assignedEquipmentCache = [];

// --- CONSTANTES MÉTIER RÉUTILISABLES ---
const MANDATORY_EQUIPMENTS = [
  { type: "Casque", label: "Casque" },
  { type: "Plastron", label: "Plastron" },
  { type: "Coudières", label: "Coudières" },
  { type: "Gants", label: "Gants" },
  { type: "Culotte", label: "Culotte" },
  { type: "Jambières", label: "Jambières" },
  { type: "Patins", label: "Patins" }
];

const OPTIONAL_EQUIPMENTS = [
  { type: "Crosse", label: "Crosse" },
  { type: "Maillot", label: "Maillot" },
  { type: "Sac", label: "Sac" }
];

// --- ÉTAT GLOBAL ---
let currentAdherentC2 = null;
let allInventoryCache = [];
let assignedEquipmentCache = [];
