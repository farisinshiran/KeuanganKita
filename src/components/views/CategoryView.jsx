import React, { useState, useMemo } from 'react';
import { collection, addDoc, doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Icon from '../ui/Icon.jsx';
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
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <Icon name="category" size={28} className="text-primary"/>
            Kelola Kategori
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">Atur kategori transaksi dan budget bulanan</p>
        </div>
        <button
          onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', type: activeTab, budget: '' }); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${isFormOpen ? 'border-2 border-primary text-primary hover:bg-primary/5' : 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95'}`}
        >
          <Icon name={isFormOpen ? 'close' : 'add'} size={18}/>
          {isFormOpen ? 'Batal' : 'Tambah Kategori'}
        </button>
      </div>

      {/* Pill Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('expense')}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'expense' ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          Pengeluaran ({categories.expense?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${activeTab === 'income' ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
        >
          Pemasukan ({categories.income?.length || 0})
        </button>
      </div>

      {/* Add / Edit Form */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-surface-container-low p-6 rounded-2xl animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Tipe</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm">
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Nama Kategori</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm" placeholder="Contoh: Makan, Transport..." />
            </div>
            {form.type === 'expense' && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-on-surface-variant">Budget Bulanan (Rp)</label>
                <input type="number" value={form.budget} onChange={e => setForm({ ...form, budget: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm" placeholder="0 = Tidak ada limit" />
              </div>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="bg-primary text-on-primary px-6 py-2.5 rounded-xl flex items-center gap-2 font-semibold shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all">
              <Icon name="save" size={18}/> {form.id ? 'Simpan Perubahan' : 'Tambah Kategori'}
            </button>
          </div>
        </form>
      )}

      {/* Budget summary banner */}
      {activeTab === 'expense' && totalBudget > 0 && (
        <div className="bg-surface-container-low p-4 rounded-2xl flex items-center gap-3">
          <Icon name="account_balance_wallet" size={20} className="text-primary"/>
          <p className="text-sm text-on-surface">
            Total Budget Pengeluaran: <span className="font-bold text-primary">{fmt(totalBudget)}</span>
          </p>
        </div>
      )}

      {/* Category tile grid */}
      {displayedCategories.length === 0 ? (
        <div className="bg-surface-container-low rounded-2xl p-16 text-center">
          <Icon name="category" size={48} className="mx-auto text-outline mb-4"/>
          <p className="text-on-surface-variant text-lg font-medium">Belum ada kategori {activeTab === 'expense' ? 'pengeluaran' : 'pemasukan'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {displayedCategories.map(cat => (
            <div
              key={cat.id}
              className="bg-surface-container-low rounded-2xl p-4 group hover:bg-surface-container-high transition-all hover:shadow-sm flex flex-col gap-3"
            >
              <div className="flex justify-between items-start">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${activeTab === 'expense' ? 'bg-error-container text-on-error-container' : 'bg-secondary-container text-on-secondary-container'}`}>
                  {activeTab === 'expense' ? 'Pengeluaran' : 'Pemasukan'}
                </span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(cat)} className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors">
                    <Icon name="edit" size={15}/>
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-1 rounded-lg text-on-surface-variant hover:text-error hover:bg-error-container transition-colors">
                    <Icon name="delete" size={15}/>
                  </button>
                </div>
              </div>
              <p className="font-semibold text-on-surface leading-tight">{cat.name}</p>
              {activeTab === 'expense' && (
                <div className={`text-xs font-semibold px-2 py-1 rounded-lg self-start ${cat.budget > 0 ? 'bg-primary-fixed/30 text-primary' : 'text-outline'}`}>
                  {cat.budget > 0 ? fmt(cat.budget) : 'Tanpa limit'}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CategoryView;
