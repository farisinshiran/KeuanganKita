import React, { useState, useMemo } from 'react';
import { Plus, Save, X, Edit2, Trash2, Calendar, Coins, ListFilter, Globe, RefreshCw, Wallet } from 'lucide-react';
import { collection, addDoc, doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { formatDateInput } from '../../utils/formatters';
import { CURRENCIES } from '../../constants/currencies';

const fetchExchangeRate = async (currency) => {
  if (currency === 'IDR') return 1;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=IDR`);
    const data = await res.json();
    return data.rates.IDR;
  } catch (error) {
    console.error("Gagal mengambil kurs:", error);
    return null;
  }
};

const getSubscriptionIcon = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('netflix')) return '🎬';
  if (n.includes('spotify')) return '🎵';
  if (n.includes('youtube')) return '▶️';
  if (n.includes('disney')) return '🏰';
  if (n.includes('apple')) return '🍎';
  if (n.includes('google')) return '🔍';
  if (n.includes('amazon')) return '📦';
  if (n.includes('microsoft') || n.includes('office') || n.includes('365')) return '💼';
  if (n.includes('canva')) return '🎨';
  if (n.includes('chatgpt') || n.includes('openai')) return '🤖';
  if (n.includes('github')) return '💻';
  if (n.includes('notion')) return '📝';
  if (n.includes('figma')) return '🎯';
  if (n.includes('zoom')) return '📹';
  if (n.includes('slack')) return '💬';
  if (n.includes('dropbox')) return '📁';
  if (n.includes('icloud')) return '☁️';
  if (n.includes('vpn')) return '🔒';
  if (n.includes('antivirus') || n.includes('kaspersky') || n.includes('norton')) return '🛡️';
  if (n.includes('domain') || n.includes('hosting')) return '🌐';
  if (n.includes('listrik') || n.includes('pln')) return '⚡';
  if (n.includes('air') || n.includes('pdam')) return '💧';
  if (n.includes('internet') || n.includes('wifi') || n.includes('indihome') || n.includes('firstmedia')) return '📡';
  if (n.includes('gym') || n.includes('fitness')) return '💪';
  if (n.includes('asuransi') || n.includes('insurance')) return '🏥';
  return '📋';
};

const SubscriptionView = ({ subscriptions, wallets, userId, appId, fmt }) => {
  const [form, setForm] = useState({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [sortBy, setSortBy] = useState('paymentDay');

  const handleFetchRate = async () => {
    if (form.currency === 'IDR' || !form.currency) return;
    setIsLoadingRate(true);
    const rate = await fetchExchangeRate(form.currency);
    if (rate && form.foreignCost) {
       setForm(prev => ({ ...prev, cost: Math.round(prev.foreignCost * rate) }));
    }
    setIsLoadingRate(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.cost) return;
    const payload = {
      ...form,
      cost: Number(form.cost),
      foreignCost: form.currency !== 'IDR' ? Number(form.foreignCost) : 0,
      paymentDay: Number(form.paymentDay),
      updatedAt: serverTimestamp(),
      startDate: new Date(form.startDate)
    };
    delete payload.id;

    try {
      if (form.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'subscriptions', form.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'subscriptions'), { ...payload, createdAt: serverTimestamp() });
      }
      setForm({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) });
      setIsFormOpen(false);
    } catch (err) { console.error(err); }
  };

  const handleEdit = (sub) => {
    const startDateValue = sub.startDate ? (
      typeof sub.startDate.toDate === 'function' 
        ? formatDateInput(sub.startDate.toDate())
        : formatDateInput(new Date(sub.startDate))
    ) : formatDateInput(new Date());
    
    setForm({ ...sub, id: sub.id, startDate: startDateValue });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus langganan ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'subscriptions', id));
    }
  };

  const sortedSubscriptions = useMemo(() => {
    const sorted = [...subscriptions];
    if (sortBy === 'paymentDay') {
      sorted.sort((a, b) => (Number(a.paymentDay) || 31) - (Number(b.paymentDay) || 31));
    } else if (sortBy === 'cost') {
      sorted.sort((a, b) => Number(b.cost) - Number(a.cost));
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [subscriptions, sortBy]);

  const totalMonthly = subscriptions.reduce((acc, sub) => {
    return acc + (sub.cycle === 'monthly' ? sub.cost : sub.cost / 12);
  }, 0);

  const totalYearly = totalMonthly * 12;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Langganan Rutin</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
            <ListFilter size={16} className="text-gray-500"/>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent outline-none text-gray-700 dark:text-gray-200 w-full"
            >
              <option value="paymentDay">Sortir: Tanggal Bayar</option>
              <option value="cost">Sortir: Nominal (Tertinggi)</option>
              <option value="name">Sortir: Nama</option>
            </select>
          </div>
          <button onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors shrink-0">{isFormOpen ? <X size={18}/> : <Plus size={18}/>} <span>{isFormOpen ? 'Batal' : 'Tambah'}</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center">
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase">Estimasi Bulanan</p>
            <p className="text-xl font-bold text-blue-800 dark:text-blue-100">{fmt(totalMonthly)}</p>
          </div>
          <Calendar className="text-blue-400 opacity-50" size={32} />
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800 flex justify-between items-center">
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold uppercase">Estimasi Tahunan</p>
            <p className="text-xl font-bold text-purple-800 dark:text-purple-100">{fmt(totalYearly)}</p>
          </div>
          <Coins className="text-purple-400 opacity-50" size={32} />
        </div>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Layanan</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Netflix" />
            </div>
            
            <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mata Uang & Nominal Asing</label>
               <div className="flex gap-2">
                 <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-1/3 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                 </select>
                 <input type="number" 
                   disabled={form.currency === 'IDR'}
                   value={form.foreignCost} 
                   onChange={e => setForm({ ...form, foreignCost: e.target.value })} 
                   className="w-2/3 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800" 
                   placeholder={form.currency === 'IDR' ? '-' : 'Nominal Asli'}
                 />
               </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex justify-between">
                <span>{form.currency !== 'IDR' ? `Estimasi (Rp)` : `Biaya (Rp)`}</span>
                {form.currency !== 'IDR' && (
                  <button type="button" onClick={handleFetchRate} disabled={isLoadingRate} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    {isLoadingRate ? <RefreshCw size={10} className="animate-spin"/> : <Globe size={10}/>} Ambil Kurs Terkini
                  </button>
                )}
              </label>
              <input type="number" required value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Siklus</label>
              <select value={form.cycle} onChange={e => setForm({ ...form, cycle: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tanggal Bayar (Tgl 1-31)</label>
              <input type="number" min="1" max="31" value={form.paymentDay} onChange={e => setForm({ ...form, paymentDay: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Tgl berapa?" />
            </div>
            <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mulai Berlangganan</label>
               <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sumber Dana</label>
              <select value={form.walletId} onChange={e => setForm({ ...form, walletId: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                <option value="">Pilih Dompet/Kartu...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors">
              <Save size={18} /> {form.id ? 'Simpan Perubahan' : 'Tambah Langganan'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedSubscriptions.map(sub => {
          const wallet = wallets.find(w => w.id === sub.walletId);
          const curr = CURRENCIES.find(c => c.code === sub.currency) || CURRENCIES[0];
          return (
            <div key={sub.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center group hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="text-3xl p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {getSubscriptionIcon(sub.name)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">{sub.name}</h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={10} /> Tgl {sub.paymentDay || '?'}</span>
                    {wallet && <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-1.5 rounded text-[10px]"><Wallet size={10} /> {wallet.name}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 dark:text-gray-100">{fmt(sub.cost)}</p>
                {sub.currency !== 'IDR' && (
                  <p className="text-xs text-gray-400">{curr.symbol} {sub.foreignCost}</p>
                )}
                <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(sub)} className="text-blue-400 hover:text-blue-600"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(sub.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {subscriptions.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            Belum ada langganan. Tambahkan Netflix, Spotify, atau tagihan rutin lainnya.
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionView;
