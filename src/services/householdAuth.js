/**
 * householdAuth.js
 * Handles family household authentication via PIN / Password.
 * Uses Firebase Anonymous Auth as the underlying auth mechanism.
 * PIN/password and household metadata are stored in Firestore.
 */
import {
  signInAnonymously,
  signOut,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, updateDoc,
  collection, query, where, getDocs,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const HOUSEHOLD_COL = 'households';

// ── PIN / Password Hashing (SHA-256 via Web Crypto API) ──────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Verify credentials against stored hash ───────────────────
async function verifyCredentials(plainText, storedHash) {
  const hash = await sha256(plainText);
  return hash === storedHash;
}

// ── Get or create anonymous Firebase Auth user ───────────────
async function ensureAnonUser() {
  // If already signed in anonymously, return current user
  if (auth.currentUser) {
    return auth.currentUser;
  }

  // Sign in anonymously using Firebase docs pattern
  try {
    const result = await signInAnonymously(auth);
    console.log('[householdAuth] Anonymous sign-in successful:', result.user.uid);
    return result.user;
  } catch (error) {
    console.error('[householdAuth] Anonymous sign-in failed:', error.code, error.message);
    throw new Error(`Authentication failed: ${error.message} (${error.code})`);
  }
}

// ── Create a new household ───────────────────────────────────
async function createHousehold({ householdName, memberName, pin, password }) {
  const user = await ensureAnonUser();

  const pinHash   = pin      ? await sha256(pin)      : null;
  const passHash  = password ? await sha256(password) : null;

  const householdRef = doc(collection(db, HOUSEHOLD_COL));

  await setDoc(householdRef, {
    name:       householdName.trim(),
    pinHash,
    passHash,
    createdAt:  serverTimestamp(),
    creatorId:  user.uid,
    authUid:    user.uid,
    members:    [memberName.trim()],
  });

  return {
    householdId: householdRef.id,
    householdName: householdName.trim(),
    memberName: memberName.trim(),
    isCreator: true,
    authUid: user.uid,
  };
}

// ── Join an existing household ────────────────────────────────
async function joinHousehold({ householdName, memberName, pin, password }) {
  const q = await getDocs(
    query(collection(db, HOUSEHOLD_COL), where('name', '==', householdName.trim()))
  );

  if (q.empty) {
    throw new Error('Household not found. Please check the name.');
  }

  const householdDoc = q.docs[0];
  const data = householdDoc.data();

  // Verify PIN
  if (data.pinHash) {
    if (!pin) throw new Error('PIN is required for this household.');
    const valid = await verifyCredentials(pin, data.pinHash);
    if (!valid) throw new Error('Invalid PIN. Please try again.');
  }

  // Verify Password
  if (data.passHash) {
    if (!password) throw new Error('Password is required for this household.');
    const valid = await verifyCredentials(password, data.passHash);
    if (!valid) throw new Error('Invalid password. Please try again.');
  }

  if (!data.pinHash && !data.passHash) {
    throw new Error('This household has no PIN or password set. Please use Google login.');
  }

  const user = await ensureAnonUser();

  // Add member to household if not already present
  if (!data.members.includes(memberName.trim())) {
    await updateDoc(householdDoc.ref, {
      members: arrayUnion(memberName.trim()),
    });
  }

  return {
    householdId: householdDoc.id,
    householdName: data.name,
    memberName: memberName.trim(),
    isCreator: false,
    authUid: user.uid,
  };
}

// ── Change household PIN / Password ──────────────────────────
async function changeHouseholdCredentials(householdId, { pin, password }) {
  const ref = doc(db, HOUSEHOLD_COL, householdId);
  const updates = {};
  if (pin      !== undefined) updates.pinHash  = pin      ? await sha256(pin)      : null;
  if (password !== undefined) updates.passHash = password ? await sha256(password) : null;
  await updateDoc(ref, updates);
}

// ── Check if a household name is available ───────────────────
async function isHouseholdNameAvailable(name) {
  const q = await getDocs(
    query(collection(db, HOUSEHOLD_COL), where('name', '==', name.trim()))
  );
  return q.empty;
}

// ── Sign out from household (just the anonymous auth) ────────
async function householdSignOut() {
  return signOut(auth);
}

export {
  sha256,
  verifyCredentials,
  createHousehold,
  joinHousehold,
  changeHouseholdCredentials,
  isHouseholdNameAvailable,
  householdSignOut,
};
