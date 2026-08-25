// Variable d'état globale
let currentAdherentC2 = null;
let allInventoryCache = [];
let assignedEquipmentCache = [];

// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  console.log("[DEBUG] Application initialisée.");
  populatePointureOptions();
  listenToQueueC2();
});

// --- GESTION DES ONGLETS ---
function switchTab(tabId, e) {
  console.log(`[DEBUG] Navigation vers l'onglet : ${tabId}`);
  
  // Masque tous les contenus d'onglets
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  
  // Retire le style actif de tous les boutons
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  
  // Affiche l'onglet ciblé
  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.add("active");
  }
  
  // Active le bouton cliqué s'il existe
  if (e && e.currentTarget) {
    e.currentTarget.classList.add("active");
  }
}

function populatePointureOptions() {
  const select = document.getElementById("adh-pointure");
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
  console.log(`[DEBUG] Calcul automatique catégorie pour âge ${age} : ${cat}`);
}

async function onSearchAdherent(query) {
  const listEl = document.getElementById("c1-search-results");
  listEl.innerHTML = "";
  if (query.length < 2) return;

  console.log(`[DEBUG] Recherche adhérent : "${query}"`);
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
  console.log("[DEBUG] Chargement de l'adhérent dans le formulaire:", adh);
  document.getElementById("adh-id").value = adh.id;
  document.getElementById("adh-nom").value = adh.nom || "";
  document.getElementById("adh-prenom").value = adh.prenom || "";
  
  // Formatage garanti YYYY-MM-DD pour le champ type="date"
  const dob = adh.dateNaissance ? formatDateToISO(adh.dateNaissance) : "";
  document.getElementById("adh-dob").value = dob;

  document.getElementById("adh-categorie").value = adh.categorie || "";
  document.getElementById("adh-taille-cm").value = adh.tailleCm || "";
  document.getElementById("adh-tete-cm").value = adh.tourTeteCm || "";
  document.getElementById("adh-main-inch").value = adh.tailleMainInch || "";
  document.getElementById("adh-pointure").value = adh.pointure || "";
  document.getElementById("c1-search-results").innerHTML = "";

  // Déclencher le recalcul automatique de la catégorie si la date est présente
  if (dob) {
    calculateCategory();
  }
}
function resetAdherentForm() {
  console.log("[DEBUG] Réinitialisation du formulaire adhérent.");
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
    console.log(`[DEBUG] Adhérent mis à jour (ID: ${id}) et statut "En attente de matériel"`);
  } else {
    const docRef = await db.collection("adherents").add(payload);
    console.log(`[DEBUG] Nouvel adhérent créé (ID: ${docRef.id}) et envoyé au Comptoir 2`);
  }

  alert("Fiche validée et transmise au Comptoir 2 !");
  resetAdherentForm();
}

// --- COMPTOIR 2 : DISTRIBUTION & ÉCHANGES ---

function listenToQueueC2() {
  console.log("[DEBUG] Écoute temps réel de la file d'attente (Comptoir 2)...");
  db.collection("adherents")
    .where("statut", "==", "En attente de matériel")
    .onSnapshot(snapshot => {
      const queueList = document.getElementById("c2-queue");
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
  console.log("[DEBUG] Adhérent sélectionné au Comptoir 2:", adh);
  currentAdherentC2 = adh;
  document.getElementById("c2-workarea").style.display = "block";
  document.getElementById("c2-adh-fullname").textContent = `${adh.nom} ${adh.prenom}`;
  document.getElementById("c2-adh-cat").textContent = adh.categorie || "N/A";

  document.getElementById("c2-adh-measures").innerHTML = `
    Taille: <b>${adh.tailleCm || '-'} cm</b> | Tête: <b>${adh.tourTeteCm || '-'} cm</b><br>
    Main: <b>${adh.tailleMainInch || '-'}</b> | Pointure: <b>${adh.pointure || '-'}</b>
  `;

  await loadInventory();
  renderAttributionGrid(); // <--- AJOUTER CETTE LIGNE
  listenToAssignedEquipment(adh.id);
}

function listenToAssignedEquipment(adhId) {
  console.log(`[DEBUG] Écoute des équipements attribués à l'adhérent ${adhId}`);
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
  tbody.innerHTML = "";
  
  assignedEquipmentCache.forEach(item => {
    const tr = document.createElement("tr");
    const dateStr = item.dateRemise ? new Date(item.dateRemise.toDate()).toLocaleString("fr-FR") : "-";
    tr.innerHTML = `
      <td>${item.type}</td>
      <td>${item.marque} ${item.modele}</td>
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
  
  // Définition du pack
  const basePack = ["Casque", "Plastron", "Coudières", "Culotte", "Jambières", "Patins", "Sac"];
  if (isEDH) basePack.push("Maillot");
  else basePack.push("Crosse");

  const requiredItems = ["Casque", "Plastron", "Coudières", "Culotte", "Jambières", "Patins"];
  
  const assignedTypes = assignedEquipmentCache.map(i => i.type);
  
  // Progression pack
  const countAssigned = basePack.filter(type => assignedTypes.includes(type)).length;
  const pct = Math.round((countAssigned / basePack.length) * 100);
  document.getElementById("c2-pack-progress").style.width = `${pct}%`;
  document.getElementById("c2-pack-count").textContent = `${countAssigned} / ${basePack.length} pièces attribuées (${pct}%)`;

  // Alertes
  const alertsContainer = document.getElementById("c2-alerts");
  alertsContainer.innerHTML = "";

  // 1. Doublons
  const duplicates = assignedTypes.filter((item, index) => assignedTypes.indexOf(item) !== index);
  if (duplicates.length > 0) {
    alertsContainer.innerHTML += `<div class="alert alert-danger">⚠️ Doublon détecté : ${[...new Set(duplicates)].join(", ")}</div>`;
  }

  // 2. Manquants obligatoires
  const missing = requiredItems.filter(type => !assignedTypes.includes(type));
  if (missing.length > 0) {
    alertsContainer.innerHTML += `<div class="alert alert-warning">⚠️ Équipements obligatoires manquants : ${missing.join(", ")}</div>`;
  }
}

async function loadInventory() {
  console.log("[DEBUG] Chargement complet de l'inventaire matériel...");
  const snapshot = await db.collection("equipment").get();
  allInventoryCache = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// --- NOUVELLE LOGIQUE D'ATTRIBUTION EN GRILLE (8/10 LIGNES) ---

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
        <select id="grid-model-${index}" class="form-control" onchange="onGridModelChange(${index}, '${type}')">
          <option value="">-- Ignorer / Sélectionner --</option>
        </select>
      </td>
      <td>
        <select id="grid-size-${index}" class="form-control" onchange="onGridSizeChange(${index}, '${type}')">
          <option value="">-- Modèle d'abord --</option>
        </select>
      </td>
      <td class="text-center">
        <span id="grid-stock-${index}" class="badge-stock">-</span>
      </td>
    `;
    tbody.appendChild(tr);

    populateGridModels(index, type);
  });
}

function populateGridModels(index, type) {
  const modelSelect = document.getElementById(`grid-model-${index}`);
  if (!modelSelect) return;

  const availableModels = [...new Set(
    allInventoryCache
      .filter(eq => eq.type === type && eq.statut === "en_stock")
      .map(eq => `${eq.marque} | ${eq.modele}`)
  )];

  modelSelect.innerHTML = '<option value="">-- Ignorer / Sélectionner --</option>';
  availableModels.forEach(m => {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    modelSelect.appendChild(opt);
  });
}

function onGridModelChange(index, type) {
  const modelSelect = document.getElementById(`grid-model-${index}`);
  const sizeSelect = document.getElementById(`grid-size-${index}`);
  const stockSpan = document.getElementById(`grid-stock-${index}`);

  const selectedModelStr = modelSelect.value;
  sizeSelect.innerHTML = '<option value="">-- Sélectionner --</option>';
  stockSpan.textContent = "-";

  if (!selectedModelStr) return;

  const [marque, modele] = selectedModelStr.split(" | ");

  const availableSizes = [...new Set(
    allInventoryCache
      .filter(eq => eq.type === type && eq.marque === marque && eq.modele === modele && eq.statut === "en_stock")
      .map(eq => eq.taille)
  )];

  availableSizes.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sizeSelect.appendChild(opt);
  });
}

function onGridSizeChange(index, type) {
  const modelSelect = document.getElementById(`grid-model-${index}`);
  const sizeSelect = document.getElementById(`grid-size-${index}`);
  const stockSpan = document.getElementById(`grid-stock-${index}`);

  const selectedModelStr = modelSelect.value;
  const selectedSize = sizeSelect.value;

  if (!selectedModelStr || !selectedSize) {
    stockSpan.textContent = "-";
    return;
  }

  const [marque, modele] = selectedModelStr.split(" | ");

  const count = allInventoryCache.filter(eq => 
    eq.type === type && 
    eq.marque === marque && 
    eq.modele === modele && 
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
    const modelSelect = document.getElementById(`grid-model-${i}`);
    const sizeSelect = document.getElementById(`grid-size-${i}`);

    if (modelSelect && sizeSelect && modelSelect.value && sizeSelect.value) {
      const [marque, modele] = modelSelect.value.split(" | ");
      const taille = sizeSelect.value;

      const itemToAssign = allInventoryCache.find(eq => 
        eq.type === type && 
        eq.marque === marque && 
        eq.modele === modele && 
        eq.taille === taille && 
        eq.statut === "en_stock"
      );

      if (itemToAssign) {
        const eqRef = db.collection("equipment").doc(itemToAssign.id);
        batch.update(eqRef, { statut: "attribue" });

        const loanRef = db.collection("loans").doc();
        batch.set(loanRef, {
          adhId: currentAdherentC2.id,
          eqId: itemToAssign.id,
          type, marque, modele, taille,
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
    alert("Veuillez sélectionner au moins un équipement complet (Modèle + Taille).");
    return;
  }

  await batch.commit();
  console.log(`[DEBUG] ${itemsAssignedCount} équipements attribués à l'adhérent ${currentAdherentC2.id}`);

  await loadInventory();
  renderAttributionGrid();
}
  if (!itemToAssign) {
    alert("Pièce non disponible en stock.");
    return;
  }

  const batch = db.batch();

  // 1. Passer le matériel en "attribue"
  const eqRef = db.collection("equipment").doc(itemToAssign.id);
  batch.update(eqRef, { statut: "attribue" });

  // 2. Enregistrer la transaction horodatée dans "loans"
  const loanRef = db.collection("loans").doc();
  batch.set(loanRef, {
    adhId: currentAdherentC2.id,
    eqId: itemToAssign.id,
    type, marque, modele, taille,
    statut: "attribue",
    dateRemise: firebase.firestore.FieldValue.serverTimestamp(),
    dateRestitution: null
  });

  await batch.commit();
  console.log(`[DEBUG] Matériel ${itemToAssign.id} attribué à l'adhérent ${currentAdherentC2.id}`);

  document.getElementById("form-attribution").reset();
  document.getElementById("stock-count").textContent = "-";
  await loadInventory();
}

async function returnEquipment(loanId, eqId) {
  console.log(`[DEBUG] Restitution du prêt ${loanId} (Équipement ${eqId})`);
  const batch = db.batch();

  // 1. Remettre l'équipement en stock
  batch.update(db.collection("equipment").doc(eqId), { statut: "en_stock" });

  // 2. Clôturer le prêt horodaté
  batch.update(db.collection("loans").doc(loanId), {
    statut: "restitue",
    dateRestitution: firebase.firestore.FieldValue.serverTimestamp()
  });

  await batch.commit();
  console.log(`[DEBUG] Restitution exécutée. Réactualisation inventaire...`);
  await loadInventory();
}

async function closeRemiseSession() {
  if (!currentAdherentC2) return;
  console.log(`[DEBUG] Clôture session pour l'adhérent ${currentAdherentC2.id}`);

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
  if (!fileInput.files[0]) return alert("Veuillez choisir un fichier CSV.");

  console.log("[DEBUG] Début import CSV Adhérents...");
  Papa.parse(fileInput.files[0], {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(), // Nettoie les espaces invisibles dans les entêtes
    complete: async (results) => {
      console.log(`[DEBUG] CSV Adhérents analysé. ${results.data.length} lignes trouvées.`, results.data);
      const batch = db.collection("adherents");
      
      for (const row of results.data) {
        // Extraction de la date (supporte 'Date Naissance', 'DateNaissance', etc.)
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
      console.log("[DEBUG] Importation adhérents Firestore terminée.");
    }
  });
}

// Fonction utilitaire pour convertir les dates au format YYYY-MM-DD
function formatDateToISO(dateStr) {
  if (!dateStr) return "";
  dateStr = dateStr.trim();

  // Si déjà au format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // Si format DD/MM/YYYY ou DD-MM-YYYY
  if (/^\d{2}[\/\-]\d{2}[\/\-]\d{4}$/.test(dateStr)) {
    const parts = dateStr.split(/[\/\-]/);
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // Si année sur 4 chiffres avec mois/jours simples (ex: 2012-5-9)
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  return dateStr;
}

function importInventoryCSV() {
  const fileInput = document.getElementById("csv-eq-file");
  if (!fileInput.files[0]) return alert("Veuillez choisir un fichier CSV.");

  console.log("[DEBUG] Début import CSV Matériel...");
  Papa.parse(fileInput.files[0], {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      console.log(`[DEBUG] CSV Matériel analysé. ${results.data.length} lignes trouvées.`, results.data);
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
      console.log("[DEBUG] Importation inventaire Firestore terminée.");
    }
  });
}

async function exportAdherentsCSV() {
  console.log("[DEBUG] Exportation Adhérents en CSV...");
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
  console.log("[DEBUG] Exportation Matériel en CSV...");
  const snapshot = await db.collection("equipment").get();
  const data = snapshot.docs.map(doc => {
    const d = doc.data();
    return {
      "Type équipement": d.type,
      "Marque": d.marque,
      "Modèle": d.modele,
      "Taille": d.taille,
      "Taille enfant": d.tailleEnfant,
      "Statut": d.statut
    };
  });

  downloadCSV(data, "export_inventaire_materiel.csv");
}

async function exportLoansCSV() {
  console.log("[DEBUG] Exportation Registre des Prêts en CSV...");
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
  console.log(`[DEBUG] Fichier CSV généré et téléchargé : ${filename}`);
}
