import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Configuration Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAaZq5n65F4QnAMqH_m77-BxWa7-GfgrBI",
  authDomain: "dlc-watcher.firebaseapp.com",
  projectId: "dlc-watcher",
  storageBucket: "dlc-watcher.firebasestorage.app",
  messagingSenderId: "750661371923",
  appId: "1:750661371923:web:24d91060e5b3354a2717e6"
};

// Initialisation de Firebase
const app = initializeApp(firebaseConfig);

// Export des services Firebase
export const db = getFirestore(app);
export const auth = getAuth(app); 