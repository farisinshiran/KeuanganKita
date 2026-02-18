import React, { useState, useEffect } from 'react';
import { Plus, Save, X, Edit2, Trash2, Target, GraduationCap, Baby, School, AlertTriangle } from 'lucide-react';
import { collection, addDoc, doc, serverTimestamp, updateDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';
import { db } from '../../config/firebase';

const EducationFundView = ({ userId, appId, fmt }) => {
  const [children, setChildren] = useState([]);
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <GraduationCap size={28} className="text-emerald-600" /> Dana Pendidikan Anak
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Rencanakan biaya pendidikan anak dengan inflasi 12% per tahun</p>
        </div>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setFormData({ id: null, name: '', birthYear: new Date().getFullYear(), currentAge: 0, currentSavings: 0 }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">
          {isFormOpen ? <X size={18} /> : <Plus size={18} />}
          <span>{isFormOpen ? 'Batal' : 'Tambah Anak'}</span>
        </button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nama Anak</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Ahmad"/>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tahun Lahir</label>
              <input type="number" required min="2000" max={new Date().getFullYear()} value={formData.birthYear} onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"/>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tabungan Saat Ini (Rp)</label>
              <input type="number" min="0" value={formData.currentSavings} onChange={(e) => setFormData({ ...formData, currentSavings: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2">
              <Save size={18} /> {formData.id ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      {children.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
          <Baby size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">Belum ada data anak. Tambahkan data anak untuk mulai merencanakan dana pendidikan.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {children.map((child) => {
            const currentAge = new Date().getFullYear() - child.birthYear;
            const educationPlan = generateEducationPlan(child);
            const upcomingLevels = educationPlan.filter(p => p.status === 'upcoming');
            const nextLevel = upcomingLevels[0];
            return (
              <div key={child.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold flex items-center gap-2"><Baby size={24} />{child.name}</h3>
                      <p className="text-emerald-100 mt-1">{currentAge} tahun • Lahir {child.birthYear}</p>
                      <div className="mt-3 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">
                        <p className="text-sm">Tabungan Saat Ini</p>
                        <p className="text-xl font-bold">{fmt(child.currentSavings || 0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleEdit(child)} className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(child.id)} className="p-2 bg-white/20 hover:bg-red-500 rounded-lg transition-colors"><Trash2 size={18} /></button>
                    </div>
                  </div>
                </div>

                {nextLevel && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 p-6">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2"><Target size={16} />Target Berikutnya</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div><p className="text-xs text-amber-700 dark:text-amber-400">Jenjang</p><p className="text-lg font-bold text-amber-900 dark:text-amber-200">{nextLevel.icon} {nextLevel.level}</p></div>
                      <div><p className="text-xs text-amber-700 dark:text-amber-400">Tahun Masuk</p><p className="text-lg font-bold text-amber-900 dark:text-amber-200">{nextLevel.startYear}</p></div>
                      <div><p className="text-xs text-amber-700 dark:text-amber-400">Estimasi Biaya</p><p className="text-lg font-bold text-amber-900 dark:text-amber-200">{fmt(nextLevel.futureCost)}</p></div>
                      <div><p className="text-xs text-amber-700 dark:text-amber-400">Nabung per Bulan</p><p className="text-lg font-bold text-amber-900 dark:text-amber-200">{fmt(nextLevel.monthlySavings)}</p></div>
                    </div>
                  </div>
                )}

                <div className="p-6">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2"><School size={16} />Rencana Pendidikan Lengkap</h4>
                  <div className="space-y-3">
                    {educationPlan.map((level, idx) => {
                      const progress = level.status === 'completed' ? 100 : level.status === 'ongoing' ? 50 : 0;
                      return (
                        <div key={idx} className={`p-4 rounded-lg border ${level.status === 'upcoming' ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800' : level.status === 'ongoing' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-gray-800 dark:text-gray-100">{level.icon} {level.level}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{level.yearsUntil > 0 ? `${level.yearsUntil} tahun lagi • ${level.startYear}` : level.status === 'ongoing' ? 'Sedang Berjalan' : 'Sudah Selesai'}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{fmt(level.futureCost)}</p>
                              {level.monthlySavings > 0 && <p className="text-xs text-emerald-600 dark:text-emerald-400">{fmt(level.monthlySavings)}/bln</p>}
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div className={`h-2 rounded-full transition-all ${level.status === 'completed' ? 'bg-gray-400' : level.status === 'ongoing' ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-purple-700 dark:text-purple-400">Total Biaya hingga Kuliah</p>
                        <p className="text-xl font-bold text-purple-900 dark:text-purple-200">{fmt(educationPlan.reduce((sum, level) => sum + level.futureCost, 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-700 dark:text-purple-400">Rekomendasi Nabung/Bulan</p>
                        <p className="text-xl font-bold text-purple-900 dark:text-purple-200">{fmt(nextLevel ? nextLevel.monthlySavings : 0)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
        <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2"><AlertTriangle size={18} />Tentang Perhitungan</h4>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
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
