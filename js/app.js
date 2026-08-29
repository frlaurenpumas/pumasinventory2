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
 * ZONE profil utilisateur
 */
function toggleUserDropdown() {
  const dropdown = document.getElementById("user-dropdown");
  if (dropdown) {
    dropdown.classList.toggle("hidden");
  }
}

// Rendre la fonction accessible depuis le HTML onclick
window.toggleUserDropdown = toggleUserDropdown;

/**
 * Ferme le menu si l'utilisateur clique en dehors de la zone
 */
window.addEventListener("click", (e) => {
  if (!e.target.closest(".user-menu-container")) {
    const dropdown = document.getElementById("user-dropdown");
    if (dropdown && !dropdown.classList.contains("hidden")) {
      dropdown.classList.add("hidden");
    }
  }
});


function logout() {
  firebase.auth().signOut()
    .then(() => {
      console.log("Déconnexion réussie");
      window.location.reload();
    })
    .catch((error) => console.error("Erreur déconnexion :", error));
}

function resetPasswordOnDemand() {
  const user = firebase.auth().currentUser;
  if (user && user.email) {
    firebase.auth().sendPasswordResetEmail(user.email)
      .then(() => alert(`Un e-mail de réinitialisation a été envoyé à ${user.email}`))
      .catch((err) => alert("Erreur lors de l'envoi de l'e-mail : " + err.message));
  }
}

// Attachement au scope global pour les clics HTML
window.logout = logout;
window.resetPasswordOnDemand = resetPasswordOnDemand;

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
