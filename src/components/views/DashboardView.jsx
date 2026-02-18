import React, { useMemo } from 'react';
import {
  Wallet, TrendingUp, PieChart, AlertTriangle, Target,
  CreditCard, Landmark, Banknote, Smartphone, Briefcase
} from 'lucide-react';
import {
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { Card } from '../ui/index';
import { COLORS } from '../../constants/currencies';

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

export default DashboardView;
