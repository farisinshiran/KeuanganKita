import React from 'react';
import { Wallet, LogIn } from 'lucide-react';
import { useI18n } from '../../i18n/I18nContext';

const LoginPage = ({ onLogin }) => {
  const { t, lang, setLang } = useI18n();

  return (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">
      <div className="flex items-center justify-end gap-2 mb-4">
        <button onClick={() => setLang('id')} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${lang === 'id' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>{t('common.indonesian')}</button>
        <button onClick={() => setLang('en')} className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${lang === 'en' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600'}`}>{t('common.english')}</button>
      </div>
      <div className="bg-emerald-100 dark:bg-emerald-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"><Wallet className="w-8 h-8 text-emerald-600 dark:text-emerald-400" /></div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{t('common.appName')}</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">{t('auth.subtitle')}</p>
      <button onClick={onLogin} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center gap-3 transition-colors">
        <LogIn size={20} className="text-emerald-600 dark:text-emerald-400"/> {t('auth.loginGoogle')}
      </button>
    </div>
  </div>
  );
};

export default LoginPage;
