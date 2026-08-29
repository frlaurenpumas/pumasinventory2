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
  const optGroupMandatory = document.createElement("optgroup");
  optGroupMandatory.label = "Équipements obligatoires";

  MANDATORY_EQUIPMENTS.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.type;
    opt.textContent = item.label;
    optGroupMandatory.appendChild(opt);
  });
  select.appendChild(optGroupMandatory);

  // Groupe 2 : Optionnels
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

// Lancement au chargement du DOM
document.addEventListener("DOMContentLoaded", populateReassortEquipmentSelect);


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

  // 2. Vérification préventive pour tailleMax (strictement limitée aux équipements concernés)
  const needsTailleMax = ["Casque", "Plastron", "Coudières", "Culotte", "Jambières", "Crosse"].includes(typeVal);
  
  if (needsTailleMax && (parsedTailleMax === null || isNaN(parsedTailleMax))) {
    const confirmNoMax = confirm(
      `Attention : Vous n'avez pas renseigné la "Taille MAX (cm)" pour cet équipement (${typeVal}).\n\nSans cette valeur, il ne pourra pas être recommandé automatiquement au comptoir. Voulez-vous enregistrer quand même ?`
    );
    if (!confirmNoMax) return;
  }

  btnSubmit.disabled = true;
  feedback.innerText = "Enregistrement en cours...";
  feedback.className = "feedback-msg info";

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
      
      // Statut initial pour distribution immédiate au C2 (aligné sur l'import CSV)
      statut: "en_stock",
      createdByName: benevoleName,
      createdByEmail: benevoleEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // Note : collection "equipment" (au singulier) pour être synchro avec l'import/export CSV
    const docRef = await db.collection("equipment").add(newEquipment);

    feedback.innerText = `✅ Équipement ajouté (ID: ${docRef.id})`;
    feedback.className = "feedback-msg success";

    document.getElementById("add-equipment-form")?.reset();

    // Recharge l'inventaire si la fonction existe dans ton app
    if (typeof loadInventory === "function") {
      await loadInventory();
    }

  } catch (error) {
    console.error("Erreur lors de l'ajout de l'équipement :", error);
    feedback.innerText = "❌ Erreur lors de l'enregistrement.";
    feedback.className = "feedback-msg danger";
  } finally {
    btnSubmit.disabled = false;
  }
}
// --- 2. SORTIE DE MATÉRIEL (Mise au rebut, perte, revente) ---
async function handleRemoveEquipment(event) {
  event.preventDefault();

  const btnSubmit = document.getElementById("btn-remove-eq");
  const feedback = document.getElementById("remove-feedback");
  const eqId = document.getElementById("remove-eq-id").value.trim();
  const motif = document.getElementById("remove-motif").value;

  if (!eqId) {
    feedback.innerText = "⚠️ Veuillez renseigner un ID d'équipement valide.";
    feedback.className = "feedback-msg danger";
    return;
  }

  btnSubmit.disabled = true;
  feedback.innerText = "Mise à jour en cours...";
  feedback.className = "feedback-msg info";

  try {
    const user = firebase.auth().currentUser;
    const benevoleEmail = user ? user.email : "Inconnu";
    const benevoleName = user ? (user.displayName || user.email) : "Inconnu";

    const eqRef = db.collection("equipments").doc(eqId);
    const docSnap = await eqRef.get();

    if (!docSnap.exists) {
      feedback.innerText = "❌ Équipement introuvable avec cet ID.";
      feedback.className = "feedback-msg danger";
      btnSubmit.disabled = false;
      return;
    }

    // Mise à jour du statut (soft delete)
    await eqRef.update({
      statut: motif, // ex: "hors_service", "perdu", "vendu"
      updatedByName: benevoleName,
      updatedByEmail: benevoleEmail,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    feedback.innerText = `✅ Équipement ${eqId} marqué comme "${motif}".`;
    feedback.className = "feedback-msg success";

    document.getElementById("remove-equipment-form").reset();

  } catch (error) {
    console.error("Erreur lors de la sortie de matériel :", error);
    feedback.innerText = "❌ Erreur lors de la mise à jour.";
    feedback.className = "feedback-msg danger";
  } finally {
    btnSubmit.disabled = false;
  }
}
