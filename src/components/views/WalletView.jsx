import React, { useState } from 'react';
import { Plus, Save, X, Edit2, Trash2, Landmark, Smartphone, Banknote, CreditCard, Briefcase, TrendingUp } from 'lucide-react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

const WalletView = ({ wallets, transactions, userId, appId, fmt }) => {
  const [form, setForm] = useState({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    try {
      const payload = { 
        name: form.name, 
        type: form.type, 
        initialBalance: Number(form.initialBalance)||0,
        limit: form.type === 'credit_card' ? (Number(form.limit)||0) : 0,
        icon: form.icon
      };

      if (form.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'wallets', form.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'wallets'), payload);
      }
      setForm({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' });
      setIsFormOpen(false);
    } catch(err) { console.error(err); }
  };

  const handleEdit = (w) => {
    setForm({ id: w.id, name: w.name, type: w.type, initialBalance: w.initialBalance, limit: w.limit || '', icon: w.icon || '' });
    setIsFormOpen(true);
  }

  const handleDelete = async (id) => {
    if(confirm('Hapus akun ini? Transaksi terkait akan tetap ada tapi tanpa nama akun.')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'wallets', id));
    }
  };

  const handleWalletClick = (wallet) => {
    setSelectedWallet(wallet);
    setIsTransactionModalOpen(true);
  };

  const getWalletTransactions = () => {
    if (!selectedWallet || !transactions) return [];
    
    return transactions.filter(t => {
      if (t.walletId === selectedWallet.id) return true;
      if (t.sourceWalletId === selectedWallet.id) return true;
      if (t.targetWalletId === selectedWallet.id) return true;
      return false;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Rekening & Kartu Kredit</h2>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">{isFormOpen ? <X size={18}/> : <Plus size={18}/>} <span>{isFormOpen ? 'Batal' : 'Tambah'}</span></button>
      </div>
      
      {isFormOpen && (
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end transition-colors duration-300 animate-in fade-in slide-in-from-top-4">
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tipe Akun</label>
           <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
             <option value="bank">Bank</option>
             <option value="ewallet">E-Wallet</option>
             <option value="cash">Tunai</option>
             <option value="credit_card">Kartu Kredit</option>
             <option value="paylater">PayLater (GoPay Later, Kredivo, dll.)</option>
             <option value="rdn">RDN (Rekening Dana Nasabah)</option>
           </select>
        </div>
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Icon (Emoji)</label>
           <input value={form.icon} onChange={e=>setForm({...form, icon:e.target.value})} placeholder="Contoh: 💰" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white text-center text-lg"/>
        </div>
        <div className="space-y-1 lg:col-span-2">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Akun</label>
           <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Contoh: BCA / Kartu Kredit" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
        </div>
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Saldo Awal (Rp)</label>
           <input type="number" value={form.initialBalance} onChange={e=>setForm({...form, initialBalance:e.target.value})} placeholder="0" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
        </div>
        {form.type === 'credit_card' && (
          <div className="space-y-1 lg:col-span-1">
             <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Limit Pagu (Rp)</label>
             <input type="number" value={form.limit} onChange={e=>setForm({...form, limit:e.target.value})} placeholder="Limit Kredit" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
          </div>
        )}
        <button type="submit" className="md:col-span-2 lg:col-span-1 bg-emerald-600 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors h-[46px]"><Save size={18}/> {form.id ? 'Simpan' : 'Tambah'}</button>
      </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map(w => (
          <div key={w.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between duration-300 group relative cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all" onClick={() => handleWalletClick(w)}>
             <div className="flex justify-between items-start">
               <div className="flex items-center gap-3">
                 <div className="text-3xl p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                   {w.icon || (
                     w.type === 'bank' ? <Landmark size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'ewallet' ? <Smartphone size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'cash' ? <Banknote size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'credit_card' ? <CreditCard size={24} className="text-red-500"/> :
                     w.type === 'paylater' ? <CreditCard size={24} className="text-orange-500"/> :
                     <Briefcase size={24} className="text-amber-600 dark:text-amber-400"/>
                   )}
                 </div>
                 <div>
                   <h3 className="font-bold text-gray-800 dark:text-gray-100">{w.name}</h3>
                   <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{w.type.replace('_', ' ')}</p>
                 </div>
               </div>
               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm">
                  <button onClick={(e)=>{e.stopPropagation();handleEdit(w)}} className="text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1 rounded"><Edit2 size={16}/></button>
                  <button onClick={(e)=>{e.stopPropagation();handleDelete(w.id)}} className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"><Trash2 size={16}/></button>
               </div>
             </div>
             <div className="mt-4 pt-4 border-t border-dashed dark:border-gray-700">
               <div className="flex justify-between items-end mb-1">
                 <div>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{w.type === 'credit_card' || w.type === 'paylater' ? 'Total Tagihan' : 'Saldo Saat Ini'}</p>
                   <p className={`text-xl font-bold ${w.type === 'credit_card' || w.type === 'paylater' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                     {w.type === 'credit_card' || w.type === 'paylater' ? fmt(Math.abs(w.currentBalance)) : fmt(w.currentBalance)}
                   </p>
                 </div>
                 {w.initialBalance !== 0 && <span className="text-[10px] text-gray-400">Awal: {fmt(w.initialBalance)}</span>}
               </div>
               {w.type === 'credit_card' && w.limit > 0 && (
                 <div className="mt-2 text-xs">
                   <div className="flex justify-between mb-1 text-gray-500 dark:text-gray-400">
                     <span>Terpakai {((Math.abs(w.currentBalance)/w.limit)*100).toFixed(0)}%</span>
                     <span>Limit: {fmt(w.limit)}</span>
                   </div>
                   <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                     <div className="bg-red-500 h-1.5 rounded-full transition-all" style={{width: `${Math.min((Math.abs(w.currentBalance)/w.limit)*100, 100)}%`}}></div>
                   </div>
                 </div>
               )}
             </div>
          </div>
        ))}
      </div>

      {/* Transaction List Modal */}
      {isTransactionModalOpen && selectedWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in" onClick={() => setIsTransactionModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="text-4xl p-3 bg-white/20 rounded-xl">
                    {selectedWallet.icon || (
                      selectedWallet.type === 'bank' ? <Landmark size={28}/> :
                      selectedWallet.type === 'ewallet' ? <Smartphone size={28}/> :
                      selectedWallet.type === 'cash' ? <Banknote size={28}/> :
                      selectedWallet.type === 'credit_card' ? <CreditCard size={28}/> :
                      selectedWallet.type === 'paylater' ? <CreditCard size={28} className="text-orange-400"/> :
                      <Briefcase size={28}/>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedWallet.name}</h2>
                    <p className="text-emerald-100 text-sm uppercase tracking-wider">{selectedWallet.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <button onClick={() => setIsTransactionModalOpen(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                  <X size={24}/>
                </button>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-emerald-100 text-sm">{selectedWallet.type === 'credit_card' ? 'Total Tagihan' : 'Saldo Saat Ini'}:</span>
                <span className="text-3xl font-bold">{selectedWallet.type === 'credit_card' ? fmt(Math.abs(selectedWallet.currentBalance)) : fmt(selectedWallet.currentBalance)}</span>
              </div>
            </div>

            <div className="p-6 overflow-y-auto" style={{maxHeight: 'calc(85vh - 180px)'}}>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-600"/>
                Riwayat Transaksi ({getWalletTransactions().length})
              </h3>
              
              {getWalletTransactions().length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-2">
                    <TrendingUp size={48} className="mx-auto opacity-30"/>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">Belum ada transaksi untuk akun ini</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Catatan</th>
                        <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getWalletTransactions().map((t, idx) => {
                        const isIncome = t.type === 'income';
                        const isExpense = t.type === 'expense';
                        const isInvestmentSale = t.type === 'investment_sale';
                        const isTransfer = t.type === 'transfer';
                        const isTransferOut = isTransfer && t.sourceWalletId === selectedWallet.id;
                        const isTransferIn = isTransfer && t.targetWalletId === selectedWallet.id;
                        
                        return (
                          <tr key={t.id || idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-300">
                              {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {isTransfer ? (isTransferOut ? 'Transfer Keluar' : 'Transfer Masuk') : (isInvestmentSale ? 'Penjualan Aset' : (t.category || 'Lainnya'))}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-sm text-gray-800 dark:text-gray-200">
                              {t.note || '-'}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <span className={`font-bold text-sm ${
                                isIncome || isTransferIn || isInvestmentSale ? 'text-emerald-600 dark:text-emerald-400' :
                                isExpense || isTransferOut ? 'text-red-600 dark:text-red-400' :
                                'text-gray-600 dark:text-gray-400'
                              }`}>
                                {(isIncome || isTransferIn || isInvestmentSale) && '+'}
                                {(isExpense || isTransferOut) && '-'}
                                {fmt(t.amount)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WalletView;
