import React, { useState, useMemo } from 'react';
import {
  Plus, Save, X, Edit2, Trash2, Target, CalendarDays, TrendingUp,
  CheckCircle, AlertCircle, Clock, Wallet,
} from 'lucide-react';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

const COLORS = ['#10B981','#3B82F6','#F59E0B','#EF4444','#8B5CF6','#EC4899','#6366F1','#14B8A6'];

const emptyForm = () => ({
  id: null, name: '', icon: '🎯', targetAmount: '', currentAmount: '0',
  targetDate: '', note: '',
});

function monthsUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now    = new Date();
  const diff   = (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth());
  return diff;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

const SavingsGoalView = ({ savingsGoals = [], wallets = [], userId, appId, fmt }) => {
  const [form, setForm]           = useState(emptyForm());
  const [isFormOpen, setIsFormOpen] = useState(false);

  const base = () => collection(db, 'artifacts', appId, 'users', userId, 'savings_goals');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = {
      name:          form.name.trim(),
      icon:          form.icon || '🎯',
      targetAmount:  Number(form.targetAmount) || 0,
      currentAmount: Number(form.currentAmount) || 0,
      targetDate:    form.targetDate || null,
      note:          form.note || '',
    };
    try {
      if (form.id) {
        await updateDoc(
          doc(db, 'artifacts', appId, 'users', userId, 'savings_goals', form.id),
          { ...payload, updatedAt: serverTimestamp() },
        );
      } else {
        await addDoc(base(), { ...payload, createdAt: serverTimestamp() });
      }
      setForm(emptyForm());
      setIsFormOpen(false);
    } catch (err) { console.error(err); }
  };

  const handleEdit = (g) => {
    setForm({
      id: g.id, name: g.name, icon: g.icon || '🎯',
      targetAmount: g.targetAmount, currentAmount: g.currentAmount,
      targetDate: g.targetDate || '', note: g.note || '',
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus target tabungan ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'savings_goals', id));
    }
  };

  const goals = useMemo(() => savingsGoals.map((g, idx) => {
    const target    = Number(g.targetAmount) || 0;
    const current   = Number(g.currentAmount) || 0;
    const remaining = Math.max(0, target - current);
    const pct       = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    const months    = monthsUntil(g.targetDate);
    const monthly   = months > 0 ? remaining / months : null;

    let status = 'on-track';
    if (months !== null && months < 0) status = 'overdue';
    else if (months !== null && monthly !== null && monthly > 0) status = 'at-risk';
    if (pct >= 100) status = 'done';

    return { ...g, target, current, remaining, pct, months, monthly, status, color: COLORS[idx % COLORS.length] };
  }), [savingsGoals]);

  const totalTarget  = goals.reduce((a, g) => a + g.target, 0);
  const totalCurrent = goals.reduce((a, g) => a + g.current, 0);
  const overallPct   = totalTarget > 0 ? Math.min(100, (totalCurrent / totalTarget) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Target className="text-emerald-600 dark:text-emerald-400" size={24}/> Target Tabungan
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tetapkan tujuan keuangan dengan deadline dan pantau progressnya.
          </p>
        </div>
        <button
          onClick={() => { setIsFormOpen(v => !v); setForm(emptyForm()); }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 items-center hover:bg-emerald-700 transition-colors"
        >
          {isFormOpen ? <X size={18}/> : <Plus size={18}/>}
          <span>{isFormOpen ? 'Batal' : 'Tambah Goal'}</span>
        </button>
      </div>

      {/* Summary bar */}
      {goals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Total Progress — {goals.length} Goal
            </span>
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{overallPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
            <div
              className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>Terkumpul: {fmt(totalCurrent)}</span>
            <span>Target: {fmt(totalTarget)}</span>
          </div>
        </div>
      )}

      {/* Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-emerald-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end"
        >
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Icon</label>
            <input
              value={form.icon}
              onChange={e => setForm({ ...form, icon: e.target.value })}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white text-center text-xl"
              placeholder="🎯"
              maxLength={4}
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Goal *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              placeholder="Contoh: Dana Darurat, Liburan, Beli Laptop"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Target (Rp) *</label>
            <input
              type="number" required min={1}
              value={form.targetAmount}
              onChange={e => setForm({ ...form, targetAmount: e.target.value })}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              placeholder="10000000"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sudah Terkumpul (Rp)</label>
            <input
              type="number" min={0}
              value={form.currentAmount}
              onChange={e => setForm({ ...form, currentAmount: e.target.value })}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Deadline</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={e => setForm({ ...form, targetDate: e.target.value })}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
            />
          </div>
          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Catatan</label>
            <input
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"
              placeholder="Opsional"
            />
          </div>
          <button
            type="submit"
            className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors h-[46px]"
          >
            <Save size={18}/> {form.id ? 'Perbarui' : 'Simpan'}
          </button>
        </form>
      )}

      {/* Goal Cards */}
      {goals.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-16 text-center">
          <Target size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4"/>
          <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">Belum ada target tabungan</p>
          <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
            Mulai tentukan tujuan keuangan agar lebih terarah dan terencana.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {goals.map(g => (
            <GoalCard key={g.id} goal={g} fmt={fmt} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
};

function GoalCard({ goal: g, fmt, onEdit, onDelete }) {
  const statusConfig = {
    done:     { icon: <CheckCircle size={14}/>, label: 'Tercapai!',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    overdue:  { icon: <AlertCircle size={14}/>, label: 'Melewati Deadline', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
    'at-risk':{ icon: <Clock size={14}/>,       label: 'Perlu Perhatian',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
    'on-track':{ icon: <TrendingUp size={14}/>, label: 'On Track',         cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  };
  const sc = statusConfig[g.status] || statusConfig['on-track'];

  return (
    <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 group relative hover:shadow-md transition-all hover:scale-[1.01] flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl p-2 bg-gray-50 dark:bg-gray-700 rounded-lg leading-none">{g.icon}</span>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-gray-100 leading-tight">{g.name}</h3>
            {g.targetDate && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                <CalendarDays size={11}/> {formatDate(g.targetDate)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(g)} className="text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1 rounded"><Edit2 size={15}/></button>
          <button onClick={() => onDelete(g.id)} className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"><Trash2 size={15}/></button>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-gray-600 dark:text-gray-300 font-medium">{fmt(g.current)}</span>
          <span className="text-gray-400 dark:text-gray-500 font-bold">{g.pct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
          <div
            className="h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${g.pct}%`, backgroundColor: g.color }}
          />
        </div>
        <div className="text-right text-xs text-gray-400 dark:text-gray-500 mt-1">Target: {fmt(g.target)}</div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-dashed dark:border-gray-700">
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Sisa</p>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">{fmt(g.remaining)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500">Nabung/Bulan</p>
          <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
            {g.monthly != null ? fmt(Math.ceil(g.monthly)) : g.status === 'done' ? '✅' : '-'}
          </p>
        </div>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-1 self-start px-2 py-1 rounded-full text-xs font-semibold ${sc.cls}`}>
        {sc.icon} {sc.label}
      </div>

      {g.note && <p className="text-xs text-gray-500 dark:text-gray-400 italic">{g.note}</p>}
    </div>
  );
}

export default SavingsGoalView;
