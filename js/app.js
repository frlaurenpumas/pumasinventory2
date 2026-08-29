// Initialisation au chargement de la page
document.addEventListener("DOMContentLoaded", () => {
  console.log("[DEBUG] Application initialisée.");

  // Navigation onglets
  document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const tabId = e.currentTarget.getAttribute("data-tab");
      switchTab(tabId, e.currentTarget);
    });
  });

  // Appels sécurisés des modules métiers
  if (typeof populatePointureOptions === "function") {
    populatePointureOptions();
  } else {
    console.warn("[WARN] populatePointureOptions n'est pas encore accessible.");
  }

  if (typeof listenToQueueC2 === "function") listenToQueueC2();
  if (typeof loadAllAdherentsC1 === "function") loadAllAdherentsC1();
});

// --- GESTION DES ONGLETS ---
function switchTab(tabId, targetBtn) {
  console.log(`[DEBUG] Navigation vers l'onglet : ${tabId}`);
  
  // Masquer toutes les sections
  document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
  
  // Désactiver tous les boutons d'onglets
  document.querySelectorAll(".tab-btn").forEach(el => el.classList.remove("active"));
  
  // Activer l'onglet cible
  const targetTab = document.getElementById(tabId);
  if (targetTab) {
    targetTab.classList.add("active");
  }
  
  // Activer le bouton cliqué
  if (targetBtn) {
    targetBtn.classList.add("active");
  }
}

// Initialisation globale au chargement du DOM
document.addEventListener("DOMContentLoaded", () => {
  console.log("[DEBUG] Application initialisée.");

  // Attacher la navigation sur tous les boutons d'onglets
  document.querySelectorAll(".tab-btn[data-tab]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const tabId = e.currentTarget.getAttribute("data-tab");
      switchTab(tabId, e.currentTarget);
    });
  });

  // Reinitialisation recherche C1 si présente
  const searchInput = document.getElementById("c1-search");
  if (searchInput) searchInput.value = "";

  // Démarrage des modules métiers s'ils existent
  if (typeof populatePointureOptions === "function") populatePointureOptions();
  if (typeof listenToQueueC2 === "function") listenToQueueC2();
  if (typeof loadAllAdherentsC1 === "function") loadAllAdherentsC1();
});
