/**
 * familyAuth.js
 * Role-based PIN authentication — Ayah / Ibu / Anak.
 *
 * Login flow:
 *   1. Pilih peran (ayah | ibu | anak)
 *   2. Masukkan nama + PIN 6 digit
 *   3. Lookup: users WHERE name == X AND role == Y
 *   4. Verify PIN → return { uid, name, role, familyId, dob }
 *
 * Data path di Firestore (selalu 'users', tanpa 'households'):
 *   users/{uid}          — profil anggota keluarga
 *   families/{familyId}   — grup keluarga (members: uid[])
 *
 * Dummy accounts (di-seed otomatis):
 *   Faris   (ayah)  PIN 111111
 *   Aisyah  (ibu)   PIN 222222
 *   Naura   (anak)  PIN 333333  dob 2015-03-20
 *   Haffi   (anak)  PIN 444444  dob 2012-07-15
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

const USERS_COL   = 'users';
const FAMILIES_COL = 'families';
const FAMILY_NAME = 'Keluarga Faris';

// ── Role constants ─────────────────────────────────────────────
export const ROLES = Object.freeze({
  AYAH: 'ayah',
  IBU:  'ibu',
  ANAK: 'anak',
});

export const ROLE_LABELS = Object.freeze({
  id: { ayah: 'Ayah',   ibu: 'Ibu',   anak: 'Anak'  },
  en: { ayah: 'Father',  ibu: 'Mother', anak: 'Child' },
});

export const ROLE_ICONS = Object.freeze({
  ayah:  '👨',
  ibu:   '👩',
  anak:  '👦',
});

// ── PIN hashing (SHA-256) ─────────────────────────────────────
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Get / create anonymous Firebase Auth user ────────────────
async function ensureAnonUser() {
  if (auth.currentUser) return auth.currentUser;
  const result = await signInAnonymously(auth);
  return result.user;
}

// ── Validate PIN (6 digit) ───────────────────────────────────
export function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

// ── Validate name ────────────────────────────────────────────
export function isValidName(name) {
  return typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 40;
}

// ── Find user by name + role ────────────────────────────────
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

// ── Seed dummy accounts ──────────────────────────────────────
const DUMMY_ACCOUNTS = [
  { name: 'Faris',  role: ROLES.AYAH, pin: '111111', dob: null  },
  { name: 'Aisyah', role: ROLES.IBU,  pin: '222222', dob: null  },
  { name: 'Naura',  role: ROLES.ANAK, pin: '333333', dob: '2015-03-20' },
  { name: 'Haffi',  role: ROLES.ANAK, pin: '444444', dob: '2012-07-15' },
];

export async function seedDummyAccounts() {
  const user = await ensureAnonUser();

  // Create family group (idempotent — skip if exists)
  let familyId = localStorage.getItem('dkFamilyId');
  if (!familyId) {
    familyId = `family_${Date.now()}`;
    await setDoc(doc(db, FAMILIES_COL, familyId), {
      name: FAMILY_NAME,
      members: [],
      createdAt: serverTimestamp(),
      createdBy: user.uid,
    });
    localStorage.setItem('dkFamilyId', familyId);
  } else {
    // Verify family exists
    const famSnap = await getDoc(doc(db, FAMILIES_COL, familyId));
    if (!famSnap.exists()) {
      await setDoc(doc(db, FAMILIES_COL, familyId), {
        name: FAMILY_NAME,
        members: [],
        createdAt: serverTimestamp(),
        createdBy: user.uid,
      });
    }
  }

  // Seed each dummy account (idempotent)
  for (const acc of DUMMY_ACCOUNTS) {
    const existing = await findUserByNameAndRole(acc.name, acc.role);
    if (existing) continue; // already seeded

    const uid   = `${acc.role}_${acc.name.toLowerCase()}_${Date.now()}`;
    const pinHash = await sha256(acc.pin);

    await setDoc(doc(db, USERS_COL, uid), {
      name:     acc.name,
      role:     acc.role,
      pinHash,
      dob:      acc.dob,
      familyId,
      createdAt:    serverTimestamp(),
      lastLoginAt:  serverTimestamp(),
      isDummy:      true,
    });

    // Add to family members
    await updateDoc(doc(db, FAMILIES_COL, familyId), {
      members: arrayUnion(uid),
    });
  }
}

// ── Login via PIN ─────────────────────────────────────────────
export async function signInWithPin({ name, role, pin }) {
  if (!isValidName(name)) throw new Error('Nama harus diisi.');
  if (!Object.values(ROLES).includes(role)) throw new Error('Peran tidak valid.');
  if (!isValidPin(pin)) throw new Error('PIN harus 6 digit angka.');

  // Try to find existing account
  let found = await findUserByNameAndRole(name, role);

  // Auto-seed dummy accounts on first login attempt
  if (!found) {
    await seedDummyAccounts();
    found = await findUserByNameAndRole(name, role);
  }

  if (!found) {
    throw new Error(`Akun "${name.trim()}" dengan peran ${role} belum terdaftar.`);
  }

  // Verify PIN
  const pinHash = await sha256(pin);
  if (pinHash !== found.pinHash) {
    throw new Error('PIN salah. Coba lagi.');
  }

  // Ensure Firebase anon auth
  await ensureAnonUser();

  // Update last login
  await updateDoc(doc(db, USERS_COL, found.id), {
    lastLoginAt: serverTimestamp(),
  });

  return {
    uid:      found.id,
    name:     found.name,
    role:     found.role,
    familyId: found.familyId,
    dob:      found.dob || null,
    isNewUser: false,
  };
}

// ── Sign out ─────────────────────────────────────────────────
export async function familySignOut() {
  return signOut(auth);
}

// ── Get user by uid ──────────────────────────────────────────
export async function getFamilyUser(uid) {
  const snap = await getDoc(doc(db, USERS_COL, uid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
