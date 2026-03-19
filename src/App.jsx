import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { Plus, Wallet, Eye, EyeOff, Moon, Sun, Menu, RefreshCw, ScanLine, Bot } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, doc, writeBatch } from 'firebase/firestore';

// --- CONFIG & UTILS ---
import { auth, db, appId, APP_VERSION, IS_DEMO_MODE } from './config/firebase';
import { formatCurrency } from './utils/formatters';
import { useI18n } from './i18n/I18nContext';

// --- CUSTOM HOOK (all Firestore data) ---
import { useAppData } from './hooks/useAppData';

// --- LAYOUT & UI (always needed, eagerly imported) ---
import LoginPage from './components/ui/LoginPage';
import Sidebar, { MobileMenu, AppFooter, NAV_ITEMS } from './components/layout/Sidebar';
import AIAdvisorPanel from './components/layout/AIAdvisorPanel';

// --- LAZY-LOADED VIEWS (downloaded only when first visited) ---
const DashboardView             = lazy(() => import('./components/views/DashboardView'));
const TransactionView           = lazy(() => import('./components/views/TransactionView'));
const WalletView                = lazy(() => import('./components/views/WalletView'));
const SubscriptionView          = lazy(() => import('./components/views/SubscriptionView'));
const InvestmentView            = lazy(() => import('./components/views/InvestmentView'));
const ZakatView                 = lazy(() => import('./components/views/ZakatView'));
const CategoryView              = lazy(() => import('./components/views/CategoryView'));
const SalaryAllocatorView       = lazy(() => import('./components/views/SalaryAllocatorView'));
const EducationFundView         = lazy(() => import('./components/views/EducationFundView'));
const SalarySlipArchiveView     = lazy(() => import('./components/views/SalarySlipArchiveView'));
const IncomeDiversificationView = lazy(() => import('./components/views/IncomeDiversificationView'));
const SavingsGoalView           = lazy(() => import('./components/views/SavingsGoalView'));
// --- LAZY-LOADED MODALS ---
const TransactionModal = lazy(() => import('./components/modals/TransactionModal'));
const QuickAddModal    = lazy(() => import('./components/modals/QuickAddModal'));

// --- Suspense fallback spinner ---
const PageLoader = ({ text }) => (
  <div className="flex items-center justify-center w-full py-40">
    <div className="flex flex-col items-center gap-3">
      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      <p className="text-sm text-gray-400 dark:text-gray-500 animate-pulse">{text}</p>
    </div>
  </div>
);

// ============================================================
// DEMO → FIRESTORE MIGRATION HELPERS
// ============================================================
const DEMO_STORE_KEY = 'dkDemo_v1';

function convertDemoTimestamps(v) {
  if (v == null) return v;
  if (Array.isArray(v)) return v.map(convertDemoTimestamps);
  if (typeof v === 'object') {
    if (typeof v.__ts === 'string') return new Date(v.__ts);
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = convertDemoTimestamps(val);
    return out;
  }
  return v;
}

async function migrateFromDemo(user, firestoreDb, firestoreAppId, rawJson = null) {
  const raw = rawJson ?? localStorage.getItem(DEMO_STORE_KEY);
  if (!raw) return { count: 0, reason: 'no_data' };

  let store;
  try { store = JSON.parse(raw); } catch { return { count: 0, reason: 'parse_error' }; }

  // Flexible: match any appId and any demo uid (usually 'demo-user')
  const toWrite = [];
  for (const [colPath, docs] of Object.entries(store)) {
    if (!docs || typeof docs !== 'object') continue;
    // Pattern: artifacts/{any_appId}/users/{any_uid}/{collection}
    const match = colPath.match(/^artifacts[/][^/]+[/]users[/][^/]+[/](.+)$/);
    if (!match) continue;
    const colName = match[1];
    for (const [docId, docData] of Object.entries(docs)) {
      if (!docData) continue;
      toWrite.push({ colName, docId, data: convertDemoTimestamps(docData) });
    }
  }

  if (toWrite.length === 0) return { count: 0, reason: 'no_match' };

  // Write in batches of 400 (Firestore limit is 500)
  for (let i = 0; i < toWrite.length; i += 400) {
    const chunk = toWrite.slice(i, i + 400);
    const batch = writeBatch(firestoreDb);
    for (const { colName, docId, data } of chunk) {
      const docRef = doc(firestoreDb, 'artifacts', firestoreAppId, 'users', user.uid, colName, docId);
      batch.set(docRef, data);
    }
    await batch.commit();
  }

  return { count: toWrite.length, reason: 'ok' };
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const { t } = useI18n();
  const [user, setUser]       = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab]     = useState('dashboard');
  const [privacyMode, setPrivacyMode] = useState(false);
  const [darkMode, setDarkMode]       = useState(() => localStorage.getItem('theme') === 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen]         = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen]       = useState(false);
  const [isAIOpen, setIsAIOpen]                             = useState(false);

  // ── Demo data migration state ───────────────────────────────
  const [demoMigration, setDemoMigration] = useState(null); // null | 'prompt' | 'migrating' | 'done' | 'no_data' | 'error'
  const [demoMigrateCount, setDemoMigrateCount] = useState(0);
  const [showManualImport, setShowManualImport] = useState(false);
  const [manualJson, setManualJson] = useState('');

  // ── Pull-to-Refresh (React-friendly: no page reload) ───────
  // Incrementing refreshKey causes useAppData to re-subscribe all listeners
  const [refreshKey, setRefreshKey] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling]       = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const mainRef     = useRef(null);

  // ── All remote data from custom hook ───────────────────────
  const { transactions, investments, categories, investTypes, wallets, subscriptions, savingsGoals, dataLoading } =
    useAppData(user, refreshKey);

  // ── Dark mode ───────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // ── Detect leftover demo data after login ───────────────────
  useEffect(() => {
    if (!user || IS_DEMO_MODE) return;
    try {
      const raw = localStorage.getItem(DEMO_STORE_KEY);
      if (!raw) return;
      const store = JSON.parse(raw);
      const hasData = Object.values(store).some(col => Object.keys(col).length > 0);
      if (hasData) setTimeout(() => setDemoMigration('prompt'), 0);
    } catch { /* ignore */ }
  }, [user]);

  const handleMigrate = useCallback(async () => {
    setDemoMigration('migrating');
    try {
      const { count } = await migrateFromDemo(user, db, appId);
      if (count === 0) {
        setDemoMigration('no_data');
        return;
      }
      localStorage.removeItem(DEMO_STORE_KEY);
      setDemoMigrateCount(count);
      setRefreshKey(k => k + 1);
      setDemoMigration('done');
      setTimeout(() => setDemoMigration(null), 6000);
    } catch (err) {
      console.error('[migrate] failed', err);
      setDemoMigration('error');
    }
  }, [user]);

  const handleManualMigrate = useCallback(async () => {
    if (!manualJson.trim()) return;
    setDemoMigration('migrating');
    setShowManualImport(false);
    try {
      const { count } = await migrateFromDemo(user, db, appId, manualJson.trim());
      if (count === 0) {
        setDemoMigration('no_data');
        return;
      }
      setDemoMigrateCount(count);
      setManualJson('');
      setRefreshKey(k => k + 1);
      setDemoMigration('done');
      setTimeout(() => setDemoMigration(null), 6000);
    } catch (err) {
      console.error('[manual migrate] failed', err);
      setDemoMigration('error');
    }
  }, [user, manualJson]);
  // ── AI panel toggle — intercepts 'ai-advisor' + 'quick-add' nav clicks ─
  const handleTabChange = useCallback((tab) => {
    if (tab === 'ai-advisor') { setIsAIOpen(prev => !prev); return; }
    if (tab === 'quick-add') { setIsQuickAddModalOpen(true); return; }
    setActiveTab(tab);
  }, []);
  // ── Auth ────────────────────────────────────────────────────
  const handleLogin  = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => alert(e.message));
  const handleLogout = () => signOut(auth);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => { setUser(u); setAuthLoading(false); });
    return unsub;
  }, []);

  // ── Pull-to-Refresh handlers ────────────────────────────────
  const handleTouchStart = useCallback((e) => {
    if (window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (window.scrollY > 0 || isRefreshing) return;
    const d = e.touches[0].clientY - touchStartY.current;
    if (d > 0 && d < 150) { setIsPulling(true); setPullDistance(d); }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance > 80) {
      setIsRefreshing(true);
      // Re-subscribe Firestore listeners — no page reload needed
      setRefreshKey(k => k + 1);
      await new Promise(r => setTimeout(r, 800)); // show spinner briefly
      setIsRefreshing(false);
      setPullDistance(0);
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || !/mobile|android|iphone|ipad/i.test(navigator.userAgent)) return;
    el.addEventListener('touchstart', handleTouchStart, { passive: true });
    el.addEventListener('touchmove',  handleTouchMove,  { passive: true });
    el.addEventListener('touchend',   handleTouchEnd,   { passive: true });
    return () => {
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove',  handleTouchMove);
      el.removeEventListener('touchend',   handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  // ── Subscription auto-transactions ─────────────────────────
  useEffect(() => {
    if (!user || !subscriptions.length || !wallets.length) return;

    const today        = new Date();
    const currentMonth = today.getMonth();
    const currentYear  = today.getFullYear();
    const daysInMonth  = (y, m) => new Date(y, m + 1, 0).getDate();
    const baseFn       = () => collection(db, 'artifacts', appId, 'users', user.uid, 'transactions');

    (async () => {
      for (const sub of subscriptions) {
        if (!sub.paymentDay || !sub.walletId || !sub.cost || sub.cycle !== 'monthly') continue;
        const targetDay  = Math.min(sub.paymentDay, daysInMonth(currentYear, currentMonth));
        const targetDate = new Date(currentYear, currentMonth, targetDay);
        const startDate  = sub.startDate?.toDate?.() ?? null;
        if (startDate && startDate > targetDate) continue;
        if (today >= targetDate) {
          const exists = transactions.some(
            t => t.subscriptionId === sub.id
              && t.date?.getMonth()    === currentMonth
              && t.date?.getFullYear() === currentYear
          );
          if (!exists) {
            await addDoc(baseFn(), {
              type: 'expense', amount: sub.cost, category: 'Langganan',
              walletId: sub.walletId, subscriptionId: sub.id,
              note: `Tagihan Otomatis: ${sub.name}`,
              date: targetDate, createdAt: serverTimestamp(),
            }).catch(e => console.error('Auto-gen failed', e));
          }
        }
      }
    })();
  }, [user, subscriptions, wallets, transactions]);

  // ── Wallet balance — O(n) single-pass Map ───────────────────
  const summary = useMemo(() => {
    const deltaMap = new Map();
    const add = (id, v) => { if (id) deltaMap.set(id, (deltaMap.get(id) ?? 0) + v); };

    let inc = 0, exp = 0;
    for (const t of transactions) {
      const amt = Number(t.amount) || 0;
      if      (t.type === 'income')     { inc += amt; add(t.walletId, +amt); }
      else if (t.type === 'expense')    { exp += amt; add(t.walletId, -amt); }
      else if (t.type === 'investment') {             add(t.walletId, -amt); }
      else if (t.type === 'investment_sale') {        add(t.walletId, +amt); }
      else if (t.type === 'transfer')   { add(t.sourceWalletId, -amt); add(t.targetWalletId, +amt); }
    }

    const walletBalances = wallets.map(w => ({
      ...w,
      currentBalance: (Number(w.initialBalance) || 0) + (deltaMap.get(w.id) ?? 0),
    }));

    const inv            = investments.reduce((a, c) => a + (Number(c.currentValue) || 0), 0);
    const liquidAssets   = walletBalances.filter(w => w.type !== 'credit_card').reduce((a, w) => a + w.currentBalance, 0);
    const creditCardDebt = walletBalances.filter(w => w.type === 'credit_card').reduce((a, w)  => a + w.currentBalance, 0);

    return {
      income: inc, expense: exp,
      balance: liquidAssets, ccDebt: creditCardDebt,
      investment: inv, netWorth: liquidAssets + inv + creditCardDebt,
      walletBalances,
    };
  }, [transactions, investments, wallets]);

  const fmt = (val) => privacyMode ? 'Rp ••••••' : formatCurrency(val);

  // ── Guards ──────────────────────────────────────────────────
  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center dark:bg-gray-900 text-emerald-600 font-bold animate-pulse">
      {t('common.loadingApp')}
    </div>
  );
  if (!user) return <LoginPage onLogin={handleLogin} />;

  const uid   = user.uid;
  const wBals = summary.walletBalances;

  return (
    <div className="min-h-screen bg-background dark:bg-gray-900 font-sans text-on-background dark:text-gray-100 transition-colors duration-300">

      {/* ── Pull-to-Refresh overlay ── */}
      {isPulling && (
        <div
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center bg-emerald-500 text-white transition-all duration-200"
          style={{ height: `${Math.min(pullDistance, 80)}px`, opacity: pullDistance / 80 }}
        >
          <div className="flex items-center gap-2">
            <RefreshCw size={20} className={pullDistance > 80 ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">{pullDistance > 80 ? t('common.releaseToRefresh') : t('common.pullToRefresh')}</span>
          </div>
        </div>
      )}
      {isRefreshing && (
        <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="text-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.refreshingData')}</p>
          </div>
        </div>
      )}

      {/* ── Desktop Sidebar (from Sidebar.jsx) ── */}
      <Sidebar
        activeTab={isAIOpen ? 'ai-advisor' : activeTab}
        setActiveTab={handleTabChange}
        user={user}
        privacyMode={privacyMode}
        setPrivacyMode={setPrivacyMode}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onLogout={handleLogout}
      />

      {/* ── Fixed top header (desktop) ── */}
      <header className="hidden md:flex fixed top-0 left-64 right-0 h-16 items-center px-6 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-green-100/20 dark:border-gray-700/50 z-40 gap-4">
        <div className="flex-1">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {(() => {
              const tab = isAIOpen ? 'ai-advisor' : activeTab;
              const allItems = [
                { id: 'dashboard', label: 'Dashboard' },
                { id: 'transactions', label: 'Transactions' },
                { id: 'wallets', label: 'Wallets' },
                { id: 'subscriptions', label: 'Subscriptions' },
                { id: 'budget', label: 'Budget' },
                { id: 'salary-allocator', label: 'Budget' },
                { id: 'investments', label: 'Investments' },
                { id: 'savings-goals', label: 'Savings Goals' },
                { id: 'education-fund', label: 'Education Fund' },
                { id: 'income-sources', label: 'Income Sources' },
                { id: 'income-diversification', label: 'Income Sources' },
                { id: 'zakat', label: 'Zakat Calculator' },
                { id: 'salary-slips', label: 'Salary Slips' },
                { id: 'salary-slip-archive', label: 'Salary Slips' },
                { id: 'categories', label: 'Categories' },
                { id: 'ai-advisor', label: 'AI Advisor' },
              ];
              return allItems.find(i => i.id === tab)?.label ?? 'Dompet Keluarga';
            })()}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {user?.displayName ? `Welcome back, ${user.displayName.split(' ')[0]}` : 'Family Finance'}
          </p>
        </div>
        <button
          onClick={() => setPrivacyMode(p => !p)}
          className="p-2 rounded-full text-slate-400 hover:bg-green-50/50 dark:hover:bg-green-900/20 hover:text-primary transition-colors"
          title={privacyMode ? 'Show balances' : 'Hide balances'}
        >
          <Eye size={20} className={privacyMode ? 'hidden' : ''} />
          <EyeOff size={20} className={privacyMode ? '' : 'hidden'} />
        </button>
        <button
          onClick={() => setDarkMode(d => !d)}
          className="p-2 rounded-full text-slate-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-500 transition-colors"
        >
          {darkMode ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        {user?.photoURL ? (
          <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border-2 border-primary/20" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-xs font-bold border border-primary/10">
            {user?.displayName?.[0] ?? '?'}
          </div>
        )}
      </header>

      {/* ── Mobile Hamburger Menu (from Sidebar.jsx) ── */}
      {isMobileMenuOpen && (
        <MobileMenu
          activeTab={isAIOpen ? 'ai-advisor' : activeTab}
          setActiveTab={handleTabChange}
          user={user}
          onLogout={handleLogout}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <main ref={mainRef} className={`md:ml-64 p-4 md:pt-20 md:px-6 pb-12 flex flex-col min-h-screen transition-[margin,padding] duration-300 min-w-0${isAIOpen ? ' md:mr-96' : ''}`}>

        {/* Demo Mode banner */}
        {IS_DEMO_MODE && (
          <div className="mb-4 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-700 flex items-center justify-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <span className="text-base">🧪</span>
            <span><strong>Demo Mode</strong> — Data tersimpan di browser ini saja (localStorage). Tidak ada akun atau Firebase yang diperlukan.</span>
          </div>
        )}

        {/* Demo → Firebase migration banner */}
        {demoMigration === 'prompt' && (
          <div className="mb-4 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700 flex flex-wrap items-center justify-center gap-3 text-sm text-blue-800 dark:text-blue-300">
            <span>📦 <strong>Data lama ditemukan.</strong> Data dari mode demo tersimpan di browser ini. Impor ke akun Firebase Anda?</span>
            <div className="flex gap-2">
              <button onClick={handleMigrate} className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-xs font-semibold">Impor Sekarang</button>
              <button onClick={() => { localStorage.removeItem(DEMO_STORE_KEY); setDemoMigration(null); }} className="px-3 py-1 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 rounded-md text-xs font-semibold">Abaikan &amp; Hapus</button>
            </div>
          </div>
        )}
        {demoMigration === 'migrating' && (
          <div className="mb-4 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-700 flex items-center justify-center gap-2 text-sm text-blue-800 dark:text-blue-300">
            <RefreshCw size={16} className="animate-spin" />
            <span>Sedang mengimpor data ke Firebase…</span>
          </div>
        )}
        {demoMigration === 'done' && (
          <div className="mb-4 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-700 flex items-center justify-center gap-2 text-sm text-emerald-800 dark:text-emerald-300">
            <span>✅ {demoMigrateCount} data berhasil diimpor ke Firebase!</span>
          </div>
        )}
        {demoMigration === 'no_data' && (
          <div className="mb-4 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-700 flex flex-wrap items-center justify-center gap-3 text-sm text-yellow-800 dark:text-yellow-300">
            <span>⚠️ Data demo ditemukan di browser tapi tidak ada dokumen yang bisa diimpor.</span>
            <button onClick={() => { localStorage.removeItem(DEMO_STORE_KEY); setDemoMigration(null); }} className="underline text-xs">Hapus data demo</button>
          </div>
        )}
        {demoMigration === 'error' && (
          <div className="mb-4 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-700 flex flex-wrap items-center justify-center gap-3 text-sm text-red-800 dark:text-red-300">
            <span>⚠️ Gagal mengimpor. Periksa koneksi atau izin Firestore.</span>
            <button onClick={() => setDemoMigration('prompt')} className="underline text-xs">Coba lagi</button>
          </div>
        )}

        {/* Restore panel: shown when Firestore is empty after loading */}
        {!IS_DEMO_MODE && !dataLoading && transactions.length === 0 && demoMigration === null && (
          <div className="mb-4 -mx-4 md:-mx-8 -mt-4 md:-mt-8 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Punya data dari browser lain atau domain lama?</span>
            <button onClick={() => setShowManualImport(true)} className="text-blue-600 dark:text-blue-400 underline font-semibold">Pulihkan data lama</button>
          </div>
        )}

        {/* Manual import modal */}
        {showManualImport && (
          <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowManualImport(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Pulihkan Data Lama</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Data tersimpan di domain berbeda (GitHub Pages atau localhost). Ikuti langkah berikut:</p>

              <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-2 mb-4 list-decimal list-inside">
                <li>Buka domain lama di browser (misal: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">github.io/...</code> atau <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-xs">localhost:5173</code>)</li>
                <li>Tekan <kbd className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">F12</kbd> → Console</li>
                <li>Ketik perintah ini lalu tekan Enter:<br/><code className="bg-gray-100 dark:bg-gray-700 block mt-1 px-2 py-1 rounded text-xs break-all select-all">copy(localStorage.getItem('dkDemo_v1'))</code></li>
                <li>Kembali ke sini dan paste hasilnya di bawah:</li>
              </ol>

              <textarea
                className="w-full h-32 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder='Paste JSON di sini (dimulai dari { ...)'
                value={manualJson}
                onChange={e => setManualJson(e.target.value)}
              />

              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => { setShowManualImport(false); setManualJson(''); }} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Batal</button>
                <button
                  onClick={handleManualMigrate}
                  disabled={!manualJson.trim()}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                >Impor Data</button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile top-bar */}
        <div className="md:hidden flex justify-between items-center mb-6">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Wallet className="w-6 h-6" />
            <h1 className="font-bold text-lg">{t('common.appName')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setPrivacyMode(p => !p)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">
              {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
            <button onClick={() => setDarkMode(d => !d)} className="text-gray-400 hover:text-amber-500">
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">
              <Menu size={24} />
            </button>
          </div>
        </div>

        {/* ── Page views (lazy-loaded inside Suspense) ── */}
        <Suspense fallback={<PageLoader text={t('common.loadingPage')} />}>
          {activeTab === 'dashboard'                                                           && <DashboardView             summary={summary} transactions={transactions} investments={investments} categories={categories} investTypes={investTypes} setActiveTab={setActiveTab} fmt={fmt} privacyMode={privacyMode} darkMode={darkMode} />}
          {activeTab === 'transactions'                                                         && <TransactionView           transactions={transactions} categories={categories} wallets={wBals} investments={investments} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'subscriptions'                                                        && <SubscriptionView          subscriptions={subscriptions} wallets={wBals} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'wallets'                                                              && <WalletView               wallets={wBals} transactions={transactions} userId={uid} appId={appId} fmt={fmt} privacyMode={privacyMode} />}
          {activeTab === 'investments'                                                          && <InvestmentView            investments={investments} investTypes={investTypes} wallets={wBals} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'education-fund'                                                       && <EducationFundView         userId={uid} appId={appId} fmt={fmt} />}
          {(activeTab === 'income-sources'       || activeTab === 'income-diversification')     && <IncomeDiversificationView userId={uid} appId={appId} fmt={fmt} transactions={transactions} />}
          {(activeTab === 'salary-slips'         || activeTab === 'salary-slip-archive')        && <SalarySlipArchiveView     userId={uid} appId={appId} fmt={fmt} />}
          {(activeTab === 'budget'               || activeTab === 'salary-allocator')           && <SalaryAllocatorView       categories={categories} wallets={wBals} transactions={transactions} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'zakat'                                                                && <ZakatView                 summary={summary} investments={investments} fmt={fmt} />}
          {activeTab === 'savings-goals'                                                        && <SavingsGoalView          savingsGoals={savingsGoals} wallets={wBals} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'categories'                                                           && <CategoryView              categories={categories} userId={uid} appId={appId} fmt={fmt} />}

          {/* Modals */}
          {isTransactionModalOpen && (
            <TransactionModal isOpen onClose={() => setIsTransactionModalOpen(false)} categories={categories} wallets={wBals} investments={investments} userId={uid} appId={appId} fmt={fmt} />
          )}
          {isQuickAddModalOpen && (
            <QuickAddModal isOpen onClose={() => setIsQuickAddModalOpen(false)} categories={categories} wallets={wBals} userId={uid} appId={appId} fmt={fmt} />
          )}
        </Suspense>

        <AppFooter APP_VERSION={APP_VERSION} />
      </main>

      {/* ── AI Advisor Panel (always available, collapsible right sidebar) ── */}
      <AIAdvisorPanel
        isOpen={isAIOpen}
        onToggle={() => setIsAIOpen(v => !v)}
        summary={summary}
        transactions={transactions}
        categories={categories}
        investments={investments}
        savingsGoals={savingsGoals}
        fmt={fmt}
      />

      {/* ── Floating Action Buttons ── */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-3 items-end">
        <button
          onClick={() => setIsAIOpen(v => !v)}
          className={`group flex items-center gap-3 px-4 py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 min-h-[48px] border-2 ${
            isAIOpen
              ? 'bg-emerald-600 border-emerald-600 text-white'
              : 'bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 border-emerald-600 text-emerald-600'
          }`}
        >
          <span className="text-sm font-semibold hidden sm:group-hover:inline-block animate-in fade-in slide-in-from-right-2 duration-200">AI Advisor</span>
          <Bot size={22} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setIsQuickAddModalOpen(true)}
          className="group flex items-center gap-3 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 border-2 border-emerald-600 text-emerald-600 px-4 py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 min-h-[48px]"
        >
          <span className="text-sm font-semibold hidden sm:group-hover:inline-block animate-in fade-in slide-in-from-right-2 duration-200">{t('common.quickAdd')}</span>
          <ScanLine size={22} strokeWidth={2.5} />
        </button>
        <button
          onClick={() => setIsTransactionModalOpen(true)}
          className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95"
        >
          <Plus size={24} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}