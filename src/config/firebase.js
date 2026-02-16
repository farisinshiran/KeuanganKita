// Firebase Configuration
// SECURITY: Use environment variables instead of hardcoded values
// Create a .env.local file in the project root with your Firebase config

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAC5_LnGPcZtLyFB091FaUfEu6_AjJsLbQ",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "dompet-keluarga-prod.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "dompet-keluarga-prod",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "dompet-keluarga-prod.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "68401529984",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:68401529984:web:0749e9b641771b3064d265",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-NKY1EL3HXN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// App ID constant - used for Firestore paths
const appId = import.meta.env.VITE_APP_ID || 'dompet-keluarga-prod';

// App version
const APP_VERSION = '3.2.0';

export { app, auth, db, appId, APP_VERSION };
