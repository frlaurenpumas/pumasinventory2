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

// Gestion du mot de passe oublié
const forgotPasswordLink = document.getElementById('forgot-password-link');

if (forgotPasswordLink) {
  forgotPasswordLink.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const emailInput = document.getElementById('email').value.trim();
    const messageElement = document.getElementById('auth-message');

    if (!emailInput) {
      messageElement.textContent = "Veuillez d'abord saisir votre adresse email ci-dessus.";
      messageElement.style.color = "orange";
      return;
    }

    try {
      // Envoi de l'email de réinitialisation par Firebase
      await firebase.auth().sendPasswordResetEmail(emailInput);
      
      messageElement.textContent = "Un e-mail de réinitialisation a été envoyé ! Vérifiez vos spams.";
      messageElement.style.color = "green";
    } catch (error) {
      console.error("Erreur réinitialisation :", error);
      
      if (error.code === 'auth/user-not-found') {
        messageElement.textContent = "Aucun compte ne correspond à cette adresse email.";
      } else {
        messageElement.textContent = "Erreur lors de l'envoi de l'e-mail : " + error.message;
      }
      messageElement.style.color = "red";
    }
  });
}


// Fonction de reset Password à la demande de l'utilisateur

async function resetPasswordOnDemand() {
  const user = firebase.auth().currentUser;

  if (!user || !user.email) {
    alert("Aucun utilisateur connecté.");
    return;
  }

  const confirmReset = confirm(`Un e-mail de réinitialisation de mot de passe va être envoyé à : ${user.email}.\n\nVoulez-vous continuer ?`);

  if (confirmReset) {
    try {
      await firebase.auth().sendPasswordResetEmail(user.email);
      alert(`Un e-mail a été envoyé à ${user.email}. Cliquez sur le lien reçu dans votre boîte mail pour modifier votre mot de passe.`);
    } catch (error) {
      console.error("Erreur réinitialisation mot de passe :", error);
      alert("Erreur lors de l'envoi de l'e-mail : " + error.message);
    }
  }
}




// Fonction de déconnexion à attacher à un bouton dans ton interface
async function logout() {
  try {
    // 1. Déconnexion de la session Firebase
    await firebase.auth().signOut();
    
    // 2. Redirection explicite vers la page de connexion
    window.location.href = "login.html";
  } catch (error) {
    console.error("Erreur lors de la déconnexion :", error);
    alert("Erreur lors de la déconnexion : " + error.message);
  }
}
