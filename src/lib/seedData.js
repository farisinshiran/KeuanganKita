/**
 * seedData.js
 * Factory functions to seed dummy data for a newly created personal account.
 * Called from personalAuth signUp / signIn flow when user opts in (or for first demo login).
 *
 * Data path: artifacts/{appId}/users/{uid}/...
 * Collections seeded:
 *   - transactions       (12 entries: 6 months × 2 per month)
 *   - wallets            (3 entries: BCA, Mandiri, Dompet Tunai)
 *   - subscriptions      (3 entries: Netflix, Spotify, Internet)
 *   - savingsGoals       (2 entries: Liburan Bali, DP Rumah)
 *   - investments        (2 entries: Reksa Dana, Saham BBCA)
 *   - categories         (init via existing DEFAULT_* if empty)
 *   - investmentTypes    (init via existing DEFAULT_* if empty)
 *
 * Kids feature: see seedKidsData() — seeds Aisyah (15y) and Rafi (4y).
 */
import {
  collection, addDoc, doc, setDoc, getDocs, serverTimestamp, query, where,
} from 'firebase/firestore';
import { db, appId } from '../config/firebase';
import {
  DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES,
  DEFAULT_INVESTMENT_TYPES, DEFAULT_WALLETS,
} from '../constants/categories';
import {
  PRESET_MILESTONES, PRESET_CURRICULUM,
} from '../services/kids';

const base = (uid) => ['artifacts', appId, 'users', uid];

// ─── Date helpers ──────────────────────────────────────────────
function monthsAgo(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(15); // mid-month for consistency
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Seed wallets ──────────────────────────────────────────────
async function seedWallets(uid) {
  const col = collection(db, ...base(uid), 'wallets');
  const existing = await getDocs(col);
  if (!existing.empty) return;

  const wallets = [
    { name: 'BCA',           type: 'bank',     balance: 12500000, color: '#1e40af', icon: '🏦' },
    { name: 'Mandiri',       type: 'bank',     balance:  4200000, color: '#dc2626', icon: '🏛️' },
    { name: 'Dompet Tunai',  type: 'cash',     balance:   850000, color: '#16a34a', icon: '💵' },
  ];
  for (const w of wallets) {
    await addDoc(col, { ...w, createdAt: serverTimestamp() });
  }
}

// ─── Seed transactions (6 months) ──────────────────────────────
async function seedTransactions(uid) {
  const col = collection(db, ...base(uid), 'transactions');
  const existing = await getDocs(col);
  if (!existing.empty) return;

  const tx = [
    // Month -1 (last month)
    { date: monthsAgo(0), type: 'income',  category: 'Gaji',         amount: 8000000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(0), type: 'income',  category: 'Gaji',         amount: 6500000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(0), type: 'expense', category: 'Listrik',      amount:  450000, wallet: 'BCA',   note: 'PLN' },
    { date: monthsAgo(0), type: 'expense', category: 'Internet',     amount:  350000, wallet: 'BCA',   note: 'Indihome' },
    { date: monthsAgo(0), type: 'expense', category: 'Bensin',       amount:  300000, wallet: 'BCA',   note: 'Pertamax' },
    { date: monthsAgo(0), type: 'expense', category: 'Belanja',      amount: 1500000, wallet: 'BCA',   note: 'Bulanan' },
    { date: monthsAgo(0), type: 'expense', category: 'Pendidikan',   amount:  750000, wallet: 'BCA',   note: 'SPP Aisyah' },
    { date: monthsAgo(0), type: 'expense', category: 'Pendidikan',   amount:  400000, wallet: 'BCA',   note: 'PAUD Rafi' },
    // Month -2
    { date: monthsAgo(1), type: 'income',  category: 'Gaji',         amount: 8000000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(1), type: 'income',  category: 'Gaji',         amount: 6500000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(1), type: 'expense', category: 'Belanja',      amount: 1450000, wallet: 'BCA',   note: 'Bulanan' },
    { date: monthsAgo(1), type: 'expense', category: 'Kesehatan',    amount:  250000, wallet: 'BCA',   note: 'Vitamin anak' },
    // Month -3
    { date: monthsAgo(2), type: 'income',  category: 'Gaji',         amount: 8000000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(2), type: 'income',  category: 'Gaji',         amount: 6500000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(2), type: 'expense', category: 'Hiburan',      amount:  500000, wallet: 'BCA',   note: 'Nonton keluarga' },
    { date: monthsAgo(2), type: 'expense', category: 'Transport',    amount:  180000, wallet: 'BCA',   note: 'Gojek' },
    // Month -4
    { date: monthsAgo(3), type: 'income',  category: 'Gaji',         amount: 8000000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(3), type: 'income',  category: 'Gaji',         amount: 6500000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(3), type: 'expense', category: 'Belanja',      amount: 1600000, wallet: 'BCA',   note: 'Bulanan' },
    // Month -5
    { date: monthsAgo(4), type: 'income',  category: 'Gaji',         amount: 8000000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(4), type: 'income',  category: 'Gaji',         amount: 6500000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(4), type: 'expense', category: 'Sedekah',      amount:  300000, wallet: 'BCA',   note: 'Infaq' },
    // Month -6
    { date: monthsAgo(5), type: 'income',  category: 'Gaji',         amount: 8000000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(5), type: 'income',  category: 'Gaji',         amount: 6500000, wallet: 'BCA',   note: 'Gaji bulanan' },
    { date: monthsAgo(5), type: 'expense', category: 'Belanja',      amount: 1400000, wallet: 'BCA',   note: 'Lebaran' },
  ];
  for (const t of tx) {
    await addDoc(col, { ...t, createdAt: serverTimestamp() });
  }
}

// ─── Seed subscriptions ────────────────────────────────────────
async function seedSubscriptions(uid) {
  const col = collection(db, ...base(uid), 'subscriptions');
  const existing = await getDocs(col);
  if (!existing.empty) return;

  const subs = [
    { name: 'Netflix',      amount:  65000, cycle: 'monthly', nextDate: monthsAgo(0), category: 'Hiburan', active: true },
    { name: 'Spotify',      amount:  55000, cycle: 'monthly', nextDate: monthsAgo(0), category: 'Hiburan', active: true },
    { name: 'Indihome',     amount: 350000, cycle: 'monthly', nextDate: monthsAgo(0), category: 'Internet', active: true },
  ];
  for (const s of subs) {
    await addDoc(col, { ...s, createdAt: serverTimestamp() });
  }
}

// ─── Seed savings goals ────────────────────────────────────────
async function seedSavingsGoals(uid) {
  const col = collection(db, ...base(uid), 'savingsGoals');
  const existing = await getDocs(col);
  if (!existing.empty) return;

  const goals = [
    { name: 'Liburan ke Bali', target: 15000000, current:  5000000, deadline: '2026-12-31', icon: '✈️' },
    { name: 'DP Rumah',        target: 200000000, current: 45000000, deadline: '2028-12-31', icon: '🏠' },
  ];
  for (const g of goals) {
    await addDoc(col, { ...g, createdAt: serverTimestamp() });
  }
}

// ─── Seed investments ──────────────────────────────────────────
async function seedInvestments(uid) {
  const col = collection(db, ...base(uid), 'investments');
  const existing = await getDocs(col);
  if (!existing.empty) return;

  const inv = [
    { name: 'Reksa Dana Sucorinvest',  type: 'Reksa Dana', amount: 25000000, currentValue: 26500000,  date: monthsAgo(5) },
    { name: 'Saham BBCA',              type: 'Saham',      amount:  8500000, currentValue:  9200000,  date: monthsAgo(3) },
  ];
  for (const i of inv) {
    await addDoc(col, { ...i, createdAt: serverTimestamp() });
  }
}

// ─── Seed categories (if empty) ────────────────────────────────
async function seedCategories(uid) {
  const col = collection(db, ...base(uid), 'categories');
  const existing = await getDocs(col);
  if (!existing.empty) return;

  const all = [
    ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, kind: 'expense' })),
    ...DEFAULT_INCOME_CATEGORIES.map(c => ({ ...c, kind: 'income' })),
  ];
  for (const c of all) {
    await addDoc(col, { ...c, createdAt: serverTimestamp() });
  }
}

// ─── Seed investment types (if empty) ──────────────────────────
async function seedInvestmentTypes(uid) {
  const col = collection(db, ...base(uid), 'investmentTypes');
  const existing = await getDocs(col);
  if (!existing.empty) return;

  for (const t of DEFAULT_INVESTMENT_TYPES) {
    await addDoc(col, { ...t, createdAt: serverTimestamp() });
  }
}

// ─── Seed kids data (Aisyah 15y, Rafi 4y) ─────────────────────
async function seedKidsData(uid) {
  const col = collection(db, ...base(uid), 'kids');
  const existing = await getDocs(col);
  if (!existing.empty) return;

  // Aisyah
  const aisyahRef = await addDoc(col, {
    name: 'Aisyah Putri',
    dob: new Date('2010-05-15'),
    gender: 'F',
    notes: 'Kelas 9 SMP, aktif di OSIS',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Rafi
  const rafiRef = await addDoc(col, {
    name: 'Rafi Pratama',
    dob: new Date('2021-09-20'),
    gender: 'M',
    notes: 'PAUD, sedang belajar calistung',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Aisyah milestones
  const aisyahMsCol = collection(db, ...base(uid), 'kids', aisyahRef.id, 'milestones');
  await addDoc(aisyahMsCol, {
    title: 'Hafal Al-Fatihah dengan tartil',
    category: 'kognitif',
    achievedAt: daysAgo(180),
    notes: 'Setelah 3 bulan les',
    createdAt: serverTimestamp(),
  });
  await addDoc(aisyahMsCol, {
    title: 'Bisa naik sepeda tanpa roda bantu',
    category: 'motorik',
    achievedAt: daysAgo(60),
    notes: '',
    createdAt: serverTimestamp(),
  });

  // Aisyah logs
  const aisyahLogsCol = collection(db, ...base(uid), 'kids', aisyahRef.id, 'logs');
  await addDoc(aisyahLogsCol, {
    title: 'Les matematika',
    notes: 'Nilai ulangan harian: 85',
    date: daysAgo(5),
    createdAt: serverTimestamp(),
  });
  await addDoc(aisyahLogsCol, {
    title: 'Pertemuan ortu-guru',
    notes: 'Aisyah aktif, nilai rapor baik',
    date: daysAgo(15),
    createdAt: serverTimestamp(),
  });

  // Aisyah curriculum
  const aisyahCurrCol = collection(db, ...base(uid), 'kids', aisyahRef.id, 'curriculum');
  await addDoc(aisyahCurrCol, {
    subject: 'Matematika',
    weeklyTarget: 3,
    done: 2,
    week: 'Minggu ini',
    createdAt: serverTimestamp(),
  });
  await addDoc(aisyahCurrCol, {
    subject: 'Bahasa Inggris',
    weeklyTarget: 3,
    done: 3,
    week: 'Minggu ini',
    createdAt: serverTimestamp(),
  });
  await addDoc(aisyahCurrCol, {
    subject: 'Bahasa Arab',
    weeklyTarget: 2,
    done: 1,
    week: 'Minggu ini',
    createdAt: serverTimestamp(),
  });

  // Rafi milestones
  const rafiMsCol = collection(db, ...base(uid), 'kids', rafiRef.id, 'milestones');
  await addDoc(rafiMsCol, {
    title: 'Bisa hitung 1-10',
    category: 'kognitif',
    achievedAt: daysAgo(90),
    notes: '',
    createdAt: serverTimestamp(),
  });
  await addDoc(rafiMsCol, {
    title: 'Bicara lancar (kalimat penuh)',
    category: 'bahasa',
    achievedAt: daysAgo(45),
    notes: '',
    createdAt: serverTimestamp(),
  });

  // Rafi logs
  const rafiLogsCol = collection(db, ...base(uid), 'kids', rafiRef.id, 'logs');
  await addDoc(rafiLogsCol, {
    title: 'Mau makan sayur sendiri',
    notes: 'Akhirnya mau brokoli tanpa dipaksa!',
    date: daysAgo(2),
    createdAt: serverTimestamp(),
  });
  await addDoc(rafiLogsCol, {
    title: 'Hari pertama PAUD',
    notes: 'Nangis 10 menit, lalu main',
    date: daysAgo(120),
    createdAt: serverTimestamp(),
  });

  // Rafi curriculum
  const rafiCurrCol = collection(db, ...base(uid), 'kids', rafiRef.id, 'curriculum');
  await addDoc(rafiCurrCol, {
    subject: 'Calistung',
    weeklyTarget: 2,
    done: 1,
    week: 'Minggu ini',
    createdAt: serverTimestamp(),
  });
  await addDoc(rafiCurrCol, {
    subject: 'Mengaji',
    weeklyTarget: 3,
    done: 2,
    week: 'Minggu ini',
    createdAt: serverTimestamp(),
  });
  await addDoc(rafiCurrCol, {
    subject: 'Motorik Halus',
    weeklyTarget: 2,
    done: 2,
    week: 'Minggu ini',
    createdAt: serverTimestamp(),
  });
}

// ─── Master seed function ──────────────────────────────────────
/**
 * Seed all dummy data for a new personal user.
 * Idempotent — checks each collection before inserting.
 * Errors in one section don't stop others.
 *
 * @param {string} uid
 * @param {object} opts
 * @param {boolean} opts.skipKids  - skip kids seed (for users without anak role)
 * @returns {Promise<{ok: boolean, errors: string[]}>}
 */
export async function seedPersonalData(uid, opts = {}) {
  const errors = [];
  const tasks = [
    ['wallets',        () => seedWallets(uid)],
    ['categories',     () => seedCategories(uid)],
    ['investmentTypes',() => seedInvestmentTypes(uid)],
    ['transactions',   () => seedTransactions(uid)],
    ['subscriptions',  () => seedSubscriptions(uid)],
    ['savingsGoals',   () => seedSavingsGoals(uid)],
    ['investments',    () => seedInvestments(uid)],
  ];
  if (!opts.skipKids) {
    tasks.push(['kids', () => seedKidsData(uid)]);
  }
  for (const [name, fn] of tasks) {
    try {
      await fn();
    } catch (e) {
      console.error(`[seedPersonalData] ${name} failed:`, e);
      errors.push(`${name}: ${e.message || e}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ─── Demo account factory ──────────────────────────────────────
/**
 * Returns the standard 4 demo accounts (Ayah, Ibu, Anak 1, Anak 2).
 * Used by LoginPage for "Quick Demo" buttons.
 */
export function getDemoAccounts() {
  return [
    { role: 'ayah', name: 'Ahmad Fauzi',   pin: '111111', color: 'blue' },
    { role: 'ibu',  name: 'Siti Aminah',   pin: '222222', color: 'pink' },
    { role: 'anak', name: 'Aisyah Putri',  pin: '333333', color: 'green' },
    { role: 'anak', name: 'Rafi Pratama',  pin: '444444', color: 'amber' },
  ];
}
