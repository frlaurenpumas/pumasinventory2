/**
 * Module de gestion du Réassort et des Sorties d'inventaire
 */

// js/reassort.js — Remplit le select d'équipement à partir de state.js

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
  
  // 1. Récupération des valeurs du formulaire
  const typeVal = document.getElementById("eq-type")?.value || "";
  const marqueVal = document.getElementById("eq-marque")?.value.trim() || "";
  const modeleVal = document.getElementById("eq-modele")?.value.trim() || "";
  const tailleVal = document.getElementById("eq-taille")?.value.trim() || "";
  
  // Nouveaux champs pour la compatibilité avec le comptoir
  const rawTailleMax = document.getElementById("eq-taille-max")?.value.trim() || "";
  const parsedTailleMax = rawTailleMax !== "" ? Number(rawTailleMax) : null;
  const tailleEnfantVal = document.getElementById("eq-taille-enfant")?.value.trim() || "";

  const etatVal = document.getElementById("eq-etat")?.value || "Bon état";
  const provenanceVal = document.getElementById("eq-provenance")?.value || "Achat";

  // Contrôle préventif du type
  if (!typeVal) {
    if (feedback) {
      feedback.innerText = "⚠️ Veuillez sélectionner un type d'équipement.";
      feedback.className = "feedback-msg danger";
    }
    return;
  }

  // 2. Vérification préventive pour tailleMax (strictement limitée aux équipements sur stature en cm)
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
    const user = firebase.auth().currentUser;
    const benevoleEmail = user ? user.email : "Inconnu";
    const benevoleName = user ? (user.displayName || user.email) : "Inconnu";

    const newEquipment = {
      type: typeVal,
      marque: marqueVal,
      modele: modeleVal,
      taille: tailleVal,
      tailleEnfant: tailleEnfantVal,
      tailleMax: parsedTailleMax !== null && !isNaN(parsedTailleMax) ? parsedTailleMax : null,
      etat: etatVal,
      provenance: provenanceVal,
      
      // Statut initial pour distribution immédiate au C2
      statut: "en_stock",
      createdByName: benevoleName,
      createdByEmail: benevoleEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Collection "equipment" (au singulier)
    const docRef = await db.collection("equipment").add(newEquipment);

    if (feedback) {
      feedback.innerText = `✅ Équipement ajouté (ID: ${docRef.id})`;
      feedback.className = "feedback-msg success";
    }

    const form = document.getElementById("add-equipment-form");
    if (form) {
      // Reinitialise le formulaire (remet aux valeurs par défaut)
      form.reset();

      // Force le vidage de tous les champs de texte et nombres
      form.querySelectorAll("input[type='text'], input[type='number'], textarea").forEach(input => {
        input.value = "";
      });

      // Remet les sélecteurs à la valeur par défaut
      form.querySelectorAll("select").forEach(select => {
        select.selectedIndex = 0;
      });
    }

    // Rétablissement de l'état initial des champs dynamiques après le reset
    const inputTailleMax = document.getElementById("eq-taille-max");
    if (inputTailleMax) {
      inputTailleMax.disabled = false;
      if (inputTailleMax.parentElement) inputTailleMax.parentElement.style.opacity = "1";
    }

    // Recharge l'inventaire si la fonction existe dans ton app
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
    const benevoleName = user ? (user.displayName || user.email) : "Inconnu";

    // Correction de la collection : "equipment" (au singulier)
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

    // Mise à jour du statut (soft delete)
    await eqRef.update({
      statut: motif, // ex: "hors_service", "perdu", "vendu"
      updatedByName: benevoleName,
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
