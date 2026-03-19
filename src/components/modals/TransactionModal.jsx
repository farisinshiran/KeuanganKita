import React, { useState } from 'react';
import Icon from '../ui/Icon.jsx';
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
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface-container-lowest border-b border-outline-variant/20 p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
            <Icon name="add" size={24} className="text-primary"/>
            Transaksi Baru
          </h2>
          <button onClick={onClose} className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors">
            <Icon name="close" size={22}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant">Jenis Transaksi</label>
                <div className="flex gap-1.5 flex-wrap">
                  <button type="button" onClick={()=>switchType('income')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${formData.type==='income'?'bg-secondary-container text-on-secondary-container ring-1 ring-secondary/30':'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>Pemasukan</button>
                  <button type="button" onClick={()=>switchType('expense')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${formData.type==='expense'?'bg-error-container text-on-error-container ring-1 ring-error/30':'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>Pengeluaran</button>
                  <button type="button" onClick={()=>switchType('investment')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${formData.type==='investment'?'bg-tertiary-container text-on-tertiary-container ring-1 ring-tertiary/30':'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>Investasi</button>
                  <button type="button" onClick={()=>switchType('investment_sale')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${formData.type==='investment_sale'?'bg-primary-container text-on-primary-container ring-1 ring-primary/30':'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>Jual Aset</button>
                  <button type="button" onClick={()=>switchType('transfer')} className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${formData.type==='transfer'?'bg-surface-container-highest text-on-surface ring-1 ring-outline/30':'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>Transfer</button>
                </div>
             </div>

             <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant">Jumlah (Rp)</label>
                <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="0"/>
             </div>

             {formData.type === 'transfer' ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-on-surface-variant">Dari (Sumber)</label>
                    <select required value={formData.sourceWalletId} onChange={e=>setFormData({...formData, sourceWalletId:e.target.value})} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                      <option value="">Pilih Sumber...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-on-surface-variant">Ke (Tujuan)</label>
                    <select required value={formData.targetWalletId} onChange={e=>setFormData({...formData, targetWalletId:e.target.value})} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                      <option value="">Pilih Tujuan...</option>
                      {wallets.filter(w => w.id !== formData.sourceWalletId).map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                </>
             ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-on-surface-variant">Kantong / Akun</label>
                    <select required value={formData.walletId} onChange={e=>setFormData({...formData, walletId:e.target.value})} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                      <option value="">Pilih Akun...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                  {formData.type === 'investment' || formData.type === 'investment_sale' ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-on-surface-variant">Portofolio Aset</label>
                      <select required value={formData.investmentId} onChange={e=>setFormData({...formData, investmentId:e.target.value})} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                        <option value="">Pilih Aset...</option>
                        {investments.map(inv=><option key={inv.id} value={inv.id}>{inv.icon || '💼'} {inv.name} ({fmt(inv.currentValue || 0)})</option>)}
                      </select>
                      {investments.length === 0 && <p className="text-xs text-tertiary bg-tertiary-container/30 p-2 rounded-xl">Belum ada aset portofolio. Tambahkan aset dulu di menu Investasi.</p>}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-on-surface-variant">Kategori</label>
                      <select required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"><option value="">Pilih Kategori...</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
                    </div>
                  )}
                </>
             )}

             <div className="space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant">Tanggal</label>
                <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"/>
             </div>
             <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-semibold text-on-surface-variant">Catatan</label>
                <input value={formData.note} onChange={e=>setFormData({...formData, note:e.target.value})} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="Opsional"/>
             </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-xl font-medium text-on-surface-variant hover:bg-surface-container transition-colors">Batal</button>
            <button type="submit" className="bg-primary text-on-primary px-8 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all"><Icon name="save" size={18}/> Simpan Transaksi</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;
