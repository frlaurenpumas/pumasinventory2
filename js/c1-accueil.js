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

/**
 * Remplissage dynamique des options de pointure (du 28 au 45)
 */
function populatePointureOptions() {
  const select = document.getElementById("adh-pointure");
  if (!select) return;
  
  // Vider les anciennes options pour éviter les doublons au réappel
  select.innerHTML = '<option value="">-- Choisir --</option>';
  
  for (let i = 28; i <= 45; i++) {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = i;
    select.appendChild(opt);
  }
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
  document.getElementById("adh-email").value = adh.email || adh.mail || "";
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

// Affiche tous les adhérents triés par nom puis prénom en temps réel (Consultation & Sélection)
function loadAllAdherentsC1() {
  db.collection("adherents")
    .orderBy("nom", "asc")
    .onSnapshot(snapshot => {
      const tbody = document.getElementById("c1-adherents-list-body");
      if (!tbody) return;
      
      tbody.innerHTML = "";

      if (snapshot.empty) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center">Aucun adhérent en base.</td></tr>';
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
        tr.style.cursor = "pointer";
        tr.onclick = () => fillAdherentForm(adh);

        tr.innerHTML = `
          <td><strong>${(adh.nom || "").toUpperCase()}</strong></td>
          <td>${adh.prenom || ""}</td>
          <td>${adh.categorie || "-"}</td>
        `;
        tbody.appendChild(tr);
      });
    });
}

async function saveAndSendToComptoir2(e) {
  e.preventDefault();

  // 1. Récupération des valeurs des mesures
  const tailleCm = document.getElementById("adh-taille-cm").value.trim();
  const tourTeteCm = document.getElementById("adh-tete-cm").value.trim();
  const tailleMainInch = document.getElementById("adh-main-inch").value.trim();
  const pointure = document.getElementById("adh-pointure").value.trim();

  // 2. BLOCUS : On vérifie que TOUTES les mesures sont renseignées
  if (!tailleCm || !tourTeteCm || !tailleMainInch || !pointure) {
    alert("Impossible de transmettre au Comptoir 2 : Toutes les mesures (Taille, Tour de tête, Main, Pointure) sont obligatoires.");
    return; // Interrompt l'exécution, rien n'est envoyé à la base de données
  }

  const id = document.getElementById("adh-id").value;

  // 3. Construction du payload complet (inchangé)
  const payload = {
    nom: document.getElementById("adh-nom").value.trim(),
    prenom: document.getElementById("adh-prenom").value.trim(),
    dateNaissance: document.getElementById("adh-dob").value,
    categorie: document.getElementById("adh-categorie").value,
    email: document.getElementById("adh-email").value.trim(),
    tailleCm: Number(tailleCm) || null,
    tourTeteCm: Number(tourTeteCm) || null,
    tailleMainInch: tailleMainInch,
    pointure: pointure,
    statut: "En attente de matériel",
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // 4. Enregistrement Firestore
  if (id) {
    await db.collection("adherents").doc(id).update(payload);
  } else {
    await db.collection("adherents").add(payload);
  }

  alert("Fiche validée et transmise au Comptoir 2 !");
  resetAdherentForm();
}
