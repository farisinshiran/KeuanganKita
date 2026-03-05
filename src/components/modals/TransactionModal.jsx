import React, { useState } from 'react';
import { Plus, Save, X } from 'lucide-react';
import { collection, addDoc, doc, increment, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatDateInput } from '../../utils/formatters';

const createInitialFormData = () => ({
  id: null,
  type: 'expense',
  amount: '',
  category: '',
  walletId: '',
  sourceWalletId: '',
  targetWalletId: '',
  investmentId: '',
  note: '',
  date: formatDateInput(new Date())
});

const TransactionModal = ({ isOpen, onClose, categories, wallets, investments = [], userId, appId, fmt }) => {
  const [formData, setFormData] = useState(createInitialFormData);

  const switchType = (type) => {
    const base = { ...formData, type, category: '', sourceWalletId: '', targetWalletId: '', investmentId: '' };
    setFormData(type === 'transfer' ? { ...base, walletId: '' } : base);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(formData.amount);
    if (!(amount > 0)) {
      alert('Jumlah transaksi harus lebih dari 0');
      return;
    }

    const isInvestmentBuy = formData.type === 'investment';
    const isInvestmentSale = formData.type === 'investment_sale';
    const isInvestmentTx = isInvestmentBuy || isInvestmentSale;

    let selectedInvestment = null;
    if (isInvestmentTx) {
      if (!formData.walletId) {
        alert(isInvestmentSale ? 'Pilih kantong/akun tujuan hasil penjualan aset' : 'Pilih kantong/akun sumber dana investasi');
        return;
      }
      if (!formData.investmentId) {
        alert(isInvestmentSale ? 'Pilih aset investasi yang akan dijual' : 'Pilih aset investasi yang akan ditambah');
        return;
      }
      selectedInvestment = investments.find(inv => inv.id === formData.investmentId);
      if (!selectedInvestment) {
        alert('Aset investasi tidak ditemukan, silakan pilih ulang');
        return;
      }
      if (isInvestmentSale) {
        if ((Number(selectedInvestment.currentValue) || 0) < amount || (Number(selectedInvestment.purchaseValue) || 0) < amount) {
          alert('Nilai jual melebihi nilai aset yang tersedia');
          return;
        }
      }
    }

    const payload = {
      ...formData,
      amount,
      category: isInvestmentBuy ? 'Investasi' : isInvestmentSale ? 'Penjualan Aset' : formData.category,
      investmentName: isInvestmentTx ? (selectedInvestment?.name || '') : '',
      date: new Date(formData.date),
      updatedAt: serverTimestamp()
    };
    delete payload.id;

    try {
      if (formData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'transactions', formData.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), { ...payload, createdAt: serverTimestamp() });
        if (isInvestmentTx) {
          const delta = isInvestmentSale ? -amount : amount;
          await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'investments', formData.investmentId), {
            purchaseValue: increment(delta),
            currentValue: increment(delta),
            updatedAt: serverTimestamp()
          });
        }
      }
      setFormData(createInitialFormData());
      onClose();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan transaksi');
    }
  };

  const cats = formData.type === 'expense' ? categories.expense : categories.income;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Plus size={24} className="text-emerald-600 dark:text-emerald-400"/>
            Transaksi Baru
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={24}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jenis Transaksi</label>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>switchType('income')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='income'?'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 ring-2 ring-green-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pemasukan</button>
                  <button type="button" onClick={()=>switchType('expense')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='expense'?'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 ring-2 ring-red-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pengeluaran</button>
                  <button type="button" onClick={()=>switchType('investment')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='investment'?'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Investasi</button>
                  <button type="button" onClick={()=>switchType('investment_sale')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='investment_sale'?'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Jual Aset</button>
                  <button type="button" onClick={()=>switchType('transfer')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='transfer'?'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Transfer</button>
                </div>
             </div>

             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jumlah (Rp)</label>
                <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
             </div>

             {formData.type === 'transfer' ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Dari (Sumber)</label>
                    <select required value={formData.sourceWalletId} onChange={e=>setFormData({...formData, sourceWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white">
                      <option value="">Pilih Sumber...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Ke (Tujuan)</label>
                    <select required value={formData.targetWalletId} onChange={e=>setFormData({...formData, targetWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white">
                      <option value="">Pilih Tujuan...</option>
                      {wallets.filter(w => w.id !== formData.sourceWalletId).map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                </>
             ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kantong / Akun</label>
                    <select required value={formData.walletId} onChange={e=>setFormData({...formData, walletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white">
                      <option value="">Pilih Akun...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                  {formData.type === 'investment' || formData.type === 'investment_sale' ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Portofolio Aset</label>
                      <select required value={formData.investmentId} onChange={e=>setFormData({...formData, investmentId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white transition-all">
                        <option value="">Pilih Aset...</option>
                        {investments.map(inv=><option key={inv.id} value={inv.id}>{inv.icon || '💼'} {inv.name} ({fmt(inv.currentValue || 0)})</option>)}
                      </select>
                      {investments.length === 0 && <p className="text-xs text-amber-600 dark:text-amber-400">Belum ada aset portofolio. Tambahkan aset dulu di menu Investasi.</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori</label>
                      <select required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white transition-all"><option value="">Pilih Kategori...</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    </div>
                  )}
                </>
             )}

             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Tanggal</label>
                <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white"/>
             </div>
             <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Catatan</label>
                <input value={formData.note} onChange={e=>setFormData({...formData, note:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="Opsional"/>
             </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Batal</button>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 transition-all"><Save size={18}/> Simpan Transaksi</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
