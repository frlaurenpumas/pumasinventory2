// Variable d'état globale
let currentAdherentC2 = null;
let allInventoryCache = [];
let assignedEquipmentCache = [];

// Définition des 2 groupes d'équipements pour le Comptoir 2
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

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  console.log("[DEBUG] Application initialisée.");
  
  const searchInput = document.getElementById("c1-search");
  if (searchInput) {
    searchInput.value = "";
  }

  populatePointureOptions();
  listenToQueueC2();
  loadAllAdherentsC1();
});

// --- GESTION DES ONGLETS ---
function switchTab(tabId, e) {
  console.log(`[DEBUG] Navigation vers l'onglet : ${tabId}`);
  
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  
  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.add("active");
  }
  
  if (e && e.currentTarget) {
    e.currentTarget.classList.add("active");
  }
}

function populatePointureOptions() {
  const select = document.getElementById("adh-pointure");
  if (!select) return;
  for (let i = 28; i <= 40; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
}

// --- COMPTOIR 1 : ACCUEIL & MESURES ---

/**
 * Calcule la catégorie selon l'année de naissance et l'année en cours.
 * @param {string} [dobString] - (Optionnel) Date au format ISO "YYYY-MM-DD"
 * @returns {string} Le code de la catégorie (EDH, U7, U9, etc.)
 */
function calculateCategory(dobString) {
  // 1. Récupère la date transmise en argument ou depuis l'input du formulaire
  const inputEl = document.getElementById("adh-dob");
  const dobValue = dobString || (inputEl ? inputEl.value : null);

  if (!dobValue) {
    if (inputEl) document.getElementById("adh-categorie").value = "";
    return "";
  }

  // 2. Calcul de l'âge selon l'année en cours
  const birthYear = new Date(dobValue).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;

  // 3. Attribution de la catégorie
  let cat = "";
  if (age >= 4 && age <= 5) cat = "EDH";
  else if (age <= 7) cat = "U7";
  else if (age <= 9) cat = "U9";
  else if (age <= 11) cat = "U11";
  else if (age <= 13) cat = "U13";
  else if (age <= 15) cat = "U15";
  else if (age <= 18) cat = "U18";
  else cat = "Sénior";

  // 4. Si la fonction a été appelée sans argument (depuis un événement du DOM), remplit l'input
  if (!dobString && document.getElementById("adh-categorie")) {
    document.getElementById("adh-categorie").value = cat;
  }

  return cat;
}

async function onSearchAdherent(query) {
  const listEl = document.getElementById("c1-search-results");
  listEl.innerHTML = "";
  if (query.length < 2) return;

  const snapshot = await db.collection("adherents").get();
  const results = snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter(a => `${a.nom} ${a.prenom}`.toLowerCase().includes(query.toLowerCase()));

  results.forEach(adh => {
    const li = document.createElement("li");
    li.textContent = `${adh.nom.toUpperCase()} ${adh.prenom} (${adh.categorie || 'SANS CAT'})`;
    li.onclick = () => fillAdherentForm(adh);
    listEl.appendChild(li);
  });
}

function fillAdherentForm(adh) {
  document.getElementById("adh-id").value = adh.id;
  document.getElementById("adh-nom").value = adh.nom || "";
  document.getElementById("adh-prenom").value = adh.prenom || "";
  
  const dob = adh.dateNaissance ? formatDateToISO(adh.dateNaissance) : "";
  document.getElementById("adh-dob").value = dob;

  document.getElementById("adh-categorie").value = adh.categorie || "";
  document.getElementById("adh-email").value = adh.email || adh.mail || "";
  document.getElementById("adh-taille-cm").value = adh.tailleCm || "";
  document.getElementById("adh-tete-cm").value = adh.tourTeteCm || "";
  document.getElementById("adh-main-inch").value = adh.tailleMainInch || "";
  document.getElementById("adh-pointure").value = adh.pointure || "";
  document.getElementById("c1-search-results").innerHTML = "";

  if (dob) calculateCategory();
}

function resetAdherentForm() {
  document.getElementById("adh-id").value = "";
  document.getElementById("form-adherent").reset();
  document.getElementById("c1-search-results").innerHTML = "";
}

// Affiche tous les adhérents triés par nom puis prénom en temps réel (Consultation & Sélection)
function loadAllAdherentsC1() {
  db.collection("adherents")
    .orderBy("nom", "asc")
    .onSnapshot(snapshot => {
      const tbody = document.getElementById("c1-adherents-list-body");
      if (!tbody) return;
      
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Aucun adhérent en base.</td></tr>';
        return;
      }

      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => {
        const nomCompare = (a.nom || "").localeCompare(b.nom || "", 'fr', { sensitivity: 'base' });
        if (nomCompare !== 0) return nomCompare;
        return (a.prenom || "").localeCompare(b.prenom || "", 'fr', { sensitivity: 'base' });
      });

      list.forEach(adh => {
        const tr = document.createElement("tr");
        tr.style.cursor = "pointer";
        tr.onclick = () => fillAdherentForm(adh);

        tr.innerHTML = `
          <td><strong>${(adh.nom || "").toUpperCase()}</strong></td>
          <td>${adh.prenom || ""}</td>
          <td>${adh.categorie || "-"}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}

async function saveAndSendToComptoir2(e) {
  e.preventDefault();

  // 1. Récupération des valeurs des mesures
  const tailleCm = document.getElementById("adh-taille-cm").value.trim();
  const tourTeteCm = document.getElementById("adh-tete-cm").value.trim();
  const tailleMainInch = document.getElementById("adh-main-inch").value.trim();
  const pointure = document.getElementById("adh-pointure").value.trim();

  // 2. BLOCUS : On vérifie que TOUTES les mesures sont renseignées
  if (!tailleCm || !tourTeteCm || !tailleMainInch || !pointure) {
    alert("Impossible de transmettre au Comptoir 2 : Toutes les mesures (Taille, Tour de tête, Main, Pointure) sont obligatoires.");
    return; // Interrompt l'exécution, rien n'est envoyé à la base de données
  }

  const id = document.getElementById("adh-id").value;

  // 3. Construction du payload complet (inchangé)
  const payload = {
    nom: document.getElementById("adh-nom").value.trim(),
    prenom: document.getElementById("adh-prenom").value.trim(),
    dateNaissance: document.getElementById("adh-dob").value,
    categorie: document.getElementById("adh-categorie").value,
    email: document.getElementById("adh-email").value.trim(),
    tailleCm: Number(tailleCm) || null,
    tourTeteCm: Number(tourTeteCm) || null,
    tailleMainInch: tailleMainInch,
    pointure: pointure,
    statut: "En attente de matériel",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // 4. Enregistrement Firestore
  if (id) {
    await db.collection("adherents").doc(id).update(payload);
  } else {
    await db.collection("adherents").add(payload);
  }

  alert("Fiche validée et transmise au Comptoir 2 !");
  resetAdherentForm();
}

// --- COMPTOIR 2 : DISTRIBUTION & ÉCHANGES (V3 Cleaned) ---

const overrideFilterMap = new Map();
let unsubscribeAssignedEquipment = null; // Pour stopper l'écoute du précédent adhérent

function listenToQueueC2() {
  db.collection("adherents")
    .where("statut", "==", "En attente de matériel")
    .onSnapshot(snapshot => {
      const queueList = document.getElementById("c2-queue");
      if (!queueList) return;
      queueList.innerHTML = "";
      
      snapshot.forEach(doc => {
        const adh = { id: doc.id, ...doc.data() };
        const li = document.createElement("li");
        li.className = `queue-item ${currentAdherentC2 && currentAdherentC2.id === adh.id ? 'active' : ''}`;
        
        // Sécurisation contre nom/prénom indéfinis
        const nomUpper = (adh.nom || '').toUpperCase();
        const prenomStr = adh.prenom || '';
        
        li.innerHTML = `<strong>${nomUpper} ${prenomStr}</strong><br><small>${adh.categorie || ''}</small>`;
        li.onclick = () => selectAdherentC2(adh);
        queueList.appendChild(li);
      });
    });
}

function listenToAssignedEquipment(adhId) {
  if (!adhId) return;

  // On stoppe l'écoute précédente si elle existe
  if (unsubscribeAssignedEquipment) {
    unsubscribeAssignedEquipment();
  }

  unsubscribeAssignedEquipment = db.collection("loans")
    .where("adhId", "==", adhId)
    .where("statut", "==", "attribue")
    .onSnapshot(
      (snapshot) => {
        assignedEquipmentCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAssignedTable();
        if (typeof checkPackAndAlerts === "function") checkPackAndAlerts();
      },
      (error) => {
        console.error("Erreur lors de l'écoute des prêts :", error);
      }
    );
}

function renderAssignedTable() {
  const tbody = document.getElementById("c2-assigned-table");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (!assignedEquipmentCache || assignedEquipmentCache.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #666;">Aucun équipement attribué pour le moment.</td></tr>`;
    return;
  }

  assignedEquipmentCache.forEach(item => {
    const tr = document.createElement("tr");
    const dateStr = item.dateRemise && item.dateRemise.toDate 
      ? new Date(item.dateRemise.toDate()).toLocaleString("fr-FR") 
      : "-";

    tr.innerHTML = `
      <td>${item.type || '-'}</td>
      <td>${item.marque || ''} ${item.modele || ''}</td>
      <td>${item.taille || '-'}</td>
      <td>${dateStr}</td>
      <td>
        <button type="button" class="btn btn-danger btn-sm" data-id="${item.id}" data-eqid="${item.eqId}">
          Échanger / Restituer
        </button>
      </td>
    `;

    // Évite d'injecter des IDs directement dans du HTML inline onclick
    const btn = tr.querySelector("button");
    btn.addEventListener("click", () => returnEquipment(item.id, item.eqId));

    tbody.appendChild(tr);
  });
}

async function selectAdherentC2(adh) {
  currentAdherentC2 = adh;
  overrideFilterMap.clear();
  
  const workarea = document.getElementById("c2-workarea");
  if (workarea) workarea.style.display = "block";

  const nameEl = document.getElementById("c2-adh-fullname");
  const catEl = document.getElementById("c2-adh-cat");
  if (nameEl) nameEl.textContent = `${(adh.nom || '').toUpperCase()} ${adh.prenom || ''}`;
  if (catEl) catEl.textContent = adh.categorie || "N/A";

  await loadInventory();
  
  renderStockSummaryBandeau();
  renderGridSection(MANDATORY_EQUIPMENTS, "grid-mandatory-body", true);
  renderGridSection(OPTIONAL_EQUIPMENTS, "grid-optional-body", false);
  updateMandatoryCounter();

  listenToAssignedEquipment(adh.id);
}

async function loadInventory() {
  const snapshot = await db.collection("equipment").get();
  allInventoryCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- BANDEAU RECAPITULATIF DE STOCK ---
function renderStockSummaryBandeau() {
  const container = document.getElementById("c2-stock-badges");
  if (!container || !currentAdherentC2) return;
  container.innerHTML = "";

  const allEquipments = [...MANDATORY_EQUIPMENTS, ...OPTIONAL_EQUIPMENTS];

  allEquipments.forEach(eq => {
    const stockType = (allInventoryCache || []).filter(i => i.type === eq.type && i.statut === "en_stock");
    const suggestedStock = filterInventoryByRule(eq.type, stockType, currentAdherentC2);
    
    const badge = document.createElement("span");
    badge.style.padding = "4px 8px";
    badge.style.borderRadius = "4px";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "bold";

    if (suggestedStock.length > 0) {
      badge.style.backgroundColor = "#dcfce7";
      badge.style.color = "#166534";
      badge.style.border = "1px solid #86efac";
      badge.textContent = `${eq.label} : ${suggestedStock.length} dispo`;
    } else {
      badge.style.backgroundColor = "#fee2e2";
      badge.style.color = "#991b1b";
      badge.style.border = "1px solid #fca5a5";
      badge.textContent = `${eq.label} : RUPTURE`;
    }
    container.appendChild(badge);
  });
}

// --- RÈGLES MÉTIER : TAILLE CIBLE STRICTE (Débrayage obligatoire si rupture) ---

// --- TRI INTELLIGENT DES TAILLES DANS LES MENUS DÉROULANTS ---
function sortSizes(sizeA, sizeB, type) {
  const strA = String(sizeA || "").trim().toUpperCase();
  const strB = String(sizeB || "").trim().toUpperCase();

  // 1. Priorité aux catégories / préfixes : YT (Youth) < JR (Junior) < SR (Senior)
  const getCategoryRank = (s) => {
    if (s.includes("YT") || s.includes("YTH") || s.includes("YOUTH")) return 1;
    if (s.includes("JR") || s.includes("JUNIOR")) return 2;
    if (s.includes("INT") || s.includes("INTERMEDIATE")) return 3;
    if (s.includes("SR") || s.includes("SENIOR")) return 4;
    return 5; // Sans catégorie précisée
  };

  const catRankA = getCategoryRank(strA);
  const catRankB = getCategoryRank(strB);
  if (catRankA !== catRankB) return catRankA - catRankB;

  // 2. Extrait les nombres pour les Patins, Gants, Jambières (ex: '9"', '10.5', '14"')
  const numA = parseFloat(strA.replace(",", ".").replace(/[^0-9.]/g, ""));
  const numB = parseFloat(strB.replace(",", ".").replace(/[^0-9.]/g, ""));

  if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
    return numA - numB;
  }

  // 3. Ordre des tailles textuelles standard
  const textOrder = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL"];
  
  // Nettoie la chaîne pour chercher le code taille (ex: "JR S" -> "S")
  const findTextRank = (s) => {
    const tokens = s.split(/[\s-]+/);
    for (const token of tokens) {
      const idx = textOrder.indexOf(token);
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const rankA = findTextRank(strA);
  const rankB = findTextRank(strB);

  if (rankA !== -1 && rankB !== -1 && rankA !== rankB) {
    return rankA - rankB;
  }

  // 4. Fallback : tri alphabétique/numérique standard
  return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
}

function filterInventoryByRule(type, items, adh) {
  if (!adh) return items;

  const adhTaille = Number(adh.tailleCm) || 0;
  const adhTete = Number(adh.tourTeteCm) || 0;

  switch (type) {
    case "Casque": {
      if (!adhTete) return items;
      const rec = getRecommendedHelmetSize(adhTete);
      return items.filter(i => {
        const itemTailleStr = String(i.taille || "").toUpperCase().trim();
        const itemTailleMax = Number(i.tailleMax) || 0;
        return itemTailleStr === rec.code || itemTailleMax === rec.max;
      });
    }

    case "Plastron":
    case "Coudières":
    case "Culotte":
    case "Jambières": {
      if (!adhTaille) return items;
      // Ajout de la marge fixe de +3cm avant arrondi à la dizaine supérieure
      const targetSize = Math.ceil((adhTaille + 3) / 10) * 10;
      return items.filter(i => Number(i.tailleMax) === targetSize);
    }

    case "Crosse": {
      if (!adhTaille) return items;
      // Idem pour la crosse (+3cm de marge d'anticipation)
      const targetSize = Math.ceil((adhTaille + 3) / 10) * 10;
      return items.filter(i => Number(i.tailleMax) === targetSize);
    }

    case "Gants": {
      if (!adh.tailleMainInch) return items;
      return items.filter(item => {
        if (item.tailleMainInch) return String(item.tailleMainInch).trim() === String(adh.tailleMainInch).trim();
        return String(item.taille || "").includes(String(adh.tailleMainInch));
      });
    }

    case "Patins": {
      if (!adh.pointure) return items;
      return items.filter(item => {
        if (item.pointure) return String(item.pointure).trim() === String(adh.pointure).trim();
        return String(item.taille || "").trim() === String(adh.pointure).trim();
      });
    }

    default:
      return items;
  }
}

function getRecommendedHelmetSize(tourTeteCm) {
  const target = Number(tourTeteCm) + 1; // Marge de +1cm
  if (target <= 53) return { code: "XS", max: 53 };
  if (target <= 56) return { code: "S", max: 56 };
  if (target <= 58) return { code: "M", max: 58 };
  return { code: "L", max: 61 };
}

function getFormattedMeasure(type, adh) {
  if (!adh) return "N/C";

  const adhTaille = Number(adh.tailleCm) || 0;
  const adhTete = Number(adh.tourTeteCm) || 0;

  switch (type) {
    case "Casque": {
      if (!adhTete) return "N/C";
      const rec = getRecommendedHelmetSize(adhTete);
      return `${adhTete} cm (Rec. Taille MAX : ${rec.code} - ${rec.max})`;
    }

    case "Plastron":
    case "Coudières":
    case "Culotte":
    case "Jambières": {
      if (!adhTaille) return "N/C";
      // Affichage de la suggestion basée sur +3cm
      const recMax = Math.ceil((adhTaille + 3) / 10) * 10;
      return `${adhTaille} cm (Rec. Taille MAX : ${recMax})`;
    }

    case "Crosse": {
      if (!adhTaille) return "N/C";
      const recMax = Math.ceil((adhTaille + 3) / 10) * 10;
      return `${adhTaille} cm (Rec. Taille MAX : ${recMax})`;
    }

    case "Patins":
      return adh.pointure ? `Pointure ${adh.pointure}` : "N/C";

    case "Gants":
      return adh.tailleMainInch ? `${adh.tailleMainInch}"` : "N/C";

    default:
      return adhTaille ? `${adhTaille} cm` : "N/C";
  }
}

// --- GRILLE D'ATTRIBUTION ---
function renderGridSection(equipmentList, containerId, isMandatory) {
  const tbody = document.getElementById(containerId);
  if (!tbody) return;
  tbody.innerHTML = "";

  equipmentList.forEach((eqConfig, index) => {
    const key = isMandatory ? `m_${index}` : `o_${index}`;
    const isOverridden = overrideFilterMap.get(key) || false;
    const measureStr = getFormattedMeasure(eqConfig.type, currentAdherentC2);
    
    const allInStock = (allInventoryCache || []).filter(item => item.type === eqConfig.type && item.statut === "en_stock");
    const suggestedStock = filterInventoryByRule(eqConfig.type, allInStock, currentAdherentC2);
    
    const activeStock = isOverridden ? allInStock : (suggestedStock.length > 0 ? suggestedStock : allInStock);

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";
    tr.innerHTML = `
      <td style="padding: 8px;">
        <strong>${eqConfig.label}</strong><br>
        <small style="color: #666;">Mesure : <strong>${measureStr}</strong></small><br>
        <button type="button" class="btn btn-sm btn-override" 
                style="margin-top: 4px; font-size: 11px; padding: 2px 6px; background-color: ${isOverridden ? '#ef4444' : '#64748b'}; color: white; border: none; border-radius: 4px; cursor: pointer;">
          ${isOverridden ? '🔓 Débrayé (Tout le stock)' : '🔒 Filtré (Suggestion)'}
        </button>
      </td>
      <td style="padding: 8px;">
        <select id="grid-size-${key}" data-type="${eqConfig.type}" style="width: 100%; padding: 5px;">
          <option value="">-- Choisir Taille --</option>
        </select>
      </td>
      <td style="padding: 8px;">
        <select id="grid-model-${key}" data-type="${eqConfig.type}" style="width: 100%; padding: 5px;">
          <option value="">-- Choisir Taille d'abord --</option>
        </select>
      </td>
    `;

    // Attachement propre des événements
    tr.querySelector(".btn-override").onclick = () => toggleOverride(key, isMandatory);
    const sizeSelect = tr.querySelector(`#grid-size-${key}`);
    const modelSelect = tr.querySelector(`#grid-model-${key}`);
    
    sizeSelect.onchange = () => onSizeChange(key, eqConfig.type);
    modelSelect.onchange = () => onGridChange(key);

    tbody.appendChild(tr);
    populateSizesFirst(key, eqConfig.type, activeStock);
  });
}

function toggleOverride(key, isMandatory) {
  const currentState = overrideFilterMap.get(key) || false;
  overrideFilterMap.set(key, !currentState);

  const list = isMandatory ? MANDATORY_EQUIPMENTS : OPTIONAL_EQUIPMENTS;
  const containerId = isMandatory ? "grid-mandatory-body" : "grid-optional-body";

  // 1. Sauvegarde des choix déjà effectués par le bénévole dans la section
  const savedSelections = new Map();
  list.forEach((eq, index) => {
    const k = isMandatory ? `m_${index}` : `o_${index}`;
    const sizeSelect = document.getElementById(`grid-size-${k}`);
    const modelSelect = document.getElementById(`grid-model-${k}`);

    if (sizeSelect || modelSelect) {
      savedSelections.set(k, {
        size: sizeSelect ? sizeSelect.value : "",
        model: modelSelect ? modelSelect.value : ""
      });
    }
  });

  // 2. Régénération du tableau avec le nouvel état (filtré ou débrayé)
  renderGridSection(list, containerId, isMandatory);

  // 3. Restauration des choix précédemment faits
  list.forEach((eqConfig, index) => {
    const k = isMandatory ? `m_${index}` : `o_${index}`;
    const saved = savedSelections.get(k);

    if (saved && saved.size) {
      const sizeSelect = document.getElementById(`grid-size-${k}`);
      if (sizeSelect) {
        sizeSelect.value = saved.size;
        
        // Relance la mise à jour du menu modèle pour cette ligne
        onSizeChange(k, eqConfig.type);

        // Si un modèle était aussi sélectionné, on le réapplique
        if (saved.model) {
          const modelSelect = document.getElementById(`grid-model-${k}`);
          if (modelSelect && Array.from(modelSelect.options).some(opt => opt.value === saved.model)) {
            modelSelect.value = saved.model;
          }
        }
      }
    }
  });

  // 4. Recalcul du compteur d'équipements obligatoires
  updateMandatoryCounter();
}

function populateSizesFirst(key, type, stockItems) {
  const sizeSelect = document.getElementById(`grid-size-${key}`);
  if (!sizeSelect) return;

  sizeSelect.innerHTML = '<option value="">-- Choisir Taille --</option>';

  if (stockItems.length === 0) {
    sizeSelect.innerHTML = '<option value="">-- Indisponible --</option>';
    return;
  }

  const uniqueSizeMap = new Map();
  stockItems.forEach(item => {
    let label = item.taille || "Taille Unique";
    if (item.tailleMax) label += ` (T.Max: ${item.tailleMax}cm)`;
    else if (type === "Crosse") label += " (à couper)";
    
    if (!uniqueSizeMap.has(item.taille)) {
      uniqueSizeMap.set(item.taille, label);
    }
  });

  // Tri des tailles selon les règles YT -> JR -> SR / Numérique / XS -> XL
  const sortedEntries = Array.from(uniqueSizeMap.entries()).sort(([valA], [valB]) => {
    return sortSizes(valA, valB, type);
  });

  sortedEntries.forEach(([sizeValue, labelText]) => {
    const opt = document.createElement("option");
    opt.value = sizeValue;
    opt.textContent = labelText;
    sizeSelect.appendChild(opt);
  });
}

function onSizeChange(key, type) {
  const sizeSelect = document.getElementById(`grid-size-${key}`);
  const modelSelect = document.getElementById(`grid-model-${key}`);
  if (!sizeSelect || !modelSelect) return;

  const selectedSize = sizeSelect.value;
  modelSelect.innerHTML = '<option value="">-- Marque / Modèle --</option>';

  if (!selectedSize) {
    modelSelect.innerHTML = '<option value="">-- Choisir Taille d\'abord --</option>';
    updateMandatoryCounter();
    return;
  }

  const isOverridden = overrideFilterMap.get(key) || false;
  let stock = (allInventoryCache || []).filter(item => item.type === type && item.statut === "en_stock");
  
  if (!isOverridden) {
    const suggested = filterInventoryByRule(type, stock, currentAdherentC2);
    if (suggested.length > 0) stock = suggested;
  }

  const matchingItems = stock.filter(i => String(i.taille) === String(selectedSize));
  const models = [...new Set(matchingItems.map(i => `${i.marque || ''} ${i.modele || ''}`.trim()))].filter(Boolean);

  models.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modelSelect.appendChild(opt);
  });

  if (models.length === 1) {
    modelSelect.value = models[0];
  }

  updateMandatoryCounter();
}

function onGridChange(key) {
  updateMandatoryCounter();
}

function updateMandatoryCounter() {
  let count = 0;
  MANDATORY_EQUIPMENTS.forEach((_, index) => {
    const modelSelect = document.getElementById(`grid-model-m_${index}`);
    const sizeSelect = document.getElementById(`grid-size-m_${index}`);
    if (modelSelect && sizeSelect && modelSelect.value !== "" && sizeSelect.value !== "") {
      count++;
    }
  });

  const badge = document.getElementById("c2-mandatory-counter");
  if (badge) {
    badge.textContent = `Complet : ${count} / ${MANDATORY_EQUIPMENTS.length}`;
    badge.style.backgroundColor = count === MANDATORY_EQUIPMENTS.length ? "#2e7d32" : "#ff9800";
  }
}

async function assignAllEquipment(e) {
  if (e) e.preventDefault();
  if (!currentAdherentC2) return;

  const batch = db.batch();
  let itemsAssignedCount = 0;

  const processList = [
    ...MANDATORY_EQUIPMENTS.map((eq, i) => ({ type: eq.type, key: `m_${i}` })),
    ...OPTIONAL_EQUIPMENTS.map((eq, i) => ({ type: eq.type, key: `o_${i}` }))
  ];

  for (const itemConfig of processList) {
    const modelSelect = document.getElementById(`grid-model-${itemConfig.key}`);
    const sizeSelect = document.getElementById(`grid-size-${itemConfig.key}`);

    if (modelSelect && sizeSelect && modelSelect.value && sizeSelect.value) {
      const selectedModel = modelSelect.value;
      const selectedSize = sizeSelect.value;

      // On trouve le matériel disponible
      const itemToAssign = allInventoryCache.find(eq => {
        const itemModel = `${eq.marque || ''} ${eq.modele || ''}`.trim();
        return eq.type === itemConfig.type &&
               itemModel === selectedModel &&
               String(eq.taille) === String(selectedSize) &&
               eq.statut === "en_stock";
      });

      if (itemToAssign) {
        // Marquage immédiat dans l'objet local pour ne pas ré-attribuer le même article
        itemToAssign.statut = "attribue";

        const eqRef = db.collection("equipment").doc(itemToAssign.id);
        batch.update(eqRef, { statut: "attribue" });

        const loanRef = db.collection("loans").doc();
        batch.set(loanRef, {
        adhId: currentAdherentC2.id,
        // --- Ajout des infos lisibles de l'adhérent ---
        adhNom: currentAdherentC2.nom || "",
        adhPrenom: currentAdherentC2.prenom || "",
        adhCategorie: currentAdherentC2.categorie || "",
        
        // --- Équipement déjà lisible ---
        eqId: itemToAssign.id,
        type: itemToAssign.type,
        marque: itemToAssign.marque || "",
        modele: itemToAssign.modele || "",
        taille: itemToAssign.taille || "",
        statut: "attribue",
        dateRemise: firebase.firestore.FieldValue.serverTimestamp(),
        dateRestitution: null
      });

        itemsAssignedCount++;
      }
    }
  }

  if (itemsAssignedCount === 0) {
    alert("Veuillez sélectionner au moins un équipement complet (Taille + Marque/Modèle).");
    return;
  }

  try {
    await batch.commit();
    await loadInventory();

    renderStockSummaryBandeau();
    renderGridSection(MANDATORY_EQUIPMENTS, "grid-mandatory-body", true);
    renderGridSection(OPTIONAL_EQUIPMENTS, "grid-optional-body", false);
    updateMandatoryCounter();
  } catch (error) {
    console.error("Erreur lors de l'attribution :", error);
    alert("Une erreur est survenue lors de l'enregistrement de l'attribution.");
  }
}

// --- RESTITUTION ET ÉCHANGE DE MATÉRIEL ---
async function returnEquipment(loanId, equipmentId) {
  if (!confirm("Voulez-vous vraiment restituer cet équipement ?")) return;

  const batch = db.batch();

  // 1. Mettre à jour le prêt dans la collection "loans"
  const loanRef = db.collection("loans").doc(loanId);
  batch.update(loanRef, {
    statut: "restitue",
    dateRestitution: firebase.firestore.FieldValue.serverTimestamp()
  });

  // 2. Remettre l'équipement en stock dans la collection "equipment"
  if (equipmentId) {
    const eqRef = db.collection("equipment").doc(equipmentId);
    batch.update(eqRef, {
      statut: "en_stock"
    });
  }

  try {
    await batch.commit();

    // 3. Mettre à jour les vues locales
    await loadInventory();
    renderStockSummaryBandeau();
    renderGridSection(MANDATORY_EQUIPMENTS, "grid-mandatory-body", true);
    renderGridSection(OPTIONAL_EQUIPMENTS, "grid-optional-body", false);
    updateMandatoryCounter();

  } catch (error) {
    console.error("Erreur lors de la restitution de l'équipement :", error);
    alert("Une erreur est survenue lors de la restitution.");
  }
}

async function closeRemiseSession() {
  if (!currentAdherentC2) return;

  try {
    await db.collection("adherents").doc(currentAdherentC2.id).update({
      statut: "Équipé",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert(`Session clôturée pour ${currentAdherentC2.nom || ''} ${currentAdherentC2.prenom || ''}. Statut passé à "Équipé".`);
    
    // Nettoyage de l'écoute Firestore
    if (unsubscribeAssignedEquipment) {
      unsubscribeAssignedEquipment();
      unsubscribeAssignedEquipment = null;
    }

    const workarea = document.getElementById("c2-workarea");
    if (workarea) workarea.style.display = "none";
    currentAdherentC2 = null;
  } catch (error) {
    console.error("Erreur clôture session :", error);
  }
}

// --- ADMIN / IMPORT & EXPORT CSV (PapaParse) ---

function importAdherentsCSV() {
  const fileInput = document.getElementById("csv-adh-file");
  if (!fileInput || !fileInput.files[0]) return alert("Veuillez choisir un fichier CSV.");

  Papa.parse(fileInput.files[0], {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    complete: async (results) => {
      for (const row of results.data) {
        let rawDate = row["Date Naissance"] || row["DateNaissance"] || row["dateNaissance"] || "";
        let formattedDate = formatDateToISO(rawDate);
        
        // Récupère la catégorie du CSV ou la calcule à partir de la date
        let cat = row["Catégorie"] || row["Categorie"] || "";
        if (!cat && formattedDate) {
          cat = calculateCategory(formattedDate);
        }

        const docRef = db.collection("adherents").doc();
        await docRef.set({
          nom: row["Nom"] || "",
          prenom: row["Prénom"] || "",
          dateNaissance: formattedDate,
          categorie: cat,
          email: row["Email"] || row["Adresse mail de contact"] || row["email"] || "",
          tailleCm: Number(row["Taille (cm)"]) || null,
          tourTeteCm: Number(row["Tour de tête (cm)"]) || null,
          tailleMainInch: row["Taille Main(inch)"] || "",
          pointure: row["Pointure"] || "",
          statut: "Nouveau",
          importedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }

      alert(`Importation réussie : ${results.data.length} adhérents ajoutés.`);
    }
  });
}

function formatDateToISO(dateStr) {
  if (!dateStr) return "";
  dateStr = dateStr.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateStr)) {
    const parts = dateStr.split(/[\/\-]/);
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return dateStr;
}

function importInventoryCSV() {
  const fileInput = document.getElementById("csv-eq-file");
  if (!fileInput || !fileInput.files[0]) return alert("Veuillez choisir un fichier CSV.");

  Papa.parse(fileInput.files[0], {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    complete: async (results) => {
      const batch = db.batch();

      results.data.forEach(row => {
        const typeVal = row["Type équipement"] || row["Type equipement"] || row["Type"] || row["type"] || "";
        const marqueVal = row["Marque"] || row["marque"] || "";
        const modeleVal = row["Modèle"] || row["Modele"] || row["modele"] || "";
        const tailleVal = row["Taille"] || row["taille"] || "";
        const tailleEnfantVal = row["Taille enfant"] || row["Taille Enfant"] || row["tailleEnfant"] || "";
        
        // Gestion de Taille Max (conversion numérique)
        const rawTailleMax = row["Taille Max (cm)"] || row["Taille Max"] || row["Taille MAX"] || row["tailleMax"] || row["taille_max"] || "";
        const parsedTailleMax = rawTailleMax !== "" ? Number(rawTailleMax) : null;

        const docRef = db.collection("equipment").doc();
        batch.set(docRef, {
          type: typeVal.trim(),
          marque: marqueVal.trim(),
          modele: modeleVal.trim(),
          taille: tailleVal.trim(),
          tailleEnfant: tailleEnfantVal.trim(),
          tailleMax: parsedTailleMax !== null && !isNaN(parsedTailleMax) ? parsedTailleMax : null,
          statut: "en_stock",
          importedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      alert(`Importation réussie : ${results.data.length} équipements ajoutés.`);
      
      if (typeof loadInventory === "function") {
        await loadInventory();
      }
    }
  });
}

async function exportAdherentsCSV() {
  const snapshot = await db.collection("adherents").get();
  const data = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      "Nom": d.nom || "",
      "Prénom": d.prenom || "",
      "Date Naissance": d.dateNaissance || "",
      "Catégorie": d.categorie || "",
      "Email": d.email || "",
      "Taille (cm)": d.tailleCm || "",
      "Tour de tête (cm)": d.tourTeteCm || "",
      "Taille Main(inch)": d.tailleMainInch || "",
      "Pointure": d.pointure || "",
      "Statut": d.statut || ""
    };
  });

  downloadCSV(data, "export_adherents.csv");
}

async function exportInventoryCSV() {
  try {
    // 1. Récupération simultanée de l'inventaire, des prêts attribués et des adhérents
    const [eqSnapshot, loansSnapshot, adhSnapshot] = await Promise.all([
      db.collection("equipment").get(),
      db.collection("loans").where("statut", "==", "attribue").get(),
      db.collection("adherents").get()
    ]);

    // Dictionnaires pour des recherches rapides O(1)
    const adherentsMap = {};
    adhSnapshot.forEach(doc => {
      adherentsMap[doc.id] = doc.data();
    });

    const loansByEqId = {};
    loansSnapshot.forEach(doc => {
      const loan = doc.data();
      if (loan.eqId) {
        loansByEqId[loan.eqId] = loan.adhId;
      }
    });

    // 2. Construction des lignes pour le CSV
    const data = eqSnapshot.docs.map(doc => {
      const d = doc.data();
      const isAttribue = d.statut === "attribue";
      
      let emailContact = "";
      if (isAttribue) {
        const adhId = loansByEqId[doc.id];
        if (adhId && adherentsMap[adhId]) {
          emailContact = adherentsMap[adhId].email || adherentsMap[adhId].mail || "";
        }
      }

      return {
        "Type": d.type || "",
        "Marque": d.marque || "",
        "Modèle": d.modele || "",
        "Taille": d.taille || "",
        "Taille Max (cm)": d.tailleMax || "",
        "Statut": d.statut || "en_stock",
        "Email Contact": emailContact
      };
    });

    // 3. Horodatage du fichier
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = `${String(now.getHours()).padStart(2, "0")}h${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `export_inventaire_materiel_${dateStr}_${timeStr}.csv`;

    downloadCSV(data, filename);
  } catch (error) {
    console.error("Erreur lors de l'export de l'inventaire :", error);
    alert("Impossible d'exporter l'inventaire.");
  }
}

async function exportLoansCSV() {
  try {
    const [loansSnapshot, adhSnapshot] = await Promise.all([
      db.collection("loans").get(),
      db.collection("adherents").get()
    ]);

    const adherentsMap = {};
    adhSnapshot.forEach(doc => {
      adherentsMap[doc.id] = doc.data();
    });

    const data = loansSnapshot.docs.map(doc => {
      const d = doc.data();

      // Recours à la map d'adhérents si les champs ne sont pas dénormalisés (anciens prêts)
      const fallbackAdh = adherentsMap[d.adhId] || {};
      const nom = d.adhNom || fallbackAdh.nom || "N/C";
      const prenom = d.adhPrenom || fallbackAdh.prenom || "N/C";
      const categorie = d.adhCategorie || fallbackAdh.categorie || "N/C";

      const dateRemise = d.dateRemise && typeof d.dateRemise.toDate === 'function' 
        ? d.dateRemise.toDate().toLocaleDateString("fr-FR") 
        : (d.dateRemise || "");

      const dateRestitution = d.dateRestitution && typeof d.dateRestitution.toDate === 'function' 
        ? d.dateRestitution.toDate().toLocaleDateString("fr-FR") 
        : (d.dateRestitution || "");

      return {
        "ID Prêt": doc.id,
        "Nom Adhérent": nom,
        "Prénom Adhérent": prenom,
        "Catégorie Adhérent": categorie,
        "Type Équipement": d.type || "",
        "Marque": d.marque || "",
        "Modèle": d.modele || "",
        "Taille": d.taille || "",
        "Statut": d.statut || "",
        "Date Remise": dateRemise,
        "Date Restitution": dateRestitution,
        "ID Adhérent (Technique)": d.adhId || "",
        "ID Équipement (Technique)": d.eqId || ""
      };
    });

    if (data.length === 0) {
      return alert("Aucun prêt à exporter.");
    }

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const filename = `export_registre_prets_${dateStr}.csv`;

    downloadCSV(data, filename);
  } catch (error) {
    console.error("Erreur lors de l'export des prêts :", error);
    alert("Impossible d'exporter le registre des prêts.");
  }
}

function downloadCSV(data, filename) {
  const csv = Papa.unparse(data, { delimiter: ";" });
  // Le préfixe \uFEFF force Excel à lire correctement l'UTF-8 avec les accents
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
