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

// Affiche tous les adhérents triés par nom puis prénom en temps réel (Consultation seule)
// Affiche tous les adhérents triés par nom puis prénom en temps réel (Consultation seule)
function loadAllAdherentsC1() {
  db.collection("adherents")
    .orderBy("nom", "asc")
    .onSnapshot(snapshot => {
      const tbody = document.getElementById("c1-adherents-list-body");
      if (!tbody) return;
      
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Aucun adhérent en base.</td></tr>';
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
        tr.innerHTML = `
          <td><strong>${(adh.nom || "").toUpperCase()}</strong></td>
          <td>${adh.prenom || ""}</td>
          <td>${adh.categorie || "-"}</td>
          <td>${adh.dateNaissance || "-"}</td>
          <td><span class="badge">${adh.statut || "Nouveau"}</span></td>
        `;
        tbody.appendChild(tr);
      });
    });
}

async function saveAndSendToComptoir2(e) {
  e.preventDefault();
  const id = document.getElementById("adh-id").value;
  
  const payload = {
    nom: document.getElementById("adh-nom").value.trim(),
    prenom: document.getElementById("adh-prenom").value.trim(),
    dateNaissance: document.getElementById("adh-dob").value,
    categorie: document.getElementById("adh-categorie").value,
    tailleCm: Number(document.getElementById("adh-taille-cm").value) || null,
    tourTeteCm: Number(document.getElementById("adh-tete-cm").value) || null,
    tailleMainInch: document.getElementById("adh-main-inch").value,
    pointure: document.getElementById("adh-pointure").value,
    statut: "En attente de matériel",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (id) {
    await db.collection("adherents").doc(id).update(payload);
  } else {
    await db.collection("adherents").add(payload);
  }

  alert("Fiche validée et transmise au Comptoir 2 !");
  resetAdherentForm();
}

// --- COMPTOIR 2 : DISTRIBUTION & ÉCHANGES ---

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
        li.innerHTML = `<strong>${adh.nom.toUpperCase()} ${adh.prenom}</strong><br><small>${adh.categorie || ''}</small>`;
        li.onclick = () => selectAdherentC2(adh);
        queueList.appendChild(li);
      });
    });
}

async function selectAdherentC2(adh) {
  currentAdherentC2 = adh;
  const workarea = document.getElementById("c2-workarea");
  if (workarea) workarea.style.display = "block";

  const nameEl = document.getElementById("c2-adh-fullname");
  const catEl = document.getElementById("c2-adh-cat");
  if (nameEl) nameEl.textContent = `${(adh.nom || '').toUpperCase()} ${adh.prenom || ''}`;
  if (catEl) catEl.textContent = adh.categorie || "N/A";

  await loadInventory();
  
  // Génération des deux grilles d'attribution (Obligatoire + Facultatif)
  renderGridSection(MANDATORY_EQUIPMENTS, "grid-mandatory-body", true);
  renderGridSection(OPTIONAL_EQUIPMENTS, "grid-optional-body", false);
  updateMandatoryCounter();

  listenToAssignedEquipment(adh.id);
}

async function loadInventory() {
  const snapshot = await db.collection("equipment").get();
  allInventoryCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function listenToAssignedEquipment(adhId) {
  db.collection("loans")
    .where("adhId", "==", adhId)
    .where("statut", "==", "attribue")
    .onSnapshot(snapshot => {
      assignedEquipmentCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      renderAssignedTable();
      checkPackAndAlerts();
    });
}

function renderAssignedTable() {
  const tbody = document.getElementById("c2-assigned-table");
  if (!tbody) return;
  tbody.innerHTML = "";
  
  assignedEquipmentCache.forEach(item => {
    const tr = document.createElement("tr");
    const dateStr = item.dateRemise ? new Date(item.dateRemise.toDate()).toLocaleString("fr-FR") : "-";
    tr.innerHTML = `
      <td>${item.type}</td>
      <td>${item.marque || ''} ${item.modele || ''}</td>
      <td>${item.taille}</td>
      <td>${dateStr}</td>
      <td><button type="button" class="btn btn-danger" onclick="returnEquipment('${item.id}', '${item.eqId}')">Échanger / Restituer</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function checkPackAndAlerts() {
  if (!currentAdherentC2) return;

  const requiredItems = ["Casque", "Plastron", "Coudières", "Gants", "Culotte", "Jambières", "Patins"];
  const assignedTypes = assignedEquipmentCache.map(i => i.type);
  
  const alertsContainer = document.getElementById("c2-alerts");
  if (!alertsContainer) return;
  alertsContainer.innerHTML = "";

  const duplicates = assignedTypes.filter((item, index) => assignedTypes.indexOf(item) !== index);
  if (duplicates.length > 0) {
    alertsContainer.innerHTML += `<div class="alert alert-danger" style="color:red; font-weight:bold; margin-bottom:10px;">⚠️ Doublon détecté : ${[...new Set(duplicates)].join(", ")}</div>`;
  }

  const missing = requiredItems.filter(type => !assignedTypes.includes(type));
  if (missing.length > 0) {
    alertsContainer.innerHTML += `<div class="alert alert-warning" style="color:#b78103; font-weight:bold; margin-bottom:10px;">⚠️ Équipements obligatoires manquants en fiche : ${missing.join(", ")}</div>`;
  }
}

async function returnEquipment(loanId, eqId) {
  if (!confirm("Voulez-vous vraiment échanger ou restituer cet équipement ?")) return;

  const batch = db.batch();
  
  const loanRef = db.collection("loans").doc(loanId);
  batch.update(loanRef, {
    statut: "restitue",
    dateRestitution: firebase.firestore.FieldValue.serverTimestamp()
  });

  const eqRef = db.collection("equipment").doc(eqId);
  batch.update(eqRef, { statut: "en_stock" });

  await batch.commit();
  await loadInventory();

  // Rafraîchit les sélecteurs de grille
  renderGridSection(MANDATORY_EQUIPMENTS, "grid-mandatory-body", true);
  renderGridSection(OPTIONAL_EQUIPMENTS, "grid-optional-body", false);
  updateMandatoryCounter();
}

// --- LOGIQUE D'ATTRIBUTION PAR TABLEAU COMPTOIR 2 ---

function getFormattedMeasure(type, adh) {
  if (!adh) return "N/C";
  switch (type) {
    case "Casque":
      return adh.tourTeteCm ? `${adh.tourTeteCm} cm` : "N/C";
    case "Patins":
      return adh.pointure ? `${adh.pointure}` : "N/C";
    case "Gants":
      return adh.tailleMainInch ? `${adh.tailleMainInch}"` : "N/C";
    case "Crosse":
    case "Sac":
      return "N/C";
    default:
      // Plastron, Coudières, Culotte, Jambières, Maillot
      return adh.tailleCm ? `${(adh.tailleCm / 100).toFixed(2).replace('.', ',')} m` : "N/C";
  }
}

function renderGridSection(equipmentList, containerId, isMandatory) {
  const tbody = document.getElementById(containerId);
  if (!tbody) return;
  tbody.innerHTML = "";

  equipmentList.forEach((eqConfig, index) => {
    const key = isMandatory ? `m_${index}` : `o_${index}`;
    const measureStr = getFormattedMeasure(eqConfig.type, currentAdherentC2);
    
    // Équipements disponibles
    const itemsInStock = (allInventoryCache || []).filter(item => item.type === eqConfig.type && item.statut === "en_stock");
    
    // Marques et modèles uniques
    const models = [...new Set(itemsInStock.map(i => `${i.marque || ''} ${i.modele || ''}`.trim()))].filter(Boolean);

    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #eee";
    tr.innerHTML = `
      <td style="padding: 8px;">
        <strong>${eqConfig.label}</strong><br>
        <small style="color: #666;">Mesure : <strong>${measureStr}</strong></small>
      </td>
      <td style="padding: 8px;">
        <select id="grid-model-${key}" data-type="${eqConfig.type}" onchange="onGridChange('${key}')" style="width: 100%; padding: 5px;">
          <option value="">-- Marque / Modèle --</option>
          ${models.map(m => `<option value="${m}">${m}</option>`).join('')}
        </select>
      </td>
      <td style="padding: 8px;">
        <select id="grid-size-${key}" data-type="${eqConfig.type}" onchange="onGridChange('${key}')" style="width: 100%; padding: 5px;">
          <option value="">-- Taille --</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);

    populateSizesSimple(key, eqConfig.type);
  });
}

function populateSizesSimple(key, type) {
  const sizeSelect = document.getElementById(`grid-size-${key}`);
  if (!sizeSelect) return;

  const itemsInStock = (allInventoryCache || []).filter(item => item.type === type && item.statut === "en_stock");
  const sizes = [...new Set(itemsInStock.map(item => item.taille))].filter(Boolean);

  // Tri naturel des tailles (numérique puis alphabétique)
  sizes.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' }));

  sizeSelect.innerHTML = '<option value="">-- Taille --</option>';
  sizes.forEach(size => {
    const opt = document.createElement("option");
    opt.value = size;
    opt.textContent = size;
    sizeSelect.appendChild(opt);
  });
}

function onGridChange(key) {
  // Met simplement à jour le compteur d'équipements obligatoires sélectionnés
  updateMandatoryCounter();
}

function updateMandatoryCounter() {
  let count = 0;
  MANDATORY_EQUIPMENTS.forEach((_, index) => {
    const sizeSelect = document.getElementById(`grid-size-m_${index}`);
    if (sizeSelect && sizeSelect.value !== "") {
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
  e.preventDefault();
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

      const itemToAssign = allInventoryCache.find(eq => {
        const itemModel = `${eq.marque || ''} ${eq.modele || ''}`.trim();
        return eq.type === itemConfig.type &&
               itemModel === selectedModel &&
               String(eq.taille) === String(selectedSize) &&
               eq.statut === "en_stock";
      });

      if (itemToAssign) {
        const eqRef = db.collection("equipment").doc(itemToAssign.id);
        batch.update(eqRef, { statut: "attribue" });

        const loanRef = db.collection("loans").doc();
        batch.set(loanRef, {
          adhId: currentAdherentC2.id,
          eqId: itemToAssign.id,
          type: itemToAssign.type,
          marque: itemToAssign.marque || "",
          modele: itemToAssign.modele || "",
          taille: itemToAssign.taille,
          statut: "attribue",
          dateRemise: firebase.firestore.FieldValue.serverTimestamp(),
          dateRestitution: null
        });

        itemToAssign.statut = "attribue";
        itemsAssignedCount++;
      }
    }
  }

  if (itemsAssignedCount === 0) {
    alert("Veuillez sélectionner au moins un équipement complet (Marque/Modèle + Taille).");
    return;
  }

  await batch.commit();
  await loadInventory();

  // Réinitialise la grille et met à jour
  renderGridSection(MANDATORY_EQUIPMENTS, "grid-mandatory-body", true);
  renderGridSection(OPTIONAL_EQUIPMENTS, "grid-optional-body", false);
  updateMandatoryCounter();
}

async function closeRemiseSession() {
  if (!currentAdherentC2) return;

  await db.collection("adherents").doc(currentAdherentC2.id).update({
    statut: "Équipé",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert(`Session clôturée pour ${currentAdherentC2.nom} ${currentAdherentC2.prenom}. Statut passé à "Équipé".`);
  const workarea = document.getElementById("c2-workarea");
  if (workarea) workarea.style.display = "none";
  currentAdherentC2 = null;
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

        const docRef = db.collection("equipment").doc();
        batch.set(docRef, {
          type: typeVal.trim(),
          marque: marqueVal.trim(),
          modele: modeleVal.trim(),
          taille: tailleVal.trim(),
          tailleEnfant: tailleEnfantVal.trim(),
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
      "Email": d.email || "", // <-- Nouveau champ ajouté ici
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
  const [equipmentSnap, loansSnap, adherentsSnap] = await Promise.all([
    db.collection("equipment").get(),
    db.collection("loans").where("statut", "==", "attribue").get(),
    db.collection("adherents").get()
  ]);

  const adherentsMap = new Map();
  adherentsSnap.docs.forEach(doc => {
    adherentsMap.set(doc.id, doc.data());
  });

  const equipmentAssigneeMap = new Map();
  loansSnap.docs.forEach(doc => {
    const loan = doc.data();
    const adh = adherentsMap.get(loan.adhId);
    if (adh && loan.eqId) {
      equipmentAssigneeMap.set(loan.eqId, `${adh.nom.toUpperCase()} ${adh.prenom}`);
    }
  });

  const data = equipmentSnap.docs.map(doc => {
    const d = doc.data();
    const attribueA = d.statut === "attribue" 
      ? (equipmentAssigneeMap.get(doc.id) || "Adhérent non trouvé") 
      : "-";

    return {
      "ID Équipement": doc.id,
      "Type équipement": d.type,
      "Marque": d.marque,
      "Modèle": d.modele,
      "Taille": d.taille,
      "Taille enfant": d.tailleEnfant || "",
      "Statut": d.statut === "attribue" ? "Attribué" : "En stock",
      "Attribué à": attribueA
    };
  });

  downloadCSV(data, "export_inventaire_materiel.csv");
}

async function exportLoansCSV() {
  const snapshot = await db.collection("loans").get();
  const data = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      "ID Prêt": doc.id,
      "ID Adhérent": d.adhId,
      "ID Équipement": d.eqId,
      "Type": d.type,
      "Marque": d.marque,
      "Modèle": d.modele,
      "Taille": d.taille,
      "Statut": d.statut,
      "Date Remise": d.dateRemise ? new Date(d.dateRemise.toDate()).toISOString() : "",
      "Date Restitution": d.dateRestitution ? new Date(d.dateRestitution.toDate()).toISOString() : ""
    };
  });

  downloadCSV(data, "export_registre_prets_horodate.csv");
}

function downloadCSV(data, filename) {
  const csv = Papa.unparse(data, { delimiter: ";" });
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
