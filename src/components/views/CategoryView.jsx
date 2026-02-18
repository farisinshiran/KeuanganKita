import React, { useState, useMemo } from 'react';
import { Plus, Save, X, Trash2, Edit2, Settings } from 'lucide-react';
import { collection, addDoc, doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES } from '../../constants/categories';

const CategoryView = ({ categories, userId, appId, fmt }) => {
  const [form, setForm] = useState({ id: null, name: '', type: 'expense', budget: '' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('expense');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    const payload = { name: form.name, type: form.type, budget: Number(form.budget) || 0 };
    try {
      if (form.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'categories', form.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'categories'), payload);
      }
      setForm({ id: null, name: '', type: 'expense', budget: '' });
      setIsFormOpen(false);
    } catch (err) { console.error(err); }
  };

  const handleEdit = (cat) => {
    setForm({ id: cat.id, name: cat.name, type: cat.type, budget: cat.budget || '' });
    setActiveTab(cat.type);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus kategori ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'categories', id));
    }
  };

  const displayedCategories = useMemo(() => {
    return (categories.raw || []).filter(c => c.type === activeTab);
  }, [categories, activeTab]);

  const totalBudget = useMemo(() => {
    return displayedCategories.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);
  }, [displayedCategories]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <Settings size={28} className="text-emerald-600 dark:text-emerald-400"/>
          Kelola Kategori
        </h2>
        <button
          onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', type: activeTab, budget: '' }); }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors"
        >
          {isFormOpen ? <X size={18}/> : <Plus size={18}/>}
          <span>{isFormOpen ? 'Batal' : 'Tambah Kategori'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('expense')}
          className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === 'expense' ? 'border-red-500 text-red-600 dark:text-red-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Pengeluaran ({categories.expense?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`px-4 py-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${activeTab === 'income' ? 'border-green-500 text-green-600 dark:text-green-400' : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          Pemasukan ({categories.income?.length || 0})
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tipe</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Kategori</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Makan, Transport..." />
            </div>
            {form.type === 'expense' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Budget Bulanan (Rp)</label>
                <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="0 = Tidak ada limit" />
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors">
              <Save size={18} /> {form.id ? 'Simpan Perubahan' : 'Tambah Kategori'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'expense' && totalBudget > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Total Budget Pengeluaran: <span className="font-bold">{fmt(totalBudget)}</span>
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
            <tr>
              <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase">Nama Kategori</th>
              {activeTab === 'expense' && <th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300 uppercase text-right">Budget Bulanan</th>}
              <th className="p-4 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {displayedCategories.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'expense' ? 3 : 2} className="p-8 text-center text-gray-400 dark:text-gray-500">
                  Belum ada kategori {activeTab === 'expense' ? 'pengeluaran' : 'pemasukan'}
                </td>
              </tr>
            ) : displayedCategories.map(cat => (
              <tr key={cat.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 group transition-colors">
                <td className="p-4">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${activeTab === 'expense' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'}`}>
                    {cat.name}
                  </span>
                </td>
                {activeTab === 'expense' && (
                  <td className="p-4 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                    {cat.budget > 0 ? fmt(cat.budget) : <span className="text-gray-400 dark:text-gray-500 italic">Tidak ada limit</span>}
                  </td>
                )}
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleEdit(cat)} className="text-blue-400 hover:text-blue-600"><Edit2 size={16}/></button>
                    <button onClick={() => handleDelete(cat.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CategoryView;
