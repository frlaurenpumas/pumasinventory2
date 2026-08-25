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

// Initialisation globalement exposée
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
console.log("[DEBUG] Firebase Firestore initialisé avec succès.");
