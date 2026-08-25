import { db, collection, addDoc, updateDoc, doc, serverTimestamp, query, where, onSnapshot, getDocs } from './firebase-config.js';

let currentAdherentId = null;

// ==========================================
// COMPTOIR 1 : ENREGISTREMENT & ENVOI
// ==========================================
const formC1 = document.getElementById('form-c1');
if (formC1) {
  formC1.addEventListener('submit', async (e) => {
    e.preventDefault();
    
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
      await addDoc(collection(db, "adherents"), payload);
      alert("Adhérent envoyé au Comptoir 2 !");
      formC1.reset();
    } catch (err) {
      console.error("Erreur ajout adhérent :", err);
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
  eqSelect.innerHTML = '<option value="">-- Sélectionner l'équipement --</option>';

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
  eqSelect.innerHTML = '<option value="">-- Sélectionner le type d'abord --</option>';
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
