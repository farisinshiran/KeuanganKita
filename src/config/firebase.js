// Firebase Configuration
// SECURITY: Copy .env.example -> .env.local and fill in your Firebase project values.
// Never commit real credentials. See README for setup instructions.

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Warn during development if env vars are missing
if (import.meta.env.DEV && !firebaseConfig.apiKey) {
  console.error(
    '[firebase.js] Firebase config is missing.\n' +
    'Copy .env.example to .env.local and fill in your Firebase project values.'
  );
}

// Initialize Firebase
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// Firestore path namespace -- change to match your project
const appId = import.meta.env.VITE_APP_ID || 'dompet-keluarga';

// App version
const APP_VERSION = '3.2.0';

// True when no Firebase API key is configured (GitHub Pages demo, offline preview).
// In this mode Vite aliases firebase/* to localStorage-backed mocks.
export const IS_DEMO_MODE = !import.meta.env.VITE_FIREBASE_API_KEY;

export { app, auth, db, appId, APP_VERSION };
