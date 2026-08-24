import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  serverTimestamp, 
  query, 
  where, 
  onSnapshot,
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = { 
  apiKey: "AIzaSyANq5OTGWebaQlXk9wBLI9DXO21T_KZQxo", 
  authDomain: "pumasinventory2.firebaseapp.com", 
  projectId: "pumasinventory2", 
  storageBucket: "pumasinventory2.firebasestorage.app", 
  messagingSenderId: "676551378696", 
  appId: "1:676551378696:web:a0f95c62c1b35b5f2c8ebd", 
  measurementId: "G-K0HTSGSE9W" 
}; 

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, doc, setDoc, addDoc, updateDoc, serverTimestamp, query, where, onSnapshot, getDocs };
