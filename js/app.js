// Variable d'état globale
let currentAdherentC2 = null;
let allInventoryCache = [];
let assignedEquipmentCache = [];
let showAllSizesOverride = false; // Option de débrayage

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  console.log("[DEBUG] Application initialisée.");
  populatePointureOptions();
  listenToQueueC2();
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

function calculateCategory() {
  const dobInput = document.getElementById("adh-dob").value;
  if (!dobInput) return;

  const birthYear = new Date(dobInput).getFullYear();
  const currentYear = new Date().getFullYear();
  const age = currentYear - birthYear;
  
  let cat = "";
  if (age >= 4 && age <= 5) cat = "EDH";
  else if (age <= 7) cat = "U7";
  else if (age <= 9) cat = "U9";
  else if (age <= 11) cat = "U11";
  else if (age <= 13) cat = "U13";
  else if (age <= 15) cat = "U15";
  else if (age <= 18) cat = "U18";
  else cat = "Sénior";

  document.getElementById("adh-categorie").value = cat;
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
  document.getElementById("c2-workarea").style.display = "block";
  document.getElementById("c2-adh-fullname").textContent = `${adh.nom} ${adh.prenom}`;
  document.getElementById("c2-adh-cat").textContent = adh.categorie || "N/A";

  document.getElementById("c2-adh-measures").innerHTML = `
    Taille: <b>${adh.tailleCm || '-'} cm</b> | Tête: <b>${adh.tourTeteCm || '-'} cm</b><br>
    Main: <b>${adh.tailleMainInch || '-'}</b> | Pointure: <b>${adh.pointure || '-'}</b>
  `;

  await loadInventory();
  renderAttributionGrid();
  listenToAssignedEquipment(adh.id);
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
      <td><button class="btn btn-danger" onclick="returnEquipment('${item.id}', '${item.eqId}')">Échanger / Restituer</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function checkPackAndAlerts() {
  if (!currentAdherentC2) return;
  const isEDH = currentAdherentC2.categorie === "EDH";
  
  const basePack = ["Casque", "Plastron", "Coudières", "Culotte", "Jambières", "Patins", "Sac"];
  if (isEDH) basePack.push("Maillot");
  else basePack.push("Crosse");

  const requiredItems = ["Casque", "Plastron", "Coudières", "Culotte", "Jambières", "Patins"];
  
  const assignedTypes = assignedEquipmentCache.map(i => i.type);
  
  const countAssigned = basePack.filter(type => assignedTypes.includes(type)).length;
  const pct = Math.round((countAssigned / basePack.length) * 100);
  document.getElementById("c2-pack-progress").style.width = `${pct}%`;
  document.getElementById("c2-pack-count").textContent = `${countAssigned} / ${basePack.length} pièces attribuées (${pct}%)`;

  const alertsContainer = document.getElementById("c2-alerts");
  alertsContainer.innerHTML = "";

  const duplicates = assignedTypes.filter((item, index) => assignedTypes.indexOf(item) !== index);
  if (duplicates.length > 0) {
    alertsContainer.innerHTML += `<div class="alert alert-danger">⚠️ Doublon détecté : ${[...new Set(duplicates)].join(", ")}</div>`;
  }

  const missing = requiredItems.filter(type => !assignedTypes.includes(type));
  if (missing.length > 0) {
    alertsContainer.innerHTML += `<div class="alert alert-warning">⚠️ Équipements obligatoires manquants : ${missing.join(", ")}</div>`;
  }
}

async function loadInventory() {
  const snapshot = await db.collection("equipment").get();
  allInventoryCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- LOGIQUE D'ATTRIBUTION PAR TAILLE ENFANT ---

const EQUIPMENT_TYPES = [
  "Casque",
  "Plastron",
  "Coudières",
  "Gants",
  "Culotte",
  "Jambières",
  "Patins",
  "Crosse",
  "Maillot",
  "Sac"
];

// Extrait min et max d'une chaîne du type "110-120"
function parseTailleEnfantRange(tailleStr) {
  if (!tailleStr) return null;
  const cleanStr = String(tailleStr).replace(/\s+/g, '');
  const parts = cleanStr.split("-").map(Number);
  
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  } else if (parts.length === 1 && !isNaN(parts[0])) {
    return { min: parts[0], max: parts[0] };
  }
  return null;
}

// Sélectionne la bonne valeur de mesure de l'adhérent selon le type d'équipement
function getAdherentMeasureForType(type, adh) {
  if (!adh) return null;
  switch (type) {
    case "Casque":
      return adh.tourTeteCm ? Number(adh.tourTeteCm) : null;
    case "Patins":
      return adh.pointure ? Number(adh.pointure) : null;
    case "Gants":
    case "Crosse":
      return adh.tailleMainInch ? Number(adh.tailleMainInch) : null;
    default:
      // Plastron, Coudières, Culotte, Jambières, Maillot, Sac...
      return adh.tailleCm ? Number(adh.tailleCm) : null;
  }
}

function toggleShowAllSizes(checkbox) {
  showAllSizesOverride = checkbox.checked;
  renderAttributionGrid();
}

function renderAttributionGrid() {
  const tbody = document.getElementById("grid-attribution-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  EQUIPMENT_TYPES.forEach((type, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <strong>${type}</strong>
        <input type="hidden" name="type_${index}" value="${type}">
      </td>
      <td>
        <select id="grid-size-${index}" class="form-control" onchange="onGridSizeChange(${index}, '${type}')">
          <option value="">-- Sélectionner une taille --</option>
        </select>
      </td>
      <td class="text-center">
        <span id="grid-stock-${index}" class="badge-stock">-</span>
      </td>
    `;
    tbody.appendChild(tr);

    populateGridSizes(index, type);
  });
}

function populateGridSizes(index, type) {
  const sizeSelect = document.getElementById(`grid-size-${index}`);
  if (!sizeSelect) return;

  const measure = getAdherentMeasureForType(type, currentAdherentC2);

  // Filtrage du matériel disponible en stock
  const inStockEquipment = allInventoryCache.filter(eq => eq.type === type && eq.statut === "en_stock");

  // Regroupement des tailles disponibles
  const availableSizes = [...new Set(inStockEquipment.map(eq => eq.taille))].filter(Boolean);

  sizeSelect.innerHTML = '<option value="">-- Sélectionner une taille --</option>';

  let recommendedCount = 0;

  availableSizes.forEach(taille => {
    // Vérifier si au moins une pièce de cette taille correspond au critère min <= mesure < max
    const isRecommended = inStockEquipment.some(eq => {
      if (eq.taille !== taille) return false;
      
      const range = parseTailleEnfantRange(eq.tailleEnfant);
      if (!range || measure === null) return true; // Si pas d'info de plage, on l'affiche par précaution

      return measure >= range.min && measure < range.max;
    });

    if (isRecommended) recommendedCount++;

    // On affiche l'option si elle est recommandée OU si l'option de débrayage est activée
    if (isRecommended || showAllSizesOverride) {
      const opt = document.createElement("option");
      opt.value = taille;
      opt.textContent = isRecommended ? `${taille} (Préconisé)` : `${taille} (Hors plage)`;
      if (isRecommended) opt.style.fontWeight = "bold";
      sizeSelect.appendChild(opt);
    }
  });

  if (recommendedCount === 0 && !showAllSizesOverride && availableSizes.length > 0) {
    const opt = document.createElement("option");
    opt.disabled = true;
    opt.textContent = "Aucune taille préconisée en stock (Cocher 'Afficher tout')";
    sizeSelect.appendChild(opt);
  }
}

function onGridSizeChange(index, type) {
  const sizeSelect = document.getElementById(`grid-size-${index}`);
  const stockSpan = document.getElementById(`grid-stock-${index}`);
  const selectedSize = sizeSelect.value;

  if (!selectedSize) {
    stockSpan.textContent = "-";
    return;
  }

  const count = allInventoryCache.filter(eq => 
    eq.type === type && 
    eq.taille === selectedSize && 
    eq.statut === "en_stock"
  ).length;

  stockSpan.textContent = `${count} dispo`;
}

async function assignAllEquipment(e) {
  e.preventDefault();
  if (!currentAdherentC2) return;

  const batch = db.batch();
  let itemsAssignedCount = 0;

  for (let i = 0; i < EQUIPMENT_TYPES.length; i++) {
    const type = EQUIPMENT_TYPES[i];
    const sizeSelect = document.getElementById(`grid-size-${i}`);

    if (sizeSelect && sizeSelect.value) {
      const selectedSize = sizeSelect.value;

      // Recherche du premier équipement disponible correspondant au type et à la taille
      const itemToAssign = allInventoryCache.find(eq => 
        eq.type === type && 
        eq.taille === selectedSize && 
        eq.statut === "en_stock"
      );

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
    alert("Veuillez sélectionner au moins une taille d'équipement.");
    return;
  }

  await batch.commit();
  await loadInventory();
  renderAttributionGrid();
}

async function returnEquipment(loanId, eqId) {
  const batch = db.batch();

  batch.update(db.collection("equipment").doc(eqId), { statut: "en_stock" });

  batch.update(db.collection("loans").doc(loanId), {
    statut: "restitue",
    dateRestitution: firebase.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();
  await loadInventory();
}

async function closeRemiseSession() {
  if (!currentAdherentC2) return;

  await db.collection("adherents").doc(currentAdherentC2.id).update({
    statut: "Équipé",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert(`Session clôturée pour ${currentAdherentC2.nom} ${currentAdherentC2.prenom}. Statut passé à "Équipé".`);
  document.getElementById("c2-workarea").style.display = "none";
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

        const docRef = db.collection("adherents").doc();
        await docRef.set({
          nom: row["Nom"] || "",
          prenom: row["Prénom"] || "",
          dateNaissance: formattedDate,
          categorie: row["Catégorie"] || "",
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
    complete: async (results) => {
      const batch = db.batch();

      results.data.forEach(row => {
        const docRef = db.collection("equipment").doc();
        batch.set(docRef, {
          type: row["Type équipement"] || "",
          marque: row["Marque"] || "",
          modele: row["Modèle"] || "",
          taille: row["Taille"] || "",
          tailleEnfant: row["Taille enfant"] || "",
          statut: "en_stock",
          importedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      await batch.commit();
      alert(`Importation réussie : ${results.data.length} équipements ajoutés.`);
    }
  });
}

async function exportAdherentsCSV() {
  const snapshot = await db.collection("adherents").get();
  const data = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      "Nom": d.nom,
      "Prénom": d.prenom,
      "Date Naissance": d.dateNaissance,
      "Catégorie": d.categorie,
      "Taille (cm)": d.tailleCm,
      "Tour de tête (cm)": d.tourTeteCm,
      "Taille Main(inch)": d.tailleMainInch,
      "Pointure": d.pointure,
      "Statut": d.statut
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
