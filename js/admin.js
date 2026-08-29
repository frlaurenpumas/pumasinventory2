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
      const rows = results.data;
      if (!rows || rows.length === 0) {
        return alert("Le fichier CSV est vide.");
      }

      console.log(`[DEBUG] Début de l'import de ${rows.length} équipements...`);

      try {
        const BATCH_SIZE = 400;
        
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const chunk = rows.slice(i, i + BATCH_SIZE);
          const batch = db.batch();

          chunk.forEach(row => {
            // 1. Détection de l'ID d'origine
            const docId = row["ID"] || row["id"] || row["docId"] || "";

            // 2. Mappage des champs demandés
            const typeVal = row["Equipement"] || row["Équipement"] || row["Type équipement"] || row["Type equipement"] || row["Type"] || row["type"] || "";
            const marqueVal = row["Marque"] || row["marque"] || "";
            const modeleVal = row["Modèle"] || row["Modele"] || row["modele"] || "";
            const tailleVal = row["Taille"] || row["taille"] || "";
            
            // Taille selon constructeur / Taille Enfant
            const tailleConstructeurVal = row["Taille (selon constructeur)"] || row["Taille constructeur"] || row["Taille enfant"] || row["Taille Enfant"] || row["tailleEnfant"] || "";
            
            const provenanceVal = row["Provenance"] || row["provenance"] || "Import CSV";
            const statutVal = row["Statut"] || row["statut"] || "en_stock";
            const emailContactVal = row["Email Contact"] || row["Email contact"] || row["emailContact"] || "";
            const benevoleVal = row["Ajouté par (Bénévole)"] || row["Ajouté par"] || row["Bénévole"] || row["createdByName"] || row["createdByEmail"] || "";

            // Conversion Taille Max
            const rawTailleMax = row["Taille Max (cm)"] || row["Taille Max"] || row["Taille MAX"] || row["tailleMax"] || row["taille_max"] || "";
            const parsedTailleMax = rawTailleMax !== "" ? Number(rawTailleMax) : null;

            // Réutilisation de l'ID existant ou génération d'un nouveau
            const docRef = docId.trim() !== "" 
              ? db.collection("equipment").doc(docId.trim()) 
              : db.collection("equipment").doc();

            // Construction de l'objet Firestore
            const equipmentData = {
              type: typeVal.trim(),
              marque: marqueVal.trim(),
              modele: modeleVal.trim(),
              taille: tailleVal.trim(),
              tailleEnfant: tailleConstructeurVal.trim(), // Stocke la taille constructeur / enfant
              tailleMax: parsedTailleMax !== null && !isNaN(parsedTailleMax) ? parsedTailleMax : null,
              provenance: provenanceVal.trim(),
              statut: statutVal.trim(),
              emailContact: emailContactVal.trim(),
              importedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Ajout du nom du bénévole s'il est renseigné
            if (benevoleVal.trim() !== "") {
              equipmentData.createdByName = benevoleVal.trim();
            }

            batch.set(docRef, equipmentData, { merge: true });
          });

          await batch.commit();
        }

        alert(`✅ Importation réussie : ${rows.length} équipements traités.`);
        
        fileInput.value = "";

        if (typeof loadInventory === "function") {
          await loadInventory();
        }

      } catch (error) {
        console.error("Erreur lors de l'importation batch :", error);
        alert("Erreur lors de l'importation : " + error.message);
      }
    }
  });
}

window.importInventoryCSV = importInventoryCSV;

// Attachement au scope global pour le HTML
window.importInventoryCSV = importInventoryCSV;

// Attachement au scope global pour le HTML
window.importInventoryCSV = importInventoryCSV;

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

    // 2. Construction des lignes pour le CSV (sans État, avec Bénévole)
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
        "ID": doc.id,                             // Important pour la réimportation
        "Type": d.type || "",
        "Marque": d.marque || "",
        "Modèle": d.modele || "",
        "Taille": d.taille || "",
        "Taille Max (cm)": d.tailleMax || "",
        "Provenance": d.provenance || "",
        "Statut": d.statut || "en_stock",
        "Email Contact": emailContact,
        "Ajouté par (Bénévole)": d.createdByName || d.createdByEmail || ""
      };
    });

    // 3. Horodatage du fichier
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = `${String(now.getHours()).padStart(2, "0")}h${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `export_inventaire_materiel_${dateStr}_${timeStr}.csv`;

    // Appel du téléchargeur PapaParse
    downloadCSV(data, filename);
  } catch (error) {
    console.error("Erreur lors de l'export de l'inventaire :", error);
    alert("Impossible d'exporter l'inventaire : " + error.message);
  }
}

// Fonction utilitaire de téléchargement CSV avec PapaParse
function downloadCSV(data, filename) {
  if (!data || !data.length) {
    alert("Aucune donnée à exporter.");
    return;
  }
  
  const csv = Papa.unparse(data, { delimiter: ";" });
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Export au scope global
window.exportInventoryCSV = exportInventoryCSV;
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

      // Informations du bénévole (avec fallback si ancien prêt sans l'info)
      const benevoleNom = d.benevoleName || "N/C";
      const benevoleEmail = d.benevoleEmail || "N/C";

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
        "Bénévole (Email)": benevoleEmail,
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
