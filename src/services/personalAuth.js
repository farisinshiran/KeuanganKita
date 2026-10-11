/**
 * personalAuth.js
 * Handles personal authentication via role + PIN (Ayah / Ibu / Anak).
 * Uses Firebase Anonymous Auth as the underlying auth mechanism.
 * User profile (name, role, pinHash, familyId) is stored in Firestore under users/{uid}.
 */
import {
  signInAnonymously,
  signOut,
} from 'firebase/auth';
import {
  doc, setDoc, getDoc, collection, query, where, getDocs,
  serverTimestamp, updateDoc, arrayUnion,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const USERS_COL = 'users';
const FAMILIES_COL = 'families';

// Role constants
export const ROLES = Object.freeze({
  AYAH: 'ayah',
  IBU:  'ibu',
  ANAK: 'anak',
});

export const ROLE_LABELS = Object.freeze({
  id: { ayah: 'Ayah', ibu: 'Ibu', anak: 'Anak' },
  en: { ayah: 'Father', ibu: 'Mother', anak: 'Child' },
});

// ── PIN hashing (SHA-256 via Web Crypto API) ──────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

async function verifyPin(plain, hash) {
  if (!hash) return false;
  return (await sha256(plain)) === hash;
}

// ── Get or create anonymous Firebase Auth user ───────────────
async function ensureAnonUser() {
  if (auth.currentUser) return auth.currentUser;
  const result = await signInAnonymously(auth);
  return result.user;
}

// ── Validate PIN format (6 digits) ────────────────────────────
function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

// ── Validate name (non-empty, max 40 chars) ───────────────────
function isValidName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 40;
}

// ── Find user by name + role (for login lookup) ──────────────
async function findUserByNameAndRole(name, role) {
  const q = await getDocs(
    query(
      collection(db, USERS_COL),
      where('name', '==', name.trim()),
      where('role', '==', role),
    )
  );
  if (q.empty) return null;
  return { id: q.docs[0].id, ...q.docs[0].data() };
}

// ── Create new personal account (signup) ──────────────────────
async function signUp({ name, role, pin, dob = null, familyId = null }) {
  if (!isValidName(name)) {
    throw new Error('Nama harus diisi (1-40 karakter).');
  }
  if (!Object.values(ROLES).includes(role)) {
    throw new Error('Peran tidak valid.');
  }
  if (!isValidPin(pin)) {
    throw new Error('PIN harus 6 digit angka.');
  }
  if (role === ROLES.ANAK && !dob) {
    throw new Error('Tanggal lahir wajib untuk peran Anak.');
  }

  // Check duplicate (same name + role already exists)
  const existing = await findUserByNameAndRole(name, role);
  if (existing) {
    throw new Error(`Akun dengan nama "${name.trim()}" dan peran ${role} sudah ada. Silakan login.`);
  }

  const user = await ensureAnonUser();
  const pinHash = await sha256(pin);

  // If no familyId, create a new family automatically
  let resolvedFamilyId = familyId;
  if (!resolvedFamilyId) {
    const familyRef = doc(collection(db, FAMILIES_COL));
    await setDoc(familyRef, {
      name: `Keluarga ${name.trim()}`,
      members: [user.uid],
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
    resolvedFamilyId = familyRef.id;
  } else {
    // Verify family exists & add self
    const famRef = doc(db, FAMILIES_COL, resolvedFamilyId);
    const famSnap = await getDoc(famRef);
    if (!famSnap.exists()) {
      throw new Error('Kode keluarga tidak ditemukan. Periksa kembali.');
    }
    await updateDoc(famRef, {
      members: arrayUnion(user.uid),
    });
  }

  const userRef = doc(db, USERS_COL, user.uid);
  await setDoc(userRef, {
    name: name.trim(),
    role,
    pinHash,
    dob: dob || null,
    familyId: resolvedFamilyId,
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp(),
  });

  return {
    uid: user.uid,
    name: name.trim(),
    role,
    familyId: resolvedFamilyId,
    isNewUser: true,
  };
}

// ── Login to existing personal account ────────────────────────
async function signIn({ name, role, pin }) {
  if (!isValidName(name)) {
    throw new Error('Nama harus diisi.');
  }
  if (!Object.values(ROLES).includes(role)) {
    throw new Error('Peran tidak valid.');
  }
  if (!isValidPin(pin)) {
    throw new Error('PIN harus 6 digit angka.');
  }

  const found = await findUserByNameAndRole(name, role);
  if (!found) {
    throw new Error(`Akun "${name.trim()}" dengan peran ${role} belum terdaftar. Silakan daftar dulu.`);
  }

  const valid = await verifyPin(pin, found.pinHash);
  if (!valid) {
    throw new Error('PIN salah. Coba lagi.');
  }

  // Ensure anon auth
  await ensureAnonUser();

  // Update last login
  await updateDoc(doc(db, USERS_COL, found.id), {
    lastLoginAt: serverTimestamp(),
  });

  return {
    uid: found.id,
    name: found.name,
    role: found.role,
    familyId: found.familyId,
    dob: found.dob || null,
    isNewUser: false,
  };
}

// ── Quick demo login (for testing only) ──────────────────────
async function signInDemo(role) {
  if (!Object.values(ROLES).includes(role)) {
    throw new Error('Peran demo tidak valid.');
  }
  const demoAccounts = {
    [ROLES.AYAH]: { name: 'Ahmad Fauzi',  pin: '111111' },
    [ROLES.IBU]:  { name: 'Siti Aminah',  pin: '222222' },
    [ROLES.ANAK]: { name: 'Aisyah Putri', pin: '333333' },
  };
  const acc = demoAccounts[role];
  return signIn(acc);
}

// ── Sign out ──────────────────────────────────────────────────
async function personalSignOut() {
  return signOut(auth);
}

// ── Check if user exists by uid ──────────────────────────────
async function getUser(uid) {
  const snap = await getDoc(doc(db, USERS_COL, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

// ── Get family by id ──────────────────────────────────────────
async function getFamily(familyId) {
  if (!familyId) return null;
  const snap = await getDoc(doc(db, FAMILIES_COL, familyId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export {
  sha256,
  verifyPin,
  isValidPin,
  isValidName,
  signUp,
  signIn,
  signInDemo,
  personalSignOut,
  getUser,
  getFamily,
  findUserByNameAndRole,
};
