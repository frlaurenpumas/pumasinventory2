import { db, collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot, getDocs } from './firebase-config.js';

let currentAdherentId = null;

// Convertit DD/MM/YYYY ou DD-MM-YYYY en YYYY-MM-DD (format ISO requis par HTML)
function normaliserDateISO(dateStr) {
  if (!dateStr) return "";
  const str = dateStr.trim();
  
  // Si la date est déjà au format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // Si la date est au format DD/MM/YYYY ou DD-MM-YYYY
  const parts = str.split(/[/.-]/);
  if (parts.length === 3) {
    const jour = parts[0].padStart(2, '0');
    const mois = parts[1].padStart(2, '0');
    let annee = parts[2];
    
    // Si l'année est sur 2 chiffres (ex: 15 -> 2015)
    if (annee.length === 2) {
      annee = parseInt(annee) > 30 ? "19" + annee : "20" + annee;
    }

    // Si le premier bloc est le jour et le dernier l'année
    if (parts[0].length <= 2 && parts[2].length === 4) {
      return `${annee}-${mois}-${jour}`;
    }
  }

  return str;
}

// ==========================================
// COMPTOIR 1 : RECHERCHE & MISE À JOUR ADHÉRENT
// ==========================================

const inputRecherche = document.getElementById('c1-recherche');
const resContainer = document.getElementById('c1-resultats-recherche');

// Recherche en direct parmi la liste des adhérents Firestore
if (inputRecherche) {
  inputRecherche.addEventListener('input', async () => {
    const terme = inputRecherche.value.trim().toUpperCase();
    resContainer.innerHTML = '';

    if (terme.length < 2) {
      resContainer.classList.add('hidden');
      return;
    }

    // Récupérer la liste des adhérents
    const snap = await getDocs(collection(db, "adherents"));
    let correspondances = 0;

    snap.forEach(docSnap => {
      const data = docSnap.data();
      const nomComplet = `${data.nom} ${data.prenom}`.toUpperCase();

      if (nomComplet.includes(terme)) {
        correspondances++;
        const item = document.createElement('div');
        item.className = "p-2 hover:bg-blue-50 cursor-pointer border-b text-sm flex justify-between items-center";
        item.innerHTML = `
          <span><strong>${data.nom}</strong> ${data.prenom} (${data.categorie})</span>
          <span class="text-xs bg-slate-100 px-2 py-1 rounded text-slate-600">${data.statut_remise || 'non_commence'}</span>
        `;
        item.onclick = () => chargerAdherentPourEdition(docSnap.id, data);
        resContainer.appendChild(item);
      }
    });

    if (correspondances > 0) {
      resContainer.classList.remove('hidden');
    } else {
      resContainer.classList.add('hidden');
    }
  });
}

// Remplir le formulaire avec l'adhérent sélectionné
function chargerAdherentPourEdition(id, data) {
  document.getElementById('c1-adherent-id').value = id;
  document.getElementById('c1-nom').value = data.nom || '';
  document.getElementById('c1-prenom').value = data.prenom || '';
  document.getElementById('c1-dob').value = data.date_naissance || '';
  document.getElementById('c1-categorie').value = data.categorie || '';
  
  document.getElementById('c1-taille-cm').value = data.taille_cm || '';
  document.getElementById('c1-taille-main').value = data.taille_main_inch || '';
  document.getElementById('c1-pointure').value = data.pointure || '';

  document.getElementById('btn-submit-c1').textContent = "Mettre à jour et Envoyer au Comptoir 2 ➔";
  resContainer.classList.add('hidden');
  inputRecherche.value = `${data.nom} ${data.prenom}`;
}

// Fonction pour réinitialiser le formulaire
window.reinitialiserFormC1 = () => {
  document.getElementById('c1-adherent-id').value = '';
  document.getElementById('form-c1').reset();
  if (inputRecherche) inputRecherche.value = '';
  document.getElementById('btn-submit-c1').textContent = "Envoyer au Comptoir 2 ➔";
};

// Soumission du formulaire (Création OU Mise à jour)
const formC1 = document.getElementById('form-c1');
if (formC1) {
  formC1.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const adherentId = document.getElementById('c1-adherent-id').value;
    const payload = {
      nom: document.getElementById('c1-nom').value.trim().toUpperCase(),
      prenom: document.getElementById('c1-prenom').value.trim(),
      date_naissance: document.getElementById('c1-dob').value,
      categorie: document.getElementById('c1-categorie').value,
      taille_cm: parseInt(document.getElementById('c1-taille-cm').value) || null,
      taille_main_inch: document.getElementById('c1-taille-main').value || null,
      pointure: parseInt(document.getElementById('c1-pointure').value) || null,
      statut_remise: "en_attente_comptoir_2",
      date_maj: serverTimestamp()
    };

    try {
      if (adherentId) {
        // MISE À JOUR de l'adhérent existant (ex: issu de l'import CSV)
        await updateDoc(doc(db, "adherents", adherentId), payload);
        alert("Adhérent mis à jour et envoyé au Comptoir 2 !");
      } else {
        // CRÉATION d'un nouvel adhérent
        await addDoc(collection(db, "adherents"), payload);
        alert("Nouvel adhérent créé et envoyé au Comptoir 2 !");
      }
      
      reinitialiserFormC1();
    } catch (err) {
      console.error("Erreur lors de l'enregistrement :", err);
    }
  });
}
// ==========================================
// COMPTOIR 2 : ÉCOUTE EN TEMPS RÉEL (QUEUE)
// ==========================================
const qAdherents = query(
  collection(db, "adherents"), 
  where("statut_remise", "==", "en_attente_comptoir_2")
);

onSnapshot(qAdherents, (snapshot) => {
  const fileContainer = document.getElementById('file-attente');
  const countBadge = document.getElementById('queue-count');
  fileContainer.innerHTML = '';
  countBadge.textContent = snapshot.docs.length;

  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    const item = document.createElement('div');
    item.className = "p-3 border rounded-lg hover:bg-blue-50 cursor-pointer transition flex justify-between items-center bg-slate-50";
    item.innerHTML = `
      <div>
        <p class="font-bold text-slate-800">${data.nom} ${data.prenom}</p>
        <span class="text-xs bg-slate-200 px-2 py-0.5 rounded text-slate-600">${data.categorie}</span>
      </div>
      <span class="text-blue-600 font-bold text-sm">Choisir ➔</span>
    `;
    item.onclick = () => chargerAdherent(docSnap.id, data);
    fileContainer.appendChild(item);
  });
});

// Charger l'adhérent dans la zone d'attribution
function chargerAdherent(id, data) {
  currentAdherentId = id;
  document.getElementById('aucun-selectionne').classList.add('hidden');
  document.getElementById('zone-attribution').classList.remove('hidden');

  document.getElementById('c2-adh-nom').textContent = `${data.nom} ${data.prenom}`;
  document.getElementById('c2-adh-infos').textContent = `Catégorie: ${data.categorie} | Né(e) le: ${data.date_naissance}`;
  
  document.getElementById('rep-taille').textContent = data.taille_cm || '-';
  document.getElementById('rep-main').textContent = data.taille_main_inch || '-';
  document.getElementById('rep-pointure').textContent = data.pointure || '-';

  chargerEquipementsAttribues(id);
}

// ==========================================
// COMPTOIR 2 : SÉLECTION DU MATÉRIEL EN STOCK
// ==========================================
const typeSelect = document.getElementById('c2-type-equipement');
const eqSelect = document.getElementById('c2-equipement-select');

typeSelect.addEventListener('change', async () => {
  const type = typeSelect.value;
  eqSelect.innerHTML = '<option value="">Chargement du stock...</option>';

  if (!type) return;

  const qStock = query(
    collection(db, "equipements"),
    where("type_equipement", "==", type),
    where("statut", "==", "en_stock")
  );

  const snap = await getDocs(qStock);
  eqSelect.innerHTML = '<option value="">-- Sélectionner l\'équipement --</option>';

  snap.forEach(docSnap => {
    const d = docSnap.data();
    const opt = document.createElement('option');
    opt.value = docSnap.id;
    opt.textContent = `${d.marque} ${d.modele} — Taille ${d.taille}`;
    eqSelect.appendChild(opt);
  });
});

// Assignation du matériel
const formC2 = document.getElementById('form-c2');
formC2.addEventListener('submit', async (e) => {
  e.preventDefault();
  const eqId = eqSelect.value;
  if (!eqId || !currentAdherentId) return;

  // 1. Enregistrer l'action dans la table intermédiaire avec horodatage
  await addDoc(collection(db, "distributions"), {
    adherent_id: currentAdherentId,
    equipement_id: eqId,
    type_action: "attribution",
    date_heure: serverTimestamp(),
    statut_pret: "actif"
  });

  // 2. Mettre à jour l'état de l'équipement
  await updateDoc(doc(db, "equipements", eqId), {
    statut: "attribue",
    adherent_actuel_id: currentAdherentId
  });

  formC2.reset();
  eqSelect.innerHTML = '<option value="">-- Sélectionner le type d\'abord --</option>';
  chargerEquipementsAttribues(currentAdherentId);
});

// Afficher le matériel actuellement prêté à l'adhérent
async function chargerEquipementsAttribues(adhId) {
  const container = document.getElementById('liste-equipements-attribues');
  container.innerHTML = '<tr><td colspan="4" class="p-2 text-slate-400">Chargement...</td></tr>';

  const qDist = query(
    collection(db, "distributions"),
    where("adherent_id", "==", adhId),
    where("statut_pret", "==", "actif")
  );

  const snapDist = await getDocs(qDist);
  container.innerHTML = '';

  if (snapDist.empty) {
    container.innerHTML = '<tr><td colspan="4" class="p-2 text-slate-400">Aucun matériel prêté pour le moment.</td></tr>';
    return;
  }

  for (const docDist of snapDist.docs) {
    const distData = docDist.data();
    const eqSnap = await getDocs(query(collection(db, "equipements"), where("__name__", "==", distData.equipement_id)));
    
    if (!eqSnap.empty) {
      const eq = eqSnap.docs[0].data();
      const tr = document.createElement('tr');
      tr.className = "border-b text-sm";
      tr.innerHTML = `
        <td class="p-2 font-medium">${eq.type_equipement}</td>
        <td class="p-2">${eq.marque} ${eq.modele}</td>
        <td class="p-2">${eq.taille}</td>
        <td class="p-2 text-right">
          <button onclick="restituerMateriel('${docDist.id}', '${distData.equipement_id}')" class="text-red-600 hover:text-red-800 font-semibold text-xs">
            Restituer / Échanger
          </button>
        </td>
      `;
      container.appendChild(tr);
    }
  }
}

// Restituer du matériel (Gestion de l'échange)
window.restituerMateriel = async (distId, equipementId) => {
  if (!confirm("Voulez-vous réintégrer cet équipement au stock ?")) return;

  // 1. Clôturer l'attribution
  await updateDoc(doc(db, "distributions", distId), {
    statut_pret: "cloture"
  });

  // 2. Traçabilité : ajouter la ligne de restitution horodatée
  await addDoc(collection(db, "distributions"), {
    adherent_id: currentAdherentId,
    equipement_id: equipementId,
    type_action: "restitution",
    date_heure: serverTimestamp(),
    statut_pret: "cloture"
  });

  // 3. Remettre l'équipement en stock
  await updateDoc(doc(db, "equipements", equipementId), {
    statut: "en_stock",
    adherent_actuel_id: null
  });

  chargerEquipementsAttribues(currentAdherentId);
};

// Clôturer la session de l'adhérent
window.cloturerSession = async () => {
  if (!currentAdherentId) return;

  await updateDoc(doc(db, "adherents", currentAdherentId), {
    statut_remise: "termine",
    date_maj: serverTimestamp()
  });

  document.getElementById('zone-attribution').classList.add('hidden');
  document.getElementById('aucun-selectionne').classList.remove('hidden');
  currentAdherentId = null;
};
// ==========================================
// IMPORTATION CSV (PAPA PARSE & WRITE BATCH)
// ==========================================


      // LOG DE DÉBOGAGE
      console.log("Nom :", row["Nom"]);
      console.log("Date lue dans CSV :", row["Date Naissance"]);
      console.log("Date après normalisation :", normaliserDateISO(row["Date Naissance"]));

// 1. Import Adhérents
window.lancerImportAdherents = () => {
  const input = document.getElementById('csv-adherents');
  const file = input ? input.files[0] : null;

  if (!file) {
    alert("Veuillez d'abord sélectionner un fichier CSV d'adhérents.");
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";",
    complete: async (results) => {
      let ajouts = 0;
      let ignores = 0;
      // Normalisation des catégories autorisées en majuscules sans espaces
      const categoriesAutorisees = ["EDH", "U7", "U9", "U11"];

      console.log("=== DÉBUT IMPORT ADHÉRENTS ===");
      console.log("Exemple de ligne brute lue :", results.data[0]);

      for (const row of results.data) {
        // Recherche souple du champ catégorie
        const rawCat = row["Catégorie"] || row["Categorie"] || row["catégorie"] || row["categorie"] || "";
        
        // Nettoyage strict : majuscules, suppression des espaces et retours à la ligne (\r, \n)
        const cat = rawCat.trim().toUpperCase().replace(/[\r\n]/g, "");

        // Récupération souple de la date
        const rawDate = row["Date Naissance"] || row["Date de naissance"] || row["Date_Naissance"] || row["Date naissance"] || "";

        console.log(`Nom: ${row["Nom"]} | Catégorie brute: "${rawCat}" | Catégorie nettoyée: "${cat}"`);

        // Si la catégorie nettoyée n'est pas dans la liste autorisée
        if (!categoriesAutorisees.includes(cat)) {
          console.warn(`Ligne ignorée (catégorie non retenue) : ${row["Nom"]} ${row["Prénom"]} (${cat})`);
          ignores++;
          continue;
        }

        await addDoc(collection(db, "adherents"), {
          nom: (row["Nom"] || "").trim().toUpperCase(),
          prenom: (row["Prénom"] || "").trim(),
          date_naissance: normaliserDateISO(rawDate),
          categorie: cat,
          taille_cm: parseInt(row["Taille (cm)"] || row["Taille"]) || null,
          taille_main_inch: row["Taille Main(inch)"] || row["Taille Main"] || null,
          pointure: parseInt(row["Pointure"]) || null,
          statut_remise: "non_commence",
          date_maj: serverTimestamp()
        });
        ajouts++;
      }

      alert(`Import adhérents terminé !\n- ${ajouts} adhérents ajoutés.\n- ${ignores} ignorés (catégorie hors EDH/U7/U9/U11).`);
      input.value = "";
    }
  });
};
        
        

// 2. Import Matériel
window.lancerImportEquipements = () => {
  const input = document.getElementById('csv-equipements');
  const file = input ? input.files[0] : null;

  if (!file) {
    alert("Veuillez d'abord sélectionner un fichier CSV de matériel.");
    return;
  }

  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    delimiter: ";",
    complete: async (results) => {
      let ajouts = 0;

      for (const row of results.data) {
        if (!row["Type équipement"]) continue;

        await addDoc(collection(db, "equipements"), {
          type_equipement: row["Type équipement"].trim(),
          marque: (row["Marque"] || "").trim(),
          modele: (row["Modèle"] || "").trim(),
          taille: (row["Taille"] || "").trim(),
          statut: "en_stock",
          adherent_actuel_id: null
        });
        ajouts++;
      }
      alert(`Import matériel terminé !\n- ${ajouts} équipements ajoutés au stock.`);
      input.value = "";
    }
  });
};

// ==========================================
// EXPORTATION CSV
// ==========================================
window.exporterCollection = async (nomCollection) => {
  const snap = await getDocs(collection(db, nomCollection));
  if (snap.empty) {
    alert("Aucune donnée à exporter.");
    return;
  }

  const donnees = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    
    // Conversion des timestamps Firestore en date lisible ISO
    if (data.date_maj && data.date_maj.toDate) {
      data.date_maj = data.date_maj.toDate().toISOString();
    }
    if (data.date_heure && data.date_heure.toDate) {
      data.date_heure = data.date_heure.toDate().toISOString();
    }
    
    data.id_firestore = docSnap.id;
    donnees.push(data);
  });

  // Génération du CSV
  const csv = Papa.unparse(donnees, { delimiter: ";" });
  
  // Téléchargement automatique du fichier
  const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' }); // \ufeff garantit le bon encodage UTF-8 sous Excel
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `export_${nomCollection}_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
