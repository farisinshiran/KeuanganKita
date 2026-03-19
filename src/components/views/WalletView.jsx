import React, { useState } from 'react';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Icon from '../ui/Icon.jsx';

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

  const WALLET_CONFIG = {
    bank:        { icon: 'account_balance',        label: 'Bank',         colorClass: 'text-primary' },
    ewallet:     { icon: 'account_balance_wallet', label: 'E-Wallet',     colorClass: 'text-secondary' },
    cash:        { icon: 'payments',               label: 'Tunai',        colorClass: 'text-tertiary' },
    credit_card: { icon: 'credit_card',            label: 'Kartu Kredit', colorClass: 'text-error' },
    paylater:    { icon: 'credit_score',           label: 'PayLater',     colorClass: 'text-error' },
    rdn:         { icon: 'verified',               label: 'RDN',          colorClass: 'text-secondary' },
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* â”€â”€ Page header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-on-surface">Rekening & Kartu Kredit</h2>
        <button
          onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' }); }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${isFormOpen ? 'border-2 border-primary text-primary hover:bg-primary/5' : 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95'}`}
        >
          <Icon name={isFormOpen ? 'close' : 'add'} size={18} />
          {isFormOpen ? 'Batal' : 'Tambah Akun'}
        </button>
      </div>

      {/* â”€â”€ Add / Edit Form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-surface-container-low p-6 rounded-2xl animate-in fade-in slide-in-from-top-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-on-surface-variant">Tipe Akun</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm">
              <option value="bank">Bank</option>
              <option value="ewallet">E-Wallet</option>
              <option value="cash">Tunai</option>
              <option value="credit_card">Kartu Kredit</option>
              <option value="paylater">PayLater</option>
              <option value="rdn">RDN</option>
            </select>
          </div>
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-on-surface-variant">Icon (Emoji)</label>
            <input value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} placeholder="ðŸ’°" className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-center text-lg text-on-surface" />
          </div>
          <div className="space-y-1.5 lg:col-span-2">
            <label className="text-xs font-semibold text-on-surface-variant">Nama Akun</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Contoh: BCA / GoPay" className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" />
          </div>
          <div className="space-y-1.5 lg:col-span-1">
            <label className="text-xs font-semibold text-on-surface-variant">Saldo Awal (Rp)</label>
            <input type="number" value={form.initialBalance} onChange={e => setForm({ ...form, initialBalance: e.target.value })} placeholder="0" className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" />
          </div>
          {form.type === 'credit_card' && (
            <div className="space-y-1.5 lg:col-span-1">
              <label className="text-xs font-semibold text-on-surface-variant">Limit Pagu (Rp)</label>
              <input type="number" value={form.limit} onChange={e => setForm({ ...form, limit: e.target.value })} placeholder="Limit Kredit" className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" />
            </div>
          )}
          <button type="submit" className="md:col-span-2 lg:col-span-1 bg-primary text-on-primary px-6 py-2.5 rounded-xl flex items-center justify-center gap-2 font-semibold shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all h-[46px]">
            <Icon name="save" size={18} /> {form.id ? 'Simpan' : 'Tambah'}
          </button>
        </form>
      )}

      {/* â”€â”€ Wallet Grid â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {wallets.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-outline-variant/30 rounded-2xl text-on-surface-variant">
          <Icon name="account_balance_wallet" size={48} className="mx-auto opacity-30 mb-3" />
          <p className="font-medium">Belum ada akun. Tambahkan akun pertama Anda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wallets.map(w => {
            const cfg = WALLET_CONFIG[w.type] || WALLET_CONFIG.bank;
            const isDebt = w.type === 'credit_card' || w.type === 'paylater';
            return (
              <div
                key={w.id}
                className="bg-surface-container-low p-5 rounded-2xl hover:ring-1 hover:ring-primary/20 transition-all cursor-pointer group relative"
                onClick={() => handleWalletClick(w)}
              >
                {/* Edit/Delete actions */}
                <div className="absolute right-4 top-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-surface-container-low rounded-xl p-1 shadow-sm">
                  <button onClick={e => { e.stopPropagation(); handleEdit(w); }} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors">
                    <Icon name="edit" size={16} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(w.id); }} className="p-1.5 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                    <Icon name="delete" size={16} />
                  </button>
                </div>

                {/* Wallet type badge + name */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`p-2.5 rounded-2xl bg-surface-container-lowest`}>
                    {w.icon ? (
                      <span className="text-2xl leading-none">{w.icon}</span>
                    ) : (
                      <Icon name={cfg.icon} size={22} className={cfg.colorClass} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface">{w.name}</h3>
                    <p className="text-xs text-on-surface-variant uppercase tracking-wider font-medium">{cfg.label}</p>
                  </div>
                </div>

                {/* Balance */}
                <div className="pt-4 border-t border-outline-variant/20">
                  <p className="text-xs text-on-surface-variant mb-1">{isDebt ? 'Total Tagihan' : 'Saldo Saat Ini'}</p>
                  <p className={`text-2xl font-bold ${isDebt ? 'text-error' : 'text-on-surface'}`}>
                    {isDebt ? fmt(Math.abs(w.currentBalance)) : fmt(w.currentBalance)}
                  </p>
                  {w.initialBalance !== 0 && (
                    <p className="text-xs text-on-surface-variant mt-1">Awal: {fmt(w.initialBalance)}</p>
                  )}

                  {/* Credit card usage bar */}
                  {w.type === 'credit_card' && w.limit > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-on-surface-variant mb-1.5">
                        <span>Terpakai {((Math.abs(w.currentBalance) / w.limit) * 100).toFixed(0)}%</span>
                        <span>Limit: {fmt(w.limit)}</span>
                      </div>
                      <div className="w-full bg-error-container/30 rounded-full h-1.5">
                        <div className="bg-error h-1.5 rounded-full transition-all" style={{ width: `${Math.min((Math.abs(w.currentBalance) / w.limit) * 100, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* â”€â”€ Transaction Detail Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {isTransactionModalOpen && selectedWallet && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in" onClick={() => setIsTransactionModalOpen(false)}>
          <div className="bg-surface-container-lowest rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>

            {/* Modal header */}
            <div className="bg-primary text-on-primary p-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/20 rounded-2xl">
                    {selectedWallet.icon ? (
                      <span className="text-2xl">{selectedWallet.icon}</span>
                    ) : (
                      <Icon name={(WALLET_CONFIG[selectedWallet.type] || WALLET_CONFIG.bank).icon} size={24} />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">{selectedWallet.name}</h2>
                    <p className="text-sm opacity-70 uppercase tracking-wider">{(WALLET_CONFIG[selectedWallet.type] || WALLET_CONFIG.bank).label}</p>
                  </div>
                </div>
                <button onClick={() => setIsTransactionModalOpen(false)} className="p-2 rounded-xl hover:bg-white/20 transition-colors">
                  <Icon name="close" size={22} />
                </button>
              </div>
              <div className="mt-4">
                <p className="text-sm opacity-70 mb-1">{selectedWallet.type === 'credit_card' ? 'Total Tagihan' : 'Saldo Saat Ini'}</p>
                <p className="text-3xl font-bold">{selectedWallet.type === 'credit_card' ? fmt(Math.abs(selectedWallet.currentBalance)) : fmt(selectedWallet.currentBalance)}</p>
              </div>
            </div>

            {/* Transaction list */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 200px)' }}>
              <h3 className="font-semibold text-on-surface mb-4 flex items-center gap-2">
                <Icon name="receipt_long" size={18} className="text-primary" />
                Riwayat Transaksi ({getWalletTransactions().length})
              </h3>

              {getWalletTransactions().length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant">
                  <Icon name="receipt" size={48} className="mx-auto opacity-30 mb-3" />
                  <p>Belum ada transaksi untuk akun ini</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-container-low">
                        <th className="text-left py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider first:rounded-l-xl">Tanggal</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Kategori</th>
                        <th className="text-left py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider hidden sm:table-cell">Catatan</th>
                        <th className="text-right py-3 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider last:rounded-r-xl">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getWalletTransactions().map((t, idx) => {
                        const isIncome = t.type === 'income';
                        const isInvestmentSale = t.type === 'investment_sale';
                        const isTransfer = t.type === 'transfer';
                        const isTransferOut = isTransfer && t.sourceWalletId === selectedWallet.id;
                        const isTransferIn = isTransfer && t.targetWalletId === selectedWallet.id;
                        const isPositive = isIncome || isTransferIn || isInvestmentSale;
                        const isNegative = t.type === 'expense' || isTransferOut;

                        return (
                          <tr key={t.id || idx} className="border-b border-outline-variant/10 hover:bg-surface-container-high/40 transition-colors">
                            <td className="py-3 px-3 text-sm text-on-surface-variant">
                              {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isPositive ? 'bg-secondary-container text-on-secondary-container' : isNegative ? 'bg-error-container text-on-error-container' : 'bg-surface-container text-on-surface-variant'}`}>
                                {isTransfer ? (isTransferOut ? 'Transfer Keluar' : 'Transfer Masuk') : (isInvestmentSale ? 'Penjualan Aset' : (t.category || 'Lainnya'))}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-sm text-on-surface hidden sm:table-cell">{t.note || '-'}</td>
                            <td className={`py-3 px-3 text-right font-bold text-sm ${isPositive ? 'text-secondary' : isNegative ? 'text-error' : 'text-on-surface-variant'}`}>
                              {isPositive && '+'}{isNegative && '-'}{fmt(t.amount)}
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
