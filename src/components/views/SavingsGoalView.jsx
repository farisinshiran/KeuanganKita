import React, { useState, useMemo } from 'react';
import {
  collection, addDoc, doc, updateDoc, deleteDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import Icon from '../ui/Icon.jsx';

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
          <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <Icon name="savings" size={28} className="text-primary"/> Target Tabungan
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Tetapkan tujuan keuangan dengan deadline dan pantau progressnya.
          </p>
        </div>
        <button
          onClick={() => { setIsFormOpen(v => !v); setForm(emptyForm()); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${isFormOpen ? 'border-2 border-primary text-primary hover:bg-primary/5' : 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95'}`}
        >
          <Icon name={isFormOpen ? 'close' : 'add'} size={18}/>
          {isFormOpen ? 'Batal' : 'Tambah Goal'}
        </button>
      </div>

      {/* Summary bar */}
      {goals.length > 0 && (
        <div className="bg-surface-container-low p-5 rounded-2xl">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-on-surface">
              Total Progress — {goals.length} Goal
            </span>
            <span className="text-sm font-bold text-primary">{overallPct.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-3">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant mt-1">
            <span>Terkumpul: {fmt(totalCurrent)}</span>
            <span>Target: {fmt(totalTarget)}</span>
          </div>
        </div>
      )}

      {/* Form */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-surface-container-low p-6 rounded-2xl animate-in fade-in slide-in-from-top-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">Icon</label>
            <input
              value={form.icon}
              onChange={e => setForm({ ...form, icon: e.target.value })}
              className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-center text-xl"
              placeholder="🎯"
              maxLength={4}
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-xs font-semibold text-on-surface-variant">Nama Goal *</label>
            <input
              required
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"
              placeholder="Contoh: Dana Darurat, Liburan, Beli Laptop"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">Target (Rp) *</label>
            <input
              type="number" required min={1}
              value={form.targetAmount}
              onChange={e => setForm({ ...form, targetAmount: e.target.value })}
              className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"
              placeholder="10000000"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">Sudah Terkumpul (Rp)</label>
            <input
              type="number" min={0}
              value={form.currentAmount}
              onChange={e => setForm({ ...form, currentAmount: e.target.value })}
              className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-on-surface-variant">Deadline</label>
            <input
              type="date"
              value={form.targetDate}
              onChange={e => setForm({ ...form, targetDate: e.target.value })}
              className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"
            />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-xs font-semibold text-on-surface-variant">Catatan</label>
            <input
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"
              placeholder="Opsional"
            />
          </div>
          <button
            type="submit"
            className="bg-primary text-on-primary px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all h-[46px]"
          >
            <Icon name="save" size={18}/> {form.id ? 'Perbarui' : 'Simpan'}
          </button>
        </form>
      )}

      {/* Goal Cards */}
      {goals.length === 0 ? (
        <div className="bg-surface-container-low rounded-2xl p-16 text-center">
          <Icon name="savings" size={48} className="mx-auto text-outline mb-4"/>
          <p className="text-on-surface-variant text-lg font-medium">Belum ada target tabungan</p>
          <p className="text-outline text-sm mt-1">
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
    done:      { icon: 'check_circle', label: 'Tercapai!',          cls: 'bg-secondary-container text-on-secondary-container' },
    overdue:   { icon: 'error',        label: 'Melewati Deadline',   cls: 'bg-error-container text-on-error-container' },
    'at-risk': { icon: 'schedule',     label: 'Perlu Perhatian',     cls: 'bg-tertiary-fixed/40 text-tertiary' },
    'on-track':{ icon: 'trending_up',  label: 'On Track',            cls: 'bg-primary-fixed/30 text-primary' },
  };
  const sc = statusConfig[g.status] || statusConfig['on-track'];
  const barPct = g.pct >= 92 ? 'bg-error' : g.pct >= 50 ? 'bg-primary' : 'bg-secondary';

  return (
    <div className="bg-surface-container-low p-5 rounded-2xl group relative hover:shadow-md transition-all hover:scale-[1.01] flex flex-col gap-4">
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl p-2 bg-surface-container rounded-xl leading-none">{g.icon}</span>
          <div>
            <h3 className="font-bold text-on-surface leading-tight">{g.name}</h3>
            {g.targetDate && (
              <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                <Icon name="calendar_today" size={11}/> {formatDate(g.targetDate)}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(g)} className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"><Icon name="edit" size={15}/></button>
          <button onClick={() => onDelete(g.id)} className="p-1 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"><Icon name="delete" size={15}/></button>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex justify-between text-sm mb-1.5">
          <span className="text-on-surface font-medium">{fmt(g.current)}</span>
          <span className="text-on-surface-variant font-bold">{g.pct.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-surface-container-high rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${barPct}`}
            style={{ width: `${g.pct}%` }}
          />
        </div>
        <div className="text-right text-xs text-on-surface-variant mt-1">Target: {fmt(g.target)}</div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 pt-1 border-t border-outline-variant/20">
        <div>
          <p className="text-xs text-on-surface-variant">Sisa</p>
          <p className="text-sm font-bold text-on-surface">{fmt(g.remaining)}</p>
        </div>
        <div>
          <p className="text-xs text-on-surface-variant">Nabung/Bulan</p>
          <p className="text-sm font-bold text-on-surface">
            {g.monthly != null ? fmt(Math.ceil(g.monthly)) : g.status === 'done' ? '✅' : '-'}
          </p>
        </div>
      </div>

      {/* Status badge */}
      <div className={`inline-flex items-center gap-1.5 self-start px-2.5 py-1 rounded-full text-xs font-semibold ${sc.cls}`}>
        <Icon name={sc.icon} size={13}/> {sc.label}
      </div>

      {g.note && <p className="text-xs text-on-surface-variant italic">{g.note}</p>}
    </div>
  );
}

export default SavingsGoalView;
