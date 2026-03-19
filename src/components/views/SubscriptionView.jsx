import React, { useState, useMemo } from 'react';
import Icon from '../ui/Icon';
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

const getSubscriptionColor = (name) => {
  const n = (name || '').toLowerCase();
  if (n.includes('netflix')) return 'bg-[#E50914] text-white';
  if (n.includes('spotify')) return 'bg-[#1DB954] text-white';
  if (n.includes('youtube')) return 'bg-[#FF0000] text-white';
  if (n.includes('disney')) return 'bg-[#113CCF] text-white';
  if (n.includes('apple')) return 'bg-[#555555] text-white';
  if (n.includes('google')) return 'bg-[#4285F4] text-white';
  if (n.includes('amazon')) return 'bg-[#FF9900] text-white';
  if (n.includes('microsoft') || n.includes('office') || n.includes('365')) return 'bg-[#F25022] text-white';
  if (n.includes('canva')) return 'bg-[#00C4CC] text-white';
  if (n.includes('chatgpt') || n.includes('openai')) return 'bg-[#10A37F] text-white';
  if (n.includes('github')) return 'bg-[#181717] text-white';
  if (n.includes('notion')) return 'bg-[#000000] text-white';
  if (n.includes('figma')) return 'bg-[#F24E1E] text-white';
  if (n.includes('zoom')) return 'bg-[#2D8CFF] text-white';
  if (n.includes('slack')) return 'bg-[#4A154B] text-white';
  return 'bg-surface-container-high text-on-surface';
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
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-extrabold text-on-surface">Langganan Rutin</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2 text-sm flex-1 md:flex-none">
            <Icon name="sort" size={16} className="text-on-surface-variant" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent outline-none text-on-surface"
            >
              <option value="paymentDay">Sortir: Tanggal Bayar</option>
              <option value="cost">Sortir: Nominal (Tertinggi)</option>
              <option value="name">Sortir: Nama</option>
            </select>
          </div>
          <button
            onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) }); }}
            className="bg-primary text-on-primary px-4 py-2.5 rounded-xl font-semibold flex gap-2 items-center shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all shrink-0"
          >
            <Icon name={isFormOpen ? 'close' : 'add'} size={18} />
            <span>{isFormOpen ? 'Batal' : 'Tambah'}</span>
          </button>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-surface-container-low rounded-2xl p-5 flex justify-between items-center">
          <div>
            <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">Estimasi Bulanan</p>
            <p className="text-2xl font-bold text-on-surface mt-1">{fmt(totalMonthly)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
            <Icon name="calendar_month" size={22} className="text-primary" />
          </div>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5 flex justify-between items-center">
          <div>
            <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">Estimasi Tahunan</p>
            <p className="text-2xl font-bold text-on-surface mt-1">{fmt(totalYearly)}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
            <Icon name="savings" size={22} className="text-tertiary" />
          </div>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5 flex justify-between items-center">
          <div>
            <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">Total Langganan</p>
            <p className="text-2xl font-bold text-on-surface mt-1">{subscriptions.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
            <Icon name="subscriptions" size={22} className="text-on-surface-variant" />
          </div>
        </div>
      </div>

      {/* ── Add/Edit form ── */}
      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-surface-container-low rounded-2xl p-6">
          <h3 className="font-bold text-on-surface mb-5">{form.id ? 'Edit Langganan' : 'Tambah Langganan Baru'}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Nama Layanan</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="Contoh: Netflix" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Mata Uang &amp; Nominal Asing</label>
              <div className="flex gap-2">
                <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-1/3 p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                  {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                </select>
                <input type="number"
                  disabled={form.currency === 'IDR'}
                  value={form.foreignCost}
                  onChange={e => setForm({ ...form, foreignCost: e.target.value })}
                  className="w-2/3 p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface disabled:opacity-40"
                  placeholder={form.currency === 'IDR' ? '-' : 'Nominal Asli'}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant flex justify-between">
                <span>{form.currency !== 'IDR' ? 'Estimasi (Rp)' : 'Biaya (Rp)'}</span>
                {form.currency !== 'IDR' && (
                  <button type="button" onClick={handleFetchRate} disabled={isLoadingRate} className="text-primary hover:text-primary/80 flex items-center gap-1 text-[11px]">
                    <Icon name={isLoadingRate ? 'progress_activity' : 'language'} size={12} className={isLoadingRate ? 'animate-spin' : ''} /> Ambil Kurs
                  </button>
                )}
              </label>
              <input type="number" required value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface font-semibold" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Siklus</label>
              <select value={form.cycle} onChange={e => setForm({ ...form, cycle: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Tanggal Bayar (1-31)</label>
              <input type="number" min="1" max="31" value={form.paymentDay} onChange={e => setForm({ ...form, paymentDay: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="Tgl berapa?" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-on-surface-variant">Mulai Berlangganan</label>
              <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-on-surface-variant">Sumber Dana</label>
              <select value={form.walletId} onChange={e => setForm({ ...form, walletId: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                <option value="">Pilih Dompet/Kartu...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all">
              <Icon name="save" size={18} /> {form.id ? 'Simpan Perubahan' : 'Tambah Langganan'}
            </button>
          </div>
        </form>
      )}

      {/* ── Subscription cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedSubscriptions.map(sub => {
          const wallet = wallets.find(w => w.id === sub.walletId);
          const curr = CURRENCIES.find(c => c.code === sub.currency) || CURRENCIES[0];
          const brandColor = getSubscriptionColor(sub.name);
          const brandInitial = (sub.name || '?').charAt(0).toUpperCase();
          const monthlyEquiv = sub.cycle === 'monthly' ? sub.cost : sub.cost / 12;
          const annualProj = monthlyEquiv * 12;
          return (
            <div key={sub.id} className="bg-surface-container-low rounded-2xl p-4 flex justify-between items-center group hover:bg-surface-container transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${brandColor}`}>
                  {getSubscriptionIcon(sub.name) !== '📋' ? getSubscriptionIcon(sub.name) : brandInitial}
                </div>
                <div>
                  <h3 className="font-bold text-on-surface">{sub.name}</h3>
                  <div className="text-xs text-on-surface-variant flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1"><Icon name="calendar_today" size={10} /> Tgl {sub.paymentDay || '?'}</span>
                    <span className="text-on-surface-variant/40">·</span>
                    <span className="capitalize">{sub.cycle === 'monthly' ? 'Bulanan' : 'Tahunan'}</span>
                    {wallet && <span className="px-1.5 py-0.5 rounded-md bg-surface-container text-[10px]">{wallet.name}</span>}
                  </div>
                  {sub.currency !== 'IDR' && (
                    <p className="text-xs text-on-surface-variant mt-0.5">{curr.symbol} {sub.foreignCost} → {fmt(sub.cost)}</p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-on-surface">{fmt(sub.cost)}
                  <span className="text-xs font-normal text-on-surface-variant ml-1">/{sub.cycle === 'monthly' ? 'bln' : 'thn'}</span>
                </p>
                <p className="text-xs text-on-surface-variant mt-0.5">~{fmt(annualProj)}/thn</p>
                <div className="flex justify-end gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(sub)} className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-primary-fixed/20 rounded-lg transition-colors">
                    <Icon name="edit" size={14} />
                  </button>
                  <button onClick={() => handleDelete(sub.id)} className="p-1.5 text-on-surface-variant hover:text-on-error-container hover:bg-error-container rounded-lg transition-colors">
                    <Icon name="delete" size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {subscriptions.length === 0 && (
          <div className="col-span-full text-center py-12 text-on-surface-variant border-2 border-dashed border-outline-variant rounded-2xl">
            <Icon name="subscriptions" size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">Belum ada langganan.</p>
            <p className="text-sm mt-1 opacity-70">Tambahkan Netflix, Spotify, atau tagihan rutin lainnya.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscriptionView;
