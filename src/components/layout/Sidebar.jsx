import React from 'react';
import { RefreshCw } from 'lucide-react';
import Icon from '../ui/Icon';
import { useI18n } from '../../i18n/I18nContext';

// â”€â”€â”€ Navigation structure (2.0) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NAV_GROUPS = [
  {
    id: 'daily',
    labelKey: 'nav.group.daily',
    items: [
      { id: 'transactions',   icon: 'receipt_long',           labelKey: 'nav.transactions' },
      { id: 'wallets',        icon: 'account_balance_wallet', labelKey: 'nav.wallets' },
      { id: 'subscriptions',  icon: 'repeat',                 labelKey: 'nav.subscriptions' },
    ],
  },
  {
    id: 'planning',
    labelKey: 'nav.group.planning',
    items: [
      { id: 'budget',         icon: 'payments',        labelKey: 'nav.budget' },
      { id: 'investments',    icon: 'trending_up',     labelKey: 'nav.investments' },
      { id: 'savings-goals',  icon: 'savings',         labelKey: 'nav.savingsGoals' },
      { id: 'education-fund', icon: 'school',          labelKey: 'nav.educationFund' },
      { id: 'income-sources', icon: 'bar_chart',       labelKey: 'nav.incomeSources' },
    ],
  },
  {
    id: 'tools',
    labelKey: 'nav.group.tools',
    items: [
      { id: 'zakat',        icon: 'volunteer_activism', labelKey: 'nav.zakat' },
      { id: 'salary-slips', icon: 'description',        labelKey: 'nav.salarySlips' },
      { id: 'categories',   icon: 'category',           labelKey: 'nav.categories' },
    ],
  },
  {
    id: 'family',
    labelKey: 'nav.group.family',
    items: [
      { id: 'kids', icon: 'family_restroom', labelKey: 'nav.family' },
    ],
  },
];

// Flat list for external consumers (e.g. App.jsx key matching)
export const NAV_ITEMS = [
  { id: 'dashboard' },
  ...NAV_GROUPS.flatMap(g => g.items),
  { id: 'ai-advisor' },
];

// â”€â”€â”€ Shared NavItem â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NavItem = ({ id, iconName, label, active, onSelect }) => {
  const isActive = active === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm
        ${isActive
          ? 'bg-green-100/50 text-green-900 dark:bg-green-900/20 dark:text-green-300 font-semibold'
          : 'text-slate-600 dark:text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/10 hover:text-green-700 dark:hover:text-green-400'
        }`}
    >
      <Icon
        name={iconName}
        size={20}
        fill={isActive ? 1 : 0}
        weight={isActive ? 600 : 400}
        className="shrink-0"
      />
      <span className="truncate">{label}</span>
    </button>
  );
};

// â”€â”€â”€ NavGroup (desktop, with label) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const NavGroup = ({ group, activeTab, onSelect, t }) => {
  const hasActive = group.items.some(item => item.id === activeTab);
  return (
    <div className="mt-1">
      <p className={`px-4 pb-0.5 pt-3 text-[10px] font-bold uppercase tracking-widest
        ${hasActive ? 'text-green-700 dark:text-green-500' : 'text-slate-400 dark:text-slate-500'}`}>
        {t(group.labelKey)}
      </p>
      <div className="space-y-0.5">
        {group.items.map(item => (
          <NavItem
            key={item.id}
            id={item.id}
            iconName={item.icon}
            label={t(item.labelKey)}
            active={activeTab}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
};

// â”€â”€â”€ Desktop Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const Sidebar = ({ activeTab, setActiveTab, user, privacyMode, setPrivacyMode, darkMode, setDarkMode, onLogout }) => {
  const { t, lang, setLang } = useI18n();

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-slate-50 dark:bg-gray-900 border-r border-green-100 dark:border-gray-700/50 z-50">

      {/* â”€â”€ Branding â”€â”€ */}
      <div className="px-6 pt-5 pb-3 shrink-0">
        <h1 className="text-xl font-extrabold text-green-800 dark:text-green-400 tracking-tight">
          {t('common.appName')}
        </h1>
        <p className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500 font-bold">
          Family Legacy
        </p>
      </div>

      {/* â”€â”€ Navigation â”€â”€ */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
        <NavItem
          id="dashboard"
          iconName="space_dashboard"
          label={t('nav.dashboard')}
          active={activeTab}
          onSelect={setActiveTab}
        />
        {NAV_GROUPS.map(group => (
          <NavGroup
            key={group.id}
            group={group}
            activeTab={activeTab}
            onSelect={setActiveTab}
            t={t}
          />
        ))}
      </nav>

      {/* â”€â”€ Quick Add CTA â”€â”€ */}
      <div className="px-4 pb-3 shrink-0">
        <button
          onClick={() => setActiveTab('quick-add')}
          className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          <Icon name="add_circle" size={20} fill={1} />
          {t('common.quickAdd')}
        </button>
      </div>

      {/* â”€â”€ AI Advisor standalone â”€â”€ */}
      <div className="px-2 pb-1 border-t border-green-100/50 dark:border-gray-700/50 pt-2 shrink-0">
        <NavItem
          id="ai-advisor"
          iconName="psychology"
          label={t('nav.aiAdvisor')}
          active={activeTab}
          onSelect={setActiveTab}
        />
      </div>

      {/* â”€â”€ User profile card â”€â”€ */}
      <div className="px-4 py-3 border-t border-green-100/50 dark:border-gray-700/50 shrink-0">
        <div className="flex gap-1.5 mb-3">
          <button
            onClick={() => setLang('id')}
            className={`flex-1 text-[11px] py-1.5 rounded-lg font-semibold transition-colors
              ${lang === 'id' ? 'bg-primary text-on-primary' : 'bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
          >ID</button>
          <button
            onClick={() => setLang('en')}
            className={`flex-1 text-[11px] py-1.5 rounded-lg font-semibold transition-colors
              ${lang === 'en' ? 'bg-primary text-on-primary' : 'bg-white dark:bg-gray-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'}`}
          >EN</button>
        </div>
        <div className="flex items-center gap-2.5">
          {user.photoURL ? (
            <img src={user.photoURL} alt="User" className="w-9 h-9 rounded-full border-2 border-primary/20 shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Icon name="person" size={20} />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-on-surface dark:text-gray-200 truncate leading-tight">
              {user.displayName || t('sidebar.user')}
            </p>
            <p className="text-[11px] text-slate-400 truncate leading-tight">{user.email}</p>
          </div>
          <div className="flex gap-0.5">
            <button
              onClick={() => setPrivacyMode(!privacyMode)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              title={privacyMode ? t('sidebar.showBalance') : t('sidebar.hideBalance')}
            >
              <Icon name={privacyMode ? 'visibility_off' : 'visibility'} size={18} />
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
              title={t('sidebar.switchTheme')}
            >
              <Icon name={darkMode ? 'light_mode' : 'dark_mode'} size={18} />
            </button>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title={t('sidebar.logout')}
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

// â”€â”€â”€ Mobile Slide-in Menu â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MobileNavItem = ({ id, iconName, label, active, onSelect }) => {
  const isActive = active === id;
  return (
    <button
      onClick={() => onSelect(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm
        ${isActive
          ? 'bg-green-100/50 text-green-900 dark:bg-green-900/20 dark:text-green-300 font-semibold'
          : 'text-slate-600 dark:text-slate-400 hover:bg-green-50 dark:hover:bg-green-900/10 hover:text-green-700'
        }`}
    >
      <Icon name={iconName} size={20} fill={isActive ? 1 : 0} weight={isActive ? 600 : 400} className="shrink-0" />
      <span className="truncate">{label}</span>
    </button>
  );
};

export const MobileMenu = ({ activeTab, setActiveTab, user, onLogout, onClose }) => {
  const { t, lang, setLang } = useI18n();
  const handleItemClick = (id) => { setActiveTab(id); onClose(); };

  return (
    <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={onClose}>
      <div
        className="fixed right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-gray-100 dark:border-gray-700 shrink-0">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-extrabold text-lg text-green-800 dark:text-green-400">{t('common.appName')}</h2>
              <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Family Legacy</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
              <Icon name="close" size={22} />
            </button>
          </div>
          {user && (
            <div className="flex items-center gap-2.5 mt-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-9 h-9 rounded-full border-2 border-primary/20" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Icon name="person" size={20} />
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{user.displayName || t('sidebar.user')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <div className="flex gap-1.5 mb-3 px-1">
            <button
              onClick={() => setLang('id')}
              className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-colors
                ${lang === 'id' ? 'bg-primary text-on-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
            >ID</button>
            <button
              onClick={() => setLang('en')}
              className={`flex-1 text-xs py-2 rounded-lg font-semibold transition-colors
                ${lang === 'en' ? 'bg-primary text-on-primary' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
            >EN</button>
          </div>
          <MobileNavItem id="dashboard" iconName="space_dashboard" label={t('nav.dashboard')} active={activeTab} onSelect={handleItemClick} />
          {NAV_GROUPS.map(group => (
            <div key={group.id} className="mt-2">
              <p className="px-3 pb-0.5 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {t(group.labelKey)}
              </p>
              {group.items.map(item => (
                <MobileNavItem
                  key={item.id}
                  id={item.id}
                  iconName={item.icon}
                  label={t(item.labelKey)}
                  active={activeTab}
                  onSelect={handleItemClick}
                />
              ))}
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <MobileNavItem id="ai-advisor" iconName="psychology" label={t('nav.aiAdvisor')} active={activeTab} onSelect={handleItemClick} />
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 shrink-0">
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2.5 rounded-lg transition-colors"
          >
            <Icon name="logout" size={18} /> {t('sidebar.logout')}
          </button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€â”€ App Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export const AppFooter = ({ APP_VERSION }) => {
  const { t } = useI18n();
  return (
    <footer className="mt-auto pt-10 pb-4 text-center space-y-2">
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-600">
        <span>
          &copy; {new Date().getFullYear()} {t('common.appName')} â€” oleh{' '}
          <span className="text-green-600 dark:text-green-500 font-medium">@fauzanalfi</span>
        </span>
      </div>
      <div className="flex items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-600">
        <span className="flex items-center gap-1">
          <Icon name="smart_toy" size={12} />
          {t('sidebar.parser')} v{APP_VERSION}
        </span>
        <span>â€¢</span>
        <span className="flex items-center gap-1">
          <RefreshCw size={12} />
          {t('sidebar.pullRefresh')}
        </span>
      </div>
    </footer>
  );
};

export default Sidebar;
