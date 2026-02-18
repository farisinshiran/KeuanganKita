import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Wallet, TrendingUp, PieChart, Settings, 
  Menu, ArrowUpRight, Coins, LogOut, Target, LogIn,
  User, Eye, EyeOff, Moon, Sun, Heart, CreditCard, Repeat, Briefcase, RefreshCw, Bot, DollarSign, BarChart3, ScanLine, GraduationCap
} from 'lucide-react';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, onSnapshot, 
  deleteDoc, doc, orderBy, serverTimestamp, updateDoc
} from 'firebase/firestore';

// --- 1. FIREBASE CONFIG ---
import { app, auth, db, appId, APP_VERSION } from './config/firebase';

// --- 2. UTILITY FUNCTIONS ---
import { formatCurrency, formatDate, formatDateInput, parseDate } from './utils/formatters';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_INVESTMENT_TYPES, DEFAULT_WALLETS } from './constants/categories';

// --- 3. COMPONENTS ---
import LoginPage from './components/ui/LoginPage';
import { NavBtn } from './components/ui/index';
import DashboardView from './components/views/DashboardView';
import TransactionView from './components/views/TransactionView';
import WalletView from './components/views/WalletView';
import SubscriptionView from './components/views/SubscriptionView';
import InvestmentView from './components/views/InvestmentView';
import ZakatView from './components/views/ZakatView';
import CategoryView from './components/views/CategoryView';
import SalaryAllocatorView from './components/views/SalaryAllocatorView';
import EducationFundView from './components/views/EducationFundView';
import SalarySlipArchiveView from './components/views/SalarySlipArchiveView';
import IncomeDiversificationView from './components/views/IncomeDiversificationView';
import TransactionModal from './components/modals/TransactionModal';
import QuickAddModal from './components/modals/QuickAddModal';

// --- 4. MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  
  // Pull to Refresh States
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const mainRef = useRef(null);
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [categories, setCategories] = useState({ expense: [], income: [], raw: [] });
  const [investTypes, setInvestTypes] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  
  // Refs to track initialization
  const walletsInitialized = useRef(false);
  const investTypesInitialized = useRef(false);
  const categoriesInitialized = useRef(false);

  useEffect(() => {
    console.log(`🚀 Dompet Keluarga v${APP_VERSION} - Loaded`);
  }, []);

  // Pull to Refresh Handlers
  const handleTouchStart = (e) => {
    if (!mainRef.current || window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (!mainRef.current || window.scrollY > 0 || isRefreshing) return;
    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStartY.current;
    if (distance > 0 && distance < 150) { setIsPulling(true); setPullDistance(distance); }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    setIsPulling(false);
    if (pullDistance > 80) {
      setIsRefreshing(true);
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.reload(true);
    } else {
      setPullDistance(0);
    }
  };

  useEffect(() => {
    const main = mainRef.current;
    if (!main || !/mobile|android|iphone|ipad/i.test(navigator.userAgent)) return;
    main.addEventListener('touchstart', handleTouchStart, { passive: true });
    main.addEventListener('touchmove', handleTouchMove, { passive: true });
    main.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
      main.removeEventListener('touchstart', handleTouchStart);
      main.removeEventListener('touchmove', handleTouchMove);
      main.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, isRefreshing]);

  // Auth Handlers
  const handleLogin = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert(e.message); } };
  const handleLogout = async () => await signOut(auth);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsub();
  }, []);

  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [darkMode]);

  // Data Sync
  useEffect(() => {
    if (!user) {
      walletsInitialized.current = false;
      investTypesInitialized.current = false;
      categoriesInitialized.current = false;
      return;
    }
    
    const uid = user.uid;
    walletsInitialized.current = false;
    investTypesInitialized.current = false;
    categoriesInitialized.current = false;

    const unsubTrans = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'transactions'), orderBy('date', 'desc')), 
      (s) => setTransactions(s.docs.map(d => ({ id: d.id, ...d.data(), date: parseDate(d.data().date) }))));

    const unsubInv = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'investments')), 
      (s) => setInvestments(s.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate() }))));

    const unsubCats = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'categories')), async (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0 && !categoriesInitialized.current) {
        categoriesInitialized.current = true;
        try {
          const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'categories');
          const defaultCategories = [
            ...DEFAULT_EXPENSE_CATEGORIES.map(n => ({name: n, type: 'expense', budget: 0})),
            ...DEFAULT_INCOME_CATEGORIES.map(n => ({name: n, type: 'income', budget: 0}))
          ];
          await Promise.all(defaultCategories.map(c => addDoc(batchRef, c)));
        } catch (error) { console.error('Error initializing categories:', error); categoriesInitialized.current = false; }
      } else if (data.length > 0) {
        const uniqueCategories = [];
        const seenKeys = new Set();
        for (const cat of data) {
          const key = `${cat.name}-${cat.type}`;
          if (!seenKeys.has(key)) { seenKeys.add(key); uniqueCategories.push(cat); }
        }
        setCategories({
          expense: uniqueCategories.filter(c => c.type === 'expense').map(c => c.name).sort(),
          income: uniqueCategories.filter(c => c.type === 'income').map(c => c.name).sort(),
          raw: uniqueCategories
        });
      }
    });

    const unsubInvTypes = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'investment_types')), async (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0 && !investTypesInitialized.current) {
        investTypesInitialized.current = true;
        try {
          const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'investment_types');
          await Promise.all(DEFAULT_INVESTMENT_TYPES.map(t => addDoc(batchRef, t)));
        } catch (error) { console.error('Error initializing investment types:', error); investTypesInitialized.current = false; }
      } else if (data.length > 0) {
        const uniqueTypes = [];
        const seenNames = new Set();
        for (const type of data) {
          if (!seenNames.has(type.name)) { seenNames.add(type.name); uniqueTypes.push(type); }
        }
        setInvestTypes(uniqueTypes);
      }
    });

    const unsubWallets = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'wallets')), async (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0 && !walletsInitialized.current) {
        walletsInitialized.current = true;
        try {
          const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'wallets');
          await Promise.all(DEFAULT_WALLETS.map(w => addDoc(batchRef, w)));
        } catch (error) { console.error('Error initializing wallets:', error); walletsInitialized.current = false; }
      } else if (data.length > 0) {
        const uniqueWallets = [];
        const seenNames = new Set();
        for (const wallet of data) {
          if (!seenNames.has(wallet.name)) { seenNames.add(wallet.name); uniqueWallets.push(wallet); }
        }
        setWallets(uniqueWallets);
      }
    });

    const unsubSubs = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'subscriptions')), (s) => {
      setSubscriptions(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubTrans(); unsubInv(); unsubCats(); unsubInvTypes(); unsubWallets(); unsubSubs(); };
  }, [user]);

  // Subscription Auto-Transactions
  useEffect(() => {
    if (!user || loading || subscriptions.length === 0 || wallets.length === 0) return;

    const processAutoTransactions = async () => {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

      for (const sub of subscriptions) {
        if (!sub.paymentDay || !sub.walletId || !sub.cost || sub.cycle !== 'monthly') continue;
        const targetDay = Math.min(sub.paymentDay, getDaysInMonth(currentYear, currentMonth));
        const targetDate = new Date(currentYear, currentMonth, targetDay);
        const startDate = sub.startDate ? sub.startDate.toDate() : null;
        if (startDate && startDate > targetDate) continue;
        if (today >= targetDate) {
          const alreadyExists = transactions.some(t => 
            t.subscriptionId === sub.id && t.date && t.date.getMonth() === currentMonth && t.date.getFullYear() === currentYear
          );
          if (!alreadyExists) {
            try {
              await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), {
                type: 'expense', amount: sub.cost, category: 'Langganan', walletId: sub.walletId,
                subscriptionId: sub.id, note: `Tagihan Otomatis: ${sub.name}`, date: targetDate, createdAt: serverTimestamp()
              });
            } catch (err) { console.error("Auto-gen failed", err); }
          }
        }
      }
    };

    processAutoTransactions();
  }, [user, loading, subscriptions, wallets, transactions.length]);

  // Calculations
  const summary = useMemo(() => {
    const inc = transactions.filter(t => t.type === 'income').reduce((a, c) => a + (Number(c.amount)||0), 0);
    const exp = transactions.filter(t => t.type === 'expense').reduce((a, c) => a + (Number(c.amount)||0), 0);
    const inv = investments.reduce((a, c) => a + (Number(c.currentValue)||0), 0);
    
    const walletBalances = wallets.map(w => {
      let currentBalance = Number(w.initialBalance) || 0;
      currentBalance += transactions.filter(t => t.type === 'income' && t.walletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      currentBalance -= transactions.filter(t => t.type === 'expense' && t.walletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      currentBalance -= transactions.filter(t => t.type === 'transfer' && t.sourceWalletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      currentBalance += transactions.filter(t => t.type === 'transfer' && t.targetWalletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      currentBalance -= transactions.filter(t => t.type === 'investment' && t.walletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      return { ...w, currentBalance };
    });

    const liquidAssets = walletBalances.filter(w => w.type !== 'credit_card').reduce((a, w) => a + w.currentBalance, 0);
    const creditCardDebt = walletBalances.filter(w => w.type === 'credit_card').reduce((a, w) => a + w.currentBalance, 0);
    const netWorth = liquidAssets + inv + creditCardDebt;

    return { income: inc, expense: exp, balance: liquidAssets, ccDebt: creditCardDebt, investment: inv, netWorth, walletBalances };
  }, [transactions, investments, wallets]);

  const fmt = (val) => privacyMode ? 'Rp ••••••' : formatCurrency(val);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-emerald-600 font-bold animate-pulse dark:bg-gray-900 dark:text-emerald-400">Memuat Dompet Keluarga...</div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  const NAV_ITEMS = [
    { id: 'dashboard', icon: <PieChart size={20}/>, label: 'Dashboard' },
    { id: 'transactions', icon: <ArrowUpRight size={20}/>, label: 'Transaksi' },
    { id: 'subscriptions', icon: <Repeat size={20}/>, label: 'Langganan' },
    { id: 'wallets', icon: <CreditCard size={20}/>, label: 'Rekening & CC' },
    { id: 'investments', icon: <TrendingUp size={20}/>, label: 'Investasi & Goal' },
    { id: 'education-fund', icon: <GraduationCap size={20}/>, label: 'Dana Pendidikan' },
    { id: 'income-diversification', icon: <BarChart3 size={20}/>, label: 'Diversifikasi Pendapatan' },
    { id: 'salary-slip-archive', icon: <ScanLine size={20}/>, label: 'Arsip Slip Gaji' },
    { id: 'salary-allocator', icon: <DollarSign size={20}/>, label: 'Alokasi Gaji' },
    { id: 'zakat', icon: <Heart size={20}/>, label: 'Kalkulator Zakat' },
    { id: 'categories', icon: <Settings size={20}/>, label: 'Kategori' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 flex flex-col md:flex-row transition-colors duration-300">
      {/* Pull to Refresh Indicator */}
      {isPulling && (
        <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center bg-emerald-500 text-white transition-all duration-200 ease-out" style={{ height: `${Math.min(pullDistance, 80)}px`, opacity: pullDistance / 80 }}>
          <div className="flex items-center gap-2">
            <RefreshCw size={20} className={pullDistance > 80 ? 'animate-spin' : ''} />
            <span className="text-sm font-medium">{pullDistance > 80 ? 'Release to refresh...' : 'Pull to refresh...'}</span>
          </div>
        </div>
      )}

      {isRefreshing && (
        <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="text-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Refreshing app...</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 h-screen sticky top-0 transition-colors duration-300">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8 text-emerald-700 dark:text-emerald-400">
            <Wallet className="w-8 h-8" />
            <h1 className="font-bold text-xl">Dompet Keluarga</h1>
          </div>
          <nav className="space-y-2">
            {NAV_ITEMS.map(item => (
              <NavBtn key={item.id} id={item.id} active={activeTab} set={setActiveTab} icon={item.icon} label={item.label} />
            ))}
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-600 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0"><User size={20}/></div>
              )}
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{user.displayName || 'Pengguna'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setPrivacyMode(!privacyMode)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title={privacyMode ? "Tampilkan Saldo" : "Sembunyikan Saldo"}>
                {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className="text-gray-400 hover:text-amber-500 transition-colors" title="Ganti Tema">
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors">
            <LogOut size={16}/> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full pb-8 flex flex-col min-h-screen">
        <div className="md:hidden flex justify-between items-center mb-6">
           <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
             <Wallet className="w-6 h-6" />
             <h1 className="font-bold text-lg">Dompet Keluarga</h1>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={() => setPrivacyMode(!privacyMode)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">
               {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
             </button>
             <button onClick={() => setDarkMode(!darkMode)} className="text-gray-400 hover:text-amber-500">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">
               <Menu size={24} />
             </button>
           </div>
        </div>

        {/* Mobile Hamburger Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="fixed right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-bold text-lg text-gray-800 dark:text-white">Menu</h2>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">✕</button>
                </div>
                <div className="flex items-center gap-3 mb-6 pb-6 border-b dark:border-gray-700">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-12 h-12 rounded-full border border-gray-200 dark:border-gray-600" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300"><User size={24}/></div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{user.displayName || 'Pengguna'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                </div>
                <nav className="space-y-2">
                  {NAV_ITEMS.map(item => (
                    <NavBtn key={item.id} id={item.id} active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={item.icon} label={item.label} />
                  ))}
                </nav>
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-3 rounded-lg transition-colors mt-6">
                  <LogOut size={16}/> Keluar
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && <DashboardView summary={summary} transactions={transactions} investments={investments} categories={categories} investTypes={investTypes} setActiveTab={setActiveTab} fmt={fmt} privacyMode={privacyMode} darkMode={darkMode}/>}
        {activeTab === 'transactions' && <TransactionView transactions={transactions} categories={categories} wallets={summary.walletBalances} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'subscriptions' && <SubscriptionView subscriptions={subscriptions} wallets={summary.walletBalances} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'wallets' && <WalletView wallets={summary.walletBalances} transactions={transactions} userId={user.uid} appId={appId} fmt={fmt} privacyMode={privacyMode}/>}
        {activeTab === 'investments' && <InvestmentView investments={investments} investTypes={investTypes} wallets={summary.walletBalances} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'education-fund' && <EducationFundView userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'income-diversification' && <IncomeDiversificationView userId={user.uid} appId={appId} fmt={fmt} transactions={transactions} />}
        {activeTab === 'salary-slip-archive' && <SalarySlipArchiveView userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'salary-allocator' && <SalaryAllocatorView categories={categories} wallets={summary.walletBalances} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'zakat' && <ZakatView summary={summary} investments={investments} fmt={fmt} />}
        {activeTab === 'categories' && <CategoryView categories={categories} userId={user.uid} appId={appId} fmt={fmt} />}

        <TransactionModal 
          isOpen={isTransactionModalOpen} 
          onClose={() => setIsTransactionModalOpen(false)} 
          categories={categories} 
          wallets={summary.walletBalances} 
          userId={user.uid} 
          appId={appId} 
          fmt={fmt}
        />

        <QuickAddModal 
          isOpen={isQuickAddModalOpen} 
          onClose={() => setIsQuickAddModalOpen(false)} 
          categories={categories} 
          wallets={summary.walletBalances} 
          userId={user.uid} 
          appId={appId} 
          fmt={fmt}
        />

        <footer className="mt-auto pt-10 pb-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-600">
            <span>© {new Date().getFullYear()} Dompet Keluarga dikembangkan oleh <span className="text-emerald-600 dark:text-emerald-500 font-medium">@fauzanalfi</span></span>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-600">
            <span className="flex items-center gap-1"><Bot size={12} /> Parser v{APP_VERSION}</span>
            <span>•</span>
            <span className="flex items-center gap-1"><RefreshCw size={12} /> Pull to Refresh</span>
          </div>
        </footer>
      </main>

      {/* Floating Action Buttons */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-3 items-end">
        <button 
          onClick={() => setIsQuickAddModalOpen(true)} 
          className="group flex items-center gap-3 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 border-2 border-emerald-600 text-emerald-600 px-4 py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 touch-manipulation min-h-[48px] min-w-[48px]"
          title="Quick Add - AI Scanner"
        >
          <span className="text-sm font-semibold hidden sm:group-hover:inline-block animate-in fade-in slide-in-from-right-2 duration-200">Quick Add</span>
          <ScanLine size={22} strokeWidth={2.5} />
        </button>
        
        <button 
          onClick={() => setIsTransactionModalOpen(true)} 
          className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
          title="Tambah Transaksi Manual"
        >
          <Plus size={24} strokeWidth={2.5} className="sm:w-7 sm:h-7" />
        </button>
      </div>
    </div>
  );
}