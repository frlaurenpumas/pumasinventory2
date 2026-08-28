// Variable globale pour connaître le rôle utilisateur
let currentUserAdmin = false;

firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    try {
      // 1. Récupération des Custom Claims pour vérifier le rôle Admin
      const tokenResult = await user.getIdTokenResult();
      currentUserAdmin = !!tokenResult.claims.admin;

      // 2. Gestion dynamique de l'affichage des fonctions Admin (Seulement cosmétique)
      const adminImportElements = document.querySelectorAll(".admin-only");
      adminImportElements.forEach(el => {
        el.style.display = currentUserAdmin ? "block" : "none";
      });

      console.log(`Connecté en tant que : ${user.email} (Admin: ${currentUserAdmin})`);

      // 3. Lancer l'écouteur du comptoir 2 si la fonction existe
      if (typeof listenToQueueC2 === "function") {
        listenToQueueC2();
      }
    } catch (error) {
      console.error("Erreur lors de la récupération des jetons :", error);
    }
  } else {
    // Redirection si non connecté
    if (!window.location.pathname.includes("login.html")) {
      window.location.href = "login.html";
    }
  }
});

// Gestion du mot de passe oublié
const forgotPasswordLink = document.getElementById('forgot-password-link');

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const emailInput = document.getElementById('email')?.value.trim();
    const messageElement = document.getElementById('auth-message');

    if (!emailInput) {
      if (messageElement) {
        messageElement.textContent = "Veuillez d'abord saisir votre adresse email ci-dessus.";
        messageElement.style.color = "orange";
      }
      return;
    }

    try {
      await firebase.auth().sendPasswordResetEmail(emailInput);
      
      if (messageElement) {
        // Message générique pour éviter l'énumération de comptes
        messageElement.textContent = "Si cet e-mail correspond à un compte, un lien de réinitialisation vous a été envoyé. Vérifiez vos spams.";
        messageElement.style.color = "green";
      }
    } catch (error) {
      console.error("Erreur réinitialisation :", error);
      if (messageElement) {
        messageElement.textContent = "Erreur lors de la demande. Veuillez réessayer.";
        messageElement.style.color = "red";
      }
    }
  });
}

// Fonction de reset Password à la demande
async function resetPasswordOnDemand() {
  const user = firebase.auth().currentUser;

  if (!user || !user.email) {
    alert("Aucun utilisateur connecté.");
    return;
  }

  const confirmReset = confirm(`Un e-mail de réinitialisation va être envoyé à : ${user.email}.\n\nVoulez-vous continuer ?`);

  if (confirmReset) {
    try {
      await firebase.auth().sendPasswordResetEmail(user.email);
      alert(`Un e-mail a été envoyé à ${user.email}. Cliquez sur le lien reçu pour modifier votre mot de passe.`);
    } catch (error) {
      console.error("Erreur réinitialisation mot de passe :", error);
      alert("Erreur lors de l'envoi de l'e-mail : " + error.message);
    }
  }
}

// Fonction de déconnexion
async function logout() {
  try {
    await firebase.auth().signOut();
    window.location.href = "login.html";
  } catch (error) {
    console.error("Erreur lors de la déconnexion :", error);
    alert("Erreur lors de la déconnexion : " + error.message);
  }
}
