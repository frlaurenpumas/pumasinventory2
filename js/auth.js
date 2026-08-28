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

// Gestion de la soumission du formulaire de connexion
const loginForm = document.getElementById('login-form');

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Empêche le rechargement de la page

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const messageElement = document.getElementById('auth-message');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (messageElement) {
      messageElement.textContent = '';
      messageElement.style.color = 'inherit';
    }

    try {
      // Connexion à Firebase
      await firebase.auth().signInWithEmailAndPassword(email, password);
      
      // Redirection vers l'application principale
      window.location.href = 'index.html';
    } catch (error) {
      console.error("Erreur de connexion :", error);
      
      if (messageElement) {
        messageElement.style.color = '#dc2626'; // Rouge
        
        // Gestion unifiée de l'erreur d'identifiants
        if (
          error.code === 'auth/invalid-login-credentials' ||
          error.code === 'auth/user-not-found' || 
          error.code === 'auth/wrong-password'
        ) {
          messageElement.textContent = "Email ou mot de passe incorrect.";
        } else {
          messageElement.textContent = "Erreur de connexion : " + error.message;
        }
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

async function inviteVolunteer(email) {
  if (!currentUserAdmin) {
    alert("Seuls les administrateurs peuvent inviter des bénévoles.");
    return;
  }

  try {
    // 1. Génération d'un mot de passe temporaire aléatoire
    const tempPassword = Math.random().toString(36).slice(-10) + "A1!";

    // 2. Création du compte dans Firebase
    // Note : createUserWithEmailAndPassword connecte automatiquement le nouveau compte
    // On conserve donc la session admin en utilisant une instance secondaire si nécessaire, 
    // ou via le SDK Admin / une Cloud Function pour les déploiements plus avancés.
    
    // Méthode simplifiée côté client : envoi d'un lien de réinitialisation direct
    await firebase.auth().sendPasswordResetEmail(email);
    
    alert(`Un e-mail d'invitation a été envoyé à ${email} !`);
  } catch (error) {
    console.error("Erreur d'invitation :", error);
    alert("Erreur lors de l'envoi de l'invitation : " + error.message);
  }
}
