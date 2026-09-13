/**
 * js/stock.js
 * Vue dédiée à l'inventaire physique du stock (vérification des armoires/étagères).
 * Tri des équipements par Taille MAX (ordre croissant).
 */

let allStockItems = [];

// Écouteur au chargement de la page et lors du clic sur l'onglet "Stock"
document.addEventListener("DOMContentLoaded", () => {
  const stockTabBtn = document.querySelector('.tab-btn[data-tab="stock"]');
  if (stockTabBtn) {
    stockTabBtn.addEventListener("click", initStockView);
  }
});

/**
 * Initialise l'affichage du stock
 */
function initStockView() {
  loadStockData();
}

/**
 * Abonnement en temps réel à la collection "equipment"
 */
function loadStockData() {
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
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #ef4444; padding: 20px;">Erreur de chargement des données.</td></tr>`;
      }
    }
  );
}

/**
 * Remplit la liste déroulante des types d'équipements
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
 * Calcule les compteurs KPI (Total, En Stock, Hors Service/Autre)
 */
function updateStockKPIs() {
  const total = allStockItems.length;
  const enStock = allStockItems.filter((i) => !i.statut || i.statut === "en_stock" || i.statut === "disponible").length;
  const attribue = allStockItems.filter((i) => i.statut === "attribue" || i.statut === "prete").length;

  const elTotal = document.getElementById("stock-kpi-total");
  const elDispo = document.getElementById("stock-kpi-dispo");
  const elPrete = document.getElementById("stock-kpi-prete");

  if (elTotal) elTotal.textContent = total;
  if (elDispo) elDispo.textContent = enStock;
  if (elPrete) elPrete.textContent = attribue;
}

/**
 * Filtre et TRIE les équipements par Taille Max
 */
function filterStockTable() {
  const search = document.getElementById("stock-filter-search")?.value.toLowerCase().trim() || "";
  const typeFilter = document.getElementById("stock-filter-type")?.value || "";
  const statutFilter = document.getElementById("stock-filter-statut")?.value || "";

  // 1. Filtrage
  let filtered = allStockItems.filter((item) => {
    const matchesSearch =
      !search ||
      (item.marque && item.marque.toLowerCase().includes(search)) ||
      (item.modele && item.modele.toLowerCase().includes(search)) ||
      (item.type && item.type.toLowerCase().includes(search)) ||
      (item.id && item.id.toLowerCase().includes(search));

    const matchesType = !typeFilter || item.type === typeFilter;

    let matchesStatut = true;
    if (statutFilter === "disponible") {
      matchesStatut = !item.statut || item.statut === "en_stock" || item.statut === "disponible";
    } else if (statutFilter === "prete") {
      matchesStatut = item.statut === "attribue" || item.statut === "prete";
    }

    return matchesSearch && matchesType && matchesStatut;
  });

  // 2. Tri par Taille MAX (les valeurs non renseignées sont placées à la fin)
  filtered.sort((a, b) => {
    const valA = a.tailleMax !== null && a.tailleMax !== undefined ? Number(a.tailleMax) : Infinity;
    const valB = b.tailleMax !== null && b.tailleMax !== undefined ? Number(b.tailleMax) : Infinity;
    return valA - valB;
  });

  renderStockTable(filtered);
}

/**
 * Rendu du tableau optimisé pour le contrôle physique
 */
function renderStockTable(items) {
  const tbody = document.getElementById("stock-table-body");
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b; padding: 20px;">Aucun équipement trouvé.</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((item) => {
      const statutRaw = item.statut || "en_stock";
      let badgeHTML = "";

      if (statutRaw === "en_stock" || statutRaw === "disponible") {
        badgeHTML = `<span style="background: #dcfce7; color: #15803d; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">En Stock</span>`;
      } else if (statutRaw === "attribue" || statutRaw === "prete") {
        badgeHTML = `<span style="background: #ffedd5; color: #c2410c; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">Sorti / Prêté</span>`;
      } else {
        badgeHTML = `<span style="background: #fee2e2; color: #b91c1c; padding: 4px 8px; border-radius: 4px; font-weight: 500; font-size: 12px;">${statutRaw}</span>`;
      }

      const tailleMaxDisplay =
        item.tailleMax !== null && item.tailleMax !== undefined
          ? `<strong style="color: #0284c7;">${item.tailleMax} cm</strong>`
          : `<span style="color: #94a3b8;">-</span>`;

      return `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px; font-weight: 600; color: #0f172a;">${tailleMaxDisplay}</td>
          <td style="padding: 10px; font-weight: bold; color: #334155;">${item.type || "-"}</td>
          <td style="padding: 10px;">${item.marque || "-"} ${item.modele ? `<small style="color: #64748b;">(${item.modele})</small>` : ""}</td>
          <td style="padding: 10px;">${item.taille || "-"}</td>
          <td style="padding: 10px;">${item.tailleEnfant || "-"}</td>
          <td style="padding: 10px;">${badgeHTML}</td>
        </tr>
      `;
    })
    .join("");
}

/**
 * Réinitialise les filtres
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
