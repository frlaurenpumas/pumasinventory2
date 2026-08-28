// Initialisation Firebase (SDK v9+ modular import via CDN dans index.html ou global)
const firebaseConfig = { 
  apiKey: "AIzaSyANq5OTGWebaQlXk9wBLI9DXO21T_KZQxo", 
  authDomain: "pumasinventory2.firebaseapp.com", 
  projectId: "pumasinventory2", 
  storageBucket: "pumasinventory2.firebasestorage.app", 
  messagingSenderId: "676551378696", 
  appId: "1:676551378696:web:a0f95c62c1b35b5f2c8ebd", 
  measurementId: "G-K0HTSGSE9W" 
}; 

// 2. Initialisation de l'application Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// 3. Export des instances Auth et Firestore
const auth = firebase.auth();

// On vérifie que le module Firestore est bien présent avant de l'instancier
const db = typeof firebase.firestore === 'function' ? firebase.firestore() : null;
