import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, RefreshCw, Target, DollarSign, AlertTriangle, CheckCircle, CalendarDays, ArrowLeftRight, BarChart3 } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createEmptySalarySource = () => ({ id: createId(), source: '', amount: '' });
const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(year, (month || 1) - 1, 1));
};
const previousMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, (month || 1) - 2, 1);
  return toMonthKey(date);
};

const SalaryAllocatorView = ({ categories, wallets, transactions, userId, appId, fmt }) => {
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [salaries, setSalaries] = useState([createEmptySalarySource()]);
  const [expenseBudget, setExpenseBudget] = useState('');
  const [allocations, setAllocations] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const isHydratingRef = useRef(false);
  const saveTimerRef = useRef(null);

  const salaryDocRef = useMemo(
    () => doc(db, 'artifacts', appId, 'users', userId, 'monthly_controls', selectedMonth),
    [appId, userId, selectedMonth]
  );

  const salaryTotal = useMemo(
    () => salaries.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    [salaries]
  );

  const incomeFromTransactions = useMemo(
    () => (transactions || []).reduce((sum, tx) => {
      if (tx?.type !== 'income' || !tx?.date || toMonthKey(tx.date) !== selectedMonth) return sum;
      return sum + (Number(tx.amount) || 0);
    }, 0),
    [transactions, selectedMonth]
  );

  const totalIncome = salaryTotal + incomeFromTransactions;

  const monthlyExpenseTransactions = useMemo(
    () => (transactions || []).filter(tx => {
      if (!tx?.date || toMonthKey(tx.date) !== selectedMonth) return false;
      return tx.type === 'expense';
    }),
    [transactions, selectedMonth]
  );

  const monthlyInvestmentTransactions = useMemo(
    () => (transactions || []).filter(tx => {
      if (!tx?.date || toMonthKey(tx.date) !== selectedMonth) return false;
      return tx.type === 'investment';
    }),
    [transactions, selectedMonth]
  );

  const spendingByCategory = useMemo(() => {
    const map = new Map();
    for (const tx of monthlyExpenseTransactions) {
      const categoryName = tx.category || 'Tanpa Kategori';
      map.set(categoryName, (map.get(categoryName) || 0) + (Number(tx.amount) || 0));
    }
    return map;
  }, [monthlyExpenseTransactions]);

  const totalAllocated = useMemo(
    () => allocations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    [allocations]
  );

  const expenseBudgetValue = parseFloat(expenseBudget) || 0;

  const totalExpenseSpent = useMemo(
    () => monthlyExpenseTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [monthlyExpenseTransactions]
  );

  const totalInvestmentSpent = useMemo(
    () => monthlyInvestmentTransactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0),
    [monthlyInvestmentTransactions]
  );

  const totalSpent = totalExpenseSpent + totalInvestmentSpent;

  const remainingToAllocate = totalIncome - totalAllocated;
  const expenseBudgetRemaining = expenseBudgetValue - totalAllocated;
  const varianceAgainstAllocation = totalAllocated - totalExpenseSpent;
  const varianceAgainstExpenseBudget = expenseBudgetValue - totalExpenseSpent;

  useEffect(() => {
    if (!userId || !appId) return;
    let cancelled = false;

    const loadMonthControl = async () => {
      setIsMonthLoading(true);
      isHydratingRef.current = true;
      try {
        const snapshot = await getDoc(salaryDocRef);
        if (cancelled) return;

        if (!snapshot.exists()) {
          setSalaries([createEmptySalarySource()]);
          setExpenseBudget('');
          setSelectedWallet('');
          setAllocations([]);
          setLastSavedAt(null);
          return;
        }

        const data = snapshot.data();
        const loadedSalaries = Array.isArray(data.salarySources)
          ? data.salarySources.map(item => ({
              id: createId(),
              source: item.source || '',
              amount: String(item.amount || ''),
            }))
          : [createEmptySalarySource()];

        const loadedAllocations = Array.isArray(data.allocations)
          ? data.allocations.map(item => ({
              id: createId(),
              category: item.category || '',
              amount: String(item.amount || ''),
              wallet: item.wallet || data.selectedWallet || '',
            }))
          : [];

        setSalaries(loadedSalaries.length > 0 ? loadedSalaries : [createEmptySalarySource()]);
        setExpenseBudget(data.expenseBudget !== undefined && data.expenseBudget !== null ? String(data.expenseBudget) : '');
        setSelectedWallet(data.selectedWallet || '');
        setAllocations(loadedAllocations);
        setLastSavedAt(data.updatedAt?.toDate?.() || null);
      } catch (error) {
        console.error('Error loading monthly control:', error);
        alert(`Gagal memuat data bulan ${monthLabel(selectedMonth)}: ${error.message}`);
      } finally {
        if (!cancelled) {
          setIsMonthLoading(false);
          setTimeout(() => {
            isHydratingRef.current = false;
          }, 0);
        }
      }
    };

    loadMonthControl();

    return () => {
      cancelled = true;
    };
  }, [salaryDocRef, selectedMonth, userId, appId]);

  useEffect(() => {
    if (!userId || !appId || isMonthLoading || isHydratingRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        setIsSaving(true);
        const payload = {
          monthKey: selectedMonth,
          selectedWallet,
          expenseBudget: parseFloat(expenseBudget) || 0,
          salarySources: salaries
            .map(item => ({ source: item.source || '', amount: parseFloat(item.amount) || 0 }))
            .filter(item => item.source || item.amount > 0),
          allocations: allocations
            .map(item => ({
              category: item.category || '',
              amount: parseFloat(item.amount) || 0,
              wallet: item.wallet || selectedWallet || '',
            }))
            .filter(item => item.category || item.amount > 0),
          updatedAt: serverTimestamp(),
        };

        await setDoc(salaryDocRef, payload, { merge: true });
        setLastSavedAt(new Date());
      } catch (error) {
        console.error('Error saving monthly control:', error);
      } finally {
        setIsSaving(false);
      }
    }, 600);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [salaryDocRef, selectedMonth, selectedWallet, salaryTotal, expenseBudget, salaries, allocations, appId, userId, isMonthLoading]);

  const handleAddSalarySource = () => setSalaries(prev => [...prev, createEmptySalarySource()]);

  const handleUpdateSalarySource = (id, field, value) => {
    setSalaries(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleDeleteSalarySource = (id) => {
    if (salaries.length === 1) {
      alert('Minimal harus ada 1 sumber pendapatan manual.');
      return;
    }
    setSalaries(prev => prev.filter(item => item.id !== id));
  };

  const handleAddAllocation = () => {
    if (!selectedWallet) {
      alert('Pilih rekening default terlebih dahulu.');
      return;
    }
    setAllocations(prev => [...prev, { id: createId(), category: '', amount: '', wallet: selectedWallet }]);
  };

  const handleUpdateAllocation = (id, field, value) => {
    setAllocations(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'percentage') {
        const pct = parseFloat(value) || 0;
        const amount = totalIncome > 0 ? (pct / 100) * totalIncome : 0;
        return { ...item, amount: String(Math.max(amount, 0)) };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleDeleteAllocation = (id) => {
    setAllocations(prev => prev.filter(item => item.id !== id));
  };

  const handleResetCurrentMonth = () => {
    if (!confirm(`Reset semua input untuk ${monthLabel(selectedMonth)}?`)) return;
    setSalaries([createEmptySalarySource()]);
    setExpenseBudget('');
    setSelectedWallet('');
    setAllocations([]);
  };

  const handleCarryOverFromPreviousMonth = async () => {
    const fromMonth = previousMonthKey(selectedMonth);
    if (!confirm(`Bawa sisa alokasi dari ${monthLabel(fromMonth)} ke ${monthLabel(selectedMonth)}?`)) return;

    try {
      const previousRef = doc(db, 'artifacts', appId, 'users', userId, 'monthly_controls', fromMonth);
      const previousSnapshot = await getDoc(previousRef);
      if (!previousSnapshot.exists()) {
        alert(`Tidak ada data alokasi pada ${monthLabel(fromMonth)}.`);
        return;
      }

      const previousData = previousSnapshot.data();
      const previousAllocations = Array.isArray(previousData.allocations) ? previousData.allocations : [];
      if (previousAllocations.length === 0) {
        alert(`Bulan ${monthLabel(fromMonth)} tidak memiliki alokasi.`);
        return;
      }

      const prevSpentByCategory = (transactions || []).reduce((map, tx) => {
        if (!tx?.date || toMonthKey(tx.date) !== fromMonth) return map;
        if (tx.type !== 'expense') return map;
        const key = tx.category || 'Tanpa Kategori';
        map.set(key, (map.get(key) || 0) + (Number(tx.amount) || 0));
        return map;
      }, new Map());

      const carryItems = previousAllocations
        .map(item => {
          const amount = Number(item.amount) || 0;
          const spent = prevSpentByCategory.get(item.category || 'Tanpa Kategori') || 0;
          const left = Math.max(amount - spent, 0);
          return {
            category: item.category || '',
            amount: left,
            wallet: item.wallet || previousData.selectedWallet || selectedWallet || '',
          };
        })
        .filter(item => item.category && item.amount > 0);

      if (carryItems.length === 0) {
        alert(`Tidak ada sisa alokasi yang bisa dibawa dari ${monthLabel(fromMonth)}.`);
        return;
      }

      setAllocations(prev => {
        const merged = [...prev.map(item => ({ ...item }))];
        for (const carry of carryItems) {
          const index = merged.findIndex(item => item.category === carry.category);
          if (index >= 0) {
            const currentAmount = parseFloat(merged[index].amount) || 0;
            merged[index].amount = String(currentAmount + carry.amount);
          } else {
            merged.push({
              id: createId(),
              category: carry.category,
              amount: String(carry.amount),
              wallet: carry.wallet,
            });
          }
        }
        return merged;
      });

      if (!selectedWallet && previousData.selectedWallet) setSelectedWallet(previousData.selectedWallet);
      if (!expenseBudget && previousData.expenseBudget) setExpenseBudget(String(previousData.expenseBudget));

      alert(`Sisa alokasi dari ${monthLabel(fromMonth)} berhasil ditambahkan.`);
    } catch (error) {
      console.error('Error applying manual carry-over:', error);
      alert(`Gagal carry-over manual: ${error.message}`);
    }
  };

  const statusForAllocation = (allocationAmount, spentAmount) => {
    if (allocationAmount <= 0) return { label: 'Belum Diatur', className: 'text-gray-500 dark:text-gray-400' };
    if (spentAmount > allocationAmount) return { label: 'Melebihi', className: 'text-red-600 dark:text-red-400' };
    if (spentAmount === allocationAmount) return { label: 'Pas', className: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Aman', className: 'text-emerald-600 dark:text-emerald-400' };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <DollarSign size={28} className="text-emerald-600 dark:text-emerald-400"/>
          Kontrol Pengeluaran Bulanan
        </h2>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
            <CalendarDays size={16} className="text-gray-500 dark:text-gray-400"/>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent outline-none text-gray-700 dark:text-gray-200"
            />
          </div>
          <button onClick={handleCarryOverFromPreviousMonth} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors">
            <ArrowLeftRight size={16}/> Carry-over Manual
          </button>
          <button onClick={handleResetCurrentMonth} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors">
            <RefreshCw size={16}/> Reset
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">Periode aktif</p>
          <p className="font-bold text-gray-800 dark:text-gray-100">{monthLabel(selectedMonth)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 dark:text-gray-400">Status simpan</p>
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {isMonthLoading ? 'Memuat data bulan...' : isSaving ? 'Menyimpan perubahan...' : 'Tersimpan otomatis'}
          </p>
          {lastSavedAt && <p className="text-[11px] text-gray-400 dark:text-gray-500">{lastSavedAt.toLocaleTimeString('id-ID')}</p>}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">Input Pendapatan Bulan {monthLabel(selectedMonth)}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle size={14}/> Auto-save aktif
            </span>
            <button onClick={handleAddSalarySource} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex gap-1 items-center transition-colors">
              <Plus size={14}/> Tambah Sumber
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {salaries.map((sal, index) => (
            <div key={sal.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Sumber Pendapatan #{index + 1}</label>
                <input type="text" value={sal.source} onChange={(e) => handleUpdateSalarySource(sal.id, 'source', e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-800 dark:text-white text-sm" placeholder="Contoh: Gaji Utama, Bonus"/>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Nominal (Rp)</label>
                <input type="number" value={sal.amount} onChange={(e) => handleUpdateSalarySource(sal.id, 'amount', e.target.value)} className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold" placeholder="0" min="0"/>
              </div>
              <div className="flex items-end">
                <button onClick={() => handleDeleteSalarySource(sal.id)} disabled={salaries.length === 1} className="w-full p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium">
                  <Trash2 size={16} className="inline mr-1"/> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Rekening Default</label>
            <select value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)} className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
              <option value="">Pilih Rekening...</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Alokasi Expenses Bulanan (di luar Investment)</label>
            <input
              type="number"
              value={expenseBudget}
              onChange={(e) => setExpenseBudget(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white font-semibold"
              placeholder="0"
              min="0"
            />
          </div>
          <div className="flex items-end">
            <div className="w-full p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mb-1">BUDGET EXPENSES</p>
              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{fmt(expenseBudgetValue)}</p>
              <p className={`text-xs mt-1 ${varianceAgainstExpenseBudget >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                {varianceAgainstExpenseBudget >= 0
                  ? `Sisa budget expenses ${fmt(varianceAgainstExpenseBudget)}`
                  : `Expenses melebihi budget ${fmt(Math.abs(varianceAgainstExpenseBudget))}`}
              </p>
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">INPUT MANUAL</p>
              <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(salaryTotal)}</p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+ Realisasi transaksi income: {fmt(incomeFromTransactions)}</p>
            </div>
          </div>
        </div>
      </div>

      {(totalIncome > 0 || allocations.length > 0 || totalSpent > 0 || expenseBudgetValue > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">TOTAL PENDAPATAN</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalIncome)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">manual + transaksi income</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">BUDGET EXPENSES</p>
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{fmt(expenseBudgetValue)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{totalIncome > 0 ? ((expenseBudgetValue / totalIncome) * 100).toFixed(1) : 0}% dari pendapatan</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">EXPENSES TERPAKAI</p>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmt(totalExpenseSpent)}</h3>
            <p className={`text-xs mt-1 ${varianceAgainstExpenseBudget >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {varianceAgainstExpenseBudget >= 0 ? `Sisa budget ${fmt(varianceAgainstExpenseBudget)}` : `Melebihi budget ${fmt(Math.abs(varianceAgainstExpenseBudget))}`}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">INVESTMENT TERPAKAI</p>
            <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{fmt(totalInvestmentSpent)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">di luar budget expenses</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500"/> Breakdown Expenses per Kategori
            </h3>
            <button onClick={handleAddAllocation} disabled={!selectedWallet} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors">
              <Plus size={16}/> Tambah Alokasi
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Realisasi kategori dihitung dari transaksi bertipe expense (termasuk subscription otomatis). Investment dihitung terpisah.</p>
          <div className="mt-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 text-xs">
            <p className="font-semibold text-blue-700 dark:text-blue-300">Sisa budget untuk dibagi ke kategori: <span className={expenseBudgetRemaining >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{fmt(expenseBudgetRemaining)}</span></p>
            <p className="text-blue-600 dark:text-blue-400 mt-1">Total alokasi kategori: {fmt(totalAllocated)} dari budget expenses {fmt(expenseBudgetValue)}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <tr>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Kategori</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Rekening</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Alokasi</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Persentase</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Realisasi</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Sisa</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                <th className="p-4 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {allocations.length === 0 ? (
                <tr><td colSpan="8" className="p-8 text-center text-gray-400 dark:text-gray-500">Belum ada alokasi</td></tr>
              ) : allocations.map(alloc => (
                <tr key={alloc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="p-4">
                    <select value={alloc.category} onChange={(e) => handleUpdateAllocation(alloc.id, 'category', e.target.value)} className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm">
                      <option value="">Pilih Kategori...</option>
                      {(categories.expense || []).map(cat => {
                        const alreadyUsed = allocations.some(item => item.id !== alloc.id && item.category === cat);
                        return <option key={cat} value={cat} disabled={alreadyUsed}>{cat}{alreadyUsed ? ' (sudah dipakai)' : ''}</option>;
                      })}
                    </select>
                  </td>
                  <td className="p-4">
                    <select value={alloc.wallet} onChange={(e) => handleUpdateAllocation(alloc.id, 'wallet', e.target.value)} className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm">
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </td>
                  <td className="p-4">
                    <input type="number" value={alloc.amount || ''} onChange={(e) => handleUpdateAllocation(alloc.id, 'amount', e.target.value)} className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold" placeholder="0" min="0"/>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <input type="number" value={expenseBudgetValue > 0 ? (((parseFloat(alloc.amount) || 0) / expenseBudgetValue) * 100).toFixed(1) : '0.0'} onChange={(e) => handleUpdateAllocation(alloc.id, 'percentage', e.target.value)} className="w-20 p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold" step="0.1" min="0" max="100"/>
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-amber-600 dark:text-amber-400">{fmt(spendingByCategory.get(alloc.category || 'Tanpa Kategori') || 0)}</td>
                  <td className={`p-4 font-semibold ${((parseFloat(alloc.amount) || 0) - (spendingByCategory.get(alloc.category || 'Tanpa Kategori') || 0)) >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                    {fmt((parseFloat(alloc.amount) || 0) - (spendingByCategory.get(alloc.category || 'Tanpa Kategori') || 0))}
                  </td>
                  <td className="p-4">
                    {(() => {
                      const planned = parseFloat(alloc.amount) || 0;
                      const spent = spendingByCategory.get(alloc.category || 'Tanpa Kategori') || 0;
                      const status = statusForAllocation(planned, spent);
                      return <span className={`text-xs font-bold ${status.className}`}>{status.label}</span>;
                    })()}
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDeleteAllocation(alloc.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors">
                      <Trash2 size={16}/>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {allocations.length > 0 && varianceAgainstAllocation < 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={20}/>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Perhatian: Realisasi expenses kategori sudah melebihi total alokasi kategori.</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">Selisih over-budget {fmt(Math.abs(varianceAgainstAllocation))}.</p>
            </div>
          </div>
        )}
      </div>

      {allocations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">Distribusi Alokasi</h3>
            {allocations.filter(a => a.amount).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RePieChart>
                  <Pie data={allocations.filter(a => a.amount).map(a => ({ name: a.category || 'Tanpa Kategori', value: parseFloat(a.amount) || 0 }))} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {allocations.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <ReTooltip formatter={(v) => fmt(v)} />
                  <Legend verticalAlign="bottom" />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">Masukkan nominal alokasi untuk melihat diagram</div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Target size={18} className="text-amber-500"/> Ringkasan Kontrol Bulan Ini
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                <p className="font-semibold text-amber-900 dark:text-amber-300">Expenses Terkategori</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{monthlyExpenseTransactions.length} transaksi expense tercatat</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <p className="font-semibold text-blue-900 dark:text-blue-300">Sisa Alokasi Kategori</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{fmt(Math.max(varianceAgainstAllocation, 0))}</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                <p className="font-semibold text-purple-900 dark:text-purple-300">Investment Bulan Ini</p>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">{fmt(totalInvestmentSpent)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryAllocatorView;
