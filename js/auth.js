// Variable globale pour connaître le rôle utilisateur dans ton app
let currentUserAdmin = false;

firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    // 1. Récupération des Custom Claims pour vérifier le rôle Admin
    const tokenResult = await user.getIdTokenResult();
    currentUserAdmin = !!tokenResult.claims.admin;

    // 2. Gestion dynamique de l'affichage des fonctions Admin (Imports)
    const adminImportElements = document.querySelectorAll(".admin-only");
    adminImportElements.forEach(el => {
      el.style.display = currentUserAdmin ? "block" : "none";
    });

    console.log(`Connecté en tant que : ${user.email} (Admin: ${currentUserAdmin})`);

    // 3. Lancer l'écouteur du comptoir 2 si la fonction existe
    if (typeof listenToQueueC2 === "function") {
      listenToQueueC2();
    }
  } else {
    // Si l'utilisateur n'est pas connecté et n'est pas déjà sur la page de login -> Redirection
    if (!window.location.pathname.endsWith("login.html")) {
      window.location.href = "login.html";
    }
  }
});

// Fonction de déconnexion à attacher à un bouton dans ton interface
function logout() {
  firebase.auth().signOut().then(() => {
    window.location.href = "login.html";
  });
}