import React, { useState, useEffect, useMemo, useRef, useCallback, lazy, Suspense } from 'react';
import { Plus, Wallet, Eye, EyeOff, Moon, Sun, Menu, RefreshCw, ScanLine } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// --- CONFIG & UTILS ---
import { auth, db, appId, APP_VERSION } from './config/firebase';
import { formatCurrency } from './utils/formatters';
import { useI18n } from './i18n/I18nContext';

// --- CUSTOM HOOK (all Firestore data) ---
import { useAppData } from './hooks/useAppData';

// --- LAYOUT & UI (always needed, eagerly imported) ---
import LoginPage from './components/ui/LoginPage';
import Sidebar, { MobileMenu, AppFooter, NAV_ITEMS } from './components/layout/Sidebar';

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

  // ── Pull-to-Refresh (React-friendly: no page reload) ───────
  // Incrementing refreshKey causes useAppData to re-subscribe all listeners
  const [refreshKey, setRefreshKey] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling]       = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const mainRef     = useRef(null);

  // ── All remote data from custom hook ───────────────────────
  const { transactions, investments, categories, investTypes, wallets, subscriptions } =
    useAppData(user, refreshKey);

  // ── Dark mode ───────────────────────────────────────────────
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
  }, [user, subscriptions, wallets, transactions.length]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 flex flex-col md:flex-row transition-colors duration-300">

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
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        privacyMode={privacyMode}
        setPrivacyMode={setPrivacyMode}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
        onLogout={handleLogout}
      />

      {/* ── Mobile Hamburger Menu (from Sidebar.jsx) ── */}
      {isMobileMenuOpen && (
        <MobileMenu
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onLogout={handleLogout}
          onClose={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── Main content ── */}
      <main ref={mainRef} className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full pb-8 flex flex-col min-h-screen">

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
          {activeTab === 'dashboard'              && <DashboardView             summary={summary} transactions={transactions} investments={investments} categories={categories} investTypes={investTypes} setActiveTab={setActiveTab} fmt={fmt} privacyMode={privacyMode} darkMode={darkMode} />}
          {activeTab === 'transactions'           && <TransactionView           transactions={transactions} categories={categories} wallets={wBals} investments={investments} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'subscriptions'          && <SubscriptionView          subscriptions={subscriptions} wallets={wBals} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'wallets'                && <WalletView               wallets={wBals} transactions={transactions} userId={uid} appId={appId} fmt={fmt} privacyMode={privacyMode} />}
          {activeTab === 'investments'            && <InvestmentView            investments={investments} investTypes={investTypes} wallets={wBals} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'education-fund'         && <EducationFundView         userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'income-diversification' && <IncomeDiversificationView userId={uid} appId={appId} fmt={fmt} transactions={transactions} />}
          {activeTab === 'salary-slip-archive'    && <SalarySlipArchiveView     userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'salary-allocator'       && <SalaryAllocatorView       categories={categories} wallets={wBals} transactions={transactions} userId={uid} appId={appId} fmt={fmt} />}
          {activeTab === 'zakat'                  && <ZakatView                 summary={summary} investments={investments} fmt={fmt} />}
          {activeTab === 'categories'             && <CategoryView              categories={categories} userId={uid} appId={appId} fmt={fmt} />}

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

      {/* ── Floating Action Buttons ── */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-3 items-end">
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