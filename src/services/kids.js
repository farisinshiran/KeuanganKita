/**
 * kids.js — Firestore CRUD for the Anak (children) feature.
 *
 * First argument of every function is `owner` = { type: 'users'|'households', id }.
 *
 * Data model (under household or user namespace):
 *   kids/{kidId}                      — profile (name, dob, gender, photo, notes)
 *   kids/{kidId}/milestones/{msId}    — developmental milestones (achieved)
 *   kids/{kidId}/logs/{logId}         — daily growth / activity log entries
 *   kids/{kidId}/curriculum/{subId}   — curriculum subject rows (weekly schedule + completion)
 *
 * All functions are pure data accessors; the UI layer decides which
 * milestones / subjects are "presets" for each age.
 */
import {
  collection, doc, addDoc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  query, orderBy, serverTimestamp, onSnapshot, where,
} from 'firebase/firestore';
import { db } from '../config/firebase';

// `owner` = { type: 'users' | 'households', id: string }
// type must match the namespace used by the rest of the app
// (users/{uid} for Google login, households/{householdId} for household login).
const base = (owner, appId) => {
  if (!owner || !owner.id || (owner.type !== 'users' && owner.type !== 'households')) {
    throw new Error('kids: invalid owner {type, id}');
  }
  return ['artifacts', appId, owner.type, owner.id];
};

const kidsCol = (owner, appId) => collection(db, ...base(owner, appId), 'kids');
const kidDoc  = (owner, appId, kidId) => doc(db, ...base(owner, appId), 'kids', kidId);
const subCol  = (owner, appId, kidId, sub) => collection(db, ...base(owner, appId), 'kids', kidId, sub);
const docRef  = (owner, appId, kidId, sub, id) => doc(db, ...base(owner, appId), 'kids', kidId, sub, id);

// ─── Age helper ────────────────────────────────────────────────
export function calcAge(dob) {
  if (!dob) return null;
  const birth = dob.toDate ? dob.toDate() : (dob instanceof Date ? dob : new Date(dob));
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (now.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, totalMonths: years * 12 + months, birthDate: birth };
}

export function formatAge(dob) {
  const a = calcAge(dob);
  if (!a) return '-';
  if (a.years === 0) return `${a.months} bulan`;
  if (a.months === 0) return `${a.years} tahun`;
  return `${a.years} tahun ${a.months} bulan`;
}

// ─── Kids profile ──────────────────────────────────────────────
export async function createKid(owner, appId, payload) {
  const ref = await addDoc(kidsCol(owner, appId), {
    name: payload.name,
    dob: payload.dob, // Date or ISO string
    gender: payload.gender || '',
    photo: payload.photo || '',
    notes: payload.notes || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateKid(owner, appId, kidId, patch) {
  await updateDoc(kidDoc(owner, appId, kidId), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteKid(owner, appId, kidId) {
  await deleteDoc(kidDoc(owner, appId, kidId));
}

export function subscribeKids(owner, appId, cb) {
  return onSnapshot(
    query(kidsCol(owner, appId), orderBy('createdAt', 'asc')),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('kids snapshot error', err); cb([]); }
  );
}

// ─── Milestones ────────────────────────────────────────────────
export async function addMilestone(owner, appId, kidId, payload) {
  const ref = await addDoc(subCol(owner, appId, kidId, 'milestones'), {
    title: payload.title,
    category: payload.category || 'lainnya', // motorik | bahasa | sosial | kognitif | lainnya
    achievedAt: payload.achievedAt || new Date().toISOString().slice(0, 10),
    notes: payload.notes || '',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteMilestone(owner, appId, kidId, msId) {
  await deleteDoc(docRef(owner, appId, kidId, 'milestones', msId));
}

export function subscribeMilestones(owner, appId, kidId, cb) {
  return onSnapshot(
    query(subCol(owner, appId, kidId, 'milestones'), orderBy('achievedAt', 'desc')),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('milestones snapshot error', err); cb([]); }
  );
}

// ─── Daily logs ────────────────────────────────────────────────
export async function addLog(owner, appId, kidId, payload) {
  const ref = await addDoc(subCol(owner, appId, kidId, 'logs'), {
    date: payload.date || new Date().toISOString().slice(0, 10),
    mood: payload.mood || '',
    weightKg: payload.weightKg ?? null,
    heightCm: payload.heightCm ?? null,
    note: payload.note || '',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteLog(owner, appId, kidId, logId) {
  await deleteDoc(docRef(owner, appId, kidId, 'logs', logId));
}

export function subscribeLogs(owner, appId, kidId, cb) {
  return onSnapshot(
    query(subCol(owner, appId, kidId, 'logs'), orderBy('date', 'desc')),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('logs snapshot error', err); cb([]); }
  );
}

// ─── Curriculum ───────────────────────────────────────────────
export async function addCurriculumItem(owner, appId, kidId, payload) {
  const ref = await addDoc(subCol(owner, appId, kidId, 'curriculum'), {
    subject: payload.subject,           // e.g. "Iqra 1", "Matematika", "Calistung"
    goal: payload.goal || '',           // what to achieve
    schedule: payload.schedule || '',   // e.g. "Senin & Kamis, 30 menit"
    notes: payload.notes || '',
    completed: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function toggleCurriculumItem(owner, appId, kidId, itemId, completed) {
  await updateDoc(docRef(owner, appId, kidId, 'curriculum', itemId), {
    completed,
    completedAt: completed ? new Date().toISOString() : null,
  });
}

export async function updateCurriculumItem(owner, appId, kidId, itemId, patch) {
  await updateDoc(docRef(owner, appId, kidId, 'curriculum', itemId), patch);
}

export async function deleteCurriculumItem(owner, appId, kidId, itemId) {
  await deleteDoc(docRef(owner, appId, kidId, 'curriculum', itemId));
}

export function subscribeCurriculum(owner, appId, kidId, cb) {
  return onSnapshot(
    query(subCol(owner, appId, kidId, 'curriculum'), orderBy('createdAt', 'asc')),
    s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))),
    err => { console.error('curriculum snapshot error', err); cb([]); }
  );
}

// ─── Preset milestones by age range ──────────────────────────
// Used to seed suggestions for parents. UI lets user pick from preset
// or write their own.
export const PRESET_MILESTONES = {
  '0-12': [ // 0–12 bulan
    { title: 'Tengkurap', category: 'motorik' },
    { title: 'Duduk sendiri', category: 'motorik' },
    { title: 'Merangkak', category: 'motorik' },
    { title: 'Berdiri dengan berpegangan', category: 'motorik' },
    { title: 'Mengoceh (ba-ba, ma-ma)', category: 'bahasa' },
    { title: 'Kata pertama', category: 'bahasa' },
    { title: 'Senyum responsif', category: 'sosial' },
    { title: 'Mengenal wajah keluarga', category: 'sosial' },
    { title: 'Bermain cilukba', category: 'kognitif' },
    { title: 'Makan MPASI', category: 'lainnya' },
  ],
  '13-36': { // 1–3 tahun
    '1-2': [
      { title: 'Berjalan sendiri', category: 'motorik' },
      { title: 'Naik tangga dengan bantuan', category: 'motorik' },
      { title: 'Makan sendiri dengan sendok', category: 'motorik' },
      { title: 'Bicara 10–20 kata', category: 'bahasa' },
      { title: 'Bicara 2 kata sekaligus', category: 'bahasa' },
      { title: 'Bermain bersama anak lain', category: 'sosial' },
      { title: 'Menyebut nama sendiri', category: 'kognitif' },
    ],
    '2-3': [
      { title: 'Lari tanpa jatuh', category: 'motorik' },
      { title: 'Menggambar garis/coretan', category: 'motorik' },
      { title: 'Bicara kalimat 3 kata', category: 'bahasa' },
      { title: 'Bisa bertanya "apa" & "mengapa"', category: 'bahasa' },
      { title: 'Bisa pakai toilet sendiri', category: 'sosial' },
      { title: 'Mengenal warna', category: 'kognitif' },
    ],
  },
  '37-72': { // 3–6 tahun (usia TK)
    '3-4': [
      { title: 'Bicara jelas dan mudah dimengerti', category: 'bahasa' },
      { title: 'Menggambar orang (lingkaran + garis)', category: 'motorik' },
      { title: 'Bermain peran (pretend play)', category: 'sosial' },
      { title: 'Menghitung 1–10', category: 'kognitif' },
      { title: 'Mengenal huruf', category: 'kognitif' },
    ],
    '4-5': [
      { title: 'Lompat dengan satu kaki', category: 'motorik' },
      { title: 'Menulis namanya sendiri', category: 'kognitif' },
      { title: 'Bercerita sederhana', category: 'bahasa' },
      { title: 'Mengenal emosi orang lain', category: 'sosial' },
      { title: 'Bisa mengancingkan baju', category: 'motorik' },
    ],
    '5-6': [
      { title: 'Bersepeda tanpa roda bantu', category: 'motorik' },
      { title: 'Membaca kalimat pendek', category: 'kognitif' },
      { title: 'Menulis kalimat sederhana', category: 'kognitif' },
      { title: 'Bisa menunggu giliran', category: 'sosial' },
      { title: 'Penjumlahan dasar', category: 'kognitif' },
    ],
  },
};

export const PRESET_CURRICULUM = {
  baby: [
    { subject: 'Stimulasi Sensori', goal: 'Sentuhan, suara, cahaya warna-warni', schedule: 'Setiap hari, 10 menit' },
    { subject: 'Tummy Time', goal: 'Latihan tengkurap & leher', schedule: '3x sehari, 5 menit' },
    { subject: 'Bonding & Talk', goal: 'Bicara, nyanyi, baca cerita', schedule: 'Setiap hari, 15 menit' },
    { subject: 'Iqra / Doa Harian', goal: 'Hafal doa harian pendek', schedule: '2x sehari' },
  ],
  toddler: [
    { subject: 'Calistung (Baca-Tulis-Hitung)', goal: 'Mengenal huruf, angka, coretan', schedule: 'Senin–Jumat, 20 menit' },
    { subject: 'Iqra 1', goal: 'Membaca huruf hijaiyah', schedule: 'Selasa & Kamis, 15 menit' },
    { subject: 'Motorik Halus', goal: 'Menggambar, lipat kertas, playdough', schedule: 'Rabu, 20 menit' },
    { subject: 'Motorik Kasar', goal: 'Lari, lompat, main bola', schedule: 'Setiap hari, 30 menit' },
    { subject: 'Bilingual Story Time', goal: 'Baca cerita Indonesia + Inggris', schedule: 'Setiap malam sebelum tidur' },
    { subject: 'Doa & Hafalan Surah Pendek', goal: 'Al-Fatihah, Al-Ikhlas, An-Nas', schedule: 'Setiap hari' },
  ],
  preschool: [
    { subject: 'Calistung Lanjut', goal: 'Membaca & menulis kalimat', schedule: 'Senin–Jumat, 30 menit' },
    { subject: 'Matematika Dasar', goal: 'Penjumlahan & pengurangan < 20', schedule: 'Selasa & Kamis, 20 menit' },
    { subject: 'Iqra / Quran', goal: 'Lanjut Iqra atau mulai Quran', schedule: '3x seminggu, 20 menit' },
    { subject: 'Bahasa Inggris', goal: 'Kosakata, percakapan dasar', schedule: 'Rabu & Jumat, 20 menit' },
    { subject: 'Seni & Kreativitas', goal: 'Menggambar, mewarnai, kerajinan', schedule: 'Sabtu, 60 menit' },
    { subject: 'Olahraga', goal: 'Senam, bersepeda, berenang', schedule: '3x seminggu' },
    { subject: 'Akhlak & Adab', goal: 'Adab makan, tidur, ke orang tua', schedule: 'Setiap hari' },
    { subject: 'Hafalan Surah & Doa', goal: 'Surah pendek + doa harian', schedule: 'Setiap hari' },
  ],
};

// Helper: pick preset bucket based on age in months
export function pickPresetBucket(totalMonths) {
  if (totalMonths <= 12) return 'baby';
  if (totalMonths <= 36) return 'toddler';
  return 'preschool';
}