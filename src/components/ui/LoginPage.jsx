import React from 'react';
import { Wallet, LogIn } from 'lucide-react';

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

export default LoginPage;
