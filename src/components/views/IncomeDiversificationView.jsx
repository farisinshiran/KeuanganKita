import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Save, X, Edit2, Trash2, Target, TrendingUp, Briefcase, Wallet, BarChart3, AlertTriangle } from 'lucide-react';
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><BarChart3 size={28} className="text-emerald-600" />Diversifikasi Pendapatan</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Kelola dan pantau sumber pendapatan aktif & pasif</p>
        </div>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setFormData({ id: null, name: '', type: 'active', category: '', monthlyAmount: 0, isRecurring: true, description: '' }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">
          {isFormOpen ? <X size={18}/> : <Plus size={18}/>}
          <span>{isFormOpen ? 'Batal' : 'Tambah Sumber'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-2"><Briefcase size={24}/><span className="text-sm opacity-80">Active</span></div>
          <p className="text-2xl font-bold">{fmt(stats.activeIncome)}</p>
          <p className="text-xs opacity-80 mt-1">{stats.activePercentage.toFixed(1)}% dari total</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-2"><TrendingUp size={24}/><span className="text-sm opacity-80">Passive</span></div>
          <p className="text-2xl font-bold">{fmt(stats.passiveIncome)}</p>
          <p className="text-xs opacity-80 mt-1">{stats.passivePercentage.toFixed(1)}% dari total</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-2"><Wallet size={24}/><span className="text-sm opacity-80">Total</span></div>
          <p className="text-2xl font-bold">{fmt(stats.totalIncome)}</p>
          <p className="text-xs opacity-80 mt-1">{stats.sourcesCount} sumber</p>
        </div>
        <div className={`bg-gradient-to-br ${stats.goalDiff >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-amber-500 to-amber-600'} p-6 rounded-xl shadow-lg text-white`}>
          <div className="flex items-center justify-between mb-2"><Target size={24}/><span className="text-sm opacity-80">Target</span></div>
          <p className="text-2xl font-bold">{passiveIncomeGoal}%</p>
          <p className="text-xs opacity-80 mt-1">{stats.goalDiff >= 0 ? '✅ Target tercapai!' : `🎯 Kurang ${Math.abs(stats.goalDiff).toFixed(1)}%`}</p>
        </div>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nama Sumber Pendapatan</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Gaji Universitas"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tipe Pendapatan</label>
              <select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value, category: '' })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white">
                <option value="active">💼 Active Income (Bekerja Aktif)</option>
                <option value="passive">💤 Passive Income (Otomatis)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Kategori</label>
              <select required value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white">
                <option value="">Pilih Kategori...</option>
                {incomeCategories[formData.type].map(cat => <option key={cat.value} value={cat.value}>{cat.icon} {cat.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Jumlah per Bulan (Rp)</label>
              <input type="number" min="0" required value={formData.monthlyAmount} onChange={(e) => setFormData({ ...formData, monthlyAmount: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Deskripsi/Catatan</label>
              <input type="text" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white" placeholder="Opsional: Detail tambahan..."/>
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input type="checkbox" id="isRecurring" checked={formData.isRecurring} onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })} className="w-4 h-4 rounded"/>
              <label htmlFor="isRecurring" className="text-sm text-gray-700 dark:text-gray-300">Pendapatan Rutin (Setiap Bulan)</label>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2">
              <Save size={18}/> {formData.id ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
        <h3 className="font-bold text-amber-900 dark:text-amber-300 mb-4 flex items-center gap-2"><Target size={20}/>Target Passive Income</h3>
        <div className="flex items-center gap-4">
          <input type="range" min="0" max="100" value={passiveIncomeGoal} onChange={(e) => savePassiveIncomeGoal(e.target.value)} className="flex-1"/>
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 min-w-[80px]">{passiveIncomeGoal}%</div>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">Target: {fmt(stats.totalIncome * passiveIncomeGoal / 100)} dari passive income</p>
      </div>

      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Proporsi Active vs Passive Income</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie data={chartData} cx="50%" cy="50%" labelLine={false} label={(entry) => `${entry.name}: ${((entry.value / stats.totalIncome) * 100).toFixed(1)}%`} outerRadius={100} fill="#8884d8" dataKey="value">
                {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color}/>)}
              </Pie>
              <ReTooltip formatter={(v) => fmt(v)}/>
            </RePieChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[{ type: 'active', label: 'Active Income', icon: <Briefcase size={20} className="text-blue-600"/>, color: 'blue' }, { type: 'passive', label: 'Passive Income', icon: <TrendingUp size={20} className="text-green-600"/>, color: 'green' }].map(({ type, label, icon, color }) => (
          <div key={type} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">{icon}{label}</h3>
            <div className="space-y-3">
              {incomeSources.filter(s => s.type === type).length === 0 ? (
                <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">Belum ada sumber {label.toLowerCase()}</p>
              ) : incomeSources.filter(s => s.type === type).map(source => (
                <div key={source.id} className={`p-4 bg-${color}-50 dark:bg-${color}-900/10 rounded-lg border border-${color}-100 dark:border-${color}-800`}>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><span>{categoryIcon(source.category)}</span>{source.name}</p>
                      {source.description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{source.description}</p>}
                      <p className={`text-lg font-bold text-${color}-600 dark:text-${color}-400 mt-2`}>{fmt(source.monthlyAmount)}<span className="text-xs font-normal">/bulan</span></p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(source)} className={`p-2 text-${color}-600 hover:bg-${color}-100 dark:hover:bg-${color}-900/20 rounded-lg`}><Edit2 size={16}/></button>
                      <button onClick={() => handleDelete(source.id)} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"><Trash2 size={16}/></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
        <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2"><AlertTriangle size={18}/>Tips Diversifikasi Pendapatan</h4>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <p>💼 <strong>Active Income:</strong> Pendapatan dari pekerjaan aktif (gaji, honor, konsultasi)</p>
          <p>💤 <strong>Passive Income:</strong> Pendapatan yang berjalan otomatis (royalti, dividen, sewa)</p>
          <p>🎯 <strong>Target Ideal:</strong> 30-50% dari passive income untuk financial freedom</p>
          <p>📈 <strong>Strategi:</strong> Mulai dari passive income kecil (buku, kursus online) lalu kembangkan</p>
          <p>🔄 <strong>Diversifikasi:</strong> Jangan bergantung pada satu sumber pendapatan saja</p>
        </div>
      </div>
    </div>
  );
};

export default IncomeDiversificationView;
