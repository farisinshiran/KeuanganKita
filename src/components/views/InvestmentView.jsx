import React, { useState, useMemo, useRef } from 'react';
import { collection, addDoc, doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Icon from '../ui/Icon.jsx';

const InvestmentView = ({ investments, investTypes, wallets, userId, appId, fmt }) => {
  const [editingType, setEditingType] = useState(null);
  const [assetForm, setAssetForm] = useState({ id: null, name: '', typeId: '', amount: '', purchaseValue: '', currentValue: '', sourceWalletId: '', icon: '' });
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [filterGoal, setFilterGoal] = useState('');
  const scrollRef = useRef(null);

  const typeStats = useMemo(() => {
    return investTypes.map(type => {
      const relatedInv = investments.filter(i => i.typeId === type.id || (!i.typeId && i.type === type.name));
      const currentTotal = relatedInv.reduce((a, c) => a + (Number(c.currentValue)||0), 0);
      const percent = type.target > 0 ? (currentTotal / type.target) * 100 : 0;
      return { ...type, currentTotal, percent: isNaN(percent) ? 0 : percent };
    });
  }, [investments, investTypes]);

  const filteredAssets = useMemo(() => {
    if (!filterGoal) return investments;
    return investments.filter(inv => {
       const typeId = inv.typeId || investTypes.find(t => t.name === inv.type)?.id;
       return typeId === filterGoal;
    });
  }, [investments, filterGoal, investTypes]);

  const handleSaveType = async (e) => {
    e.preventDefault();
    const payload = { ...editingType, target: Number(editingType.target) };
    try {
      if (editingType.id) await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'investment_types', editingType.id), payload);
      else await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'investment_types'), payload);
      setEditingType(null);
    } catch(err){console.error(err)}
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    const payload = { ...assetForm, amount: Number(assetForm.amount)||0, purchaseValue: Number(assetForm.purchaseValue)||0, currentValue: Number(assetForm.currentValue)||0, updatedAt: serverTimestamp() };
    delete payload.id;
    delete payload.sourceWalletId;

    try {
      if (assetForm.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'investments', assetForm.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'investments'), { ...payload, createdAt: serverTimestamp() });
        
        if (assetForm.sourceWalletId) {
           await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), {
              type: 'investment',
              walletId: assetForm.sourceWalletId,
              amount: Number(assetForm.purchaseValue),
              category: 'Investasi',
              note: `Beli Aset: ${assetForm.name}`,
              date: new Date(),
              createdAt: serverTimestamp()
           });
        }
      }
      setIsAssetFormOpen(false); setAssetForm({ id: null, name: '', typeId: '', amount: '', purchaseValue: '', currentValue: '', sourceWalletId: '', icon: '' });
    } catch(err){console.error(err)}
  };

  const handleEditAsset = (inv) => {
    setAssetForm({ 
      id: inv.id, name: inv.name, 
      typeId: inv.typeId || investTypes.find(t => t.name === inv.type)?.id || '', 
      amount: inv.amount ?? '', purchaseValue: inv.purchaseValue ?? '', currentValue: inv.currentValue ?? '',
      icon: inv.icon || '',
      sourceWalletId: ''
    });
    setIsAssetFormOpen(true);
    setTimeout(() => {
       if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
  const handleDeleteAsset = async (id) => { if(confirm('Hapus aset ini?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'investments', id)); };
  const handleDeleteType = async (id) => { if(confirm('Hapus kategori ini? Aset di dalamnya tidak akan terhapus tapi jadi tidak berkategori.')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'investment_types', id)); };

  // â”€â”€ Portfolio summary stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const totalModal   = useMemo(() => investments.reduce((a, c) => a + (Number(c.purchaseValue) || 0), 0), [investments]);
  const totalNilai   = useMemo(() => investments.reduce((a, c) => a + (Number(c.currentValue)  || 0), 0), [investments]);
  const totalRoi     = totalNilai - totalModal;
  const totalRoiPct  = totalModal > 0 ? ((totalRoi / totalModal) * 100).toFixed(1) : '0.0';

  return (
    <div className="space-y-6 animate-in fade-in duration-500" ref={scrollRef}>

      {/* â”€â”€ Hero Strip â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-gradient-to-br from-primary to-primary-container p-8 rounded-[2rem] text-on-primary relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 90% 10%, #fff 0%, transparent 50%)' }} />
        <div className="relative z-10">
          <div className="flex justify-between items-start mb-6">
            <div>
              <p className="text-sm opacity-70 font-medium mb-1">Total Nilai Portofolio</p>
              <p className="text-3xl font-extrabold">{fmt(totalNilai)}</p>
            </div>
            <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${totalRoi >= 0 ? 'bg-white/20' : 'bg-error/30'}`}>
              {totalRoi >= 0 ? '+' : ''}{totalRoiPct}%
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs opacity-60 mb-1">Total Modal</p>
              <p className="font-bold text-lg">{fmt(totalModal)}</p>
            </div>
            <div>
              <p className="text-xs opacity-60 mb-1">Profit / Loss</p>
              <p className={`font-bold text-lg ${totalRoi >= 0 ? '' : 'text-red-300'}`}>{totalRoi >= 0 ? '+' : ''}{fmt(totalRoi)}</p>
            </div>
            <div>
              <p className="text-xs opacity-60 mb-1">Jumlah Aset</p>
              <p className="font-bold text-lg">{investments.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Investment Goals / Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="bg-surface-container-low p-6 rounded-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-on-surface flex items-center gap-2">
            <Icon name="target" size={18} className="text-primary" /> Tujuan & Kategori Investasi
          </h3>
          <button onClick={() => setEditingType({ name: '', target: '', deadline: '', icon: '' })} className="text-sm text-primary hover:underline font-medium">+ Buat Tujuan Baru</button>
        </div>

        {editingType && (
          <form onSubmit={handleSaveType} className="bg-surface-container-lowest p-6 rounded-2xl mb-4 grid grid-cols-1 md:grid-cols-5 gap-4 animate-in fade-in">
            <div className="md:col-span-1 space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Icon</label>
              <input value={editingType.icon} onChange={e => setEditingType({ ...editingType, icon: e.target.value })} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-center text-on-surface" placeholder="ðŸ’°" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Nama Kategori / Tujuan</label>
              <input required value={editingType.name} onChange={e => setEditingType({ ...editingType, name: e.target.value })} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="Misal: Dana Haji" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Target (Rp)</label>
              <input type="number" required value={editingType.target} onChange={e => setEditingType({ ...editingType, target: e.target.value })} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Deadline</label>
              <input type="date" value={editingType.deadline || ''} onChange={e => setEditingType({ ...editingType, deadline: e.target.value })} className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" />
            </div>
            <div className="md:col-span-5 flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingType(null)} className="px-4 py-2 text-sm border-2 border-primary text-primary rounded-xl hover:bg-primary/5 font-semibold">Batal</button>
              <button type="submit" className="px-6 py-2 text-sm bg-primary text-on-primary hover:scale-[0.98] rounded-xl font-semibold shadow-lg shadow-primary/20">Simpan Tujuan</button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {typeStats.length === 0 ? (
            <p className="col-span-full text-center text-on-surface-variant text-sm py-6">Belum ada kategori tujuan</p>
          ) : typeStats.map(t => (
            <div
              key={t.id}
              className={`bg-surface-container-lowest p-4 rounded-2xl border cursor-pointer transition-all hover:ring-1 ${filterGoal === t.id ? 'border-primary/40 ring-1 ring-primary/20' : 'border-outline-variant/10 hover:ring-primary/20'} group relative`}
              onClick={() => setFilterGoal(t.id === filterGoal ? '' : t.id)}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{t.icon || 'ðŸ’°'}</span>
                  <span className="font-semibold text-on-surface text-sm">{t.name}</span>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={e => { e.stopPropagation(); setEditingType(t); }} className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary">
                    <Icon name="edit" size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteType(t.id); }} className="p-1 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error">
                    <Icon name="delete" size={14} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-xs text-on-surface-variant mb-1.5">
                <span>{fmt(t.currentTotal)}</span>
                <span>Target: {fmt(t.target)}</span>
              </div>
              <div className="w-full bg-surface-container rounded-full h-2 mb-1.5">
                <div className={`h-2 rounded-full transition-all duration-700 ${t.percent >= 100 ? 'bg-secondary' : t.percent >= 50 ? 'bg-primary' : 'bg-tertiary'}`} style={{ width: `${Math.min(t.percent, 100)}%` }} />
              </div>
              <div className="flex justify-between items-center">
                <span className={`text-xs font-bold ${t.percent >= 100 ? 'text-secondary' : 'text-primary'}`}>{t.percent.toFixed(1)}%</span>
                {t.deadline && (
                  <span className="text-[10px] bg-surface-container px-1.5 py-0.5 rounded-full text-on-surface-variant flex items-center gap-1">
                    <Icon name="calendar_today" size={10} /> {t.deadline}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ Asset Portfolio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-xl font-bold text-on-surface">Portofolio Aset</h2>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2 bg-surface-container-low rounded-xl px-3 py-2 text-sm flex-1 md:flex-none">
              <Icon name="filter_list" size={16} className="text-on-surface-variant" />
              <select value={filterGoal} onChange={e => setFilterGoal(e.target.value)} className="bg-transparent outline-none text-on-surface w-full">
                <option value="">Semua Kategori</option>
                {investTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
              </select>
            </div>
            <button
              onClick={() => { setIsAssetFormOpen(!isAssetFormOpen); setAssetForm({ id: null, name: '', typeId: '', amount: '', purchaseValue: '', currentValue: '', sourceWalletId: '', icon: '' }); }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shrink-0 ${isAssetFormOpen ? 'border-2 border-primary text-primary hover:bg-primary/5' : 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95'}`}
            >
              <Icon name={isAssetFormOpen ? 'close' : 'add'} size={18} />
              <span className="hidden md:inline">{isAssetFormOpen ? 'Batal' : 'Tambah Aset'}</span>
            </button>
          </div>
        </div>

        {isAssetFormOpen && (
          <form onSubmit={handleSaveAsset} className="bg-surface-container-low p-8 rounded-2xl mb-6 animate-in fade-in slide-in-from-top-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface-variant">Nama Produk</label>
                <input required value={assetForm.name} onChange={e => setAssetForm({ ...assetForm, name: e.target.value })} className="w-full p-3 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="Contoh: Antam 5g" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface-variant">Ikon (Emoji)</label>
                <input value={assetForm.icon} onChange={e => setAssetForm({ ...assetForm, icon: e.target.value })} className="w-full p-3 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-center text-on-surface" placeholder="â“" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface-variant">Kategori / Tujuan</label>
                <select required value={assetForm.typeId} onChange={e => setAssetForm({ ...assetForm, typeId: e.target.value })} className="w-full p-3 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                  <option value="">Pilih...</option>
                  {investTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface-variant">Jumlah Unit</label>
                <input type="number" value={assetForm.amount} onChange={e => setAssetForm({ ...assetForm, amount: e.target.value })} className="w-full p-3 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface-variant">Modal Awal (Rp)</label>
                <input type="number" required value={assetForm.purchaseValue} onChange={e => setAssetForm({ ...assetForm, purchaseValue: e.target.value })} className="w-full p-3 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-on-surface-variant">Nilai Saat Ini (Rp)</label>
                <input type="number" required value={assetForm.currentValue} onChange={e => setAssetForm({ ...assetForm, currentValue: e.target.value })} className="w-full p-3 bg-primary/10 border-none rounded-xl focus:ring-1 focus:ring-primary/30 outline-none font-semibold text-primary" />
                <p className="text-xs text-on-surface-variant">Nilai pasar terkini untuk menghitung profit/loss.</p>
              </div>
              {!assetForm.id && (
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-sm font-semibold text-on-surface-variant">Sumber Dana (Opsional)</label>
                  <select value={assetForm.sourceWalletId || ''} onChange={e => setAssetForm({ ...assetForm, sourceWalletId: e.target.value })} className="w-full p-3 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface">
                    <option value="">Tidak ada (Hanya catat)</option>
                    {wallets.map(w => <option key={w.id} value={w.id}>{w.icon || 'ðŸ’°'} {w.name} ({fmt(w.currentBalance)})</option>)}
                  </select>
                  <p className="text-xs text-on-surface-variant">Jika dipilih, saldo akan berkurang otomatis.</p>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setIsAssetFormOpen(false)} className="px-4 py-2.5 border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 text-sm">Batal</button>
              <button type="submit" className="bg-primary text-on-primary px-8 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all text-sm">
                <Icon name="save" size={18} /> {assetForm.id ? 'Update Aset' : 'Simpan Aset'}
              </button>
            </div>
          </form>
        )}

        {filteredAssets.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-outline-variant/30 rounded-2xl text-on-surface-variant">
            <Icon name="inventory" size={48} className="mx-auto opacity-30 mb-3" />
            <p>Tidak ada aset di kategori ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAssets.map(inv => {
              const roi = inv.currentValue - inv.purchaseValue;
              const roiP = inv.purchaseValue > 0 ? (roi / inv.purchaseValue) * 100 : 0;
              const type = investTypes.find(t => t.id === inv.typeId) || { name: inv.type || 'Lainnya', icon: 'â“' };
              const initials = (inv.name || '??').slice(0, 2).toUpperCase();

              return (
                <div key={inv.id} className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant/10 hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      {inv.icon || type?.icon ? (
                        <div className="p-2.5 bg-surface-container-low rounded-2xl text-2xl">{inv.icon || type?.icon}</div>
                      ) : (
                        <div className="w-10 h-10 bg-primary text-on-primary rounded-2xl flex items-center justify-center text-sm font-bold">{initials}</div>
                      )}
                      <div>
                        <h3 className="font-bold text-on-surface">{inv.name}</h3>
                        <p className="text-xs text-on-surface-variant">{type?.name || 'Lainnya'}{inv.amount ? ` â€¢ ${inv.amount} unit` : ''}</p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEditAsset(inv)} className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary">
                        <Icon name="edit" size={16} />
                      </button>
                      <button onClick={() => handleDeleteAsset(inv.id)} className="p-1.5 rounded-lg hover:bg-error-container text-on-surface-variant hover:text-error">
                        <Icon name="delete" size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm border-t border-b border-outline-variant/10 py-3 mb-3">
                    <div className="flex justify-between text-on-surface-variant"><span>Modal</span><span>{fmt(inv.purchaseValue)}</span></div>
                    <div className="flex justify-between font-semibold text-on-surface"><span>Nilai Pasar</span><span>{fmt(inv.currentValue)}</span></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-on-surface-variant">ROI</span>
                    <span className={`text-sm font-bold ${roi >= 0 ? 'text-secondary' : 'text-error'}`}>
                      {roi >= 0 ? '+' : ''}{roiP.toFixed(1)}% ({fmt(roi)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvestmentView;
