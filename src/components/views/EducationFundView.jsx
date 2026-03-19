import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, serverTimestamp, updateDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../config/firebase';
import Icon from '../ui/Icon.jsx';

const EducationFundView = ({ userId, appId, fmt }) => {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ id: null, name: '', birthYear: new Date().getFullYear(), currentAge: 0, currentSavings: 0 });

  const educationLevels = [
    { level: 'TK', startAge: 4, duration: 2, estimatedCost: 5000000, icon: '🎨' },
    { level: 'SD', startAge: 6, duration: 6, estimatedCost: 15000000, icon: '📚' },
    { level: 'SMP', startAge: 12, duration: 3, estimatedCost: 25000000, icon: '📖' },
    { level: 'SMA', startAge: 15, duration: 3, estimatedCost: 35000000, icon: '🎓' },
    { level: 'Kuliah', startAge: 18, duration: 4, estimatedCost: 150000000, icon: '🎯' }
  ];

  const EDUCATION_INFLATION = 0.12;

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(
      query(collection(db, 'artifacts', appId, 'users', userId, 'children')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), birthYear: doc.data().birthYear || new Date().getFullYear() }));
        setChildren(data);
        setSelectedChildId(prev => prev && data.find(c => c.id === prev) ? prev : (data[0]?.id || null));
      }
    );
    return () => unsubscribe();
  }, [userId, appId]);

  const calculateFutureCost = (baseCost, yearsFromNow) => baseCost * Math.pow(1 + EDUCATION_INFLATION, yearsFromNow);
  const calculateMonthlySavings = (targetAmount, currentSavings, monthsUntil) => monthsUntil <= 0 ? 0 : (targetAmount - currentSavings) / monthsUntil;

  const generateEducationPlan = (child) => {
    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - child.birthYear;
    return educationLevels.map(level => {
      const yearsUntil = level.startAge - currentAge;
      const startYear = currentYear + yearsUntil;
      const futureCost = calculateFutureCost(level.estimatedCost, yearsUntil);
      const monthsUntil = yearsUntil * 12;
      const monthlySavings = calculateMonthlySavings(futureCost, child.currentSavings || 0, monthsUntil);
      return { ...level, yearsUntil, startYear, futureCost, monthlySavings: monthlySavings > 0 ? monthlySavings : 0, status: yearsUntil > 0 ? 'upcoming' : yearsUntil >= -level.duration ? 'ongoing' : 'completed' };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) { alert('Nama anak harus diisi'); return; }
    try {
      const payload = { name: formData.name, birthYear: Number(formData.birthYear), currentSavings: Number(formData.currentSavings) || 0, updatedAt: serverTimestamp() };
      if (formData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'children', formData.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'children'), { ...payload, createdAt: serverTimestamp() });
      }
      setIsFormOpen(false);
      setFormData({ id: null, name: '', birthYear: new Date().getFullYear(), currentAge: 0, currentSavings: 0 });
    } catch (error) { console.error('Error saving child data:', error); alert('Gagal menyimpan data'); }
  };

  const handleEdit = (child) => {
    setFormData({ id: child.id, name: child.name, birthYear: child.birthYear, currentAge: new Date().getFullYear() - child.birthYear, currentSavings: child.currentSavings || 0 });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus data anak ini?')) {
      try { await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'children', id)); }
      catch (error) { console.error('Error deleting child:', error); alert('Gagal menghapus data'); }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <Icon name="school" size={28} className="text-primary"/> Dana Pendidikan Anak
          </h2>
          <p className="text-sm text-on-surface-variant mt-1 flex items-center gap-1.5">
            Rencanakan biaya pendidikan anak
            <span className="bg-tertiary-fixed/40 text-tertiary text-xs font-bold px-2 py-0.5 rounded-full">Inflasi 12%/th</span>
          </p>
        </div>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setFormData({ id: null, name: '', birthYear: new Date().getFullYear(), currentAge: 0, currentSavings: 0 }); }} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${isFormOpen ? 'border-2 border-primary text-primary hover:bg-primary/5' : 'bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95'}`}>
          <Icon name={isFormOpen ? 'close' : 'add'} size={18}/>
          <span>{isFormOpen ? 'Batal' : 'Tambah Anak'}</span>
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-surface-container-low p-6 rounded-2xl animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Nama Anak</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="Contoh: Ahmad"/>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Tahun Lahir</label>
              <input type="number" required min="2000" max={new Date().getFullYear()} value={formData.birthYear} onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"/>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-on-surface-variant">Tabungan Saat Ini (Rp)</label>
              <input type="number" min="0" value={formData.currentSavings} onChange={(e) => setFormData({ ...formData, currentSavings: e.target.value })} className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface" placeholder="0"/>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all">
              <Icon name="save" size={18}/> {formData.id ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      {children.length === 0 ? (
        <div className="bg-surface-container-low p-12 rounded-2xl text-center">
          <Icon name="child_care" size={48} className="mx-auto text-outline mb-4"/>
          <p className="text-on-surface-variant">Belum ada data anak. Tambahkan data anak untuk mulai merencanakan dana pendidikan.</p>
        </div>
      ) : (
        <>
          {/* Child pill tabs */}
          <div className="flex gap-2 flex-wrap">
            {children.map(child => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${selectedChildId === child.id ? 'bg-primary text-on-primary shadow-lg shadow-primary/20' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}
              >
                <Icon name="person" size={15}/>
                {child.name}
                <span className="text-xs opacity-70">({new Date().getFullYear() - child.birthYear} th)</span>
              </button>
            ))}
          </div>

          {/* Selected child detail */}
          {children.filter(c => c.id === selectedChildId).map(child => {
            const currentAge = new Date().getFullYear() - child.birthYear;
            const educationPlan = generateEducationPlan(child);
            const upcomingLevels = educationPlan.filter(p => p.status === 'upcoming');
            const nextLevel = upcomingLevels[0];
            return (
              <div key={child.id} className="space-y-4">
                <div className="bg-gradient-to-br from-primary to-primary-container rounded-3xl p-6 text-on-primary relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-40 h-40 bg-white/10 rounded-full -translate-y-10 translate-x-10"/>
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Icon name="child_care" size={22}/>
                        <h3 className="text-2xl font-bold">{child.name}</h3>
                      </div>
                      <p className="text-on-primary/80 text-sm">{currentAge} tahun • Lahir {child.birthYear}</p>
                      <div className="mt-3 bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2 inline-block">
                        <p className="text-xs text-on-primary/70">Tabungan Saat Ini</p>
                        <p className="text-xl font-bold">{fmt(child.currentSavings || 0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(child)} className="p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
                        <Icon name="edit" size={18}/>
                      </button>
                      <button onClick={() => handleDelete(child.id)} className="p-2 bg-white/20 hover:bg-error rounded-xl transition-colors">
                        <Icon name="delete" size={18}/>
                      </button>
                    </div>
                  </div>
                </div>

                {nextLevel && (
                  <div className="bg-tertiary-fixed/20 border border-outline-variant/30 p-5 rounded-2xl">
                    <h4 className="text-sm font-semibold text-on-surface mb-3 flex items-center gap-2">
                      <Icon name="flag" size={16} className="text-tertiary"/> Target Berikutnya
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><p className="text-xs text-on-surface-variant">Jenjang</p><p className="text-lg font-bold text-on-surface">{nextLevel.icon} {nextLevel.level}</p></div>
                      <div><p className="text-xs text-on-surface-variant">Tahun Masuk</p><p className="text-lg font-bold text-on-surface">{nextLevel.startYear}</p></div>
                      <div><p className="text-xs text-on-surface-variant">Estimasi Biaya</p><p className="text-lg font-bold text-on-surface">{fmt(nextLevel.futureCost)}</p></div>
                      <div><p className="text-xs text-on-surface-variant">Nabung per Bulan</p><p className="text-lg font-bold text-primary">{fmt(nextLevel.monthlySavings)}</p></div>
                    </div>
                  </div>
                )}

                <div className="bg-surface-container-low rounded-2xl p-5">
                  <h4 className="text-sm font-semibold text-on-surface mb-4 flex items-center gap-2">
                    <Icon name="timeline" size={16} className="text-primary"/> Peta Jalan Pendidikan
                  </h4>
                  <div className="overflow-x-auto pb-2">
                    <div className="flex gap-3 min-w-max">
                      {educationPlan.map((level, idx) => {
                        const isCompleted = level.status === 'completed';
                        const isOngoing   = level.status === 'ongoing';
                        return (
                          <div key={idx} className={`w-44 shrink-0 p-4 rounded-2xl border-2 ${isCompleted ? 'border-outline-variant/30 bg-surface-container opacity-60' : isOngoing ? 'border-primary bg-primary-fixed/20' : 'border-outline-variant/30 bg-surface-container-lowest'}`}>
                            <div className="text-2xl mb-2">{level.icon}</div>
                            <p className="font-bold text-on-surface text-sm">{level.level}</p>
                            <p className="text-xs text-on-surface-variant mt-0.5">
                              {isCompleted ? 'Selesai' : isOngoing ? 'Berlangsung' : `${level.yearsUntil} th lagi • ${level.startYear}`}
                            </p>
                            <p className="text-xs font-semibold text-primary mt-2">{fmt(level.futureCost)}</p>
                            {level.monthlySavings > 0 && <p className="text-xs text-secondary mt-0.5">{fmt(level.monthlySavings)}/bln</p>}
                            <div className="mt-2 w-full bg-surface-container-high rounded-full h-1.5">
                              <div className={`h-1.5 rounded-full ${isCompleted ? 'bg-outline' : isOngoing ? 'bg-primary' : 'bg-surface-container-high'}`} style={{ width: isCompleted ? '100%' : isOngoing ? '50%' : '0%' }}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-low rounded-2xl p-5">
                    <p className="text-xs text-on-surface-variant">Total Biaya hingga Kuliah</p>
                    <p className="text-2xl font-bold text-on-surface mt-1">{fmt(educationPlan.reduce((s, l) => s + l.futureCost, 0))}</p>
                  </div>
                  <div className="bg-surface-container-low rounded-2xl p-5">
                    <p className="text-xs text-on-surface-variant">Rekomendasi Nabung/Bulan</p>
                    <p className="text-2xl font-bold text-primary mt-1">{fmt(nextLevel ? nextLevel.monthlySavings : 0)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      <div className="bg-surface-container-low p-5 rounded-2xl">
        <h4 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
          <Icon name="info" size={18} className="text-primary"/> Tentang Perhitungan
        </h4>
        <div className="space-y-1.5 text-sm text-on-surface-variant">
          <p>📈 <strong>Inflasi Pendidikan:</strong> 12% per tahun (rata-rata Indonesia)</p>
          <p>💰 <strong>Estimasi Biaya:</strong> Berdasarkan biaya rata-rata sekolah swasta menengah</p>
          <p>🎯 <strong>Rekomendasi:</strong> Mulai menabung sedini mungkin untuk meringankan beban</p>
          <p>📊 <strong>Tips:</strong> Diversifikasi investasi (deposito, reksadana, emas) untuk hasil maksimal</p>
        </div>
      </div>
    </div>
  );
};

export default EducationFundView;
