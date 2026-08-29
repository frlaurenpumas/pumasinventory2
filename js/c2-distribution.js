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

        // Récupération du bénévole connecté
        const user = firebase.auth().currentUser;
        const benevoleEmail = user ? user.email : "Inconnu";
        const benevoleName = user ? (user.displayName || user.email) : "Inconnu";

        const loanRef = db.collection("loans").doc(); 
        batch.set(loanRef, { 
          adhId: currentAdherentC2.id, 
          // --- Ajout des infos lisibles de l'adhérent --- 
          adhNom: currentAdherentC2.nom || "", 
          adhPrenom: currentAdherentC2.prenom || "", 
          adhCategorie: currentAdherentC2.categorie || "", 
          
          // --- Traçabilité Bénévole / Opérateur ---
          benevoleEmail: benevoleEmail,
          benevoleName: benevoleName,

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
