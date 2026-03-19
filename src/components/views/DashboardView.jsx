import React, { useMemo } from 'react';
import {
  ResponsiveContainer, Tooltip as ReTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  AreaChart, Area,
} from 'recharts';
import Icon from '../ui/Icon.jsx';
import { COLORS } from '../../constants/currencies';
import { calculateHealthScore, getScoreStatus } from '../../utils/healthScore';

const DashboardView = ({ summary, transactions, investments, categories, investTypes, setActiveTab, fmt, privacyMode, darkMode }) => {

  // â”€â”€ Data logic (preserved from v1) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

  const healthScore = useMemo(
    () => calculateHealthScore(summary, transactions, categories),
    [summary, transactions, categories],
  );

  const momData = useMemo(() => {
    const now  = new Date();
    const thisM = now.getMonth();
    const thisY = now.getFullYear();
    const prevDate = new Date(thisY, thisM - 1, 1);
    const prevM = prevDate.getMonth();
    const prevY = prevDate.getFullYear();

    const thisSpending = {};
    const prevSpending = {};
    transactions.forEach(t => {
      if (t.type !== 'expense' || !t.date) return;
      const m = t.date.getMonth();
      const y = t.date.getFullYear();
      if (m === thisM && y === thisY) thisSpending[t.category] = (thisSpending[t.category] || 0) + Number(t.amount);
      else if (m === prevM && y === prevY) prevSpending[t.category] = (prevSpending[t.category] || 0) + Number(t.amount);
    });

    const allCats = new Set([...Object.keys(thisSpending), ...Object.keys(prevSpending)]);
    const rows = Array.from(allCats)
      .map(cat => ({ cat, this: thisSpending[cat] || 0, prev: prevSpending[cat] || 0 }))
      .sort((a, b) => b.this - a.this)
      .slice(0, 6);

    const thisIncome  = transactions.filter(t => t.type === 'income'  && t.date?.getMonth() === thisM && t.date?.getFullYear() === thisY).reduce((a, t) => a + Number(t.amount), 0);
    const prevIncome  = transactions.filter(t => t.type === 'income'  && t.date?.getMonth() === prevM && t.date?.getFullYear() === prevY).reduce((a, t) => a + Number(t.amount), 0);
    const thisExpense = Object.values(thisSpending).reduce((a, v) => a + v, 0);
    const prevExpense = Object.values(prevSpending).reduce((a, v) => a + v, 0);

    const pct = (a, b) => b === 0 ? null : (((a - b) / b) * 100).toFixed(1);
    const bulanIni  = now.toLocaleString('id-ID', { month: 'long' });
    const bulanLalu = prevDate.toLocaleString('id-ID', { month: 'long' });

    return { rows, thisIncome, prevIncome, thisExpense, prevExpense, pct, bulanIni, bulanLalu };
  }, [transactions]);

  const recentTransactions = useMemo(
    () => [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8),
    [transactions],
  );

  // â”€â”€ Derived display values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const hs = healthScore;
  const st = getScoreStatus(hs.score);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference * (1 - hs.score / 100);

  const WALLET_ICONS = { bank: 'account_balance', ewallet: 'account_balance_wallet', cash: 'payments', credit_card: 'credit_card', paylater: 'credit_score', rdn: 'verified' };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* â”€â”€ 4 Stat Cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Aset Bersih', value: summary.netWorth, icon: 'account_balance', color: 'text-primary' },
          { label: 'Total Kas', value: summary.balance, icon: 'wallet', color: 'text-secondary' },
          { label: 'Pengeluaran Bln Ini', value: momData.thisExpense, icon: 'trending_down', color: 'text-error' },
          { label: 'Total Investasi', value: summary.investment, icon: 'trending_up', color: 'text-tertiary' },
        ].map(s => (
          <div key={s.label} className="bg-surface-container-lowest p-5 rounded-2xl border-b-2 border-primary/20 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Icon name={s.icon} size={20} className={s.color} />
              <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide leading-tight">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-on-surface truncate">{privacyMode ? 'â€¢â€¢â€¢â€¢' : fmt(s.value)}</p>
          </div>
        ))}
      </div>

      {/* â”€â”€ Budget Alert Banner â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {budgetProgress.some(b => b.percent >= 90) && (
        <div className="bg-error-container/40 border border-error/20 p-4 rounded-2xl flex gap-3 items-start">
          <Icon name="warning" size={20} className="text-error mt-0.5 shrink-0" fill={1} />
          <div>
            <h3 className="font-semibold text-error text-sm">Peringatan Budget!</h3>
            <div className="text-xs text-on-error-container mt-1 space-y-0.5">
              {budgetProgress.filter(b => b.percent >= 90).map(b => (
                <p key={b.id}><b>{b.name}</b>: {b.percent.toFixed(0)}% ({fmt(b.spent)} / {fmt(b.budget)})</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Bento Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left column: Health Score + Active Wallets */}
        <div className="lg:col-span-4 space-y-4">

          {/* Health Score Card */}
          <div className="bg-primary text-on-primary p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 85% 15%, #fff 0%, transparent 55%)' }} />
            <h3 className="text-sm font-semibold opacity-80 mb-5 flex items-center gap-2 relative z-10">
              <Icon name="favorite" size={18} fill={1} /> Skor Kesehatan Keuangan
            </h3>
            <div className="flex items-center gap-4 relative z-10">
              <div className="relative w-28 h-28 flex-shrink-0">
                <svg width="112" height="112" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="54" fill="none" stroke="white" strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    transform="rotate(-90 60 60)"
                    style={{ transition: 'stroke-dashoffset 1s ease' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-extrabold leading-none">{hs.score}</span>
                  <span className="text-xs opacity-70">/ 100</span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate">{st.label}</p>
                <div className="mt-2 space-y-2">
                  {hs.breakdown.map(item => (
                    <div key={item.key}>
                      <div className="flex justify-between text-xs opacity-70 mb-0.5">
                        <span className="truncate mr-2">{item.label}</span>
                        <span className="shrink-0">{item.score}/{item.max}</span>
                      </div>
                      <div className="w-full bg-white/20 rounded-full h-1.5">
                        <div className="bg-white h-1.5 rounded-full transition-all duration-700" style={{ width: `${(item.score / item.max) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Active Wallets mini-list */}
          <div className="bg-surface-container-low p-5 rounded-2xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                <Icon name="account_balance_wallet" size={18} className="text-primary" /> Akun Aktif
              </h3>
              <button onClick={() => setActiveTab('wallets')} className="text-xs text-primary hover:underline font-medium">Kelola â†’</button>
            </div>
            <div className="space-y-2">
              {summary.walletBalances.length === 0 ? (
                <p className="text-xs text-on-surface-variant text-center py-4">Belum ada akun</p>
              ) : summary.walletBalances.slice(0, 6).map(w => {
                const isDebt = w.type === 'credit_card' || w.type === 'paylater';
                return (
                  <button key={w.id} onClick={() => setActiveTab('wallets')} className="w-full flex items-center justify-between p-2.5 rounded-xl bg-surface-container-lowest hover:ring-1 hover:ring-primary/30 transition-all">
                    <div className="flex items-center gap-2.5">
                      <Icon name={WALLET_ICONS[w.type] || 'wallet'} size={18} className={isDebt ? 'text-error' : 'text-primary'} />
                      <span className="text-sm font-medium text-on-surface truncate max-w-[100px]">{w.name}</span>
                    </div>
                    <span className={`text-sm font-bold shrink-0 ${isDebt ? 'text-error' : 'text-on-surface'}`}>
                      {privacyMode ? 'â€¢â€¢â€¢â€¢' : (isDebt ? `-${fmt(Math.abs(w.currentBalance))}` : fmt(w.currentBalance))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column: Charts + Budget */}
        <div className="lg:col-span-8 space-y-4">

          {/* 6-Month Bar Chart */}
          <div className="bg-surface-container-low p-6 rounded-2xl">
            <h3 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Icon name="bar_chart" size={18} className="text-primary" /> Tren Arus Kas (6 Bulan)
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trendData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8def8" />
                <XAxis dataKey="monthStr" tick={{ fontSize: 11, fill: '#49454f' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#49454f' }} tickFormatter={v => privacyMode ? 'â€¢' : `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
                <ReTooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" name="Pemasukan" fill="#0d631b" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Pengeluaran" fill="#ba1a1a" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Sub-grid: Asset Growth + Budget */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* Asset Growth */}
            <div className="bg-surface-container-low p-5 rounded-2xl">
              <h3 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                <Icon name="show_chart" size={18} className="text-tertiary" /> Tren Nilai Aset
              </h3>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={assetGrowthData} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="assetValueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7d5260" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#7d5260" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8def8" />
                  <XAxis dataKey="monthStr" tick={{ fontSize: 10, fill: '#49454f' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#49454f' }} tickFormatter={v => privacyMode ? 'â€¢' : `${(v / 1000000).toFixed(1)}jt`} tickLine={false} axisLine={false} />
                  <ReTooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="modal" name="Modal" stroke="#94a3b8" fill="none" strokeWidth={1.5} strokeDasharray="5 5" />
                  <Area type="monotone" dataKey="value" name="Nilai" stroke="#7d5260" fillOpacity={1} fill="url(#assetValueGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Budget Monitoring */}
            <div className="bg-surface-container-low p-5 rounded-2xl">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-on-surface flex items-center gap-2">
                  <Icon name="savings" size={18} className="text-secondary" /> Monitoring Budget
                </h3>
                <button onClick={() => setActiveTab('categories')} className="text-xs text-primary hover:underline font-medium">Atur</button>
              </div>
              <div className="space-y-3 overflow-y-auto max-h-40 pr-1 custom-scrollbar">
                {budgetProgress.length === 0 ? (
                  <p className="text-xs text-on-surface-variant text-center py-6">Belum ada budget diset</p>
                ) : budgetProgress.map(b => (
                  <div key={b.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-on-surface truncate max-w-[120px]">{b.name}</span>
                      <span className={`font-semibold ${b.percent >= 90 ? 'text-error' : b.percent >= 60 ? 'text-tertiary' : 'text-on-surface-variant'}`}>{b.percent.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-surface-container rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${b.percent >= 90 ? 'bg-error' : b.percent >= 60 ? 'bg-tertiary' : 'bg-primary'}`}
                        style={{ width: `${Math.min(b.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Recent Transactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-sm">
        <div className="flex justify-between items-center p-5 border-b border-outline-variant/20">
          <h3 className="font-semibold text-on-surface flex items-center gap-2">
            <Icon name="receipt_long" size={18} className="text-primary" /> Transaksi Terbaru
          </h3>
          <button onClick={() => setActiveTab('wallets')} className="text-xs text-primary hover:underline font-medium">Lihat Semua â†’</button>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant text-sm">Belum ada transaksi</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-surface-container-low">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Tanggal</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Jenis</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden sm:table-cell">Catatan</th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {recentTransactions.map((t, idx) => {
                  const isIncome = t.type === 'income';
                  const isTransfer = t.type === 'transfer';
                  return (
                    <tr key={t.id || idx} className="border-b border-outline-variant/10 hover:bg-surface-container-high/40 transition-colors">
                      <td className="py-3 px-4 text-sm text-on-surface-variant">
                        {t.date ? new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isIncome ? 'bg-secondary-container text-on-secondary-container' : isTransfer ? 'bg-surface-container text-on-surface-variant' : 'bg-error-container text-on-error-container'}`}>
                          {isTransfer ? 'Transfer' : (t.category || 'Lainnya')}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-on-surface hidden sm:table-cell">{t.note || '-'}</td>
                      <td className={`py-3 px-4 text-right font-bold text-sm ${isIncome ? 'text-secondary' : isTransfer ? 'text-on-surface-variant' : 'text-error'}`}>
                        {isIncome ? '+' : t.type === 'expense' ? '-' : ''}{privacyMode ? 'â€¢â€¢â€¢â€¢' : fmt(t.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* â”€â”€ Month-over-Month Comparison â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-surface-container-low p-6 rounded-2xl">
        <h3 className="font-semibold text-on-surface mb-1 flex items-center gap-2">
          <Icon name="compare_arrows" size={18} className="text-primary" /> Perbandingan Bulan ke Bulan
        </h3>
        <p className="text-xs text-on-surface-variant mb-4">{momData.bulanLalu} vs {momData.bulanIni}</p>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {[
            { label: 'Pemasukan', prev: momData.prevIncome, curr: momData.thisIncome, up: 'good' },
            { label: 'Pengeluaran', prev: momData.prevExpense, curr: momData.thisExpense, up: 'bad' },
          ].map(row => {
            const diff = momData.pct(row.curr, row.prev);
            const up = row.curr >= row.prev;
            const good = (up && row.up === 'good') || (!up && row.up === 'bad');
            return (
              <div key={row.label} className="bg-surface-container-lowest p-4 rounded-xl">
                <div className="text-xs text-on-surface-variant mb-1">{row.label}</div>
                <div className={`font-bold text-lg ${row.up === 'good' ? 'text-secondary' : 'text-error'}`}>
                  {privacyMode ? 'â€¢â€¢â€¢â€¢' : fmt(row.curr)}
                </div>
                {diff !== null && (
                  <div className={`text-xs mt-1 ${good ? 'text-secondary' : 'text-error'}`}>
                    {up ? 'â–²' : 'â–¼'} {Math.abs(diff)}% vs {momData.bulanLalu}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {momData.rows.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={momData.rows} margin={{ top: 5, right: 20, bottom: 5, left: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8def8" />
              <XAxis dataKey="cat" tick={{ fontSize: 11, fill: '#49454f' }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#49454f' }} tickFormatter={v => privacyMode ? 'â€¢' : `${(v / 1000).toFixed(0)}k`} tickLine={false} axisLine={false} />
              <ReTooltip formatter={v => fmt(v)} contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="prev" name={momData.bulanLalu} fill="#6750a4" radius={[4, 4, 0, 0]} />
              <Bar dataKey="this" name={momData.bulanIni} fill="#0d631b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-32 flex items-center justify-center text-on-surface-variant text-sm">Belum ada data perbandingan</div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
