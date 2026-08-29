/**
 * Module de gestion du Réassort et des Sorties d'inventaire
 */

// --- 1. ENTRÉE DE MATÉRIEL (Ajout unitaire) ---
async function handleAddSingleEquipment(event) {
  event.preventDefault();

  const btnSubmit = document.getElementById("btn-save-eq");
  const feedback = document.getElementById("reassort-feedback");
  
  btnSubmit.disabled = true;
  feedback.innerText = "Enregistrement en cours...";
  feedback.className = "feedback-msg info";

  try {
    const user = firebase.auth().currentUser;
    const benevoleEmail = user ? user.email : "Inconnu";
    const benevoleName = user ? (user.displayName || user.email) : "Inconnu";

    const newEquipment = {
      type: document.getElementById("eq-type").value,
      marque: document.getElementById("eq-marque").value.trim(),
      modele: document.getElementById("eq-modele").value.trim(),
      taille: document.getElementById("eq-taille").value.trim(),
      etat: document.getElementById("eq-etat").value,
      provenance: document.getElementById("eq-provenance").value,
      
      // Statut initial pour distribution immédiate au C2
      statut: "disponible",
      createdByName: benevoleName,
      createdByEmail: benevoleEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    const docRef = await db.collection("equipments").add(newEquipment);

    feedback.innerText = `✅ Équipement ajouté (ID: ${docRef.id})`;
    feedback.className = "feedback-msg success";

    document.getElementById("add-equipment-form").reset();

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
