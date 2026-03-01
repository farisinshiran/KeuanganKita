import React from 'react';
import {
  Wallet, PieChart, ArrowUpRight, Repeat, CreditCard, TrendingUp,
  GraduationCap, BarChart3, ScanLine, DollarSign, Heart, Settings,
  User, Eye, EyeOff, Moon, Sun, LogOut, X, Menu, RefreshCw, Bot
} from 'lucide-react';
import { NavBtn } from '../ui/index';

export const NAV_ITEMS = [
  { id: 'dashboard',               icon: <PieChart size={20}/>,      label: 'Dashboard' },
  { id: 'transactions',            icon: <ArrowUpRight size={20}/>,   label: 'Transaksi' },
  { id: 'subscriptions',           icon: <Repeat size={20}/>,         label: 'Langganan' },
  { id: 'wallets',                 icon: <CreditCard size={20}/>,     label: 'Rekening & CC' },
  { id: 'investments',             icon: <TrendingUp size={20}/>,     label: 'Investasi & Goal' },
  { id: 'education-fund',          icon: <GraduationCap size={20}/>,  label: 'Dana Pendidikan' },
  { id: 'income-diversification',  icon: <BarChart3 size={20}/>,      label: 'Diversifikasi Pendapatan' },
  { id: 'salary-slip-archive',     icon: <ScanLine size={20}/>,       label: 'Arsip Slip Gaji' },
  { id: 'salary-allocator',        icon: <DollarSign size={20}/>,     label: 'Kontrol Bulanan' },
  { id: 'zakat',                   icon: <Heart size={20}/>,          label: 'Kalkulator Zakat' },
  { id: 'categories',              icon: <Settings size={20}/>,       label: 'Kategori' },
];

const Sidebar = ({ activeTab, setActiveTab, user, privacyMode, setPrivacyMode, darkMode, setDarkMode, onLogout }) => (
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
      <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors">
        <LogOut size={16}/> Keluar
      </button>
    </div>
  </aside>
);

export const MobileMenu = ({ activeTab, setActiveTab, user, onLogout, onClose }) => (
  <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose}>
    <div className="fixed right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <div className="p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-lg text-gray-800 dark:text-white">Menu</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
          {NAV_ITEMS.map(item => (
            <NavBtn
              key={item.id}
              id={item.id}
              active={activeTab}
              set={(id) => { setActiveTab(id); onClose(); }}
              icon={item.icon}
              label={item.label}
            />
          ))}
        </nav>

        {/* Logout */}
        <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-3 rounded-lg transition-colors mt-6">
          <LogOut size={16}/> Keluar
        </button>
      </div>
    </div>
  </div>
);

export const AppFooter = ({ APP_VERSION }) => (
  <footer className="mt-auto pt-10 pb-4 text-center space-y-2">
    <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-600">
      <span>&copy; {new Date().getFullYear()} Dompet Keluarga dikembangkan oleh <span className="text-emerald-600 dark:text-emerald-500 font-medium">@fauzanalfi</span></span>
    </div>
    <div className="flex items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-600">
      <span className="flex items-center gap-1">
        <Bot size={12} />
        Parser v{APP_VERSION}
      </span>
      <span>•</span>
      <span className="flex items-center gap-1">
        <RefreshCw size={12} />
        Pull to Refresh
      </span>
    </div>
  </footer>
);

export default Sidebar;
