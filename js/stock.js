/**
 * js/stock.js
 * Vue Récolement / Inventaire physique du stock.
 * Regroupe les équipements individuels par [Type + Taille] pour afficher les quantités disponibles.
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
 * Chargement en temps réel depuis Firestore (collection "equipment")
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
      filterAndRenderStockTable();
    },
    (error) => {
      console.error("Erreur de chargement du stock (equipment):", error);
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #ef4444; padding: 20px;">Erreur de chargement des données.</td></tr>`;
      }
    }
  );
}

/**
 * Remplit le filtre par Type d'équipement
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
 * Agrège les données par (Type + Taille) et filtre le tableau
 */
function filterAndRenderStockTable() {
  const searchTaille = document.getElementById("stock-filter-search")?.value.toLowerCase().trim() || "";
  const typeFilter = document.getElementById("stock-filter-type")?.value || "";

  // 1. Dictionnaire d'agrégation : clé = "Type|TailleMax|TailleTexte"
  const aggregatedMap = {};

  allStockItems.forEach((item) => {
    const type = item.type || "Non spécifié";
    
    // Détermination du libellé de taille affiché
    let tailleLabel = "-";
    if (item.tailleMax !== null && item.tailleMax !== undefined && item.tailleMax !== "") {
      tailleLabel = `${item.tailleMax} cm`;
    } else if (item.taille) {
      tailleLabel = item.taille;
    } else if (item.tailleEnfant) {
      tailleLabel = item.tailleEnfant;
    }

    const key = `${type}__${tailleLabel}`;

    if (!aggregatedMap[key]) {
      aggregatedMap[key] = {
        type: type,
        tailleDisplay: tailleLabel,
        tailleMaxVal: item.tailleMax !== null && item.tailleMax !== undefined ? Number(item.tailleMax) : Infinity,
        quantiteEnStock: 0,
        totalRef: 0
      };
    }

    aggregatedMap[key].totalRef += 1;

    // Statut en stock / disponible
    const isEnStock = !item.statut || item.statut === "en_stock" || item.statut === "disponible";
    if (isEnStock) {
      aggregatedMap[key].quantiteEnStock += 1;
    }
  });

  // 2. Conversion en tableau
  let groups = Object.values(aggregatedMap);

  // 3. Application des filtres
  groups = groups.filter((g) => {
    const matchesType = !typeFilter || g.type === typeFilter;
    const matchesTaille = !searchTaille || g.tailleDisplay.toLowerCase().includes(searchTaille);
    return matchesType && matchesTaille;
  });

  // 4. Tri : D'abord par Type (alphabétique) puis par Taille MAX (croissant)
  groups.sort((a, b) => {
    const typeA = a.type.toLowerCase();
    const typeB = b.type.toLowerCase();

    if (typeA < typeB) return -1;
    if (typeA > typeB) return 1;

    return a.tailleMaxVal - b.tailleMaxVal;
  });

  // 5. Calcul des KPIs globaux
  updateKPIsFromGroups(groups);

  // 6. Rendu dans le tableau
  renderAggregatedTable(groups);
}

/**
 * Calcule et affiche les KPI globaux
 */
function updateKPIsFromGroups(groups) {
  const totalEnStock = groups.reduce((acc, g) => acc + g.quantiteEnStock, 0);
  const totalRuptures = groups.filter((g) => g.quantiteEnStock === 0).length;

  const elTotal = document.getElementById("stock-kpi-total");
  const elRuptures = document.getElementById("stock-kpi-prete"); // ou ID dédié aux ruptures

  if (elTotal) elTotal.textContent = totalEnStock;
  if (elRuptures) elRuptures.textContent = totalRuptures;
}

/**
 * Génération du HTML du tableau avec le style coloré par statut
 */
function renderAggregatedTable(groups) {
  const tbody = document.getElementById("stock-table-body");
  if (!tbody) return;

  if (groups.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Aucun équipement trouvé.</td></tr>`;
    return;
  }

  tbody.innerHTML = groups
    .map((g) => {
      let rowStyle = "";
      let badgeHTML = "";

      if (g.quantiteEnStock === 0) {
        // En rupture
        rowStyle = 'style="background-color: #fef2f2; color: #991b1b;"';
        badgeHTML = `<span style="color: #dc2626; font-weight: 600;">🔴 Rupture</span>`;
      } else if (g.quantiteEnStock <= 2) {
        // Stock faible
        rowStyle = 'style="background-color: #eff6ff; color: #1e3a8a;"';
        badgeHTML = `<span style="color: #d97706; font-weight: 600;">🟠 Stock faible</span>`;
      } else {
        // Disponible
        rowStyle = 'style="background-color: #eff6ff; color: #1e3a8a;"';
        badgeHTML = `<span style="color: #16a34a; font-weight: 600;">🟢 Disponible</span>`;
      }

      return `
        <tr ${rowStyle} style="border-bottom: 1px solid #e2e8f0; font-size: 14px;">
          <td style="padding: 12px; font-weight: 600;">${g.type}</td>
          <td style="padding: 12px; font-weight: 600;">${g.tailleDisplay}</td>
          <td style="padding: 12px; font-weight: bold; font-size: 15px;">${g.quantiteEnStock}</td>
          <td style="padding: 12px;">${badgeHTML}</td>
        </tr>
      `;
    })
    .join("");
}

/**
 * Réinitialise tous les filtres
 */
function resetStockFilters() {
  const searchInput = document.getElementById("stock-filter-search");
  const typeSelect = document.getElementById("stock-filter-type");

  if (searchInput) searchInput.value = "";
  if (typeSelect) typeSelect.value = "";

  filterAndRenderStockTable();
}

// Expositions globales
window.initStockView = initStockView;
window.filterStockTable = filterAndRenderStockTable;
window.resetStockFilters = resetStockFilters;
