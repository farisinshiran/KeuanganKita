import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../ui/Icon';
import { collection, addDoc, doc, serverTimestamp, updateDoc, deleteDoc, onSnapshot, query, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip } from 'recharts';

const IncomeDiversificationView = ({ userId, appId, fmt, transactions }) => {
  const [incomeSources, setIncomeSources] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [passiveIncomeGoal, setPassiveIncomeGoal] = useState(30);
  const [formData, setFormData] = useState({ id: null, name: '', type: 'active', category: '', monthlyAmount: 0, isRecurring: true, description: '' });

  const incomeCategories = {
    active: [
      { value: 'salary-base', label: 'Gaji Pokok Dosen', icon: '💼' },
      { value: 'salary-certification', label: 'Tunjangan Sertifikasi', icon: '🎓' },
      { value: 'teaching-extra', label: 'Honor Mengajar Tambahan', icon: '👨‍🏫' },
      { value: 'research', label: 'Honorarium Penelitian', icon: '🔬' },
      { value: 'community-service', label: 'Honorarium Pengabdian', icon: '🤝' },
      { value: 'consultation', label: 'Konsultasi/Workshop', icon: '💡' },
      { value: 'freelance', label: 'Freelance/Proyek', icon: '💻' },
      { value: 'other-active', label: 'Lainnya (Aktif)', icon: '⚡' }
    ],
    passive: [
      { value: 'book-royalty', label: 'Royalti Buku', icon: '📚' },
      { value: 'investment-dividend', label: 'Dividen Investasi', icon: '📈' },
      { value: 'rental-income', label: 'Pendapatan Sewa', icon: '🏠' },
      { value: 'online-course', label: 'Kursus Online', icon: '🎥' },
      { value: 'affiliate', label: 'Affiliate/Komisi', icon: '🔗' },
      { value: 'patent-license', label: 'Lisensi/Paten', icon: '⚖️' },
      { value: 'other-passive', label: 'Lainnya (Pasif)', icon: '💤' }
    ]
  };

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'artifacts', appId, 'users', userId, 'incomeSources')),
      (snapshot) => { setIncomeSources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))); }
    );
    return () => unsubscribe();
  }, [userId, appId]);

  useEffect(() => {
    if (!userId) return;
    const loadGoal = async () => {
      try {
        const goalDoc = await getDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'incomeGoal'));
        if (goalDoc.exists() && goalDoc.data().passiveIncomeGoal) setPassiveIncomeGoal(goalDoc.data().passiveIncomeGoal);
      } catch (error) { console.error('Error loading goal:', error); }
    };
    loadGoal();
  }, [userId, appId]);

  const stats = useMemo(() => {
    const activeIncome = incomeSources.filter(s => s.type === 'active').reduce((sum, s) => sum + (s.monthlyAmount || 0), 0);
    const passiveIncome = incomeSources.filter(s => s.type === 'passive').reduce((sum, s) => sum + (s.monthlyAmount || 0), 0);
    const totalIncome = activeIncome + passiveIncome;
    const passivePercentage = totalIncome > 0 ? (passiveIncome / totalIncome) * 100 : 0;
    const activePercentage = totalIncome > 0 ? (activeIncome / totalIncome) * 100 : 0;
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentIncome = (transactions || []).filter(t => t.type === 'income' && t.date >= thirtyDaysAgo).reduce((sum, t) => sum + t.amount, 0);
    return { activeIncome, passiveIncome, totalIncome, passivePercentage, activePercentage, recentIncome, goalDiff: passivePercentage - passiveIncomeGoal, sourcesCount: incomeSources.length };
  }, [incomeSources, transactions, passiveIncomeGoal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.category) { alert('Nama dan kategori harus diisi'); return; }
    try {
      const payload = { name: formData.name, type: formData.type, category: formData.category, monthlyAmount: Number(formData.monthlyAmount) || 0, isRecurring: formData.isRecurring, description: formData.description || '', updatedAt: serverTimestamp() };
      if (formData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'incomeSources', formData.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'incomeSources'), { ...payload, createdAt: serverTimestamp() });
      }
      setIsFormOpen(false);
      setFormData({ id: null, name: '', type: 'active', category: '', monthlyAmount: 0, isRecurring: true, description: '' });
    } catch (error) { console.error('Error saving income source:', error); alert('Gagal menyimpan data'); }
  };

  const handleEdit = (source) => {
    setFormData({ id: source.id, name: source.name, type: source.type, category: source.category, monthlyAmount: source.monthlyAmount, isRecurring: source.isRecurring, description: source.description || '' });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus sumber pendapatan ini?')) {
      try { await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'incomeSources', id)); }
      catch (error) { console.error('Error deleting income source:', error); alert('Gagal menghapus data'); }
    }
  };

  const savePassiveIncomeGoal = async (goal) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'incomeGoal'), { passiveIncomeGoal: Number(goal), updatedAt: serverTimestamp() });
      setPassiveIncomeGoal(Number(goal));
    } catch (error) { console.error('Error saving goal:', error); alert('Gagal menyimpan target'); }
  };

  const chartData = [
    { name: 'Active Income', value: stats.activeIncome, color: '#3b82f6' },
    { name: 'Passive Income', value: stats.passiveIncome, color: '#10b981' }
  ].filter(d => d.value > 0);

  const categoryIcon = (category) => {
    const allCategories = [...incomeCategories.active, ...incomeCategories.passive];
    return allCategories.find(c => c.value === category)?.icon || '💰';
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface flex items-center gap-2">
            <Icon name="bar_chart" size={28} className="text-primary" />
            Sumber Pendapatan
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">Kelola dan pantau sumber pendapatan aktif &amp; pasif</p>
        </div>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setFormData({ id: null, name: '', type: 'active', category: '', monthlyAmount: 0, isRecurring: true, description: '' }); }} className="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-semibold flex gap-2 items-center shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all">
          <Icon name={isFormOpen ? 'close' : 'add'} size={18} />
          <span>{isFormOpen ? 'Batal' : 'Tambah Sumber'}</span>
        </button>
      </div>

      {/* ── 4-stat strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-surface-container-low rounded-2xl p-5">
          <div className="w-9 h-9 rounded-xl bg-primary-fixed/30 flex items-center justify-center mb-3">
            <Icon name="work" size={20} className="text-primary" />
          </div>
          <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide mb-1">Active Income</p>
          <p className="text-xl font-bold text-on-surface">{fmt(stats.activeIncome)}</p>
          <p className="text-xs text-on-surface-variant mt-1">{stats.activePercentage.toFixed(1)}% dari total</p>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5">
          <div className="w-9 h-9 rounded-xl bg-secondary-container flex items-center justify-center mb-3">
            <Icon name="trending_up" size={20} className="text-on-secondary-container" />
          </div>
          <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide mb-1">Passive Income</p>
          <p className="text-xl font-bold text-on-surface">{fmt(stats.passiveIncome)}</p>
          <p className="text-xs text-on-surface-variant mt-1">{stats.passivePercentage.toFixed(1)}% dari total</p>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5">
          <div className="w-9 h-9 rounded-xl bg-surface-container-high flex items-center justify-center mb-3">
            <Icon name="account_balance_wallet" size={20} className="text-on-surface" />
          </div>
          <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide mb-1">Total</p>
          <p className="text-xl font-bold text-on-surface">{fmt(stats.totalIncome)}</p>
          <p className="text-xs text-on-surface-variant mt-1">{stats.sourcesCount} sumber</p>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${stats.goalDiff >= 0 ? 'bg-secondary-container' : 'bg-tertiary-fixed/30'}`}>
            <Icon name="flag" size={20} className={stats.goalDiff >= 0 ? 'text-on-secondary-container' : 'text-tertiary'} />
          </div>
          <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide mb-1">Target</p>
          <p className="text-xl font-bold text-on-surface">{passiveIncomeGoal}%</p>
          <p className="text-xs text-on-surface-variant mt-1">{stats.goalDiff >= 0 ? '✅ Tercapai' : `Kurang ${Math.abs(stats.goalDiff).toFixed(1)}%`}</p>
        </div>
      </div>

      {/* ── Active/Passive allocation bar ── */}
      {stats.totalIncome > 0 && (
        <div className="bg-surface-container-low rounded-2xl p-5">
          <p className="text-sm font-semibold text-on-surface mb-3">Proporsi Active vs Passive</p>
          <div className="flex h-4 rounded-full overflow-hidden mb-2">
            <div className="bg-primary transition-all" style={{ width: `${stats.activePercentage}%` }} />
            <div className="bg-secondary transition-all" style={{ width: `${stats.passivePercentage}%` }} />
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Active {stats.activePercentage.toFixed(1)}%</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary inline-block" /> Passive {stats.passivePercentage.toFixed(1)}%</span>
          </div>
        </div>
      )}

      {/* ── Add/Edit form ── */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-surface-container-low rounded-2xl p-6">
          <h3 className="font-bold text-on-surface mb-4">{formData.id ? 'Edit Sumber' : 'Tambah Sumber Pendapatan'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-on-surface-variant">Nama Sumber Pendapatan</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="Contoh: Gaji Universitas" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-on-surface-variant">Tipe Pendapatan</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value, category: '' })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                <option value="active">💼 Active Income</option>
                <option value="passive">💤 Passive Income</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-on-surface-variant">Kategori</label>
              <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                <option value="">Pilih Kategori...</option>
                {incomeCategories[formData.type].map(cat => <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-on-surface-variant">Jumlah per Bulan (Rp)</label>
              <input type="number" min="0" required value={formData.monthlyAmount} onChange={(e) => setFormData({ ...formData, monthlyAmount: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface font-semibold" placeholder="0" />
            </div>
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-on-surface-variant">Deskripsi/Catatan</label>
              <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="Opsional..." />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isRecurring" checked={formData.isRecurring} onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })} className="w-4 h-4 rounded accent-primary" />
              <label htmlFor="isRecurring" className="text-sm text-on-surface-variant">Pendapatan Rutin (Setiap Bulan)</label>
            </div>
          </div>
          <div className="flex justify-end mt-5">
            <button type="submit" className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all">
              <Icon name="save" size={18} /> {formData.id ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      {/* ── Pie chart ── */}
      {chartData.length > 0 && (
        <div className="bg-surface-container-low rounded-2xl p-6">
          <h3 className="font-bold text-on-surface mb-4">Proporsi Active vs Passive Income</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RePieChart>
              <Pie data={chartData} cx="50%" cy="50%" labelLine={false} label={(entry) => `${entry.name}: ${((entry.value / stats.totalIncome) * 100).toFixed(1)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
              </Pie>
              <ReTooltip formatter={(v) => fmt(v)} />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Sources grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[{ type: 'active', label: 'Active Income', icon: 'work', accent: 'bg-primary-fixed/20 text-primary' }, { type: 'passive', label: 'Passive Income', icon: 'trending_up', accent: 'bg-secondary-container text-on-secondary-container' }].map(({ type, label, icon, accent }) => (
          <div key={type} className="bg-surface-container-low rounded-2xl p-6">
            <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2">
              <Icon name={icon} size={20} className={accent.split(' ')[1]} />{label}
            </h3>
            <div className="space-y-3">
              {incomeSources.filter(s => s.type === type).length === 0 ? (
                <p className="text-on-surface-variant text-sm text-center py-8">Belum ada sumber {label.toLowerCase()}</p>
              ) : incomeSources.filter(s => s.type === type).map(source => (
                <div key={source.id} className="p-4 bg-surface-container rounded-xl">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-on-surface flex items-center gap-2">
                        <span>{categoryIcon(source.category)}</span>{source.name}
                        {source.isRecurring && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant">Rutin</span>}
                      </p>
                      {source.description && <p className="text-xs text-on-surface-variant mt-1">{source.description}</p>}
                      <p className="text-lg font-bold text-primary mt-2">{fmt(source.monthlyAmount)}<span className="text-xs font-normal text-on-surface-variant">/bulan</span></p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(source)} className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20 rounded-lg transition-colors">
                        <Icon name="edit" size={16} />
                      </button>
                      <button onClick={() => handleDelete(source.id)} className="p-2 text-on-surface-variant hover:text-on-error-container hover:bg-error-container rounded-lg transition-colors">
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Passive % gauge + target ── */}
      <div className="bg-surface-container-low rounded-2xl p-6">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1">
            <h3 className="font-bold text-on-surface mb-1 flex items-center gap-2">
              <Icon name="flag" size={18} className="text-tertiary" /> Target Passive Income
            </h3>
            <p className="text-xs text-on-surface-variant mb-4">Geser untuk ubah target persentase passive income</p>
            <div className="flex items-center gap-4">
              <input type="range" min="0" max="100" value={passiveIncomeGoal} onChange={(e) => savePassiveIncomeGoal(e.target.value)} className="flex-1 accent-primary" />
              <div className="text-2xl font-bold text-on-surface min-w-[70px] text-right">{passiveIncomeGoal}%</div>
            </div>
            <p className="text-xs text-on-surface-variant mt-3">Target: {fmt(stats.totalIncome * passiveIncomeGoal / 100)}/bulan dari passive</p>
          </div>
          <div className="w-36 h-36 relative shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" className="text-surface-container" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${stats.passivePercentage} ${100 - stats.passivePercentage}`} className={stats.passivePercentage >= passiveIncomeGoal ? 'text-secondary' : 'text-tertiary'} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-extrabold text-on-surface">{stats.passivePercentage.toFixed(0)}%</p>
              <p className="text-[10px] text-on-surface-variant">Passive</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomeDiversificationView;
