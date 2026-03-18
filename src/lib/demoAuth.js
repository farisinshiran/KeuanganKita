/**
 * demoAuth.js — stub for firebase/auth in demo mode.
 * Auto-logs in a "Demo User" so the app renders without any Google OAuth.
 */

const DEMO_USER = {
  uid: 'demo-user',
  email: 'demo@dompet-keluarga.app',
  displayName: 'Demo User',
  photoURL: 'https://ui-avatars.com/api/?name=Demo+User&background=10B981&color=fff&size=64',
};

export const getAuth = () => ({ currentUser: DEMO_USER });

export class GoogleAuthProvider {}

/** In demo mode sign-in is instant — the user is already "logged in". */
export const signInWithPopup = async () => ({ user: DEMO_USER });

/** Sign-out is a no-op in demo mode. */
export const signOut = async () => {};

/**
 * Immediately calls the callback with the demo user.
 * Uses queueMicrotask so React's useEffect subscription is in place first.
 */
export const onAuthStateChanged = (_auth, callback) => {
  queueMicrotask(() => callback(DEMO_USER));
  return () => {};
};
