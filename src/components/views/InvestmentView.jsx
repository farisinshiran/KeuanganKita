import React, { useState, useMemo, useRef } from 'react';
import { Plus, Save, X, Edit2, Trash2, Target, Calendar, ListFilter } from 'lucide-react';
import { collection, addDoc, doc, serverTimestamp, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

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

  return (
    <div className="space-y-8" ref={scrollRef}>
      {/* SECTION 1: GOALS & TYPES */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Target className="text-emerald-600 dark:text-emerald-400"/> Tujuan & Kategori Investasi</h3>
          <button onClick={()=>setEditingType({name:'', target:'', deadline:'', icon:''})} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">+ Buat Tujuan Baru</button>
        </div>
        
        {editingType && (
           <form onSubmit={handleSaveType} className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-5 gap-4 animate-in fade-in border border-gray-200 dark:border-gray-600">
             <div className="md:col-span-1 space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Icon</label>
                <input value={editingType.icon} onChange={e=>setEditingType({...editingType, icon:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white text-center" placeholder="💰"/>
             </div>
             <div className="md:col-span-2 space-y-1">
               <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nama Kategori/Tujuan</label>
                <input required value={editingType.name} onChange={e=>setEditingType({...editingType, name:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" placeholder="Misal: Dana Haji"/>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Target (Rp)</label>
                <input type="number" required value={editingType.target} onChange={e=>setEditingType({...editingType, target:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Deadline</label>
                <input type="date" value={editingType.deadline||''} onChange={e=>setEditingType({...editingType, deadline:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
             </div>
             <div className="md:col-span-5 flex justify-end gap-2 pt-2">
               <button type="button" onClick={()=>setEditingType(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">Batal</button>
               <button type="submit" className="px-6 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium shadow-sm">Simpan Tujuan</button>
             </div>
           </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {typeStats.map(t => (
            <div key={t.id} className="border dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow group relative dark:bg-gray-700/50">
              <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-2">
                   <span className="text-xl">{t.icon||'💰'}</span>
                   <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">{t.name}</span>
                 </div>
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>setEditingType(t)} className="text-gray-300 hover:text-blue-500"><Edit2 size={14}/></button>
                    <button onClick={()=>handleDeleteType(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                 </div>
              </div>
              <div className="space-y-1 cursor-pointer" onClick={() => setFilterGoal(t.id === filterGoal ? '' : t.id)}>
                 <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                   <span>Tercapai: {fmt(t.currentTotal)}</span>
                   <span>Target: {fmt(t.target)}</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-gray-600 rounded-full h-2">
                   <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{width: `${Math.min(t.percent, 100)}%`}}></div>
                 </div>
                 <div className="flex justify-between items-center mt-1">
                   <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t.percent.toFixed(1)}%</span>
                   {t.deadline && <span className="text-[10px] bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-500 dark:text-gray-300 flex items-center gap-1"><Calendar size={8}/> {t.deadline}</span>}
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: ASSETS LIST */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Portofolio Aset</h2>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
                <ListFilter size={16} className="text-gray-500"/>
                <select 
                  value={filterGoal} 
                  onChange={(e) => setFilterGoal(e.target.value)}
                  className="bg-transparent outline-none text-gray-700 dark:text-gray-200 w-full"
                >
                  <option value="">Semua Kategori</option>
                  {investTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                </select>
             </div>
             <button onClick={()=>{setIsAssetFormOpen(!isAssetFormOpen); setAssetForm({id:null, name:'', typeId:'', amount:'', purchaseValue:'', currentValue:''})}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors shrink-0">{isAssetFormOpen?<X size={18}/>:<Plus size={18}/>} <span className="hidden md:inline">{isAssetFormOpen?'Batal':'Tambah'}</span></button>
          </div>
        </div>

        {isAssetFormOpen && (
          <form onSubmit={handleSaveAsset} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700 mb-6 animate-in fade-in slide-in-from-top-4 transition-colors duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Nama Produk</label>
                  <input required value={assetForm.name} onChange={e=>setAssetForm({...assetForm, name:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Antam 5g"/>
               </div>
               <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Ikon (Emoji)</label>
                <input value={assetForm.icon} onChange={e=>setAssetForm({...assetForm, icon:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white text-center" placeholder="Bawaan: ❓"/>
               </div>
               <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori/Tujuan</label>
                  <select required value={assetForm.typeId} onChange={e=>setAssetForm({...assetForm, typeId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"><option value="">Pilih...</option>{investTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jumlah Unit</label>
                  <input type="number" value={assetForm.amount} onChange={e=>setAssetForm({...assetForm, amount:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Modal Awal (Rp)</label>
                  <input type="number" required value={assetForm.purchaseValue} onChange={e=>setAssetForm({...assetForm, purchaseValue:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
               </div>
               <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Nilai Saat Ini (Rp)</label>
                  <input type="number" required value={assetForm.currentValue} onChange={e=>setAssetForm({...assetForm, currentValue:e.target.value})} className="w-full p-2.5 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-emerald-900 dark:text-emerald-300"/>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nilai pasar terkini untuk menghitung profit/loss.</p>
               </div>
               {!assetForm.id && (
                 <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Sumber Dana (Opsional)</label>
                    <select value={assetForm.sourceWalletId || ''} onChange={e=>setAssetForm({...assetForm, sourceWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white">
                      <option value="">Tidak ada (Hanya catat)</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon || '💰'} {w.name} ({fmt(w.currentBalance)})</option>)}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Jika dipilih, saldo akan berkurang otomatis sebagai "Mutasi Keluar" ke Aset.</p>
                 </div>
               )}
            </div>
            <div className="flex justify-end"><button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-200/50 transition-all"><Save size={18}/> {assetForm.id ? 'Update Aset' : 'Simpan Aset'}</button></div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {filteredAssets.length === 0 ? (
             <div className="col-span-full text-center py-10 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
               Tidak ada aset di kategori ini.
             </div>
           ) : filteredAssets.map(inv => {
             const roi = inv.currentValue - inv.purchaseValue;
             const roiP = inv.purchaseValue > 0 ? (roi/inv.purchaseValue)*100 : 0;
             const type = investTypes.find(t => t.id === inv.typeId) || { name: inv.type || 'Lainnya', icon: '❓' };
             
             return (
               <div key={inv.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
                 <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">{inv.icon || type?.icon || '❓'}</div>
                      <div><h3 className="font-bold text-gray-800 dark:text-gray-200">{inv.name}</h3><p className="text-xs text-gray-500 dark:text-gray-400">{type?.name || 'Lainnya'} • {inv.amount} unit</p></div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={()=>handleEditAsset(inv)} className="p-1 text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"><Edit2 size={16}/></button>
                      <button onClick={()=>handleDeleteAsset(inv.id)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={16}/></button>
                    </div>
                 </div>
                 <div className="space-y-1 text-sm border-t dark:border-gray-700 border-b py-2 mb-2 border-dashed">
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Modal</span><span>{fmt(inv.purchaseValue)}</span></div>
                    <div className="flex justify-between font-medium dark:text-gray-200"><span>Nilai</span><span>{fmt(inv.currentValue)}</span></div>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500">ROI</span>
                    <span className={`text-sm font-bold ${roi>=0?'text-green-600 dark:text-green-400':'text-red-600 dark:text-red-400'}`}>{roi>=0?'+':''}{roiP.toFixed(1)}% ({fmt(roi)})</span>
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};

export default InvestmentView;
