import React, { useState, useMemo } from 'react';
import Icon from '../ui/Icon.jsx';
import { collection, addDoc, doc, increment, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatDate, formatDateInput } from '../../utils/formatters';

const exportToCSV = (transactions, wallets) => {
  const walletMap = new Map((wallets || []).map(w => [w.id, w]));
  const header = ['Tanggal', 'Jenis', 'Jumlah', 'Kategori', 'Rekening', 'Catatan'];
  const rows = transactions.map(t => {
    const w     = walletMap.get(t.walletId);
    const wSrc  = walletMap.get(t.sourceWalletId);
    const wTgt  = walletMap.get(t.targetWalletId);
    const typeLabel = { income: 'Pemasukan', expense: 'Pengeluaran', investment: 'Investasi', investment_sale: 'Jual Aset', transfer: 'Transfer' }[t.type] || t.type;
    const acct  = t.type === 'transfer'
      ? `${wSrc?.name || '?'} → ${wTgt?.name || '?'}`
      : w?.name || '-';
    const cat   = t.type === 'transfer' ? 'Mutasi Saldo' : (t.category || '-');
    const dateStr = t.date ? t.date.toLocaleDateString('id-ID') : '-';
    return [dateStr, typeLabel, t.amount, cat, acct, t.note || ''].map(v => `"${String(v).replace(/"/g, '""')}"`);
  });
  const csv = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `transaksi-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

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

const TransactionView = ({ transactions, categories, wallets, investments = [], userId, appId, fmt }) => {
  const [formData, setFormData] = useState(createInitialFormData);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', walletId: '' });
  const [typeFilter, setTypeFilter] = useState('');

  const investmentMap = useMemo(
    () => new Map((investments || []).map(inv => [inv.id, inv])),
    [investments]
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = t.date;
      if (!d || isNaN(d.getTime())) return false;

      let matchesDate = true;
      if (filters.startDate) matchesDate = matchesDate && d >= new Date(filters.startDate);
      if (filters.endDate) {
        const e = new Date(filters.endDate);
        e.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && d <= e;
      }

      let matchesWallet = true;
      if (filters.walletId) {
        matchesWallet = t.walletId === filters.walletId || t.sourceWalletId === filters.walletId || t.targetWalletId === filters.walletId;
      }

      const matchesType = !typeFilter || t.type === typeFilter;
      return matchesDate && matchesWallet && matchesType;
    });
  }, [transactions, filters, typeFilter]);

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
      selectedInvestment = investmentMap.get(formData.investmentId);
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
      setIsFormOpen(false);
      setFormData(createInitialFormData());
    } catch (err) { console.error(err); }
  };

  const handleEdit = (t) => {
    setFormData({ id: t.id, type: t.type, amount: t.amount, category: t.category || '', walletId: t.walletId || '', sourceWalletId: t.sourceWalletId || '', targetWalletId: t.targetWalletId || '', investmentId: t.investmentId || '', note: t.note, date: formatDateInput(t.date) });
    setIsFormOpen(true);
  };

  const switchType = (type) => {
    const base = { ...formData, type, category: '', sourceWalletId: '', targetWalletId: '', investmentId: '' };
    setFormData(type === 'transfer' ? { ...base, walletId: '' } : base);
  };

  const handleDelete = async (id) => { if (confirm('Hapus transaksi?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'transactions', id)); };

  const cats = formData.type === 'expense' ? categories.expense : categories.income;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-on-surface">Transaksi</h2>
        <div className="flex gap-2">
          <button onClick={() => exportToCSV(filteredTransactions, wallets)} className="bg-surface-container-low text-on-surface-variant px-3 py-2 rounded-xl flex gap-1.5 items-center hover:bg-surface-container transition-colors text-sm"><Icon name="download" size={16}/> Export CSV</button>
          <button onClick={() => { setIsFormOpen(!isFormOpen); setFormData(createInitialFormData()); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${isFormOpen ? 'border-2 border-primary text-primary hover:bg-primary/5' : 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95'}`}><Icon name={isFormOpen ? 'close' : 'add'} size={18}/> <span>{isFormOpen ? 'Batal' : 'Baru'}</span></button>
        </div>
      </div>

      {/* TYPE FILTER CHIPS + FILTER BAR */}
      <div className="space-y-3">
        <div className="flex gap-2 flex-wrap">
          {[{ label: 'Semua', value: '' }, { label: 'Pemasukan', value: 'income' }, { label: 'Pengeluaran', value: 'expense' }, { label: 'Investasi', value: 'investment' }, { label: 'Jual Aset', value: 'investment_sale' }, { label: 'Transfer', value: 'transfer' }].map(({ label, value }) => (
            <button key={value} onClick={() => setTypeFilter(value)} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${typeFilter === value ? 'bg-primary text-on-primary shadow-sm' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>{label}</button>
          ))}
        </div>
        <div className="bg-surface-container-low p-4 rounded-2xl flex flex-col md:flex-row gap-3 items-end">
          <div className="w-full md:w-auto flex items-center gap-2 text-on-surface-variant text-sm font-semibold">
            <Icon name="filter_list" size={16}/> Filter:
          </div>
          <div className="w-full md:w-auto space-y-1">
            <label className="text-xs text-on-surface-variant">Dari Tanggal</label>
            <input type="date" value={filters.startDate} onChange={e=>setFilters({...filters, startDate:e.target.value})} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary/20 text-on-surface"/>
          </div>
          <div className="w-full md:w-auto space-y-1">
            <label className="text-xs text-on-surface-variant">Sampai Tanggal</label>
            <input type="date" value={filters.endDate} onChange={e=>setFilters({...filters, endDate:e.target.value})} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl text-sm outline-none focus:ring-1 focus:ring-primary/20 text-on-surface"/>
          </div>
          <div className="w-full md:w-auto space-y-1 flex-1">
            <label className="text-xs text-on-surface-variant">Rekening / Dompet</label>
            <select value={filters.walletId} onChange={e=>setFilters({...filters, walletId:e.target.value})} className="w-full p-2 bg-surface-container-lowest border-none rounded-xl text-sm outline-none text-on-surface">
              <option value="">Semua Rekening</option>
              {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <button onClick={()=>{ setFilters({startDate:'', endDate:'', walletId:''}); setTypeFilter(''); }} className="text-sm text-error hover:text-error/80 underline pb-2">Reset</button>
        </div>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 mb-6 transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jenis Transaksi</label>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>switchType('income')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='income'?'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 ring-2 ring-green-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pemasukan</button>
                  <button type="button" onClick={()=>switchType('expense')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='expense'?'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 ring-2 ring-red-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pengeluaran</button>
                  <button type="button" onClick={()=>switchType('investment')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='investment'?'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 ring-2 ring-amber-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Investasi</button>
                  <button type="button" onClick={()=>switchType('investment_sale')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='investment_sale'?'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700 ring-2 ring-indigo-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Jual Aset</button>
                  <button type="button" onClick={()=>switchType('transfer')} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='transfer'?'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Mutasi / Transfer</button>
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
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name} ({fmt(w.currentBalance)})</option>)}
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
                <input value={formData.note} onChange={e=>setFormData({...formData, note:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="Opsional (misal: Mutasi ke e-wallet)"/>
             </div>
          </div>
          <div className="flex justify-end"><button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-200/50 transition-all"><Save size={18}/> {formData.id ? 'Update Data' : 'Simpan Transaksi'}</button></div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600"><tr><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">TANGGAL</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">AKUN/DETAIL</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">KATEGORI</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">CATATAN</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300 text-right">JUMLAH</th><th className="p-4 w-20"></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredTransactions.length===0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-400 dark:text-gray-500">Belum ada data</td></tr> : filteredTransactions.map(t => {
                const w = wallets.find(x => x.id === t.walletId);
                const wSource = wallets.find(x => x.id === t.sourceWalletId);
                const wTarget = wallets.find(x => x.id === t.targetWalletId);
                const linkedInvestment = t.investmentId ? investmentMap.get(t.investmentId) : null;

                return (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 group transition-colors">
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="p-4 text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {t.type === 'transfer' ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500">{wSource?.icon} {wSource?.name || '?'}</span>
                          <ArrowRightLeft size={10} />
                          <span className="text-gray-900 dark:text-white font-bold">{wTarget?.icon} {wTarget?.name || '?'}</span>
                        </div>
                      ) : t.type === 'investment' ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Briefcase size={12}/> {linkedInvestment?.name || t.investmentName || 'Investasi'}</span>
                      ) : t.type === 'investment_sale' ? (
                        <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><Briefcase size={12}/> {linkedInvestment?.name || t.investmentName || 'Penjualan Aset'}</span>
                      ) : (
                        w ? <span>{w.icon} {w.name}</span> : <span className="text-gray-400 italic">Terhapus</span>
                      )}
                    </td>
                    <td className="p-4 text-sm">
                      {t.type === 'transfer' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Mutasi Saldo</span>
                      ) : t.type === 'investment' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Beli Aset</span>
                      ) : t.type === 'investment_sale' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Jual Aset</span>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type==='income'?'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400':'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{t.category}</span>
                      )}
                      {t.subscriptionId && (<span className="ml-2" title="Dibuat otomatis"><Bot size={12} className="inline text-purple-500"/></span>)}
                      {t.quickAddSource && (<span className="ml-2" title="Ditambahkan via Tambah Cepat AI Scanner"><ScanLine size={12} className="inline text-emerald-500"/></span>)}
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{t.note||'-'}</td>
                    <td className={`p-4 text-sm font-medium text-right whitespace-nowrap ${t.type==='income' || t.type === 'investment_sale' ?'text-green-600 dark:text-green-400': t.type === 'expense' || t.type === 'investment' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {t.type==='income' || t.type === 'investment_sale' ? '+' : (t.type === 'expense' || t.type === 'investment') ? '-' : ''}{fmt(t.amount)}
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.type !== 'investment' && t.type !== 'investment_sale' && (<button onClick={()=>handleEdit(t)} className="text-blue-400 hover:text-blue-600"><Edit2 size={16}/></button>)}
                      <button onClick={()=>handleDelete(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {filteredTransactions.length===0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Belum ada data</div>
          ) : filteredTransactions.map(t => {
            const w = wallets.find(x => x.id === t.walletId);
            const wSource = wallets.find(x => x.id === t.sourceWalletId);
            const wTarget = wallets.find(x => x.id === t.targetWalletId);
            const linkedInvestment = t.investmentId ? investmentMap.get(t.investmentId) : null;

            return (
              <div key={t.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(t.date)}</p>
                    <div className="mt-1 text-sm text-gray-700 dark:text-gray-200 font-medium">
                      {t.type === 'transfer' ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500">{wSource?.icon} {wSource?.name || '?'}</span>
                          <ArrowRightLeft size={10} />
                          <span className="text-gray-900 dark:text-white font-bold">{wTarget?.icon} {wTarget?.name || '?'}</span>
                        </div>
                      ) : t.type === 'investment' ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Briefcase size={12}/> {linkedInvestment?.name || t.investmentName || 'Investasi'}</span>
                      ) : t.type === 'investment_sale' ? (
                        <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><Briefcase size={12}/> {linkedInvestment?.name || t.investmentName || 'Penjualan Aset'}</span>
                      ) : (
                        w ? <span>{w.icon} {w.name}</span> : <span className="text-gray-400 italic">Terhapus</span>
                      )}
                    </div>
                  </div>
                  <div className={`text-sm font-bold whitespace-nowrap ${t.type==='income' || t.type === 'investment_sale' ?'text-green-600 dark:text-green-400': t.type === 'expense' || t.type === 'investment' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {t.type==='income' || t.type === 'investment_sale' ? '+' : (t.type === 'expense' || t.type === 'investment') ? '-' : ''}{fmt(t.amount)}
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  {t.type === 'transfer' ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Mutasi Saldo</span>
                  ) : t.type === 'investment' ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Beli Aset</span>
                  ) : t.type === 'investment_sale' ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Jual Aset</span>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type==='income'?'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400':'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{t.category}</span>
                  )}
                  {t.subscriptionId && (<span title="Dibuat otomatis"><Bot size={12} className="text-purple-500"/></span>)}
                  {t.quickAddSource && (<span title="Ditambahkan via Tambah Cepat AI Scanner"><ScanLine size={12} className="text-emerald-500"/></span>)}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{t.note||'-'}</p>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {t.type !== 'investment' && t.type !== 'investment_sale' && (
                    <button onClick={()=>handleEdit(t)} className="min-h-[40px] px-3 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1">
                      <Edit2 size={14}/> Edit
                    </button>
                  )}
                  <button onClick={()=>handleDelete(t.id)} className="min-h-[40px] px-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1">
                    <Trash2 size={14}/> Hapus
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

export default TransactionView;
