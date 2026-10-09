import React from 'react';

export const NavBtn = ({ id, active, set, icon, label }) => (
  <button onClick={()=>set(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active===id ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
    {icon}<span>{label}</span>
  </button>
);

export const MobileNavBtn = ({ id, active, set, icon, label }) => (
  <button onClick={()=>set(id)} className={`flex flex-col items-center gap-1 ${active===id ? 'text-pink-400 dark:text-pink-300' : 'text-gray-400 dark:text-gray-500'}`}>
    {icon}<span className="text-[10px] font-medium">{label}</span>
  </button>
);

export const Card = ({ title, amount, icon, color, fmt }) => (
  <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-l-4 ${color} flex justify-between items-start transition-colors duration-300`}>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 font-medium">{title}</p>
      <h3 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">{fmt(amount)}</h3>
    </div>
    <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">{icon}</div>
  </div>
);
