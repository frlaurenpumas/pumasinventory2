/**
 * Module de gestion du Réassort et des Sorties d'inventaire
 */

// Variable globale pour stocker temporairement les données CSV analysées
let parsedCSVData = [];

// Remplit le select d'équipement à partir de state.js
function populateReassortEquipmentSelect() {
  const select = document.getElementById("eq-type");
  if (!select) return;

  // Réinitialisation
  select.innerHTML = '<option value="">-- Choisir --</option>';

  // Groupe 1 : Obligatoires
  if (typeof MANDATORY_EQUIPMENTS !== "undefined") {
    const optGroupMandatory = document.createElement("optgroup");
    optGroupMandatory.label = "Équipements obligatoires";

    MANDATORY_EQUIPMENTS.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.type;
      opt.textContent = item.label;
      optGroupMandatory.appendChild(opt);
    });
    select.appendChild(optGroupMandatory);
  }

  // Groupe 2 : Optionnels
  if (typeof OPTIONAL_EQUIPMENTS !== "undefined") {
    const optGroupOptional = document.createElement("optgroup");
    optGroupOptional.label = "Équipements optionnels";

    OPTIONAL_EQUIPMENTS.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.type;
      opt.textContent = item.label;
      optGroupOptional.appendChild(opt);
    });
    select.appendChild(optGroupOptional);
  }
}

// Adaptation dynamique du formulaire selon le type d'équipement choisi
function setupDynamicFormFields() {
  const selectType = document.getElementById("eq-type");
  const inputTailleMax = document.getElementById("eq-taille-max");
  
  if (!selectType || !inputTailleMax) return;

  selectType.addEventListener("change", (e) => {
    const typeVal = e.target.value;
    const needsTailleMax = ["Casque", "Plastron", "Coudières", "Culotte", "Jambières", "Crosse"].includes(typeVal);

    if (!needsTailleMax) {
      inputTailleMax.value = "";
      inputTailleMax.disabled = true;
      if (inputTailleMax.parentElement) {
        inputTailleMax.parentElement.style.opacity = "0.4";
      }
    } else {
      inputTailleMax.disabled = false;
      if (inputTailleMax.parentElement) {
        inputTailleMax.parentElement.style.opacity = "1";
      }
    }
  });
}

// Lancement au chargement du DOM
document.addEventListener("DOMContentLoaded", () => {
  populateReassortEquipmentSelect();
  setupDynamicFormFields();
});


// --- 1. ENTRÉE DE MATÉRIEL (Ajout unitaire) ---
async function handleAddSingleEquipment(event) {
  event.preventDefault();

  const btnSubmit = document.getElementById("btn-save-eq");
  const feedback = document.getElementById("reassort-feedback");
  
  // Récupération des valeurs du formulaire
  const typeVal = document.getElementById("eq-type")?.value || "";
  const marqueVal = document.getElementById("eq-marque")?.value.trim() || "";
  const modeleVal = document.getElementById("eq-modele")?.value.trim() || "";
  const tailleVal = document.getElementById("eq-taille")?.value.trim() || "";
  
  const rawTailleMax = document.getElementById("eq-taille-max")?.value.trim() || "";
  const parsedTailleMax = rawTailleMax !== "" ? Number(rawTailleMax) : null;
  const tailleEnfantVal = document.getElementById("eq-taille-enfant")?.value.trim() || "";
  const provenanceVal = document.getElementById("eq-provenance")?.value || "Achat";

  // Contrôle préventif du type
  if (!typeVal) {
    if (feedback) {
      feedback.innerText = "⚠️ Veuillez sélectionner un type d'équipement.";
      feedback.className = "feedback-msg danger";
    }
    return;
  }

  // Vérification préventive pour tailleMax (équipements sur stature en cm)
  const needsTailleMax = ["Casque", "Plastron", "Coudières", "Culotte", "Jambières", "Crosse"].includes(typeVal);
  
  if (needsTailleMax && (parsedTailleMax === null || isNaN(parsedTailleMax))) {
    const confirmNoMax = confirm(
      `Attention : Vous n'avez pas renseigné la "Taille MAX (cm)" pour cet équipement (${typeVal}).\n\nSans cette valeur, il ne pourra pas être recommandé automatiquement au comptoir. Voulez-vous enregistrer quand même ?`
    );
    if (!confirmNoMax) return;
  }

  if (btnSubmit) btnSubmit.disabled = true;
  if (feedback) {
    feedback.innerText = "Enregistrement en cours...";
    feedback.className = "feedback-msg info";
  }

  try {
    // Récupération du bénévole connecté via Firebase Auth
    const user = firebase.auth().currentUser;
    const benevoleEmail = user ? user.email : "Inconnu";
    
    const newEquipment = {
      type: typeVal,
      marque: marqueVal,
      modele: modeleVal,
      taille: tailleVal,
      tailleEnfant: tailleEnfantVal,
      tailleMax: parsedTailleMax !== null && !isNaN(parsedTailleMax) ? parsedTailleMax : null,
      provenance: provenanceVal,
      
      statut: "en_stock",
      createdByEmail: benevoleEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Ajout dans la collection "equipment"
    const docRef = await db.collection("equipment").add(newEquipment);

    if (feedback) {
      feedback.innerText = `✅ Équipement ajouté (ID: ${docRef.id})`;
      feedback.className = "feedback-msg success";
    }

    // Remise à zero explicite du formulaire
    const form = document.getElementById("add-equipment-form");
    if (form) {
      form.reset();
      form.querySelectorAll("input[type='text'], input[type='number'], textarea").forEach(input => {
        input.value = "";
      });
      form.querySelectorAll("select").forEach(select => {
        select.selectedIndex = 0;
      });
    }

    // Réinitialisation de l'affichage de tailleMax
    const inputTailleMax = document.getElementById("eq-taille-max");
    if (inputTailleMax) {
      inputTailleMax.disabled = false;
      if (inputTailleMax.parentElement) inputTailleMax.parentElement.style.opacity = "1";
    }

    if (typeof loadInventory === "function") {
      await loadInventory();
    }

  } catch (error) {
    console.error("Erreur lors de l'ajout de l'équipement :", error);
    if (feedback) {
      feedback.innerText = "❌ Erreur lors de l'enregistrement.";
      feedback.className = "feedback-msg danger";
    }
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}

// --- 2. SORTIE DE MATÉRIEL (Mise au rebut, perte, revente) ---
async function handleRemoveEquipment(event) {
  event.preventDefault();

  const btnSubmit = document.getElementById("btn-remove-eq");
  const feedback = document.getElementById("remove-feedback");
  const eqId = document.getElementById("remove-eq-id")?.value.trim() || "";
  const motif = document.getElementById("remove-motif")?.value || "hors_service";

  if (!eqId) {
    if (feedback) {
      feedback.innerText = "⚠️ Veuillez renseigner un ID d'équipement valide.";
      feedback.className = "feedback-msg danger";
    }
    return;
  }

  if (btnSubmit) btnSubmit.disabled = true;
  if (feedback) {
    feedback.innerText = "Mise à jour en cours...";
    feedback.className = "feedback-msg info";
  }

  try {
    const user = firebase.auth().currentUser;
    const benevoleEmail = user ? user.email : "Inconnu";
    
    const eqRef = db.collection("equipment").doc(eqId);
    const docSnap = await eqRef.get();

    if (!docSnap.exists) {
      if (feedback) {
        feedback.innerText = "❌ Équipement introuvable avec cet ID.";
        feedback.className = "feedback-msg danger";
      }
      if (btnSubmit) btnSubmit.disabled = false;
      return;
    }

    await eqRef.update({
      statut: motif,
      updatedByEmail: benevoleEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (feedback) {
      feedback.innerText = `✅ Équipement ${eqId} marqué comme "${motif}".`;
      feedback.className = "feedback-msg success";
    }

    const form = document.getElementById("remove-equipment-form");
    if (form) form.reset();

    if (typeof loadInventory === "function") {
      await loadInventory();
    }

  } catch (error) {
    console.error("Erreur lors de la sortie de matériel :", error);
    if (feedback) {
      feedback.innerText = "❌ Erreur lors de la mise à jour.";
      feedback.className = "feedback-msg danger";
    }
  } finally {
    if (btnSubmit) btnSubmit.disabled = false;
  }
}


// --- 3. RÉASSORT EN MASSE (IMPORT CSV) ---

// Sélection et lecture du fichier CSV
function handleCSVFileSelect(event) {
  const file = event.target.files[0];
  const fileNameLabel = document.getElementById("csv-file-name");
  const previewContainer = document.getElementById("csv-preview-container");

  if (!file) {
    if (fileNameLabel) fileNameLabel.textContent = "Aucun fichier sélectionné";
    if (previewContainer) previewContainer.style.display = "none";
    return;
  }

  if (fileNameLabel) fileNameLabel.textContent = file.name;

  const reader = new FileReader();
  reader.onload = function(e) {
    const content = e.target.result;
    parsedCSVData = parseCSVContent(content);
    renderCSVPreview(parsedCSVData);
  };
  reader.readAsText(file, "UTF-8");
}

// Parsing du fichier CSV (Colonnes: Equipement, Marque, Modèle, Taille, Taille constructeur, Taille Max, Quantité)
function parseCSVContent(csvText) {
  const lines = csvText.split(/\r\n|\n/);
  const result = [];
  if (lines.length < 2) return result;

  // Détection automatique du séparateur (, ou ;)
  const separator = lines[0].includes(";") ? ";" : ",";
  
  // Normalisation des en-têtes (minuscules sans espaces superflus)
  const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());

  // Recherche des index de colonnes
  const idxEquipement = headers.findIndex(h => h.includes("equipement") || h.includes("équipement") || h === "type");
  const idxMarque = headers.findIndex(h => h.includes("marque"));
  const idxModele = headers.findIndex(h => h.includes("modele") || h.includes("modèle"));
  const idxTaille = headers.findIndex(h => h === "taille");
  const idxTailleEnfant = headers.findIndex(h => h.includes("constructeur") || h.includes("enfant"));
  const idxTailleMax = headers.findIndex(h => h.includes("max"));
  const idxQuantite = headers.findIndex(h => h.includes("quantite") || h.includes("quantité") || h === "qte");

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(separator).map(v => v.trim());
    
    const typeVal = idxEquipement !== -1 ? values[idxEquipement] : "";
    const quantiteVal = idxQuantite !== -1 ? parseInt(values[idxQuantite], 10) : 1;

    if (typeVal) {
      result.push({
        type: typeVal,
        marque: idxMarque !== -1 ? values[idxMarque] : "",
        modele: idxModele !== -1 ? values[idxModele] : "",
        taille: idxTaille !== -1 ? values[idxTaille] : "Taille Unique",
        tailleEnfant: idxTailleEnfant !== -1 ? values[idxTailleEnfant] : "",
        tailleMax: idxTailleMax !== -1 && values[idxTailleMax] ? Number(values[idxTailleMax]) : null,
        quantite: isNaN(quantiteVal) || quantiteVal < 1 ? 1 : quantiteVal
      });
    }
  }

  return result;
}

// Affichage du tableau d'aperçu
function renderCSVPreview(data) {
  const tbody = document.getElementById("csv-preview-body");
  const countEl = document.getElementById("csv-count");
  const container = document.getElementById("csv-preview-container");

  if (!tbody || !container) return;

  tbody.innerHTML = "";
  if (countEl) countEl.textContent = data.length;

  if (data.length === 0) {
    alert("Le fichier CSV est vide ou le format des en-têtes est incorrect.");
    container.style.display = "none";
    return;
  }

  data.forEach(item => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid #f1f5f9";
    tr.innerHTML = `
      <td style="padding: 6px 8px;">${item.type}</td>
      <td style="padding: 6px 8px;">${item.marque}</td>
      <td style="padding: 6px 8px;">${item.modele}</td>
      <td style="padding: 6px 8px;">${item.taille}</td>
      <td style="padding: 6px 8px;">${item.tailleEnfant || '-'}</td>
      <td style="padding: 6px 8px;">${item.tailleMax ? item.tailleMax + ' cm' : '-'}</td>
      <td style="padding: 6px 8px;"><strong>${item.quantite}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  container.style.display = "block";
}

// Injection en masse Firestore (par lots)
async function processCSVImportReassort() {
  if (!parsedCSVData || parsedCSVData.length === 0) return;

  const btn = document.getElementById("btn-process-csv");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Importation en cours...";
  }

  try {
    const user = firebase.auth().currentUser;
    const benevoleEmail = user ? user.email : "Inconnu";

    let totalCreated = 0;
    let batch = db.batch();
    let operationCount = 0;

    for (const row of parsedCSVData) {
      for (let i = 0; i < row.quantite; i++) {
        const docRef = db.collection("equipment").doc();
        
        const newEquipment = {
          type: row.type,
          marque: row.marque,
          modele: row.modele,
          taille: row.taille,
          tailleEnfant: row.tailleEnfant, // Correctement lié
          statut: "en_stock",
          createdByEmail: benevoleEmail,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (row.tailleMax !== null) {
          newEquipment.tailleMax = Number(row.tailleMax);
        }

        batch.set(docRef, newEquipment);
        operationCount++;
        totalCreated++;

        // Limite Firestore à 450 opérations par batch
        if (operationCount >= 450) {
          await batch.commit();
          batch = db.batch();
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      await batch.commit();
    }

    alert(`✅ Réassort réussi ! ${totalCreated} exemplaire(s) d'équipement ajouté(s) au stock.`);

    const fileInput = document.getElementById("csv-file-input");
    const fileNameLabel = document.getElementById("csv-file-name");
    const previewContainer = document.getElementById("csv-preview-container");

    if (fileInput) fileInput.value = "";
    if (fileNameLabel) fileNameLabel.textContent = "Aucun fichier sélectionné";
    if (previewContainer) previewContainer.style.display = "none";
    parsedCSVData = [];

    if (typeof loadInventory === "function") await loadInventory();

  } catch (error) {
    console.error("Erreur lors de l'importation CSV :", error);
    alert("Une erreur est survenue lors de l'injection des données.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "🚀 Valider et injecter en base";
    }
  }
}
