import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Save, Trash2, RefreshCw, Target, DollarSign, AlertTriangle, CheckCircle, Briefcase, BarChart3 } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend } from 'recharts';

const SalaryAllocatorView = ({ categories, wallets, userId, appId, fmt }) => {
  const [salaries, setSalaries] = useState([{ id: Date.now(), source: '', amount: '' }]);
  const [allocations, setAllocations] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [savedTemplates, setSavedTemplates] = useState([]);

  const totalSalary = useMemo(() => {
    return salaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  }, [salaries]);

  useEffect(() => {
    const savedState = localStorage.getItem(`salaryState_${userId}`);
    if (savedState) {
      try {
        const { salaries: sal, selectedWallet: w, allocations: a } = JSON.parse(savedState);
        if (sal && Array.isArray(sal)) {
          setSalaries(sal.length > 0 ? sal : [{ id: Date.now(), source: '', amount: '' }]);
        }
        setSelectedWallet(w || '');
        setAllocations(a || []);
      } catch (e) { console.error('Error loading state:', e); }
    }
    const templates = localStorage.getItem(`salaryTemplates_${userId}`);
    if (templates) {
      try { setSavedTemplates(JSON.parse(templates)); } catch (e) { console.error('Error loading templates:', e); }
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      localStorage.setItem(`salaryState_${userId}`, JSON.stringify({ salaries, selectedWallet, allocations }));
    }
  }, [salaries, selectedWallet, allocations, userId]);

  const saveAllocations = (data) => setAllocations(data);

  const handleAddSalarySource = () => setSalaries([...salaries, { id: Date.now(), source: '', amount: '' }]);
  const handleUpdateSalarySource = (id, field, value) => setSalaries(salaries.map(s => s.id === id ? { ...s, [field]: value } : s));
  const handleDeleteSalarySource = (id) => {
    if (salaries.length === 1) { alert('Minimal harus ada 1 sumber gaji'); return; }
    setSalaries(salaries.filter(s => s.id !== id));
  };

  const handleAddAllocation = () => {
    if (totalSalary === 0 || !selectedWallet) { alert('Masukkan gaji dan pilih rekening terlebih dahulu'); return; }
    saveAllocations([...allocations, { id: Date.now(), category: '', amount: '', percentage: 0, wallet: selectedWallet }]);
  };

  const handleUpdateAllocation = (id, field, value) => {
    const updated = allocations.map(a => {
      if (a.id !== id) return a;
      const newA = { ...a };
      if (field === 'amount') {
        newA.amount = value;
        newA.percentage = totalSalary && value !== '' ? ((parseFloat(value) || 0) / totalSalary) * 100 : 0;
      } else if (field === 'percentage') {
        newA.percentage = parseFloat(value) || 0;
        newA.amount = totalSalary ? ((parseFloat(value) || 0) / 100 * totalSalary).toString() : '';
      } else {
        newA[field] = value;
      }
      return newA;
    });
    saveAllocations(updated);
  };

  const handleDeleteAllocation = (id) => saveAllocations(allocations.filter(a => a.id !== id));

  const handleReset = () => {
    if (confirm('Reset semua alokasi? Data akan dihapus.')) {
      setSalaries([{ id: Date.now(), source: '', amount: '' }]);
      setSelectedWallet('');
      setAllocations([]);
    }
  };

  const handleSaveTemplate = () => {
    if (totalSalary === 0 || allocations.length === 0) { alert('Masukkan gaji dan minimal 1 alokasi terlebih dahulu'); return; }
    const name = prompt('Nama template (contoh: Gaji Bulanan Januari):');
    if (!name) return;
    const template = { id: Date.now(), name, salaries, selectedWallet, allocations, createdAt: new Date().toISOString() };
    const updated = [...savedTemplates, template];
    setSavedTemplates(updated);
    localStorage.setItem(`salaryTemplates_${userId}`, JSON.stringify(updated));
    alert(`Template "${name}" berhasil disimpan!`);
  };

  const handleLoadTemplate = (template) => {
    if (confirm(`Load template "${template.name}"?`)) {
      if (template.salaries && Array.isArray(template.salaries)) {
        setSalaries(template.salaries.map(s => ({ ...s, id: Date.now() + Math.random() })));
      } else if (template.salary) {
        setSalaries([{ id: Date.now(), source: 'Gaji Utama', amount: template.salary }]);
      }
      setSelectedWallet(template.selectedWallet);
      setAllocations(template.allocations.map(a => ({ ...a, id: Date.now() + Math.random() })));
    }
  };

  const handleDeleteTemplate = (id) => {
    if (confirm('Hapus template ini?')) {
      const updated = savedTemplates.filter(t => t.id !== id);
      setSavedTemplates(updated);
      localStorage.setItem(`salaryTemplates_${userId}`, JSON.stringify(updated));
    }
  };

  const handleApplyToBudget = async () => {
    if (allocations.length === 0) { alert('Tidak ada alokasi untuk diaplikasikan ke budget'); return; }
    if (!confirm('Aplikasikan alokasi ini sebagai budget limit untuk kategori terkait?')) return;
    try {
      let successCount = 0;
      for (const alloc of allocations) {
        if (alloc.category && alloc.amount) {
          const category = (categories.raw || []).find(c => c.name === alloc.category && c.type === 'expense');
          if (category) {
            await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'categories', category.id), { budget: parseFloat(alloc.amount) || 0 });
            successCount++;
          }
        }
      }
      alert(`Budget berhasil diaplikasikan ke ${successCount} kategori!`);
    } catch (error) {
      console.error('Error applying budget:', error);
      alert('Gagal mengaplikasikan budget: ' + error.message);
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const remaining = totalSalary - totalAllocated;
  const remainingPercent = totalSalary ? (remaining / totalSalary) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <DollarSign size={28} className="text-emerald-600 dark:text-emerald-400"/>
          Kalkulator Pengalokasian Gaji
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={handleApplyToBudget} disabled={allocations.length === 0} className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors">
            <Target size={16}/> Apply ke Budget
          </button>
          <button onClick={handleSaveTemplate} disabled={totalSalary === 0 || allocations.length === 0} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors">
            <Save size={16}/> Simpan Template
          </button>
          <button onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors">
            <RefreshCw size={16}/> Reset
          </button>
        </div>
      </div>

      {savedTemplates.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <Briefcase size={18} className="text-purple-500"/> Template Tersimpan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedTemplates.map(template => (
              <div key={template.id} className="p-3 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{template.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {template.salaries ? fmt(template.salaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)) : fmt(template.salary || 0)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{template.allocations.length} alokasi</p>
                  </div>
                  <button onClick={() => handleDeleteTemplate(template.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14}/>
                  </button>
                </div>
                <button onClick={() => handleLoadTemplate(template)} className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 rounded-lg transition-colors font-medium">
                  Load Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">Sumber Gaji</h3>
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
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Sumber Gaji #{index + 1}</label>
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
          <div className="flex items-end">
            <div className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">TOTAL GAJI</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(totalSalary)}</p>
            </div>
          </div>
        </div>
      </div>

      {totalSalary > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">TOTAL DIALOKASIKAN</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalAllocated)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{totalSalary > 0 ? ((totalAllocated / totalSalary) * 100).toFixed(1) : 0}%</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">SISA GAJI</p>
            <h3 className={`text-2xl font-bold ${remaining >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>{fmt(remaining)}</h3>
            <p className={`text-xs mt-1 ${remaining >= 0 ? 'text-blue-500 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
              {remaining >= 0 ? `${remainingPercent.toFixed(1)}% tersedia` : `Kurang ${fmt(Math.abs(remaining))}`}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">ALOKASI ITEM</p>
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{allocations.length}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">kategori teralokasi</p>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500"/> Daftar Alokasi
            </h3>
            <button onClick={handleAddAllocation} disabled={totalSalary === 0 || !selectedWallet} className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors">
              <Plus size={16}/> Tambah Alokasi
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">💡 Tip: Input bisa dilakukan dengan nominal atau persentase. Sistem akan otomatis menghitung yang lainnya.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <tr>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Kategori</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Rekening</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Nominal</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Persentase</th>
                <th className="p-4 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {allocations.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-gray-400 dark:text-gray-500">Belum ada alokasi</td></tr>
              ) : allocations.map(alloc => (
                <tr key={alloc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                  <td className="p-4">
                    <select value={alloc.category} onChange={(e) => handleUpdateAllocation(alloc.id, 'category', e.target.value)} className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm">
                      <option value="">Pilih Kategori...</option>
                      {(categories.expense || []).map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
                      <input type="number" value={((alloc.percentage || 0)).toFixed(1)} onChange={(e) => handleUpdateAllocation(alloc.id, 'percentage', e.target.value)} className="w-20 p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold" step="0.1" min="0" max="100"/>
                      <span className="text-gray-500 dark:text-gray-400">%</span>
                    </div>
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

        {allocations.length > 0 && remaining < 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={20}/>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Perhatian: Total alokasi melebihi gaji!</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">Kurang {fmt(Math.abs(remaining))} untuk seimbangkan alokasi.</p>
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
                    {allocations.map((_, i) => <Cell key={i} fill={['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'][i % 7]}/>)}
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
              <Target size={18} className="text-amber-500"/> Saran Pengalokasian
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                <p className="font-semibold text-amber-900 dark:text-amber-300">Kebutuhan Primer (60%)</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{fmt(totalSalary * 0.6)}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <p className="font-semibold text-blue-900 dark:text-blue-300">Kebutuhan Sekunder (30%)</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{fmt(totalSalary * 0.3)}</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                <p className="font-semibold text-purple-900 dark:text-purple-300">Investasi & Tabungan (10%)</p>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">{fmt(totalSalary * 0.1)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalaryAllocatorView;
