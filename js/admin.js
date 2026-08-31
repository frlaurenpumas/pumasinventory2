// --- ADMIN / IMPORT & EXPORT CSV (PapaParse) ---

function parseNum(val) {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(String(val).replace(',', '.').trim());
  return isNaN(n) ? null : n;
}

function importAdherentsCSV() {
  const fileInput = document.getElementById("csv-adh-file");
  if (!fileInput || !fileInput.files[0]) return alert("Veuillez choisir un fichier CSV.");

  Papa.parse(fileInput.files[0], {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    complete: async (results) => {
      for (const row of results.data) {
        let rawDate = row["Date Naissance"] || row["DateNaissance"] || row["dateNaissance"] || row["Date de naissance"] || "";
        let formattedDate = formatDateToISO(rawDate);
        
        let cat = row["Catégorie"] || row["Categorie"] || "";
        if (!cat && formattedDate) {
          cat = calculateCategory(formattedDate);
        }

        // Nettoyage de la pointure (remplace 38,5 par 38.5)
        let rawPointure = row["Pointure"] || row["pointure"] || "";
        let cleanPointure = String(rawPointure).replace(',', '.').trim();

        const docRef = db.collection("adherents").doc();
        await docRef.set({
          nom: row["Nom"] || row["nom"] || "",
          prenom: row["Prénom"] || row["Prenom"] || row["prenom"] || "",
          dateNaissance: formattedDate,
          categorie: cat,
          email: row["Email"] || row["Adresse mail de contact"] || row["email"] || "",
          tailleCm: parseNum(row["Taille (cm)"] || row["Taille"]),
          tourTeteCm: parseNum(row["Tour de tête (cm)"] || row["Tour de tete"]),
          tailleMainInch: row["Taille Main(inch)"] || row["Taille Main"] || "",
          pointure: cleanPointure,
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
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    transformHeader: (h) => h.trim(),
    complete: async (results) => {
      let rows = results.data;
      if (!rows || rows.length === 0) {
        return alert("Le fichier CSV est vide ou illisible.");
      }

      rows = rows.filter(row => Object.values(row).some(val => val && val.toString().trim() !== ""));

      if (rows.length === 0) {
        return alert("Aucune donnée valide n'a été trouvée dans le CSV.");
      }

      console.log(`[DEBUG] Séparateur détecté: "${results.meta.delimiter}"`);

      try {
        const BATCH_SIZE = 400;
        
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const chunk = rows.slice(i, i + BATCH_SIZE);
          const batch = db.batch();

          chunk.forEach(row => {
            const getVal = (...keys) => {
              for (const k of keys) {
                if (row[k] !== undefined && row[k] !== null) return String(row[k]).trim();
              }
              return "";
            };

            const docId = getVal("ID", "id", "docId");
            const typeVal = getVal("Equipement", "Équipement", "Type équipement", "Type equipement", "Type", "type");
            const marqueVal = getVal("Marque", "marque");
            const modeleVal = getVal("Modèle", "Modele", "modele");
            
            // Supporte "Taille" ou "Pointure" et transforme les virgules en points (ex: 38,5 -> 38.5)
            const rawTaille = getVal("Taille", "taille", "Pointure", "pointure");
            const tailleVal = rawTaille.replace(',', '.');

            const tailleConstructeurVal = getVal("Taille (selon constructeur)", "Taille constructeur", "Taille enfant", "Taille Enfant", "tailleEnfant");
            const provenanceVal = getVal("Provenance", "provenance") || "Import CSV";
            const statutVal = getVal("Statut", "statut") || "en_stock";
            const emailContactVal = getVal("Email Contact", "Email contact", "emailContact");
            const benevoleVal = getVal("Ajouté par (Bénévole)", "Ajouté par", "Bénévole", "createdByName", "createdByEmail");

            const rawTailleMax = getVal("Taille Max (cm)", "Taille Max", "Taille MAX", "tailleMax", "taille_max");
            const parsedTailleMax = parseNum(rawTailleMax);

            if (!typeVal && !marqueVal && !modeleVal) return;

            const docRef = docId !== "" 
              ? db.collection("equipment").doc(docId) 
              : db.collection("equipment").doc();

            const equipmentData = {
              type: typeVal,
              marque: marqueVal,
              modele: modeleVal,
              taille: tailleVal,
              tailleEnfant: tailleConstructeurVal,
              tailleMax: parsedTailleMax,
              provenance: provenanceVal,
              statut: statutVal,
              emailContact: emailContactVal,
              importedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            if (benevoleVal !== "") {
              equipmentData.createdByName = benevoleVal;
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
      "Taille (cm)": d.tailleCm !== null && d.tailleCm !== undefined ? d.tailleCm : "",
      "Tour de tête (cm)": d.tourTeteCm !== null && d.tourTeteCm !== undefined ? d.tourTeteCm : "",
      "Taille Main(inch)": d.tailleMainInch || "",
      "Pointure": d.pointure || "",
      "Statut": d.statut || ""
    };
  });

  downloadCSV(data, "export_adherents.csv");
}

async function exportInventoryCSV() {
  try {
    const [eqSnapshot, loansSnapshot, adhSnapshot] = await Promise.all([
      db.collection("equipment").get(),
      db.collection("loans").where("statut", "==", "attribue").get(),
      db.collection("adherents").get()
    ]);

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
        "ID": doc.id,
        "Type": d.type || "",
        "Marque": d.marque || "",
        "Modèle": d.modele || "",
        "Taille": d.taille || "",
        "Taille Max (cm)": d.tailleMax !== null && d.tailleMax !== undefined ? d.tailleMax : "",
        "Provenance": d.provenance || "",
        "Statut": d.statut || "en_stock",
        "Email Contact": emailContact,
        "Ajouté par (Bénévole)": d.createdByName || d.createdByEmail || ""
      };
    });

    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = `${String(now.getHours()).padStart(2, "0")}h${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `export_inventaire_materiel_${dateStr}_${timeStr}.csv`;

    downloadCSV(data, filename);
  } catch (error) {
    console.error("Erreur lors de l'export de l'inventaire :", error);
    alert("Impossible d'exporter l'inventaire : " + error.message);
  }
}

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

      const fallbackAdh = adherentsMap[d.adhId] || {};
      const nom = d.adhNom || fallbackAdh.nom || "N/C";
      const prenom = d.adhPrenom || fallbackAdh.prenom || "N/C";
      const categorie = d.adhCategorie || fallbackAdh.categorie || "N/C";

      const benevoleEmail = d.benevoleEmail || d.benevoleName || "N/C";

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

// Fonction unique utilitaire de téléchargement CSV
function downloadCSV(data, filename) {
  const csv = Papa.unparse(data, { delimiter: ";" });
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
