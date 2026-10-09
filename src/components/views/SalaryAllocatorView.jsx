import React, { useState, useMemo, useEffect, useRef } from 'react';
import Icon from '../ui/Icon';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import BudgetWizard from '../modals/BudgetWizard';
import { db } from '../../config/firebase';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';
import { useI18n } from '../../i18n/I18nContext';
import { formatDate } from '../../utils/formatters';

const COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'];

const createId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const createEmptySalarySource = () => ({ id: createId(), source: '', amount: '' });
const createEmptyExpenseAllocation = (wallet = '') => ({ id: createId(), category: '', amount: '', wallet });
const createEmptyInvestmentAllocation = (wallet = '') => ({ id: createId(), label: '', amount: '', wallet });
const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};
const INVESTMENT_ALLOCATION_CATEGORY = 'Investasi';
const toMonthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (monthKey, lang = 'id') => {
  const [year, month] = monthKey.split('-').map(Number);
  const locale = lang === 'en' ? 'en-US' : 'id-ID';
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(new Date(year, (month || 1) - 1, 1));
};
const previousMonthKey = (monthKey) => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, (month || 1) - 2, 1);
  return toMonthKey(date);
};

const SalaryAllocatorView = ({ categories, wallets, transactions, userId, appId, fmt }) => {
  const { t, lang } = useI18n();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [salaries, setSalaries] = useState([createEmptySalarySource()]);
  const [expenseBudget, setExpenseBudget] = useState('');
  const [expenseAllocations, setExpenseAllocations] = useState([]);
  const [investmentAllocations, setInvestmentAllocations] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
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

  const monthlyAllTransactions = useMemo(
    () => (transactions || [])
      .filter(tx => tx?.date && toMonthKey(tx.date) === selectedMonth)
      .sort((a, b) => (b.date?.getTime?.() ?? 0) - (a.date?.getTime?.() ?? 0)),
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

  const walletMap = useMemo(
    () => new Map((wallets || []).map(w => [w.id, w])),
    [wallets]
  );

  const totalAllocatedExpense = useMemo(
    () => expenseAllocations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    [expenseAllocations]
  );

  const totalAllocatedInvestment = useMemo(
    () => investmentAllocations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0),
    [investmentAllocations]
  );

  const totalAllocated = totalAllocatedExpense + totalAllocatedInvestment;

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
  const expenseBudgetRemaining = expenseBudgetValue - totalAllocatedExpense;
  const varianceAgainstExpenseAllocation = totalAllocatedExpense - totalExpenseSpent;
  const varianceAgainstInvestmentAllocation = totalAllocatedInvestment - totalInvestmentSpent;
  const varianceAgainstExpenseBudget = expenseBudgetValue - totalExpenseSpent;

  const hasAnyAllocation = expenseAllocations.length > 0 || investmentAllocations.length > 0;

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
          setExpenseAllocations([]);
          setInvestmentAllocations([]);
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

        const legacyAllocations = Array.isArray(data.allocations)
          ? data.allocations.map(item => ({
              id: createId(),
              category: item.category || '',
              amount: String(item.amount || ''),
              label: item.label || '',
              wallet: item.wallet || data.selectedWallet || '',
            }))
          : [];

        const loadedExpenseAllocations = Array.isArray(data.expenseAllocations)
          ? data.expenseAllocations.map(item => ({
              id: createId(),
              category: item.category || '',
              amount: String(item.amount || ''),
              wallet: item.wallet || data.selectedWallet || '',
            }))
          : legacyAllocations.filter(item => item.category && item.category !== INVESTMENT_ALLOCATION_CATEGORY);

        const loadedInvestmentAllocations = Array.isArray(data.investmentAllocations)
          ? data.investmentAllocations.map(item => ({
              id: createId(),
              label: item.label || '',
              amount: String(item.amount || ''),
              wallet: item.wallet || data.selectedWallet || '',
            }))
          : legacyAllocations
              .filter(item => item.category === INVESTMENT_ALLOCATION_CATEGORY)
              .map(item => ({
                id: createId(),
                label: item.label || INVESTMENT_ALLOCATION_CATEGORY,
                amount: String(item.amount || ''),
                wallet: item.wallet || data.selectedWallet || '',
              }));

        setSalaries(loadedSalaries.length > 0 ? loadedSalaries : [createEmptySalarySource()]);
        setExpenseBudget(data.expenseBudget !== undefined && data.expenseBudget !== null ? String(data.expenseBudget) : '');
        setSelectedWallet(data.selectedWallet || '');
        setExpenseAllocations(loadedExpenseAllocations);
        setInvestmentAllocations(loadedInvestmentAllocations);
        setLastSavedAt(data.updatedAt?.toDate?.() || null);
      } catch (error) {
        console.error('Error loading monthly control:', error);
        alert(`Gagal memuat data bulan ${monthLabel(selectedMonth, lang)}: ${error.message}`);
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
  }, [salaryDocRef, selectedMonth, userId, appId, lang]);

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
          expenseAllocations: expenseAllocations
            .map(item => ({
              category: item.category || '',
              amount: parseFloat(item.amount) || 0,
              wallet: item.wallet || selectedWallet || '',
            }))
            .filter(item => item.category || item.amount > 0),
          investmentAllocations: investmentAllocations
            .map(item => ({
              label: item.label || '',
              amount: parseFloat(item.amount) || 0,
              wallet: item.wallet || selectedWallet || '',
            }))
            .filter(item => item.label || item.amount > 0),
          allocations: [
            ...expenseAllocations
              .map(item => ({
                category: item.category || '',
                amount: parseFloat(item.amount) || 0,
                wallet: item.wallet || selectedWallet || '',
              }))
              .filter(item => item.category || item.amount > 0),
            ...investmentAllocations
              .map(item => ({
                category: INVESTMENT_ALLOCATION_CATEGORY,
                label: item.label || INVESTMENT_ALLOCATION_CATEGORY,
                amount: parseFloat(item.amount) || 0,
                wallet: item.wallet || selectedWallet || '',
              }))
              .filter(item => item.label || item.amount > 0),
          ],
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
  }, [salaryDocRef, selectedMonth, selectedWallet, salaryTotal, expenseBudget, salaries, expenseAllocations, investmentAllocations, appId, userId, isMonthLoading]);

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

  const handleAddExpenseAllocation = () => {
    if (!selectedWallet) {
      alert('Pilih rekening default terlebih dahulu.');
      return;
    }
    setExpenseAllocations(prev => [...prev, createEmptyExpenseAllocation(selectedWallet)]);
  };

  const handleUpdateExpenseAllocation = (id, field, value) => {
    setExpenseAllocations(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'percentage') {
        const pct = parseFloat(value) || 0;
        const amount = expenseBudgetValue > 0 ? (pct / 100) * expenseBudgetValue : 0;
        return { ...item, amount: String(Math.max(amount, 0)) };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleDeleteExpenseAllocation = (id) => {
    setExpenseAllocations(prev => prev.filter(item => item.id !== id));
  };

  const handleAddInvestmentAllocation = () => {
    if (!selectedWallet) {
      alert('Pilih rekening default terlebih dahulu.');
      return;
    }
    setInvestmentAllocations(prev => [...prev, createEmptyInvestmentAllocation(selectedWallet)]);
  };

  const handleUpdateInvestmentAllocation = (id, field, value) => {
    setInvestmentAllocations(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (field === 'percentage') {
        const pct = parseFloat(value) || 0;
        const amount = totalIncome > 0 ? (pct / 100) * totalIncome : 0;
        return { ...item, amount: String(Math.max(amount, 0)) };
      }
      return { ...item, [field]: value };
    }));
  };

  const handleDeleteInvestmentAllocation = (id) => {
    setInvestmentAllocations(prev => prev.filter(item => item.id !== id));
  };

  const handleResetCurrentMonth = () => {
    if (!confirm(`Reset semua input untuk ${monthLabel(selectedMonth, lang)}?`)) return;
    setSalaries([createEmptySalarySource()]);
    setExpenseBudget('');
    setSelectedWallet('');
    setExpenseAllocations([]);
    setInvestmentAllocations([]);
  };

  const handleCarryOverFromPreviousMonth = async () => {
    const fromMonth = previousMonthKey(selectedMonth);
    if (!confirm(`Bawa sisa alokasi dari ${monthLabel(fromMonth, lang)} ke ${monthLabel(selectedMonth, lang)}?`)) return;

    try {
      const previousRef = doc(db, 'artifacts', appId, 'users', userId, 'monthly_controls', fromMonth);
      const previousSnapshot = await getDoc(previousRef);
      if (!previousSnapshot.exists()) {
        alert(`Tidak ada data alokasi pada ${monthLabel(fromMonth, lang)}.`);
        return;
      }

      const previousData = previousSnapshot.data();
      const legacyPreviousAllocations = Array.isArray(previousData.allocations) ? previousData.allocations : [];
      const previousExpenseAllocations = Array.isArray(previousData.expenseAllocations)
        ? previousData.expenseAllocations
        : legacyPreviousAllocations.filter(item => item.category && item.category !== INVESTMENT_ALLOCATION_CATEGORY);
      const previousInvestmentAllocations = Array.isArray(previousData.investmentAllocations)
        ? previousData.investmentAllocations
        : legacyPreviousAllocations.filter(item => item.category === INVESTMENT_ALLOCATION_CATEGORY);

      if (previousExpenseAllocations.length === 0 && previousInvestmentAllocations.length === 0) {
        alert(`Bulan ${monthLabel(fromMonth, lang)} tidak memiliki alokasi.`);
        return;
      }

      const prevSpentByCategory = (transactions || []).reduce((map, tx) => {
        if (!tx?.date || toMonthKey(tx.date) !== fromMonth) return map;
        if (tx.type !== 'expense') return map;
        const key = tx.category || 'Tanpa Kategori';
        map.set(key, (map.get(key) || 0) + (Number(tx.amount) || 0));
        return map;
      }, new Map());

      const previousInvestmentSpent = (transactions || []).reduce((sum, tx) => {
        if (!tx?.date || toMonthKey(tx.date) !== fromMonth) return sum;
        if (tx.type !== 'investment') return sum;
        return sum + (Number(tx.amount) || 0);
      }, 0);

      const carryExpenseItems = previousExpenseAllocations
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

      const previousInvestmentAllocated = previousInvestmentAllocations.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      const carryInvestmentAmount = Math.max(previousInvestmentAllocated - previousInvestmentSpent, 0);

      if (carryExpenseItems.length === 0 && carryInvestmentAmount <= 0) {
        alert(`Tidak ada sisa alokasi yang bisa dibawa dari ${monthLabel(fromMonth, lang)}.`);
        return;
      }

      if (carryExpenseItems.length > 0) {
        setExpenseAllocations(prev => {
          const merged = [...prev.map(item => ({ ...item }))];
          for (const carry of carryExpenseItems) {
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
      }

      if (carryInvestmentAmount > 0) {
        setInvestmentAllocations(prev => {
        const merged = [...prev.map(item => ({ ...item }))];
        const carryPrefix = lang === 'en' ? 'Carry-over' : 'Bawa dari';
        const carryLabel = `${carryPrefix} ${monthLabel(fromMonth, lang)}`;
        const index = merged.findIndex(item => item.label === carryLabel);
        if (index >= 0) {
          const currentAmount = parseFloat(merged[index].amount) || 0;
          merged[index].amount = String(currentAmount + carryInvestmentAmount);
        } else {
          merged.push({
            id: createId(),
            label: carryLabel,
            amount: String(carryInvestmentAmount),
            wallet: previousData.selectedWallet || selectedWallet || '',
          });
        }
        return merged;
      });
      }

      if (!selectedWallet && previousData.selectedWallet) setSelectedWallet(previousData.selectedWallet);
      if (!expenseBudget && previousData.expenseBudget) setExpenseBudget(String(previousData.expenseBudget));

      alert(`Sisa alokasi dari ${monthLabel(fromMonth, lang)} berhasil ditambahkan.`);
    } catch (error) {
      console.error('Error applying manual carry-over:', error);
      alert(`Gagal carry-over manual: ${error.message}`);
    }
  };

  const statusForAllocation = (allocationAmount, spentAmount) => {
    if (allocationAmount <= 0) return { label: 'Belum Diatur', className: 'text-gray-500 dark:text-gray-400' };
    if (spentAmount > allocationAmount) return { label: 'Melebihi', className: 'text-red-600 dark:text-red-400' };
    if (spentAmount === allocationAmount) return { label: 'Pas', className: 'text-amber-600 dark:text-amber-400' };
    return { label: 'Aman', className: 'text-pink-500 dark:text-pink-300' };
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-extrabold text-on-surface flex items-center gap-2">
          <Icon name="account_balance_wallet" size={28} className="text-primary" />
          {t('salaryAllocator.title')}
        </h2>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-container text-sm">
            <Icon name="calendar_month" size={16} className="text-on-surface-variant" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent outline-none text-on-surface font-medium"
            />
          </div>
          <button onClick={handleCarryOverFromPreviousMonth} className="bg-surface-container-high text-on-surface px-3 py-2 rounded-xl text-sm font-medium flex gap-1.5 items-center hover:bg-surface-container-highest transition-colors">
            <Icon name="swap_horiz" size={16} /> {t('salaryAllocator.carryOver')}
          </button>
          <button onClick={handleResetCurrentMonth} className="bg-error-container text-on-error-container px-3 py-2 rounded-xl text-sm font-medium flex gap-1.5 items-center hover:bg-error-container/80 transition-colors">
            <Icon name="refresh" size={16} /> {t('salaryAllocator.reset')}
          </button>
          <button onClick={() => setIsWizardOpen(true)} className="bg-primary text-on-primary px-4 py-2 rounded-xl text-sm font-semibold flex gap-1.5 items-center shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all">
            <Icon name="auto_fix_high" size={16} /> Budget Wizard
          </button>
        </div>
      </div>

      <BudgetWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        categories={categories}
        wallets={wallets}
        userId={userId}
        appId={appId}
        selectedMonth={selectedMonth}
      />

      {/* ── Period + save status ── */}
      <div className="bg-surface-container-low rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-on-surface-variant">{t('common.activePeriod')}</p>
          <p className="font-bold text-on-surface">{monthLabel(selectedMonth, lang)}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-on-surface-variant">{t('common.saveStatus')}</p>
          <p className="text-xs font-semibold text-primary">
            {isMonthLoading ? t('salaryAllocator.loadingMonth') : isSaving ? t('salaryAllocator.saving') : t('salaryAllocator.saved')}
          </p>
          {lastSavedAt && <p className="text-[11px] text-on-surface-variant">{lastSavedAt.toLocaleTimeString('id-ID')}</p>}
        </div>
      </div>

      {/* ── Income Input ── */}
      <div className="bg-surface-container-low rounded-2xl p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-on-surface">Input Pendapatan — {monthLabel(selectedMonth, lang)}</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-primary flex items-center gap-1">
              <Icon name="check_circle" size={14} /> {t('common.autoSave')}
            </span>
            <button onClick={handleAddSalarySource} className="bg-primary text-on-primary px-3 py-1.5 rounded-xl text-xs font-semibold flex gap-1 items-center shadow-sm hover:scale-[0.98] active:scale-95 transition-all">
              <Icon name="add" size={14} /> Tambah Sumber
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {salaries.map((sal, index) => (
            <div key={sal.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 bg-surface-container rounded-xl">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-on-surface-variant">Sumber #{index + 1}</label>
                <input type="text" value={sal.source} onChange={(e) => handleUpdateSalarySource(sal.id, 'source', e.target.value)} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm" placeholder="Contoh: Gaji Utama, Bonus" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-on-surface-variant">Nominal (Rp)</label>
                <input type="number" value={sal.amount} onChange={(e) => handleUpdateSalarySource(sal.id, 'amount', e.target.value)} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm font-semibold" placeholder="0" min="0" />
              </div>
              <div className="flex items-end">
                <button onClick={() => handleDeleteSalarySource(sal.id)} disabled={salaries.length === 1} className="w-full p-2.5 text-on-error-container bg-error-container/30 hover:bg-error-container rounded-xl transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-xs font-semibold flex items-center justify-center gap-1">
                  <Icon name="delete" size={15} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-outline-variant/30">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-on-surface-variant">Rekening Default</label>
            <select value={selectedWallet} onChange={(e) => setSelectedWallet(e.target.value)} className="w-full p-3 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
              <option value="">Pilih Rekening...</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-on-surface-variant">{t('salaryAllocator.expenseBudgetLabel')}</label>
            <input type="number" value={expenseBudget} onChange={(e) => setExpenseBudget(e.target.value)} className="w-full p-3 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface font-semibold" placeholder="0" min="0" />
          </div>
          <div className="flex items-end">
            <div className="w-full p-4 bg-surface-container rounded-xl">
              <p className="text-xs text-on-surface-variant font-semibold mb-1">{t('salaryAllocator.expenseAllocation')}</p>
              <p className="text-xl font-bold text-on-surface">{fmt(expenseBudgetValue)}</p>
              <p className={`text-xs mt-1 ${varianceAgainstExpenseBudget >= 0 ? 'text-primary' : 'text-on-error-container'}`}>
                {varianceAgainstExpenseBudget >= 0
                  ? `Sisa ${fmt(varianceAgainstExpenseBudget)}`
                  : `Melebihi ${fmt(Math.abs(varianceAgainstExpenseBudget))}`}
              </p>
            </div>
          </div>
          <div className="flex items-end">
            <div className="w-full p-4 bg-surface-container rounded-xl">
              <p className="text-xs text-on-surface-variant font-semibold mb-1">INPUT MANUAL</p>
              <p className="text-xl font-bold text-on-surface">{fmt(salaryTotal)}</p>
              <p className="text-xs text-on-surface-variant mt-1">+ Realisasi transaksi: {fmt(incomeFromTransactions)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Hero stat strip ── */}
      {(totalIncome > 0 || hasAnyAllocation || totalSpent > 0 || expenseBudgetValue > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'TOTAL PENDAPATAN', value: totalIncome, sub: 'manual + transaksi', icon: 'payments', accent: 'bg-secondary-container text-on-secondary-container' },
            { label: t('salaryAllocator.expenseAllocation'), value: expenseBudgetValue, sub: `${totalIncome > 0 ? ((expenseBudgetValue / totalIncome) * 100).toFixed(1) : 0}% dari pendapatan`, icon: 'category', accent: 'bg-tertiary-fixed/30 text-tertiary' },
            { label: t('salaryAllocator.expenseUsed'), value: totalExpenseSpent, sub: varianceAgainstExpenseBudget >= 0 ? `Sisa ${fmt(varianceAgainstExpenseBudget)}` : `Melebihi ${fmt(Math.abs(varianceAgainstExpenseBudget))}`, icon: 'receipt_long', accent: 'bg-error-container text-on-error-container' },
            { label: t('salaryAllocator.investmentUsed'), value: totalInvestmentSpent, sub: totalAllocatedInvestment > 0 ? (varianceAgainstInvestmentAllocation >= 0 ? `Sisa ${fmt(varianceAgainstInvestmentAllocation)}` : `Melebihi ${fmt(Math.abs(varianceAgainstInvestmentAllocation))}`) : 'Belum ada alokasi', icon: 'trending_up', accent: 'bg-primary-fixed/30 text-primary' },
          ].map(({ label, value, sub, icon, accent }) => (
            <div key={label} className="bg-surface-container-low rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
                  <Icon name={icon} size={18} />
                </span>
                <p className="text-[10px] text-on-surface-variant font-semibold uppercase tracking-wide leading-tight">{label}</p>
              </div>
              <p className="text-xl font-bold text-on-surface">{fmt(value)}</p>
              <p className="text-xs text-on-surface-variant mt-1">{sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Expense Allocation Table ── */}
      <div className="bg-surface-container-low rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-outline-variant/20">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-on-surface flex items-center gap-2">
              <Icon name="bar_chart" size={18} className="text-primary" /> {t('salaryAllocator.expenseBreakdown')}
            </h3>
            <button onClick={handleAddExpenseAllocation} disabled={!selectedWallet} className="bg-primary disabled:bg-surface-container-high disabled:text-on-surface-variant text-on-primary px-3 py-1.5 rounded-xl text-sm font-semibold flex gap-1.5 items-center shadow-sm hover:scale-[0.98] active:scale-95 transition-all disabled:shadow-none disabled:hover:scale-100">
              <Icon name="add" size={16} /> Tambah Alokasi
            </button>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">Realisasi kategori dihitung dari transaksi bertipe pengeluaran (termasuk langganan otomatis).</p>
          <div className="mt-3 p-3 rounded-xl bg-surface-container text-xs">
            <p className="font-semibold text-on-surface">Sisa untuk dibagi ke kategori: <span className={expenseBudgetRemaining >= 0 ? 'text-primary' : 'text-on-error-container'}>{fmt(expenseBudgetRemaining)}</span></p>
            <p className="text-on-surface-variant mt-1">Total alokasi pengeluaran: {fmt(totalAllocatedExpense)} dari {fmt(expenseBudgetValue)} | Sisa pendapatan total: {fmt(remainingToAllocate)}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container border-b border-outline-variant/20">
              <tr>
                <th className="p-4 font-semibold text-on-surface-variant">Kategori</th>
                <th className="p-4 font-semibold text-on-surface-variant">Rekening</th>
                <th className="p-4 font-semibold text-on-surface-variant">Alokasi</th>
                <th className="p-4 font-semibold text-on-surface-variant">%</th>
                <th className="p-4 font-semibold text-on-surface-variant">Realisasi</th>
                <th className="p-4 font-semibold text-on-surface-variant">Sisa</th>
                <th className="p-4 font-semibold text-on-surface-variant">Status</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {expenseAllocations.length === 0 ? (
                <tr><td colSpan="8" className="p-8 text-center text-on-surface-variant">Belum ada alokasi</td></tr>
              ) : expenseAllocations.map(alloc => (
                <tr key={alloc.id} className="hover:bg-surface-container-high/40 transition-colors">
                  <td className="p-4">
                    <select value={alloc.category} onChange={(e) => handleUpdateExpenseAllocation(alloc.id, 'category', e.target.value)} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm">
                      <option value="">Pilih Kategori...</option>
                      {(categories.expense || []).map(cat => {
                        const alreadyUsed = expenseAllocations.some(item => item.id !== alloc.id && item.category === cat);
                        return <option key={cat} value={cat} disabled={alreadyUsed}>{cat}{alreadyUsed ? ' (sudah)' : ''}</option>;
                      })}
                    </select>
                  </td>
                  <td className="p-4">
                    <select value={alloc.wallet} onChange={(e) => handleUpdateExpenseAllocation(alloc.id, 'wallet', e.target.value)} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm">
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </td>
                  <td className="p-4">
                    <input type="number" value={alloc.amount || ''} onChange={(e) => handleUpdateExpenseAllocation(alloc.id, 'amount', e.target.value)} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm font-semibold" placeholder="0" min="0" />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <input type="number" value={expenseBudgetValue > 0 ? (((parseFloat(alloc.amount) || 0) / expenseBudgetValue) * 100).toFixed(1) : '0.0'} onChange={(e) => handleUpdateExpenseAllocation(alloc.id, 'percentage', e.target.value)} className="w-16 p-2 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm font-semibold" step="0.1" min="0" max="100" />
                      <span className="text-on-surface-variant text-xs">%</span>
                    </div>
                  </td>
                  <td className="p-4 font-semibold text-tertiary">{fmt(spendingByCategory.get(alloc.category || 'Tanpa Kategori') || 0)}</td>
                  <td className={`p-4 font-semibold ${((parseFloat(alloc.amount) || 0) - (spendingByCategory.get(alloc.category || 'Tanpa Kategori') || 0)) >= 0 ? 'text-primary' : 'text-on-error-container'}`}>
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
                    <button onClick={() => handleDeleteExpenseAllocation(alloc.id)} className="p-1.5 text-on-surface-variant hover:text-on-error-container hover:bg-error-container rounded-lg transition-colors">
                      <Icon name="delete" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {expenseAllocations.length > 0 && varianceAgainstExpenseAllocation < 0 && (
          <div className="p-4 bg-error-container/20 border-t border-error-container/40 flex gap-3">
            <Icon name="warning" size={20} className="text-on-error-container shrink-0" />
            <div>
              <p className="text-sm font-semibold text-on-error-container">Perhatian: Realisasi pengeluaran kategori sudah melebihi total alokasi kategori.</p>
              <p className="text-xs text-on-error-container/80 mt-1">Selisih over-budget {fmt(Math.abs(varianceAgainstExpenseAllocation))}.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Investment Allocation Table ── */}
      <div className="bg-surface-container-low rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-outline-variant/20">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-on-surface flex items-center gap-2">
              <Icon name="trending_up" size={18} className="text-primary" /> {t('salaryAllocator.investmentBreakdown')}
            </h3>
            <button onClick={handleAddInvestmentAllocation} disabled={!selectedWallet} className="bg-surface-container-high disabled:opacity-50 text-on-surface px-3 py-1.5 rounded-xl text-sm font-semibold flex gap-1.5 items-center hover:bg-surface-container-highest transition-colors disabled:cursor-not-allowed">
              <Icon name="add" size={16} /> Tambah Alokasi
            </button>
          </div>
          <p className="text-xs text-on-surface-variant mt-2">Bagian ini khusus alokasi investasi, terpisah dari alokasi expenses.</p>
          <div className="mt-3 p-3 rounded-xl bg-surface-container text-xs">
            <p className="font-semibold text-on-surface">Total alokasi investasi: {fmt(totalAllocatedInvestment)}</p>
            <p className="text-on-surface-variant mt-1">Realisasi investasi bulan ini: {fmt(totalInvestmentSpent)} | {varianceAgainstInvestmentAllocation >= 0 ? `Sisa ${fmt(varianceAgainstInvestmentAllocation)}` : `Melebihi ${fmt(Math.abs(varianceAgainstInvestmentAllocation))}`}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container border-b border-outline-variant/20">
              <tr>
                <th className="p-4 font-semibold text-on-surface-variant">{t('salaryAllocator.investmentPosition')}</th>
                <th className="p-4 font-semibold text-on-surface-variant">Rekening</th>
                <th className="p-4 font-semibold text-on-surface-variant">Alokasi</th>
                <th className="p-4 font-semibold text-on-surface-variant">%</th>
                <th className="p-4 w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {investmentAllocations.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-on-surface-variant">Belum ada alokasi investasi</td></tr>
              ) : investmentAllocations.map(alloc => (
                <tr key={alloc.id} className="hover:bg-surface-container-high/40 transition-colors">
                  <td className="p-4">
                    <input type="text" value={alloc.label || ''} onChange={(e) => handleUpdateInvestmentAllocation(alloc.id, 'label', e.target.value)} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm" placeholder="Saham, Emas, Reksadana..." />
                  </td>
                  <td className="p-4">
                    <select value={alloc.wallet} onChange={(e) => handleUpdateInvestmentAllocation(alloc.id, 'wallet', e.target.value)} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm">
                      {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </td>
                  <td className="p-4">
                    <input type="number" value={alloc.amount || ''} onChange={(e) => handleUpdateInvestmentAllocation(alloc.id, 'amount', e.target.value)} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm font-semibold" placeholder="0" min="0" />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <input type="number" value={totalIncome > 0 ? (((parseFloat(alloc.amount) || 0) / totalIncome) * 100).toFixed(1) : '0.0'} onChange={(e) => handleUpdateInvestmentAllocation(alloc.id, 'percentage', e.target.value)} className="w-16 p-2 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm font-semibold" step="0.1" min="0" max="100" />
                      <span className="text-on-surface-variant text-xs">%</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleDeleteInvestmentAllocation(alloc.id)} className="p-1.5 text-on-surface-variant hover:text-on-error-container hover:bg-error-container rounded-lg transition-colors">
                      <Icon name="delete" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {investmentAllocations.length > 0 && varianceAgainstInvestmentAllocation < 0 && (
          <div className="p-4 bg-error-container/20 border-t border-error-container/40 flex gap-3">
            <Icon name="warning" size={20} className="text-on-error-container shrink-0" />
            <div>
              <p className="text-sm font-semibold text-on-error-container">Perhatian: Realisasi investasi bulan ini sudah melebihi total alokasi investasi.</p>
              <p className="text-xs text-on-error-container/80 mt-1">Selisih over-budget {fmt(Math.abs(varianceAgainstInvestmentAllocation))}.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Pie chart + Summary ── */}
      {hasAnyAllocation && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-container-low rounded-2xl p-6 flex flex-col">
            <h3 className="font-bold text-on-surface mb-4">Distribusi Alokasi</h3>
            {[...expenseAllocations.map(a => ({ name: a.category || 'Tanpa Kategori', value: parseFloat(a.amount) || 0 })), ...investmentAllocations.map(a => ({ name: `INV: ${a.label || 'Tanpa Nama'}`, value: parseFloat(a.amount) || 0 }))].filter(a => a.value > 0).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RePieChart>
                  <Pie data={[...expenseAllocations.map(a => ({ name: a.category || 'Tanpa Kategori', value: parseFloat(a.amount) || 0 })), ...investmentAllocations.map(a => ({ name: `INV: ${a.label || 'Tanpa Nama'}`, value: parseFloat(a.amount) || 0 }))].filter(a => a.value > 0)} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value">
                    {[...expenseAllocations, ...investmentAllocations].map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                  </Pie>
                  <ReTooltip formatter={(v) => fmt(v)} />
                  <Legend verticalAlign="bottom" />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex items-center justify-center text-on-surface-variant text-sm">Masukkan nominal alokasi untuk melihat diagram</div>
            )}
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6">
            <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2">
              <Icon name="flag" size={18} className="text-tertiary" /> Ringkasan Kontrol Bulan Ini
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-4 bg-surface-container rounded-xl">
                <p className="font-semibold text-on-surface">Expenses Terkategori</p>
                <p className="text-xs text-on-surface-variant mt-1">{monthlyExpenseTransactions.length} transaksi expense tercatat</p>
              </div>
              <div className="p-4 bg-surface-container rounded-xl">
                <p className="font-semibold text-on-surface">Sisa Alokasi Kategori</p>
                <p className="text-xs text-primary mt-1">{fmt(Math.max(varianceAgainstExpenseAllocation, 0))}</p>
              </div>
              <div className="p-4 bg-surface-container rounded-xl">
                <p className="font-semibold text-on-surface">Sisa Alokasi Investasi</p>
                <p className="text-xs text-primary mt-1">{fmt(Math.max(varianceAgainstInvestmentAllocation, 0))}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Transaction History ── */}
      <div className="bg-surface-container-low rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-outline-variant/20">
          <h3 className="font-bold text-on-surface flex items-center gap-2">
            <Icon name="receipt" size={18} className="text-primary" /> {t('salaryAllocator.transactionHistory')}
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">{t('salaryAllocator.transactionHistoryDesc')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-container border-b border-outline-variant/20">
              <tr>
                <th className="p-4 font-semibold text-on-surface-variant">{t('salaryAllocator.txDate')}</th>
                <th className="p-4 font-semibold text-on-surface-variant">{t('salaryAllocator.txType')}</th>
                <th className="p-4 font-semibold text-on-surface-variant">{t('salaryAllocator.txCategory')}</th>
                <th className="p-4 font-semibold text-on-surface-variant">{t('salaryAllocator.txNote')}</th>
                <th className="p-4 font-semibold text-on-surface-variant">{t('salaryAllocator.txWallet')}</th>
                <th className="p-4 font-semibold text-on-surface-variant text-right">{t('salaryAllocator.txAmount')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {monthlyAllTransactions.length === 0 ? (
                <tr><td colSpan="6" className="p-8 text-center text-on-surface-variant">{t('salaryAllocator.txEmpty')}</td></tr>
              ) : monthlyAllTransactions.map(tx => {
                const typeLabel = tx.type === 'expense' ? t('salaryAllocator.txTypeExpense')
                  : tx.type === 'income' ? t('salaryAllocator.txTypeIncome')
                  : tx.type === 'investment' ? t('salaryAllocator.txTypeInvestment')
                  : tx.type === 'investment_sale' ? t('salaryAllocator.txTypeInvestmentSale')
                  : t('salaryAllocator.txTypeTransfer');
                const badgeClass = tx.type === 'expense' ? 'text-on-error-container bg-error-container'
                  : tx.type === 'income' ? 'text-on-secondary-container bg-secondary-container'
                  : tx.type === 'investment' ? 'text-primary bg-primary-fixed/30'
                  : tx.type === 'investment_sale' ? 'text-tertiary bg-tertiary-fixed/30'
                  : 'text-on-surface-variant bg-surface-container';
                const amountColor = tx.type === 'income' ? 'text-on-secondary-container'
                  : tx.type === 'expense' ? 'text-on-error-container'
                  : tx.type === 'investment' ? 'text-primary'
                  : tx.type === 'investment_sale' ? 'text-tertiary'
                  : 'text-on-surface-variant';
                const walletName = (() => {
                  const wId = tx.walletId || tx.sourceWalletId;
                  const w = walletMap.get(wId);
                  return w ? `${w.icon} ${w.name}` : '-';
                })();
                return (
                  <tr key={tx.id} className="hover:bg-surface-container-high/40 transition-colors">
                    <td className="p-4 text-on-surface-variant whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="p-4"><span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${badgeClass}`}>{typeLabel}</span></td>
                    <td className="p-4 text-on-surface">{tx.category || '-'}</td>
                    <td className="p-4 text-on-surface-variant max-w-[200px] truncate">{tx.note || '-'}</td>
                    <td className="p-4 text-on-surface-variant whitespace-nowrap">{walletName}</td>
                    <td className={`p-4 font-semibold text-right whitespace-nowrap ${amountColor}`}>{fmt(tx.amount)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalaryAllocatorView;
