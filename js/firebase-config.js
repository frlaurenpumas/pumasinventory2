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
  apiKey: "VOTRE_API_KEY",
  authDomain: "votre-app.firebaseapp.com",
  projectId: "votre-app-id",
  storageBucket: "votre-app.appspot.com",
  messagingSenderId: "XXXXXX",
  appId: "XXXXXX"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db, collection, doc, setDoc, addDoc, updateDoc, serverTimestamp, query, where, onSnapshot, getDocs };
