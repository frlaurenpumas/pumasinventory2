/**
 * js/stock.js
 * Gestion de l'affichage, du filtrage et de la vue temps réel du stock d'équipements.
 */

let allStockItems = [];
let activeLoansMap = {}; // Map { eqId: { adhNom, adhPrenom, email } }

// Écouteur pour charger le stock lorsque l'onglet est activé
document.addEventListener("DOMContentLoaded", () => {
  const stockTabBtn = document.querySelector('.tab-btn[data-tab="stock"]');
  if (stockTabBtn) {
    stockTabBtn.addEventListener("click", initStockView);
  }
});

/**
 * Initialise l'affichage de l'onglet Stock
 */
function initStockView() {
  loadStockData();
}

/**
 * Charge les données depuis les collections "equipment", "loans" et "adherents"
 */
function loadStockData() {
  const tbody = document.getElementById("stock-table-body");
  if (!tbody) return;

  // Écoute en temps réel des prêts actifs pour connaître les emprunteurs
  db.collection("loans")
    .where("statut", "==", "attribue")
    .onSnapshot((loansSnapshot) => {
      activeLoansMap = {};
      
      // Promesses pour récupérer les infos adhérents associées si nécessaire
      const adhPromises = [];
      
      loansSnapshot.forEach((loanDoc) => {
        const loan = loanDoc.data();
        if (loan.eqId) {
          activeLoansMap[loan.eqId] = {
            adhNom: loan.adhNom || "",
            adhPrenom: loan.adhPrenom || "",
            adhId: loan.adhId || ""
          };

          // Si le nom n'est pas directement dans le prêt, on prépare un fetch de l'adhérent
          if (!loan.adhNom && loan.adhId) {
            adhPromises.push(
              db.collection("adherents").doc(loan.adhId).get().then((adhDoc) => {
                if (adhDoc.exists) {
                  const adhData = adhDoc.data();
                  activeLoansMap[loan.eqId].adhNom = adhData.nom || "";
                  activeLoansMap[loan.eqId].adhPrenom = adhData.prenom || "";
                }
              })
            );
          }
        }
      });

      // Attendre la résolution des infos adhérents puis charger les équipements
      Promise.all(adhPromises).then(() => {
        subscribeToEquipmentCollection();
      });
    }, (error) => {
      console.error("Erreur de chargement des prêts actifs:", error);
      subscribeToEquipmentCollection();
    });
}

/**
 * Abonnement temps réel à la collection "equipment"
 */
function subscribeToEquipmentCollection() {
  const tbody = document.getElementById("stock-table-body");

  db.collection("equipment").onSnapshot(
    (snapshot) => {
      allStockItems = [];
      snapshot.forEach((doc) => {
        allStockItems.push({ id: doc.id, ...doc.data() });
      });

      populateTypeFilter();
      updateStockKPIs();
      filterStockTable();
    },
    (error) => {
      console.error("Erreur de chargement du stock (equipment):", error);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 20px;">Erreur de chargement des données.</td></tr>`;
      }
    }
  );
}

/**
 * Remplit dynamiquement la liste déroulante des types d'équipements
 */
function populateTypeFilter() {
  const selectType = document.getElementById("stock-filter-type");
  if (!selectType) return;

  const currentSelection = selectType.value;
  const types = [...new Set(allStockItems.map((item) => item.type).filter(Boolean))].sort();

  selectType.innerHTML = `<option value="">Tous les types</option>`;
  types.forEach((type) => {
    const opt = document.createElement("option");
    opt.value = type;
    opt.textContent = type;
    if (type === currentSelection) opt.selected = true;
    selectType.appendChild(opt);
  });
}

/**
 * Helper : Vérifie si un statut correspond à "disponible / en stock"
 */
function isDispo(statut) {
  return !statut || statut === "en_stock" || statut === "disponible";
}

/**
 * Helper : Vérifie si un statut correspond à "prêté / attribué"
 */
function isPrete(statut) {
  return statut === "attribue" || statut === "prete";
}

/**
 * Calcule et affiche les KPI du stock (Total, Disponible, Prêté)
 */
function updateStockKPIs() {
  const total = allStockItems.length;
  const dispo = allStockItems.filter((i) => isDispo(i.statut)).length;
  const prete = allStockItems.filter((i) => isPrete(i.statut)).length;

  const elTotal = document.getElementById("stock-kpi-total");
  const elDispo = document.getElementById("stock-kpi-dispo");
  const elPrete = document.getElementById("stock-kpi-prete");

  if (elTotal) elTotal.textContent = total;
  if (elDispo) elDispo.textContent = dispo;
  if (elPrete) elPrete.textContent = prete;
}

/**
 * Filtre les équipements du tableau en fonction des critères sélectionnés
 */
function filterStockTable() {
  const search = document.getElementById("stock-filter-search")?.value.toLowerCase().trim() || "";
  const typeFilter = document.getElementById("stock-filter-type")?.value || "";
  const statutFilter = document.getElementById("stock-filter-statut")?.value || "";

  const filtered = allStockItems.filter((item) => {
    const loanInfo = activeLoansMap[item.id];
    const borrowerName = loanInfo ? `${loanInfo.adhNom} ${loanInfo.adhPrenom}`.toLowerCase() : "";

    // Filtre Recherche textuelle (Marque, Modèle, Type, ID, Emprunteur)
    const matchesSearch =
      !search ||
      (item.marque && item.marque.toLowerCase().includes(search)) ||
      (item.modele && item.modele.toLowerCase().includes(search)) ||
      (item.type && item.type.toLowerCase().includes(search)) ||
      (item.id && item.id.toLowerCase().includes(search)) ||
      borrowerName.includes(search);

    // Filtre Type
    const matchesType = !typeFilter || item.type === typeFilter;

    // Filtre Statut
    let matchesStatut = true;
    if (statutFilter === "disponible") {
      matchesStatut = isDispo(item.statut);
    } else if (statutFilter === "prete") {
      matchesStatut = isPrete(item.statut);
    } else if (statutFilter === "hors_service") {
      matchesStatut = !isDispo(item.statut) && !isPrete(item.statut);
    }

    return matchesSearch && matchesType && matchesStatut;
  });

  renderStockTable(filtered);
}

/**
 * Rendu HTML du tableau des équipements du stock
 */
function renderStockTable(items) {
  const tbody = document.getElementById("stock-table-body");
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b; padding: 20px;">Aucun équipement ne correspond aux critères.</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((item) => {
      const statutRaw = item.statut || "en_stock";
      let badgeHTML = "";

      if (isDispo(statutRaw)) {
        badgeHTML = `<span style="background: #dcfce7; color: #15803d; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">En Stock</span>`;
      } else if (isPrete(statutRaw)) {
        badgeHTML = `<span style="background: #ffedd5; color: #c2410c; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">Prêté</span>`;
      } else {
        badgeHTML = `<span style="background: #fee2e2; color: #b91c1c; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">${statutRaw}</span>`;
      }

      // Information sur l'emprunteur ou la provenance
      let infoEmprunteur = item.provenance || "-";
      if (isPrete(statutRaw)) {
        const loanInfo = activeLoansMap[item.id];
        if (loanInfo && (loanInfo.adhNom || loanInfo.adhPrenom)) {
          infoEmprunteur = `👤 ${loanInfo.adhPrenom} ${loanInfo.adhNom}`.trim();
        } else if (item.emailContact) {
          infoEmprunteur = `📧 ${item.emailContact}`;
        } else {
          infoEmprunteur = `👤 Attribué`;
        }
      }

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px; font-weight: bold; color: #334155;">${item.type || "-"}</td>
          <td style="padding: 10px;">${item.marque || "-"} ${item.modele ? `<small style="color: #64748b;">(${item.modele})</small>` : ""}</td>
          <td style="padding: 10px;">${item.taille || "-"}</td>
          <td style="padding: 10px;">${item.tailleEnfant || "-"}</td>
          <td style="padding: 10px;">${item.tailleMax !== null && item.tailleMax !== undefined ? item.tailleMax + " cm" : "-"}</td>
          <td style="padding: 10px;">${badgeHTML}</td>
          <td style="padding: 10px; color: #475569; font-size: 13px;">${infoEmprunteur}</td>
        </tr>
      `;
    })
    .join("");
}

/**
 * Réinitialise tous les filtres de recherche
 */
function resetStockFilters() {
  const searchInput = document.getElementById("stock-filter-search");
  const typeSelect = document.getElementById("stock-filter-type");
  const statutSelect = document.getElementById("stock-filter-statut");

  if (searchInput) searchInput.value = "";
  if (typeSelect) typeSelect.value = "";
  if (statutSelect) statutSelect.value = "";

  filterStockTable();
}

// Expositions globales
window.initStockView = initStockView;
window.filterStockTable = filterStockTable;
window.resetStockFilters = resetStockFilters;
