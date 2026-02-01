import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, Minus, Wallet, TrendingUp, PieChart, Settings, Trash2, Save, X, 
  Menu, ArrowUpRight, ArrowDownRight, Coins, LogOut, Landmark, AlertTriangle, Target, Edit2, LogIn,
  User, Calendar, CheckCircle, Eye, EyeOff, Moon, Sun, Heart, CreditCard, Banknote, Smartphone, ArrowRightLeft, Repeat, Briefcase, Globe, RefreshCw, Bot, ListFilter, DollarSign, BarChart3
} from 'lucide-react';
import { 
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, 
  deleteDoc, doc, orderBy, serverTimestamp, updateDoc, setDoc
} from 'firebase/firestore';

// --- 1. KONFIGURASI FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAC5_LnGPcZtLyFB091FaUfEu6_AjJsLbQ",
  authDomain: "dompet-keluarga-prod.firebaseapp.com",
  projectId: "dompet-keluarga-prod",
  storageBucket: "dompet-keluarga-prod.firebasestorage.app",
  messagingSenderId: "68401529984",
  appId: "1:68401529984:web:0749e9b641771b3064d265",
  measurementId: "G-NKY1EL3HXN"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'dompet-keluarga-prod'; 

// --- 2. UTILITY FUNCTIONS ---
const formatCurrency = (amount) => {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};

const formatDate = (date) => {
  if (!date || typeof date.getTime !== 'function' || isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
};

const formatDateInput = (date) => {
  if (!date || typeof date.toISOString !== 'function') return new Date().toISOString().split('T')[0];
  return date.toISOString().split('T')[0];
};

// Helper: Parse tanggal dari berbagai format (Timestamp, String, Date)
const parseDate = (val) => {
  if (!val) return null;
  if (val.toDate) return val.toDate(); // Firestore Timestamp
  if (val instanceof Date) return val; // JS Date Object
  const d = new Date(val); // String / Number
  return isNaN(d.getTime()) ? null : d;
};

const fetchExchangeRate = async (currency) => {
  if (currency === 'IDR') return 1;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=IDR`);
    const data = await res.json();
    return data.rates.IDR;
  } catch (error) {
    console.error("Gagal mengambil kurs:", error);
    return null;
  }
};

// Function to fetch gold price (in IDR per gram)
const fetchGoldPrice = async () => {
  try {
    // Try primary API: metals.live
    try {
      const res = await fetch('https://api.metals.live/v1/spot/gold');
      if (res.ok) {
        const data = await res.json();
        const goldPricePerOz = data.gold;
        const rate = await fetchExchangeRate('USD');
        if (rate && goldPricePerOz) {
          const pricePerGram = (goldPricePerOz * rate) / 31.1035;
          return pricePerGram;
        }
      }
    } catch (err) {
      console.warn("API metals.live gagal, mencoba fallback...", err);
    }

    // Fallback: Menggunakan harga emas historis yang stabil
    // Harga emas terkini berkisar 600.000-750.000 IDR per gram
    console.warn("Menggunakan harga emas fallback: 700.000 IDR");
    return 700000; // Fallback yang lebih realistis
  } catch (error) {
    console.error("Gagal mengambil harga emas:", error);
    return 700000; // Return default fallback price
  }
};

// --- 3. CONSTANTS ---
const DEFAULT_EXPENSE_CATEGORIES = ['Belanja Bulanan', 'Makan Luar', 'Transportasi', 'Listrik & Air', 'Pulsa & Internet', 'Zakat & Infaq', 'Pendidikan (SPP)', 'Cicilan Rumah', 'Kesehatan', 'Langganan'];
const DEFAULT_INCOME_CATEGORIES = ['Gaji Pokok', 'Bonus/THR', 'Sampingan', 'Dividen'];
const DEFAULT_INVESTMENT_TYPES = [
  { name: 'Emas (Logam Mulia)', target: 100000000, deadline: null, icon: '🥇' },
  { name: 'Saham Bluechip', target: 500000000, deadline: null, icon: '📊' },
  { name: 'Reksadana Pasar Uang', target: 50000000, deadline: null, icon: '📈' }
];
const DEFAULT_WALLETS = [
  { name: 'Dompet Tunai', type: 'cash', initialBalance: 0, limit: 0, icon: '💵' },
  { name: 'Bank BCA', type: 'bank', initialBalance: 0, limit: 0, icon: '🏦' },
  { name: 'Kartu Kredit Mandiri', type: 'credit_card', initialBalance: 0, limit: 10000000, icon: '💳' }
];
const CURRENCIES = [
  { code: 'IDR', label: 'Rupiah (IDR)', symbol: 'Rp' },
  { code: 'USD', label: 'US Dollar (USD)', symbol: '$' },
  { code: 'SGD', label: 'Singapore Dollar (SGD)', symbol: 'S$' },
  { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { code: 'MYR', label: 'Malaysian Ringgit (MYR)', symbol: 'RM' },
  { code: 'JPY', label: 'Japanese Yen (JPY)', symbol: '¥' },
  { code: 'AUD', label: 'Australian Dollar (AUD)', symbol: 'A$' },
];
const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

// Mapping service name to icon
const SERVICE_ICONS = {
  netflix: '🎬', 'netflix premium': '🎬',
  spotify: '🎵', 'spotify premium': '🎵',
  youtube: '📺', 'youtube premium': '📺',
  disney: '🎭', 'disney+': '🎭',
  apple: '🍎', 'apple tv': '🍎', 'apple music': '🎶',
  hbo: '📺', 'hbo max': '📺',
  prime: '📦', 'amazon prime': '📦',
  canva: '🎨',
  figma: '🎨',
  github: '💻', 'github pro': '💻',
  slack: '💬',
  notion: '📝',
  adobe: '🖼️', 'creative cloud': '🖼️',
  dropbox: '☁️',
  onedrive: '☁️',
  icloud: '☁️',
  google: '🔍', 'google drive': '☁️', 'google one': '☁️',
  microsoft: '💻', 'office 365': '💻',
  zoom: '📹',
  telegram: '✈️', 'telegram premium': '✈️',
  whatsapp: '💬',
  duolingo: '🦉',
  udemy: '🎓',
  coursera: '🎓',
  linkedin: '💼',
  chatgpt: '🤖',
  grammarly: '✍️',
  nordvpn: '🔒',
  plex: '🎬',
  tidal: '🎵',
  deezer: '🎵',
  lastpass: '🔐', 'password': '🔐',
  evernote: '📓',
  todoist: '✅',
  trello: '📋',
  asana: '📋',
  miro: '🎨',
  photoshop: '🖼️',
  lightroom: '📷',
  illustrator: '🎨',
  indesign: '📄',
  audible: '🎧',
  skillshare: '🎓',
  masterclass: '🎓',
  funimation: '🎭',
  crunchyroll: '🎭',
  showtime: '📺',
  cinemax: '📺',
  starz: '📺',
  paramount: '📺',
  peacock: '📺',
  vpn: '🔒',
  wix: '🌐',
  squarespace: '🌐',
  hosting: '🌐',
  domain: '🌐',
  email: '📧',
  mailchimp: '📧',
  sendgrid: '📧',
  stripe: '💳',
  paypal: '💳',
  wise: '💰',
  revolut: '💳',
  twitch: '🎮',
  gamepass: '🎮', 'xbox': '🎮',
  playstation: '🎮', 'ps plus': '🎮',
  nintendo: '🎮', 'switch': '🎮',
  steam: '🎮',
  epic: '🎮',
  origin: '🎮',
  ubisoft: '🎮',
  elden: '🎮',
  roblox: '🎮',
  // Untuk kategori umum
  'listrik': '⚡', 'gas': '🔥', 'air': '💧', 'internet': '📡', 'pulsa': '📱',
  'tagihan': '📄', 'cicilan': '💰', 'asuransi': '🛡️', 'kesehatan': '⚕️',
  'gym': '💪', 'olahraga': '⚽', 'kendaraan': '🚗', 'rumah': '🏠',
  'sekolah': '🏫', 'kursus': '📚', 'langganan': '🔔'
};

// Helper function to get icon for subscription
const getSubscriptionIcon = (name) => {
  if (!name) return '🔔';
  const lowerName = name.toLowerCase();
  
  // Direct match
  if (SERVICE_ICONS[lowerName]) return SERVICE_ICONS[lowerName];
  
  // Partial match - check if name contains any key
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (lowerName.includes(key)) return icon;
  }
  
  // Default icon
  return '🔔';
};

// --- 4. SMALL COMPONENTS ---

const LoginPage = ({ onLogin }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">
      <div className="bg-emerald-100 dark:bg-emerald-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"><Wallet className="w-8 h-8 text-emerald-600 dark:text-emerald-400" /></div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Dompet Keluarga</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Kelola keuangan dan investasi keluarga.</p>
      <button onClick={onLogin} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center gap-3 transition-colors">
        <LogIn size={20} className="text-emerald-600 dark:text-emerald-400"/> Masuk dengan Google
      </button>
    </div>
  </div>
);

const NavBtn = ({ id, active, set, icon, label }) => (
  <button onClick={()=>set(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active===id ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
    {icon}<span>{label}</span>
  </button>
);

const MobileNavBtn = ({ id, active, set, icon, label }) => (
  <button onClick={()=>set(id)} className={`flex flex-col items-center gap-1 ${active===id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
    {icon}<span className="text-[10px] font-medium">{label}</span>
  </button>
);

const Card = ({ title, amount, icon, color, fmt }) => (
  <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-l-4 ${color} flex justify-between items-start transition-colors duration-300`}>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 font-medium">{title}</p>
      <h3 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">{fmt(amount)}</h3>
    </div>
    <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">{icon}</div>
  </div>
);

// --- 5. VIEW COMPONENTS ---

const DashboardView = ({ summary, transactions, investments, categories, investTypes, setActiveTab, fmt, privacyMode, darkMode }) => {
  const expensePie = useMemo(() => {
    const d = {};
    const now = new Date();
    transactions.filter(t => t.type === 'expense' && t.date?.getMonth() === now.getMonth() && t.date?.getFullYear() === now.getFullYear())
      .forEach(t => d[t.category] = (d[t.category]||0) + Number(t.amount));
    return Object.entries(d).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [transactions]);

  const budgetProgress = useMemo(() => {
    const spending = {};
    const now = new Date();
    transactions.filter(t => t.type === 'expense' && t.date?.getMonth() === now.getMonth() && t.date?.getFullYear() === now.getFullYear())
      .forEach(t => spending[t.category] = (spending[t.category]||0) + Number(t.amount));
    
    return categories.raw.filter(c => c.type === 'expense' && c.budget > 0)
      .map(c => ({ ...c, spent: spending[c.name] || 0, percent: ((spending[c.name]||0)/c.budget)*100 }))
      .sort((a,b) => b.percent - a.percent);
  }, [transactions, categories]);

  const trendData = useMemo(() => {
    const months = [];
    const today = new Date();
    for(let i=5; i>=0; i--) {
       const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
       months.push({ 
         monthStr: d.toLocaleString('id-ID', { month: 'short', year: '2-digit' }), 
         monthIdx: d.getMonth(), 
         year: d.getFullYear(),
         income: 0, 
         expense: 0 
       });
    }
    transactions.forEach(t => {
       if (!t.date) return;
       const match = months.find(m => m.monthIdx === t.date.getMonth() && m.year === t.date.getFullYear());
       if (match) {
         if (t.type === 'income') match.income += parseFloat(t.amount);
         if (t.type === 'expense') match.expense += parseFloat(t.amount);
       }
    });
    return months;
  }, [transactions]);

  const assetGrowthData = useMemo(() => {
    const months = [];
    const today = new Date();
    for(let i=5; i>=0; i--) {
       const endOfMonth = new Date(today.getFullYear(), today.getMonth() - i + 1, 0); 
       const monthStr = endOfMonth.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
       const activeAssets = investments.filter(inv => {
         if (!inv.createdAt) return true;
         return inv.createdAt <= endOfMonth;
       });
       const totalModal = activeAssets.reduce((acc, curr) => acc + (Number(curr.purchaseValue)||0), 0);
       const totalValue = activeAssets.reduce((acc, curr) => acc + (Number(curr.currentValue)||0), 0);
       months.push({ monthStr, modal: totalModal, value: totalValue });
    }
    return months;
  }, [investments]);

  const investProgress = useMemo(() => {
    return investTypes.map(t => {
      const currentTotal = investments
        .filter(i => i.typeId === t.id || (!i.typeId && i.type === t.name))
        .reduce((a, c) => a + (Number(c.currentValue)||0), 0);
      const percent = t.target > 0 ? (currentTotal / t.target) * 100 : 0;
      return { ...t, currentTotal, percent };
    }).sort((a,b) => b.percent - a.percent);
  }, [investments, investTypes]);

  const chartStroke = darkMode ? '#94a3b8' : '#64748b';
  const gridStroke = darkMode ? '#374151' : '#eee';
  const tooltipStyle = darkMode ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' } : { backgroundColor: '#fff', color: '#333' };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Ringkasan Saldo (Top Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Total Aset Bersih" amount={summary.netWorth} icon={<Landmark className="text-emerald-600 dark:text-emerald-400"/>} color="border-emerald-500" fmt={fmt} />
        <Card title="Total Saldo Kas" amount={summary.balance} icon={<Wallet className="text-blue-600 dark:text-blue-400"/>} color="border-blue-500" fmt={fmt} />
        <Card title="Total Investasi" amount={summary.investment} icon={<TrendingUp className="text-amber-500 dark:text-amber-400"/>} color="border-amber-500" fmt={fmt} />
      </div>

      {/* Wallet Breakdown */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <CreditCard size={18} className="text-blue-500"/> Saldo per Akun
            </h3>
            <button onClick={()=>setActiveTab('wallets')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Kelola</button>
         </div>
         <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {summary.walletBalances.map(w => (
              <div key={w.id} className={`min-w-[180px] p-3 rounded-lg border ${w.type === 'credit_card' ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800' : 'border-gray-100 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600'} flex flex-col justify-between`}>
                 <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {w.icon ? (
                       <span className="text-lg leading-none">{w.icon}</span>
                    ) : (
                       <>
                         {w.type === 'bank' && <Landmark size={12}/>}
                         {w.type === 'cash' && <Banknote size={12}/>}
                         {w.type === 'ewallet' && <Smartphone size={12}/>}
                         {w.type === 'credit_card' && <CreditCard size={12} className="text-red-500"/>}
                         {w.type === 'rdn' && <Briefcase size={12} className="text-amber-600"/>}
                       </>
                    )}
                    <span className="truncate">{w.name}</span>
                 </div>
                 <div>
                    <div className={`font-bold ${w.type === 'credit_card' ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                      {w.type === 'credit_card' ? `Utang: ${fmt(Math.abs(w.currentBalance))}` : fmt(w.currentBalance)}
                    </div>
                    {w.type === 'credit_card' && (
                      <div className="mt-1">
                        <div className="w-full bg-red-200 dark:bg-red-900 rounded-full h-1.5 mb-1">
                          <div className="bg-red-500 h-1.5 rounded-full" style={{width: `${Math.min((Math.abs(w.currentBalance)/w.limit)*100, 100)}%`}}></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                          <span>Sisa: {fmt(w.limit - Math.abs(w.currentBalance))}</span>
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            ))}
         </div>
      </div>

      {budgetProgress.some(b => b.percent >= 90) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex gap-3">
           <AlertTriangle className="text-red-600 dark:text-red-400 mt-1 shrink-0" size={20} />
           <div>
             <h3 className="font-bold text-red-700 dark:text-red-400 text-sm">Peringatan Budget!</h3>
             <div className="text-xs text-red-600 dark:text-red-300 mt-1 space-y-1">
               {budgetProgress.filter(b => b.percent >= 90).map(b => (
                 <p key={b.id}><b>{b.name}</b>: {b.percent.toFixed(0)}% ({fmt(b.spent)} / {fmt(b.budget)})</p>
               ))}
             </div>
           </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[300px] transition-colors duration-300">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500"/> Tren Arus Kas (6 Bulan)
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="monthStr" tick={{fontSize: 12, fill: chartStroke}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 10, fill: chartStroke}} tickFormatter={(val) => privacyMode ? '•' : `${val/1000}k`} tickLine={false} axisLine={false} />
                <ReTooltip formatter={(value) => fmt(value)} contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Pemasukan" stroke="#10B981" strokeWidth={2} dot={{r:4}} />
                <Line type="monotone" dataKey="expense" name="Pengeluaran" stroke="#EF4444" strokeWidth={2} dot={{r:4}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[300px] transition-colors duration-300">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-500"/> Tren Nilai Aset (6 Bulan)
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={assetGrowthData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="monthStr" tick={{fontSize: 12, fill: chartStroke}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 10, fill: chartStroke}} tickFormatter={(val) => privacyMode ? '•' : `${val/1000000}jt`} tickLine={false} axisLine={false} />
                <ReTooltip formatter={(value) => fmt(value)} contentStyle={tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="modal" name="Total Modal" stroke="#94a3b8" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                <Area type="monotone" dataKey="value" name="Nilai Pasar" stroke="#F59E0B" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[300px] transition-colors duration-300">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2"><PieChart size={18}/> Pengeluaran Bulan Ini</h3>
            {expensePie.length > 0 ? (
              <div className="flex-1"><ResponsiveContainer width="100%" height={250}><RePieChart><Pie data={expensePie} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke={darkMode ? "#1f2937" : "#fff"}>{expensePie.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><ReTooltip formatter={v=>fmt(v)} contentStyle={tooltipStyle} /><Legend verticalAlign="bottom"/></RePieChart></ResponsiveContainer></div>
            ) : <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">Belum ada data</div>}
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col transition-colors duration-300">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2"><Target size={18}/> Monitoring Budget</h3><button onClick={()=>setActiveTab('categories')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Atur</button></div>
            <div className="flex-1 overflow-y-auto max-h-[250px] space-y-4 pr-2 custom-scrollbar">
              {budgetProgress.length===0 ? <div className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">Belum ada budget diset</div> : budgetProgress.map(b => (
                <div key={b.id}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium text-gray-700 dark:text-gray-300">{b.name}</span><span className={b.percent>90?'text-red-600 dark:text-red-400':'text-gray-500 dark:text-gray-400'}>{b.percent.toFixed(0)}%</span></div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2"><div className={`h-2 rounded-full ${b.percent>=100?'bg-red-600':b.percent>=75?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${Math.min(b.percent,100)}%`}}></div></div>
                </div>
              ))}
            </div>
          </div>
      </div>
    </div>
  );
};

const TransactionView = ({ transactions, categories, wallets, userId, appId, fmt }) => {
  const [formData, setFormData] = useState({ id: null, type: 'expense', amount: '', category: '', walletId: '', sourceWalletId: '', targetWalletId: '', note: '', date: formatDateInput(new Date()) });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', walletId: '' });

  // Filter Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = t.date;
      if (!d || isNaN(d.getTime())) return false;

      let matchesDate = true;
      if (filters.startDate) {
        matchesDate = matchesDate && d >= new Date(filters.startDate);
      }
      if (filters.endDate) {
        const e = new Date(filters.endDate);
        e.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && d <= e;
      }

      let matchesWallet = true;
      if (filters.walletId) {
        matchesWallet = t.walletId === filters.walletId || t.sourceWalletId === filters.walletId || t.targetWalletId === filters.walletId;
      }

      return matchesDate && matchesWallet;
    });
  }, [transactions, filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      ...formData, 
      amount: Number(formData.amount), 
      date: new Date(formData.date), 
      updatedAt: serverTimestamp() 
    };
    delete payload.id;

    try {
      if (formData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'transactions', formData.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), { ...payload, createdAt: serverTimestamp() });
      }
      setIsFormOpen(false); setFormData({ id: null, type: 'expense', amount: '', category: '', walletId: '', sourceWalletId: '', targetWalletId: '', note: '', date: formatDateInput(new Date()) });
    } catch (err) { console.error(err); }
  };

  const handleEdit = (t) => {
    setFormData({ 
      id: t.id, 
      type: t.type, 
      amount: t.amount, 
      category: t.category || '', 
      walletId: t.walletId || '', 
      sourceWalletId: t.sourceWalletId || '',
      targetWalletId: t.targetWalletId || '',
      note: t.note, 
      date: formatDateInput(t.date) 
    });
    setIsFormOpen(true);
  };
  
  const handleDelete = async (id) => { if (confirm('Hapus transaksi?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'transactions', id)); };

  const cats = formData.type === 'expense' ? categories.expense : categories.income;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Transaksi</h2>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setFormData({ id: null, type: 'expense', amount: '', category: '', walletId: '', sourceWalletId: '', targetWalletId: '', note: '', date: formatDateInput(new Date()) }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">{isFormOpen ? <X size={18}/> : <Plus size={18}/>} <span>{isFormOpen ? 'Batal' : 'Baru'}</span></button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-3 items-end">
        <div className="w-full md:w-auto flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-semibold">
           <ListFilter size={16}/> Filter:
        </div>
        <div className="w-full md:w-auto space-y-1">
           <label className="text-xs text-gray-500 dark:text-gray-400">Dari Tanggal</label>
           <input type="date" value={filters.startDate} onChange={e=>setFilters({...filters, startDate:e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
        </div>
        <div className="w-full md:w-auto space-y-1">
           <label className="text-xs text-gray-500 dark:text-gray-400">Sampai Tanggal</label>
           <input type="date" value={filters.endDate} onChange={e=>setFilters({...filters, endDate:e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
        </div>
        <div className="w-full md:w-auto space-y-1 flex-1">
           <label className="text-xs text-gray-500 dark:text-gray-400">Rekening / Dompet</label>
           <select value={filters.walletId} onChange={e=>setFilters({...filters, walletId:e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:[&>option]:bg-gray-800">
             <option value="">Semua Rekening</option>
             {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
           </select>
        </div>
        <button onClick={()=>setFilters({startDate:'', endDate:'', walletId:''})} className="text-sm text-red-500 hover:text-red-700 underline pb-2">Reset</button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 mb-6 transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jenis Transaksi</label>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>setFormData({...formData, type:'income', category:'', sourceWalletId: '', targetWalletId: ''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='income'?'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 ring-2 ring-green-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pemasukan</button>
                  <button type="button" onClick={()=>setFormData({...formData, type:'expense', category:'', sourceWalletId: '', targetWalletId: ''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='expense'?'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 ring-2 ring-red-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pengeluaran</button>
                  <button type="button" onClick={()=>setFormData({...formData, type:'transfer', category:''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='transfer'?'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Mutasi / Transfer</button>
                </div>
             </div>
             
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jumlah (Rp)</label>
                <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
             </div>

             {/* Dynamic Fields based on Type */}
             {formData.type === 'transfer' ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Dari (Sumber)</label>
                    <select required value={formData.sourceWalletId} onChange={e=>setFormData({...formData, sourceWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Sumber...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name} ({fmt(w.currentBalance)})</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Ke (Tujuan)</label>
                    <select required value={formData.targetWalletId} onChange={e=>setFormData({...formData, targetWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Tujuan...</option>
                      {wallets.filter(w => w.id !== formData.sourceWalletId).map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                </>
             ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kantong / Akun</label>
                    <select required value={formData.walletId} onChange={e=>setFormData({...formData, walletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Akun...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori</label>
                    <select required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white transition-all dark:[&>option]:bg-gray-800"><option value="">Pilih Kategori...</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
                  </div>
                </>
             )}

             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Tanggal</label>
                <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white"/>
             </div>
             <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Catatan</label>
                <input value={formData.note} onChange={e=>setFormData({...formData, note:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="Opsional (misal: Mutasi ke e-wallet)"/>
             </div>
          </div>
          <div className="flex justify-end"><button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-200/50 transition-all"><Save size={18}/> {formData.id ? 'Update Data' : 'Simpan Transaksi'}</button></div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600"><tr><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">TANGGAL</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">AKUN/DETAIL</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">KATEGORI</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">CATATAN</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300 text-right">JUMLAH</th><th className="p-4 w-20"></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredTransactions.length===0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-400 dark:text-gray-500">Belum ada data</td></tr> : filteredTransactions.map(t => {
                const w = wallets.find(x => x.id === t.walletId);
                const wSource = wallets.find(x => x.id === t.sourceWalletId);
                const wTarget = wallets.find(x => x.id === t.targetWalletId);
                
                return (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 group transition-colors">
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="p-4 text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {t.type === 'transfer' ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500">{wSource?.icon} {wSource?.name || '?'}</span>
                          <ArrowRightLeft size={10} />
                          <span className="text-gray-900 dark:text-white font-bold">{wTarget?.icon} {wTarget?.name || '?'}</span>
                        </div>
                      ) : t.type === 'investment' ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Briefcase size={12}/> Investasi</span>
                      ) : (
                        w ? <span>{w.icon} {w.name}</span> : <span className="text-gray-400 italic">Terhapus</span>
                      )}
                    </td>
                    <td className="p-4 text-sm">
                      {t.type === 'transfer' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Mutasi Saldo</span>
                      ) : t.type === 'investment' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Beli Aset</span>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type==='income'?'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400':'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{t.category}</span>
                      )}
                      {t.subscriptionId && (
                         <span className="ml-2" title="Auto-generated"><Bot size={12} className="inline text-purple-500"/></span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{t.note||'-'}</td>
                    <td className={`p-4 text-sm font-medium text-right whitespace-nowrap ${t.type==='income'?'text-green-600 dark:text-green-400': t.type === 'expense' || t.type === 'investment' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {t.type==='income' ? '+' : (t.type === 'expense' || t.type === 'investment') ? '-' : ''}{fmt(t.amount)}
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.type !== 'investment' && ( // Prevent editing investment transactions directly here for simplicity
                        <button onClick={()=>handleEdit(t)} className="text-blue-400 hover:text-blue-600"><Edit2 size={16}/></button>
                      )}
                      <button onClick={()=>handleDelete(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const WalletView = ({ wallets, userId, appId, fmt, privacyMode }) => {
  const [form, setForm] = useState({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    try {
      const payload = { 
        name: form.name, 
        type: form.type, 
        initialBalance: Number(form.initialBalance)||0,
        limit: form.type === 'credit_card' ? (Number(form.limit)||0) : 0,
        icon: form.icon
      };

      if (form.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'wallets', form.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'wallets'), payload);
      }
      setForm({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' });
      setIsFormOpen(false);
    } catch(err) { console.error(err); }
  };

  const handleEdit = (w) => {
    setForm({ id: w.id, name: w.name, type: w.type, initialBalance: w.initialBalance, limit: w.limit || '', icon: w.icon || '' });
    setIsFormOpen(true);
  }

  const handleDelete = async (id) => {
    if(confirm('Hapus akun ini? Transaksi terkait akan tetap ada tapi tanpa nama akun.')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'wallets', id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Rekening & Kartu Kredit</h2>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">{isFormOpen ? <X size={18}/> : <Plus size={18}/>} <span>{isFormOpen ? 'Batal' : 'Tambah'}</span></button>
      </div>
      
      {isFormOpen && (
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end transition-colors duration-300 animate-in fade-in slide-in-from-top-4">
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tipe Akun</label>
           <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
             <option value="bank">Bank</option>
             <option value="ewallet">E-Wallet</option>
             <option value="cash">Tunai</option>
             <option value="credit_card">Kartu Kredit</option>
             <option value="rdn">RDN (Rekening Dana Nasabah)</option>
           </select>
        </div>
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Icon (Emoji)</label>
           <input value={form.icon} onChange={e=>setForm({...form, icon:e.target.value})} placeholder="Contoh: 💰" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white text-center text-lg"/>
        </div>
        <div className="space-y-1 lg:col-span-2">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Akun</label>
           <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Contoh: BCA / Kartu Kredit" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
        </div>
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Saldo Awal (Rp)</label>
           <input type="number" value={form.initialBalance} onChange={e=>setForm({...form, initialBalance:e.target.value})} placeholder="0" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
        </div>
        {form.type === 'credit_card' && (
          <div className="space-y-1 lg:col-span-1">
             <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Limit Pagu (Rp)</label>
             <input type="number" value={form.limit} onChange={e=>setForm({...form, limit:e.target.value})} placeholder="Limit Kredit" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
          </div>
        )}
        <button type="submit" className="md:col-span-2 lg:col-span-1 bg-emerald-600 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors h-[46px]"><Save size={18}/> {form.id ? 'Simpan' : 'Tambah'}</button>
      </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map(w => (
          <div key={w.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transition-colors duration-300 group relative">
             <div className="flex justify-between items-start">
               <div className="flex items-center gap-3">
                 <div className="text-3xl p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                   {w.icon || (
                     w.type === 'bank' ? <Landmark size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'ewallet' ? <Smartphone size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'cash' ? <Banknote size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'credit_card' ? <CreditCard size={24} className="text-red-500"/> :
                     <Briefcase size={24} className="text-amber-600 dark:text-amber-400"/>
                   )}
                 </div>
                 <div>
                   <h3 className="font-bold text-gray-800 dark:text-gray-100">{w.name}</h3>
                   <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{w.type.replace('_', ' ')}</p>
                 </div>
               </div>
               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm">
                  <button onClick={()=>handleEdit(w)} className="text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1 rounded"><Edit2 size={16}/></button>
                  <button onClick={()=>handleDelete(w.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"><Trash2 size={16}/></button>
               </div>
             </div>
             <div className="mt-4 pt-4 border-t border-dashed dark:border-gray-700">
               <div className="flex justify-between items-end mb-1">
                 <div>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{w.type === 'credit_card' ? 'Total Tagihan' : 'Saldo Saat Ini'}</p>
                   <p className={`text-xl font-bold ${w.type === 'credit_card' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                     {w.type === 'credit_card' ? fmt(Math.abs(w.currentBalance)) : fmt(w.currentBalance)}
                   </p>
                 </div>
                 {w.initialBalance !== 0 && <span className="text-[10px] text-gray-400">Awal: {fmt(w.initialBalance)}</span>}
               </div>
               {w.type === 'credit_card' && w.limit > 0 && (
                 <div className="mt-2 text-xs">
                   <div className="flex justify-between mb-1 text-gray-500 dark:text-gray-400">
                     <span>Terpakai {((Math.abs(w.currentBalance)/w.limit)*100).toFixed(0)}%</span>
                     <span>Limit: {fmt(w.limit)}</span>
                   </div>
                   <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                     <div className="bg-red-500 h-1.5 rounded-full transition-all" style={{width: `${Math.min((Math.abs(w.currentBalance)/w.limit)*100, 100)}%`}}></div>
                   </div>
                 </div>
               )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SubscriptionView = ({ subscriptions, wallets, userId, appId, fmt }) => {
  const [form, setForm] = useState({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [sortBy, setSortBy] = useState('paymentDay'); // 'paymentDay' | 'cost' | 'name'

  // New function to handle manual rate fetch
  const handleFetchRate = async () => {
    if (form.currency === 'IDR' || !form.currency) return;
    setIsLoadingRate(true);
    const rate = await fetchExchangeRate(form.currency);
    if (rate && form.foreignCost) {
       setForm(prev => ({ ...prev, cost: Math.round(prev.foreignCost * rate) }));
    }
    setIsLoadingRate(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.cost) return;
    const payload = {
      ...form,
      cost: Number(form.cost),
      foreignCost: form.currency !== 'IDR' ? Number(form.foreignCost) : 0,
      paymentDay: Number(form.paymentDay),
      updatedAt: serverTimestamp(),
      startDate: new Date(form.startDate) // Save start date
    };
    delete payload.id;

    try {
      if (form.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'subscriptions', form.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'subscriptions'), { ...payload, createdAt: serverTimestamp() });
      }
      setForm({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) });
      setIsFormOpen(false);
    } catch (err) { console.error(err); }
  };

  const handleEdit = (sub) => {
    const startDateValue = sub.startDate ? (
      typeof sub.startDate.toDate === 'function' 
        ? formatDateInput(sub.startDate.toDate())
        : formatDateInput(new Date(sub.startDate))
    ) : formatDateInput(new Date());
    
    setForm({ 
      ...sub, 
      id: sub.id,
      startDate: startDateValue
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus langganan ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'subscriptions', id));
    }
  };

  // Sorting logic
  const sortedSubscriptions = useMemo(() => {
    const sorted = [...subscriptions];
    if (sortBy === 'paymentDay') {
      sorted.sort((a, b) => (Number(a.paymentDay) || 31) - (Number(b.paymentDay) || 31));
    } else if (sortBy === 'cost') {
      sorted.sort((a, b) => Number(b.cost) - Number(a.cost)); // Descending
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [subscriptions, sortBy]);

  // Calculate stats
  const totalMonthly = subscriptions.reduce((acc, sub) => {
    return acc + (sub.cycle === 'monthly' ? sub.cost : sub.cost / 12);
  }, 0);

  const totalYearly = totalMonthly * 12;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Langganan Rutin</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
            <ListFilter size={16} className="text-gray-500"/>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent outline-none text-gray-700 dark:text-gray-200 w-full dark:[&>option]:bg-gray-800"
            >
              <option value="paymentDay">Sortir: Tanggal Bayar</option>
              <option value="cost">Sortir: Nominal (Tertinggi)</option>
              <option value="name">Sortir: Nama</option>
            </select>
          </div>
          <button onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors shrink-0">{isFormOpen ? <X size={18}/> : <Plus size={18}/>} <span>{isFormOpen ? 'Batal' : 'Tambah'}</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center">
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase">Estimasi Bulanan</p>
            <p className="text-xl font-bold text-blue-800 dark:text-blue-100">{fmt(totalMonthly)}</p>
          </div>
          <Calendar className="text-blue-400 opacity-50" size={32} />
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800 flex justify-between items-center">
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold uppercase">Estimasi Tahunan</p>
            <p className="text-xl font-bold text-purple-800 dark:text-purple-100">{fmt(totalYearly)}</p>
          </div>
          <Coins className="text-purple-400 opacity-50" size={32} />
        </div>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Layanan</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Netflix" />
            </div>
            
            <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mata Uang & Nominal Asing</label>
               <div className="flex gap-2">
                 <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-1/3 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                 </select>
                 <input type="number" 
                   disabled={form.currency === 'IDR'}
                   value={form.foreignCost} 
                   onChange={e => setForm({ ...form, foreignCost: e.target.value })} 
                   className="w-2/3 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800" 
                   placeholder={form.currency === 'IDR' ? '-' : 'Nominal Asli'}
                 />
               </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex justify-between">
                <span>{form.currency !== 'IDR' ? `Estimasi (Rp)` : `Biaya (Rp)`}</span>
                {form.currency !== 'IDR' && (
                  <button type="button" onClick={handleFetchRate} disabled={isLoadingRate} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    {isLoadingRate ? <RefreshCw size={10} className="animate-spin"/> : <Globe size={10}/>} Ambil Kurs Terkini
                  </button>
                )}
              </label>
              <input type="number" required value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Siklus</label>
              <select value={form.cycle} onChange={e => setForm({ ...form, cycle: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tanggal Bayar (Tgl 1-31)</label>
              <input type="number" min="1" max="31" value={form.paymentDay} onChange={e => setForm({ ...form, paymentDay: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Tgl berapa?" />
            </div>
            <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mulai Berlangganan</label>
               <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sumber Dana</label>
              <select value={form.walletId} onChange={e => setForm({ ...form, walletId: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                <option value="">Pilih Dompet/Kartu...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors">
              <Save size={18} /> {form.id ? 'Simpan Perubahan' : 'Tambah Langganan'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedSubscriptions.map(sub => {
          const wallet = wallets.find(w => w.id === sub.walletId);
          const curr = CURRENCIES.find(c => c.code === sub.currency) || CURRENCIES[0];
          return (
            <div key={sub.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center group hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="text-3xl p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {getSubscriptionIcon(sub.name)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">{sub.name}</h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={10} /> Tgl {sub.paymentDay || '?'}</span>
                    {wallet && <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-1.5 rounded text-[10px]"><Wallet size={10} /> {wallet.name}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 dark:text-gray-100">{fmt(sub.cost)}</p>
                {sub.currency !== 'IDR' && (
                  <p className="text-xs text-gray-400">{curr.symbol} {sub.foreignCost}</p>
                )}
                <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(sub)} className="text-blue-400 hover:text-blue-600"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(sub.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {subscriptions.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            Belum ada langganan. Tambahkan Netflix, Spotify, atau tagihan rutin lainnya.
          </div>
        )}
      </div>
    </div>
  );
};

const InvestmentView = ({ investments, investTypes, wallets, userId, appId, fmt }) => {
  const [editingType, setEditingType] = useState(null);
  const [assetForm, setAssetForm] = useState({ id: null, name: '', typeId: '', amount: '', purchaseValue: '', currentValue: '', sourceWalletId: '', icon: '' });
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [filterGoal, setFilterGoal] = useState(''); // State untuk filter
  const scrollRef = useRef(null);

  const typeStats = useMemo(() => {
    return investTypes.map(type => {
      const relatedInv = investments.filter(i => i.typeId === type.id || (!i.typeId && i.type === type.name));
      const currentTotal = relatedInv.reduce((a, c) => a + (Number(c.currentValue)||0), 0);
      const percent = type.target > 0 ? (currentTotal / type.target) * 100 : 0;
      return { ...type, currentTotal, percent: isNaN(percent) ? 0 : percent };
    });
  }, [investments, investTypes]);

  // Filter Logic untuk List Aset
  const filteredAssets = useMemo(() => {
    if (!filterGoal) return investments;
    return investments.filter(inv => {
       // Handle legacy data (cocokkan ID atau Name jika ID kosong)
       const typeId = inv.typeId || investTypes.find(t => t.name === inv.type)?.id;
       return typeId === filterGoal;
    });
  }, [investments, filterGoal, investTypes]);

  const handleSaveType = async (e) => {
    e.preventDefault();
    const payload = { ...editingType, target: Number(editingType.target) };
    try {
      if (editingType.id) await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'investment_types', editingType.id), payload);
      else await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'investment_types'), payload);
      setEditingType(null);
    } catch(err){console.error(err)}
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    const payload = { ...assetForm, amount: Number(assetForm.amount)||0, purchaseValue: Number(assetForm.purchaseValue)||0, currentValue: Number(assetForm.currentValue)||0, updatedAt: serverTimestamp() };
    delete payload.id;
    delete payload.sourceWalletId; // Don't save this to asset, used for transaction creation only

    try {
      if (assetForm.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'investments', assetForm.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'investments'), { ...payload, createdAt: serverTimestamp() });
        
        // Auto-create transaction if wallet selected
        if (assetForm.sourceWalletId) {
           await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), {
              type: 'investment',
              walletId: assetForm.sourceWalletId,
              amount: Number(assetForm.purchaseValue),
              category: 'Investasi',
              note: `Beli Aset: ${assetForm.name}`,
              date: new Date(),
              createdAt: serverTimestamp()
           });
        }
      }
      setIsAssetFormOpen(false); setAssetForm({ id: null, name: '', typeId: '', amount: '', purchaseValue: '', currentValue: '', sourceWalletId: '', icon: '' });
    } catch(err){console.error(err)}
  };

  const handleEditAsset = (inv) => {
    setAssetForm({ 
      id: inv.id, name: inv.name, 
      typeId: inv.typeId || investTypes.find(t => t.name === inv.type)?.id || '', 
      amount: inv.amount ?? '', purchaseValue: inv.purchaseValue ?? '', currentValue: inv.currentValue ?? '',
      icon: inv.icon || '',
      sourceWalletId: '' // No source wallet editing for existing assets
    });
    setIsAssetFormOpen(true);
    // Auto-scroll ke form
    setTimeout(() => {
       if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
  const handleDeleteAsset = async (id) => { if(confirm('Hapus aset ini?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'investments', id)); };
  const handleDeleteType = async (id) => { if(confirm('Hapus kategori ini? Aset di dalamnya tidak akan terhapus tapi jadi tidak berkategori.')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'investment_types', id)); };

  return (
    <div className="space-y-8" ref={scrollRef}>
      {/* SECTION 1: GOALS & TYPES */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Target className="text-emerald-600 dark:text-emerald-400"/> Goal & Kategori Investasi</h3>
          <button onClick={()=>setEditingType({name:'', target:'', deadline:'', icon:''})} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">+ Buat Goal Baru</button>
        </div>
        
        {editingType && (
           <form onSubmit={handleSaveType} className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-5 gap-4 animate-in fade-in border border-gray-200 dark:border-gray-600">
             <div className="md:col-span-1 space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Icon</label>
                <input value={editingType.icon} onChange={e=>setEditingType({...editingType, icon:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white text-center" placeholder="💰"/>
             </div>
             <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nama Kategori/Goal</label>
                <input required value={editingType.name} onChange={e=>setEditingType({...editingType, name:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" placeholder="Misal: Dana Haji"/>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Target (Rp)</label>
                <input type="number" required value={editingType.target} onChange={e=>setEditingType({...editingType, target:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Deadline</label>
                <input type="date" value={editingType.deadline||''} onChange={e=>setEditingType({...editingType, deadline:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
             </div>
             <div className="md:col-span-5 flex justify-end gap-2 pt-2">
               <button type="button" onClick={()=>setEditingType(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">Batal</button>
               <button type="submit" className="px-6 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium shadow-sm">Simpan Goal</button>
             </div>
           </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {typeStats.map(t => (
            <div key={t.id} className="border dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow group relative dark:bg-gray-700/50">
              <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-2">
                   <span className="text-xl">{t.icon||'💰'}</span>
                   <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">{t.name}</span>
                 </div>
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>setEditingType(t)} className="text-gray-300 hover:text-blue-500"><Edit2 size={14}/></button>
                    <button onClick={()=>handleDeleteType(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                 </div>
              </div>
              <div className="space-y-1 cursor-pointer" onClick={() => setFilterGoal(t.id === filterGoal ? '' : t.id)}>
                 <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                   <span>Tercapai: {fmt(t.currentTotal)}</span>
                   <span>Target: {fmt(t.target)}</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-gray-600 rounded-full h-2">
                   <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{width: `${Math.min(t.percent, 100)}%`}}></div>
                 </div>
                 <div className="flex justify-between items-center mt-1">
                   <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t.percent.toFixed(1)}%</span>
                   {t.deadline && <span className="text-[10px] bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-500 dark:text-gray-300 flex items-center gap-1"><Calendar size={8}/> {t.deadline}</span>}
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: ASSETS LIST */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Portofolio Aset</h2>
          <div className="flex items-center gap-2 w-full md:w-auto">
             {/* FILTER DROPDOWN */}
             <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
                <ListFilter size={16} className="text-gray-500"/>
                <select 
                  value={filterGoal} 
                  onChange={(e) => setFilterGoal(e.target.value)}
                  className="bg-transparent outline-none text-gray-700 dark:text-gray-200 w-full dark:[&>option]:bg-gray-800 dark:[&>option]:text-gray-200"
                >
                  <option value="">Semua Kategori</option>
                  {investTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                </select>
             </div>
             <button onClick={()=>{setIsAssetFormOpen(!isAssetFormOpen); setAssetForm({id:null, name:'', typeId:'', amount:'', purchaseValue:'', currentValue:''})}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors shrink-0">{isAssetFormOpen?<X size={18}/>:<Plus size={18}/>} <span className="hidden md:inline">{isAssetFormOpen?'Batal':'Tambah'}</span></button>
          </div>
        </div>

        {isAssetFormOpen && (
          <form onSubmit={handleSaveAsset} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700 mb-6 animate-in fade-in slide-in-from-top-4 transition-colors duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Nama Produk</label>
                  <input required value={assetForm.name} onChange={e=>setAssetForm({...assetForm, name:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Antam 5g"/>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Icon (Emoji)</label>
                  <input value={assetForm.icon} onChange={e=>setAssetForm({...assetForm, icon:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white text-center" placeholder="Default: ❓"/>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori/Goal</label>
                  <select required value={assetForm.typeId} onChange={e=>setAssetForm({...assetForm, typeId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800"><option value="">Pilih...</option>{investTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jumlah Unit</label>
                  <input type="number" value={assetForm.amount} onChange={e=>setAssetForm({...assetForm, amount:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Modal Awal (Rp)</label>
                  <input type="number" required value={assetForm.purchaseValue} onChange={e=>setAssetForm({...assetForm, purchaseValue:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
               </div>
               <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Nilai Saat Ini (Rp)</label>
                  <input type="number" required value={assetForm.currentValue} onChange={e=>setAssetForm({...assetForm, currentValue:e.target.value})} className="w-full p-2.5 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-emerald-900 dark:text-emerald-300"/>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nilai pasar terkini untuk menghitung profit/loss.</p>
               </div>
               {!assetForm.id && (
                 <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Sumber Dana (Opsional)</label>
                    <select value={assetForm.sourceWalletId || ''} onChange={e=>setAssetForm({...assetForm, sourceWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Tidak ada (Hanya catat)</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon || '💰'} {w.name} ({fmt(w.currentBalance)})</option>)}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Jika dipilih, saldo akan berkurang otomatis sebagai "Mutasi Keluar" ke Aset.</p>
                 </div>
               )}
            </div>
            <div className="flex justify-end"><button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-200/50 transition-all"><Save size={18}/> {assetForm.id ? 'Update Aset' : 'Simpan Aset'}</button></div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {filteredAssets.length === 0 ? (
             <div className="col-span-full text-center py-10 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
               Tidak ada aset di kategori ini.
             </div>
           ) : filteredAssets.map(inv => {
             const roi = inv.currentValue - inv.purchaseValue;
             const roiP = inv.purchaseValue > 0 ? (roi/inv.purchaseValue)*100 : 0;
             const type = investTypes.find(t => t.id === inv.typeId) || { name: inv.type || 'Lainnya', icon: '❓' };
             
             return (
               <div key={inv.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
                 <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">{inv.icon || type?.icon || '❓'}</div>
                      <div><h3 className="font-bold text-gray-800 dark:text-gray-200">{inv.name}</h3><p className="text-xs text-gray-500 dark:text-gray-400">{type?.name || 'Lainnya'} • {inv.amount} unit</p></div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={()=>handleEditAsset(inv)} className="p-1 text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"><Edit2 size={16}/></button>
                      <button onClick={()=>handleDeleteAsset(inv.id)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={16}/></button>
                    </div>
                 </div>
                 <div className="space-y-1 text-sm border-t dark:border-gray-700 border-b py-2 mb-2 border-dashed">
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Modal</span><span>{fmt(inv.purchaseValue)}</span></div>
                    <div className="flex justify-between font-medium dark:text-gray-200"><span>Nilai</span><span>{fmt(inv.currentValue)}</span></div>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500">ROI</span>
                    <span className={`text-sm font-bold ${roi>=0?'text-green-600 dark:text-green-400':'text-red-600 dark:text-red-400'}`}>{roi>=0?'+':''}{roiP.toFixed(1)}% ({fmt(roi)})</span>
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};

const ZakatView = ({ summary, investments, fmt }) => {
  const [goldPrice, setGoldPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customGoldPrice, setCustomGoldPrice] = useState('');

  // Nisab: 85 grams of gold
  const NISAB_GOLD_GRAMS = 85;

  useEffect(() => {
    const loadGoldPrice = async () => {
      setLoading(true);
      const price = await fetchGoldPrice();
      if (price) {
        setGoldPrice(price);
        setCustomGoldPrice('');
      }
      setLoading(false);
    };
    loadGoldPrice();
  }, []);

  // Calculate nisab based on current gold price
  const nisab = useMemo(() => {
    const price = customGoldPrice ? Number(customGoldPrice) : goldPrice;
    if (!price) return 0;
    return NISAB_GOLD_GRAMS * price;
  }, [goldPrice, customGoldPrice]);

  // Total liquid assets (kas + investasi)
  const totalLiquidAssets = useMemo(() => {
    const liquidWallets = summary.walletBalances
      .filter(w => w.type !== 'credit_card')
      .reduce((a, w) => a + w.currentBalance, 0);
    const investmentValue = investments.reduce((a, c) => a + (Number(c.currentValue) || 0), 0);
    return liquidWallets + investmentValue;
  }, [summary, investments]);

  // Check if nisab is reached
  const isNisabReached = totalLiquidAssets >= nisab;

  // Calculate zakat mal (2.5%)
  const zakatAmount = useMemo(() => {
    if (!isNisabReached) return 0;
    return (totalLiquidAssets * 0.025);
  }, [totalLiquidAssets, isNisabReached]);

  const handleUpdateGoldPrice = () => {
    if (customGoldPrice) {
      setGoldPrice(Number(customGoldPrice));
    }
  };

  const currentPrice = customGoldPrice ? Number(customGoldPrice) : goldPrice;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Kalkulator Zakat Mal</h2>

      {/* Gold Price Section */}
      <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-100 dark:border-amber-800 transition-colors duration-300">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Globe size={18} className="text-amber-600"/> Harga Emas Terkini
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase mb-1">Harga Emas (Per Gram)</p>
            {loading ? (
              <p className="text-lg font-bold text-gray-400 dark:text-gray-500 animate-pulse">Memuat...</p>
            ) : currentPrice > 0 ? (
              <div>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(currentPrice)}</p>
                {!customGoldPrice && goldPrice && goldPrice < 500000 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ Estimasi</p>
                )}
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-400 dark:text-gray-500">—</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase">Update Harga Manual (Rp)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={customGoldPrice}
                onChange={(e) => setCustomGoldPrice(e.target.value)}
                placeholder={currentPrice > 0 ? fmt(currentPrice) : "Masukkan harga emas..."}
                className="flex-1 p-2.5 border border-amber-200 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-amber-900/20 dark:text-white text-sm"
              />
              <button
                onClick={handleUpdateGoldPrice}
                disabled={!customGoldPrice}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Update
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase mb-1">Nisab (85 gr)</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(nisab)}</p>
            <button
              onClick={() => {
                setLoading(true);
                fetchGoldPrice().then(price => {
                  setGoldPrice(price);
                  setCustomGoldPrice('');
                  setLoading(false);
                });
              }}
              disabled={loading}
              className="text-xs mt-2 px-2 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-300 rounded disabled:opacity-50 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Assets Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Saldo Kas</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {fmt(summary.walletBalances.filter(w => w.type !== 'credit_card').reduce((a, w) => a + w.currentBalance, 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Nilai Investasi</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {fmt(investments.reduce((a, c) => a + (Number(c.currentValue) || 0), 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Total Aset Cair</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {fmt(totalLiquidAssets)}
          </p>
        </div>
      </div>

      {/* Nisab Status */}
      <div className={`p-6 rounded-xl border transition-colors duration-300 ${
        isNisabReached
          ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
      }`}>
        <div className="flex items-start gap-4">
          {isNisabReached ? (
            <CheckCircle className="text-green-600 dark:text-green-400 mt-1 shrink-0" size={24} />
          ) : (
            <AlertTriangle className="text-red-600 dark:text-red-400 mt-1 shrink-0" size={24} />
          )}
          <div>
            <h3 className={`font-bold text-lg mb-2 ${
              isNisabReached
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {isNisabReached ? '✓ Sudah Mencapai Nisab' : '✗ Belum Mencapai Nisab'}
            </h3>
            <div className={`text-sm ${
              isNisabReached
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {isNisabReached ? (
                <>
                  <p>Total aset Anda: <span className="font-bold">{fmt(totalLiquidAssets)}</span></p>
                  <p>Telah melampaui nisab: <span className="font-bold">{fmt(nisab)}</span></p>
                  <p className="mt-2">Selisih: <span className="font-bold">{fmt(totalLiquidAssets - nisab)}</span></p>
                </>
              ) : (
                <>
                  <p>Total aset Anda: <span className="font-bold">{fmt(totalLiquidAssets)}</span></p>
                  <p>Nisab yang dibutuhkan: <span className="font-bold">{fmt(nisab)}</span></p>
                  <p className="mt-2">Masih kurang: <span className="font-bold">{fmt(nisab - totalLiquidAssets)}</span></p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zakat Calculation */}
      {isNisabReached && (
        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 p-8 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors duration-300">
          <h3 className="font-bold text-2xl text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-2">
            <Heart size={24} className="text-red-500"/> Zakat Mal yang Perlu Dibayarkan
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">2,5% dari total aset cair dan investasi</p>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-emerald-200 dark:border-emerald-700 mb-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Jumlah Zakat Mal</p>
              <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(zakatAmount)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ({totalLiquidAssets.toLocaleString('id-ID')} × 2,5%)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Metode Pembayaran</p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Langsung ke yang berhak menerima zakat</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Melalui lembaga zakat terpercaya</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Disimpan dengan niat zakat</span>
                </li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Catatan Penting</p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">ℹ</span>
                  <span>Zakat baru wajib jika mencapai nisab selama 1 tahun penuh</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">ℹ</span>
                  <span>Aset utang tidak dikurangi dari perhitungan zakat</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {!isNisabReached && (
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Zakat mal baru wajib dibayarkan setelah total aset mencapai nisab (setara dengan 85 gram emas) selama minimal 1 tahun qamariyah.
          </p>
        </div>
      )}
    </div>
  );
};

const CategoryView = ({ categories, userId, appId, fmt }) => {
  const [editingId, setEditingId] = useState(null);
  const [editBudget, setEditBudget] = useState('');
  const [newCatForm, setNewCatForm] = useState({ type: 'expense', name: '', budget: '' });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  
  const handleSaveBudget = async (catId, budget) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'categories', catId), { budget: Number(budget) || 0 });
      setEditingId(null);
    } catch(err) { console.error(err); }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatForm.name.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'categories'), {
        name: newCatForm.name.trim(),
        type: newCatForm.type,
        budget: Number(newCatForm.budget) || 0
      });
      setNewCatForm({ type: 'expense', name: '', budget: '' });
      setIsAddingCategory(false);
    } catch(err) { console.error(err); }
  };

  const handleDeleteCategory = async (catId) => {
    if (confirm('Hapus kategori ini?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'categories', catId));
      } catch(err) { console.error(err); }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Kategori & Budget</h2>
        <button onClick={() => setIsAddingCategory(!isAddingCategory)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">{isAddingCategory ? <X size={18}/> : <Plus size={18}/>} <span>{isAddingCategory ? 'Batal' : 'Tambah'}</span></button>
      </div>

      {isAddingCategory && (
        <form onSubmit={handleAddCategory} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tipe</label>
              <select value={newCatForm.type} onChange={e => setNewCatForm({...newCatForm, type: e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Kategori</label>
              <input required type="text" value={newCatForm.name} onChange={e => setNewCatForm({...newCatForm, name: e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Hobi & Rekreasi"/>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{newCatForm.type === 'expense' ? 'Budget (Rp)' : 'Target (Rp)'}</label>
              <input type="number" value={newCatForm.budget} onChange={e => setNewCatForm({...newCatForm, budget: e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
            </div>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 shadow-sm transition-colors h-[46px]"><Save size={18}/> Tambah</button>
          </div>
        </form>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><ArrowDownRight size={18} className="text-red-500"/> Kategori Pengeluaran</h3>
          <div className="space-y-3">
            {categories.raw.filter(c => c.type === 'expense').length === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">Belum ada kategori</div>
            ) : categories.raw.filter(c => c.type === 'expense').map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-700 group hover:shadow-sm transition-all">
                <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                {editingId === cat.id ? (
                  <div className="flex gap-2">
                    <input type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} className="w-24 p-1 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
                    <button onClick={() => handleSaveBudget(cat.id, editBudget)} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 font-bold">Simpan</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500">Batal</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className={`font-bold ${cat.budget > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>{cat.budget > 0 ? fmt(cat.budget) : '-'}</span>
                    <button onClick={() => { setEditingId(cat.id); setEditBudget(cat.budget); }} className="text-blue-500 hover:text-blue-700 dark:text-blue-400"><Edit2 size={14}/></button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><Trash2 size={14}/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><ArrowUpRight size={18} className="text-green-500"/> Kategori Pemasukan</h3>
          <div className="space-y-3">
            {categories.raw.filter(c => c.type === 'income').length === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">Belum ada kategori</div>
            ) : categories.raw.filter(c => c.type === 'income').map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-700 group hover:shadow-sm transition-all">
                <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Untuk referensi</span>
                  <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SalaryAllocatorView = ({ categories, wallets, userId, appId, fmt }) => {
  const [salary, setSalary] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [savedTemplates, setSavedTemplates] = useState([]);

  // Load state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`salaryState_${userId}`);
    if (savedState) {
      try {
        const { salary: s, selectedWallet: w, allocations: a } = JSON.parse(savedState);
        setSalary(s || '');
        setSelectedWallet(w || '');
        setAllocations(a || []);
      } catch (e) {
        console.error('Error loading state:', e);
      }
    }

    // Load saved templates
    const templates = localStorage.getItem(`salaryTemplates_${userId}`);
    if (templates) {
      try {
        setSavedTemplates(JSON.parse(templates));
      } catch (e) {
        console.error('Error loading templates:', e);
      }
    }
  }, [userId]);

  // Auto-save state to localStorage whenever it changes
  useEffect(() => {
    if (userId) {
      const state = { salary, selectedWallet, allocations };
      localStorage.setItem(`salaryState_${userId}`, JSON.stringify(state));
    }
  }, [salary, selectedWallet, allocations, userId]);

  // Save allocations helper
  const saveAllocations = (data) => {
    setAllocations(data);
  };

  const handleAddAllocation = () => {
    if (!salary || !selectedWallet) {
      alert('Masukkan gaji dan pilih rekening terlebih dahulu');
      return;
    }
    const newAlloc = {
      id: Date.now(),
      category: '',
      amount: '',
      percentage: 0,
      wallet: selectedWallet
    };
    saveAllocations([...allocations, newAlloc]);
  };

  const handleUpdateAllocation = (id, field, value) => {
    const updated = allocations.map(a => {
      if (a.id === id) {
        const newA = { ...a };
        
        if (field === 'amount') {
          newA.amount = value;
          // Auto calculate percentage if amount changes and salary is set
          if (salary && value !== '') {
            newA.percentage = ((parseFloat(value) || 0) / parseFloat(salary)) * 100;
          } else {
            newA.percentage = 0;
          }
        } else if (field === 'percentage') {
          newA.percentage = parseFloat(value) || 0;
          // Auto calculate amount if percentage changes and salary is set
          if (salary) {
            newA.amount = ((parseFloat(value) || 0) / 100 * parseFloat(salary)).toString();
          } else {
            newA.amount = '';
          }
        } else {
          // For other fields like category, wallet
          newA[field] = value;
        }
        
        return newA;
      }
      return a;
    });
    saveAllocations(updated);
  };

  const handleDeleteAllocation = (id) => {
    saveAllocations(allocations.filter(a => a.id !== id));
  };

  const handleReset = () => {
    if (confirm('Reset semua alokasi? Data akan dihapus.')) {
      setSalary('');
      setSelectedWallet('');
      setAllocations([]);
    }
  };

  const handleSaveTemplate = () => {
    if (!salary || allocations.length === 0) {
      alert('Masukkan gaji dan minimal 1 alokasi terlebih dahulu');
      return;
    }
    const name = prompt('Nama template (contoh: Gaji Bulanan Januari):');
    if (!name) return;
    
    const template = {
      id: Date.now(),
      name,
      salary,
      selectedWallet,
      allocations,
      createdAt: new Date().toISOString()
    };

    const updated = [...savedTemplates, template];
    setSavedTemplates(updated);
    localStorage.setItem(`salaryTemplates_${userId}`, JSON.stringify(updated));
    alert(`Template "${name}" berhasil disimpan!`);
  };

  const handleLoadTemplate = (template) => {
    if (confirm(`Load template "${template.name}"?`)) {
      setSalary(template.salary);
      setSelectedWallet(template.selectedWallet);
      setAllocations(template.allocations.map(a => ({ ...a, id: Date.now() + Math.random() })));
    }
  };

  const handleDeleteTemplate = (id) => {
    if (confirm('Hapus template ini?')) {
      const updated = savedTemplates.filter(t => t.id !== id);
      setSavedTemplates(updated);
      localStorage.setItem(`salaryTemplates_${userId}`, JSON.stringify(updated));
    }
  };

  const handleApplyToBudget = async () => {
    if (allocations.length === 0) {
      alert('Tidak ada alokasi untuk diaplikasikan ke budget');
      return;
    }

    if (!confirm('Aplikasikan alokasi ini sebagai budget limit untuk kategori terkait?')) {
      return;
    }

    try {
      let successCount = 0;
      for (const alloc of allocations) {
        if (alloc.category && alloc.amount) {
          // Find category in categories.raw
          const category = categories.raw.find(c => c.name === alloc.category && c.type === 'expense');
          if (category) {
            const catRef = doc(db, 'artifacts', appId, 'users', userId, 'categories', category.id);
            await updateDoc(catRef, {
              budget: parseFloat(alloc.amount) || 0
            });
            successCount++;
          }
        }
      }

      alert(`Budget berhasil diaplikasikan ke ${successCount} kategori!`);
    } catch (error) {
      console.error('Error applying budget:', error);
      alert('Gagal mengaplikasikan budget: ' + error.message);
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const remaining = (parseFloat(salary) || 0) - totalAllocated;
  const remainingPercent = salary ? (remaining / parseFloat(salary)) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <DollarSign size={28} className="text-emerald-600 dark:text-emerald-400"/>
          Kalkulator Pengalokasian Gaji
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={handleApplyToBudget}
            disabled={allocations.length === 0}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors"
          >
            <Target size={16}/> Apply ke Budget
          </button>
          <button 
            onClick={handleSaveTemplate} 
            disabled={!salary || allocations.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors"
          >
            <Save size={16}/> Simpan Template
          </button>
          <button 
            onClick={handleReset}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors"
          >
            <RefreshCw size={16}/> Reset
          </button>
        </div>
      </div>

      {/* Saved Templates */}
      {savedTemplates.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <Briefcase size={18} className="text-purple-500"/>
            Template Tersimpan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedTemplates.map(template => (
              <div key={template.id} className="p-3 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{template.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{fmt(template.salary)}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{template.allocations.length} alokasi</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
                <button 
                  onClick={() => handleLoadTemplate(template)}
                  className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 rounded-lg transition-colors font-medium"
                >
                  Load Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salary Input */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">Input Data Gaji</h3>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle size={14}/> Auto-save aktif
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Total Gaji (Rp)</label>
            <input 
              type="number" 
              value={salary} 
              onChange={(e) => setSalary(e.target.value)} 
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white text-lg font-bold"
              placeholder="Masukkan total gaji"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Rekening Default</label>
            <select 
              value={selectedWallet} 
              onChange={(e) => setSelectedWallet(e.target.value)} 
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800"
            >
              <option value="">Pilih Rekening...</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
            </select>
          </div>
        </div>

        {salary && (
          <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
              Total Gaji: <span className="font-bold text-lg">{fmt(salary)}</span>
            </p>
          </div>
        )}
      </div>

      {/* Allocations Summary */}
      {salary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">TOTAL DIALOKASIKAN</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalAllocated)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{((totalAllocated / parseFloat(salary)) * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">SISA GAJI</p>
            <h3 className={`text-2xl font-bold ${remaining >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              {fmt(remaining)}
            </h3>
            <p className={`text-xs mt-1 ${remaining >= 0 ? 'text-blue-500 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
              {remaining >= 0 ? `${remainingPercent.toFixed(1)}% tersedia` : `Kurang ${fmt(Math.abs(remaining))}`}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">ALOKASI ITEM</p>
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{allocations.length}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">kategori teralokasi</p>
          </div>
        </div>
      )}

      {/* Allocations Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500"/>
              Daftar Alokasi
            </h3>
            <button 
              onClick={handleAddAllocation} 
              disabled={!salary || !selectedWallet}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors"
            >
              <Plus size={16}/> Tambah Alokasi
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            💡 Tip: Input bisa dilakukan dengan nominal atau persentase. Sistem akan otomatis menghitung yang lainnya.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <tr>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Kategori</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Rekening</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Nominal</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Persentase</th>
                <th className="p-4 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 dark:text-gray-500">
                    Belum ada alokasi
                  </td>
                </tr>
              ) : (
                allocations.map(alloc => (
                  <tr key={alloc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <select 
                        value={alloc.category} 
                        onChange={(e) => handleUpdateAllocation(alloc.id, 'category', e.target.value)}
                        className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm dark:[&>option]:bg-gray-700"
                      >
                        <option value="">Pilih Kategori...</option>
                        {categories.expense.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <select 
                        value={alloc.wallet} 
                        onChange={(e) => handleUpdateAllocation(alloc.id, 'wallet', e.target.value)}
                        className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm dark:[&>option]:bg-gray-700"
                      >
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <input 
                        type="number" 
                        value={alloc.amount || ''} 
                        onChange={(e) => handleUpdateAllocation(alloc.id, 'amount', e.target.value)}
                        className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold"
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={((alloc.percentage || 0)).toFixed(1)} 
                          onChange={(e) => handleUpdateAllocation(alloc.id, 'percentage', e.target.value)}
                          className="w-20 p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold"
                          step="0.1"
                          min="0"
                          max="100"
                        />
                        <span className="text-gray-500 dark:text-gray-400">%</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDeleteAllocation(alloc.id)}
                        className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {allocations.length > 0 && remaining < 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={20}/>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Perhatian: Total alokasi melebihi gaji!</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">Kurang {fmt(Math.abs(remaining))} untuk seimbangkan alokasi.</p>
            </div>
          </div>
        )}
      </div>

      {/* Allocation Breakdown Chart */}
      {allocations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col transition-colors duration-300">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">Distribusi Alokasi</h3>
            {allocations.filter(a => a.amount).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RePieChart>
                  <Pie 
                    data={allocations.filter(a => a.amount).map(a => ({
                      name: a.category || 'Tanpa Kategori',
                      value: parseFloat(a.amount) || 0
                    }))} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={90} 
                    paddingAngle={2} 
                    dataKey="value"
                  >
                    {allocations.map((_, i) => (
                      <Cell key={i} fill={['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'][i % 7]}/>
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v) => fmt(v)} />
                  <Legend verticalAlign="bottom" />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                Masukkan nominal alokasi untuk melihat diagram
              </div>
            )}
          </div>

          {/* Tips & Suggestions */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Target size={18} className="text-amber-500"/>
              Saran Pengalokasian
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                <p className="font-semibold text-amber-900 dark:text-amber-300">Kebutuhan Primer (60%)</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{fmt((parseFloat(salary) || 0) * 0.6)}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <p className="font-semibold text-blue-900 dark:text-blue-300">Kebutuhan Sekunder (30%)</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{fmt((parseFloat(salary) || 0) * 0.3)}</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                <p className="font-semibold text-purple-900 dark:text-purple-300">Investasi & Tabungan (10%)</p>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">{fmt((parseFloat(salary) || 0) * 0.1)}</p>
              </div>
            </div>
            <div className="space-y-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
              <p>💡 <strong>Panduan:</strong> Alokasikan gaji sesuai prioritas keluarga Anda.</p>
              <p>🎯 <strong>Apply ke Budget:</strong> Klik tombol "Apply ke Budget" untuk otomatis mengatur limit budget kategori sesuai alokasi Anda.</p>
              <p>💾 <strong>Simpan Template:</strong> Simpan konfigurasi alokasi untuk digunakan di bulan berikutnya.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 6. MAIN APP (Defined Last) ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [categories, setCategories] = useState({ expense: [], income: [], raw: [] });
  const [investTypes, setInvestTypes] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);

  // Auth Handlers
  const handleLogin = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert(e.message); } };
  const handleLogout = async () => await signOut(auth);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsub();
  }, []);

  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Data Sync
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const unsubTrans = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'transactions'), orderBy('date', 'desc')), 
      (s) => setTransactions(s.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        date: parseDate(d.data().date) // Use helper function here
      }))));

    const unsubInv = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'investments')), 
      (s) => setInvestments(s.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() 
      }))));

    const unsubCats = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'categories')), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0) {
        const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'categories');
        [...DEFAULT_EXPENSE_CATEGORIES.map(n => ({name: n, type: 'expense'})), ...DEFAULT_INCOME_CATEGORIES.map(n => ({name: n, type: 'income'}))]
          .forEach(c => addDoc(batchRef, { ...c, budget: 0 }));
      } else {
        setCategories({
          expense: data.filter(c => c.type === 'expense').map(c => c.name).sort(),
          income: data.filter(c => c.type === 'income').map(c => c.name).sort(),
          raw: data
        });
      }
    });

    const unsubInvTypes = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'investment_types')), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0) {
        const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'investment_types');
        DEFAULT_INVESTMENT_TYPES.forEach(t => addDoc(batchRef, t));
      } else {
        setInvestTypes(data);
      }
    });

    const unsubWallets = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'wallets')), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      if (data.length === 0) {
        const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'wallets');
        DEFAULT_WALLETS.forEach(w => addDoc(batchRef, w));
      } else {
        setWallets(data);
      }
    });

    const unsubSubs = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'subscriptions')), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubscriptions(data);
    });

    return () => { unsubTrans(); unsubInv(); unsubCats(); unsubInvTypes(); unsubWallets(); unsubSubs(); };
  }, [user]);

  // --- AUTOMATION: Generate Subscription Transactions ---
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

        // Check if subscription has started
        const startDate = sub.startDate ? sub.startDate.toDate() : null;
        if (startDate && startDate > targetDate) continue;

        if (today >= targetDate) {
          const alreadyExists = transactions.some(t => 
            t.subscriptionId === sub.id && 
            t.date && 
            t.date.getMonth() === currentMonth && 
            t.date.getFullYear() === currentYear
          );

          if (!alreadyExists) {
            console.log("Generating auto transaction for:", sub.name);
            try {
              await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), {
                type: 'expense',
                amount: sub.cost,
                category: 'Langganan', 
                walletId: sub.walletId,
                subscriptionId: sub.id, 
                note: `Tagihan Otomatis: ${sub.name}`,
                date: targetDate,
                createdAt: serverTimestamp()
              });
            } catch (err) {
              console.error("Auto-gen failed", err);
            }
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

    return { income: inc, expense: exp, balance: liquidAssets, ccDebt: creditCardDebt, investment: inv, netWorth: netWorth, walletBalances };
  }, [transactions, investments, wallets]);

  const fmt = (val) => privacyMode ? 'Rp ••••••' : formatCurrency(val);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-emerald-600 font-bold animate-pulse dark:bg-gray-900 dark:text-emerald-400">Memuat Dompet Keluarga...</div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 flex flex-col md:flex-row transition-colors duration-300">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 h-screen sticky top-0 transition-colors duration-300">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8 text-emerald-700 dark:text-emerald-400">
            <Wallet className="w-8 h-8" />
            <h1 className="font-bold text-xl">Dompet Keluarga</h1>
          </div>
          <nav className="space-y-2">
            <NavBtn id="dashboard" active={activeTab} set={setActiveTab} icon={<PieChart size={20}/>} label="Dashboard" />
            <NavBtn id="transactions" active={activeTab} set={setActiveTab} icon={<ArrowUpRight size={20}/>} label="Transaksi" />
            <NavBtn id="subscriptions" active={activeTab} set={setActiveTab} icon={<Repeat size={20}/>} label="Langganan" />
            <NavBtn id="wallets" active={activeTab} set={setActiveTab} icon={<CreditCard size={20}/>} label="Rekening & CC" />
            <NavBtn id="investments" active={activeTab} set={setActiveTab} icon={<TrendingUp size={20}/>} label="Investasi & Goal" />
            <NavBtn id="salary-allocator" active={activeTab} set={setActiveTab} icon={<DollarSign size={20}/>} label="Alokasi Gaji" />
            <NavBtn id="zakat" active={activeTab} set={setActiveTab} icon={<Heart size={20}/>} label="Kalkulator Zakat" />
            <NavBtn id="categories" active={activeTab} set={setActiveTab} icon={<Settings size={20}/>} label="Kategori" />
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
      <main className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full pb-8 flex flex-col min-h-screen">
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
                  <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X size={24} />
                  </button>
                </div>
                
                {/* User Info */}
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

                {/* Navigation */}
                <nav className="space-y-2">
                  <NavBtn id="dashboard" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<PieChart size={20}/>} label="Dashboard" />
                  <NavBtn id="transactions" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<ArrowUpRight size={20}/>} label="Transaksi" />
                  <NavBtn id="subscriptions" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<Repeat size={20}/>} label="Langganan" />
                  <NavBtn id="wallets" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<CreditCard size={20}/>} label="Rekening & CC" />
                  <NavBtn id="investments" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<TrendingUp size={20}/>} label="Investasi & Goal" />
                  <NavBtn id="salary-allocator" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<DollarSign size={20}/>} label="Alokasi Gaji" />
                  <NavBtn id="zakat" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<Heart size={20}/>} label="Kalkulator Zakat" />
                  <NavBtn id="categories" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<Settings size={20}/>} label="Kategori" />
                </nav>

                {/* Logout */}
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-3 rounded-lg transition-colors mt-6">
                  <LogOut size={16}/> Keluar
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && <DashboardView summary={summary} transactions={transactions} investments={investments} categories={categories} investTypes={investTypes} setActiveTab={setActiveTab} fmt={fmt} privacyMode={privacyMode} darkMode={darkMode}/>}
        {activeTab === 'transactions' && <TransactionView transactions={transactions} categories={categories} wallets={wallets} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'subscriptions' && <SubscriptionView subscriptions={subscriptions} wallets={wallets} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'wallets' && <WalletView wallets={summary.walletBalances} userId={user.uid} appId={appId} fmt={fmt} privacyMode={privacyMode}/>}
        {activeTab === 'investments' && <InvestmentView investments={investments} investTypes={investTypes} wallets={wallets} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'salary-allocator' && <SalaryAllocatorView categories={categories} wallets={summary.walletBalances} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'zakat' && <ZakatView summary={summary} investments={investments} fmt={fmt} />}
        {activeTab === 'categories' && <CategoryView categories={categories} userId={user.uid} appId={appId} fmt={fmt} />}

        {/* FOOTER */}
        <footer className="mt-auto pt-10 pb-4 text-center">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-600">
            <span>&copy; {new Date().getFullYear()} Dompet Keluarga dikembangkan oleh <span className="text-emerald-600 dark:text-emerald-500 font-medium">@fauzanalfi</span></span>
          </div>
        </footer>
      </main>

      {/* Floating Action Button (FAB) */}
      <button 
        onClick={() => setActiveTab('transactions')} 
        className="fixed bottom-6 right-6 w-16 h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center justify-center z-30 transition-all duration-300 hover:scale-110 active:scale-95"
        title="Tambah Transaksi"
      >
        <Plus size={28} strokeWidth={2.5} />
      </button>
    </div>
  );
}