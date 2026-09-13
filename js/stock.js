/**
 * js/stock.js
 * Gestion de l'affichage et du filtrage de l'état du stock
 */

let allStockItems = [];

// Écouteur pour charger le stock lorsque l'onglet est activé
document.addEventListener("DOMContentLoaded", () => {
  const stockTabBtn = document.querySelector('.tab-btn[data-tab="stock"]');
  if (stockTabBtn) {
    stockTabBtn.addEventListener("click", initStockView);
  }
});

/**
 * Initialise l'affichage de l'onglet Stock et charge les données Firestore
 */
function initStockView() {
  loadStockData();
}

/**
 * Charge tous les équipements depuis la collection Firestore "equipements"
 */
function loadStockData() {
  const tbody = document.getElementById("stock-table-body");
  if (!tbody) return;

  db.collection("equipements").onSnapshot(
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
      console.error("Erreur de chargement du stock:", error);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444; padding: 20px;">Erreur de chargement des données.</td></tr>`;
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
 * Calcule et affiche les KPI du stock (Total, Disponible, Prêté)
 */
function updateStockKPIs() {
  const total = allStockItems.length;
  const dispo = allStockItems.filter((i) => !i.statut || i.statut === "disponible").length;
  const prete = allStockItems.filter((i) => i.statut === "prete").length;

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
    // Filtre Recherche textuelle
    const matchesSearch =
      !search ||
      (item.marque && item.marque.toLowerCase().includes(search)) ||
      (item.modele && item.modele.toLowerCase().includes(search)) ||
      (item.type && item.type.toLowerCase().includes(search)) ||
      (item.id && item.id.toLowerCase().includes(search)) ||
      (item.attribueANom && item.attribueANom.toLowerCase().includes(search));

    // Filtre Type
    const matchesType = !typeFilter || item.type === typeFilter;

    // Filtre Statut
    const itemStatut = item.statut || "disponible";
    let matchesStatut = true;
    if (statutFilter === "disponible") {
      matchesStatut = itemStatut === "disponible";
    } else if (statutFilter === "prete") {
      matchesStatut = itemStatut === "prete";
    } else if (statutFilter === "hors_service") {
      matchesStatut = itemStatut !== "disponible" && itemStatut !== "prete";
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
      const statut = item.statut || "disponible";
      let badgeHTML = "";

      if (statut === "disponible") {
        badgeHTML = `<span style="background: #dcfce7; color: #15803d; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">Disponible</span>`;
      } else if (statut === "prete") {
        badgeHTML = `<span style="background: #ffedd5; color: #c2410c; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">Prêté</span>`;
      } else {
        badgeHTML = `<span style="background: #fee2e2; color: #b91c1c; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">${statut}</span>`;
      }

      let infoEmprunteur = item.provenance || "-";
      if (statut === "prete" && item.attribueANom) {
        infoEmprunteur = `👤 ${item.attribueANom}`;
      }

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px; font-weight: bold; color: #334155;">${item.type || "-"}</td>
          <td style="padding: 10px;">${item.marque || "-"} ${item.modele ? `<small style="color: #64748b;">(${item.modele})</small>` : ""}</td>
          <td style="padding: 10px;">${item.taille || "-"}</td>
          <td style="padding: 10px;">${item.tailleEnfant || "-"}</td>
          <td style="padding: 10px;">${item.tailleMax ? item.tailleMax + " cm" : "-"}</td>
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
