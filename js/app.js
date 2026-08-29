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

/**
 * Affiche / Masque le menu déroulant du profil utilisateur
 */
function toggleUserDropdown() {
  const dropdown = document.getElementById("user-dropdown"); // ou le dynamic-ID de ton menu
  if (dropdown) {
    dropdown.classList.toggle("show");
  }
}

// Rendre la fonction accessible depuis les attributs HTML onclick
window.toggleUserDropdown = toggleUserDropdown;

// Optionnel : Fermer le menu si l'utilisateur clique en dehors
window.addEventListener("click", (event) => {
  if (!event.target.matches('.user-profile-btn') && !event.target.closest('.user-profile-btn')) {
    const dropdowns = document.getElementsByClassName("user-dropdown-content");
    for (let i = 0; i < dropdowns.length; i++) {
      const openDropdown = dropdowns[i];
      if (openDropdown.classList.contains('show')) {
        openDropdown.classList.remove('show');
      }
    }
  }
});

// --- GESTION DES ONGLETS ---
function switchTab(tabId, targetBtn) {
  console.log(`[DEBUG] Navigation vers l'onglet : ${tabId}`);
  
  // 1. Masquer tous les onglets et nettoyer le style en ligne
  document.querySelectorAll(".tab-content").forEach(el => {
    el.classList.remove("active");
    el.style.display = ""; // Supprime le "display: none" écrit en dur dans le HTML
  });
  
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
