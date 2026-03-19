import React, { useState, useMemo } from 'react';
import Icon from '../ui/Icon.jsx';
import { collection, doc, updateDoc, getDoc, setDoc, serverTimestamp, query, getDocs } from 'firebase/firestore';
import { db } from '../../config/firebase';

const STEPS = ['Metode', 'Pendapatan', 'Alokasi', 'Kategori', 'Simpan'];

const PERCENTAGE_PRESETS = [
  { label: '50/30/20 (Klasik)',   needs: 50, wants: 30, savings: 20 },
  { label: '60/20/20 (Hemat)',    needs: 60, wants: 20, savings: 20 },
  { label: '70/10/20 (Kebutuhan)', needs: 70, wants: 10, savings: 20 },
];

const BudgetWizard = ({ isOpen, onClose, categories, userId, appId, selectedMonth }) => {
  const [step, setStep]         = useState(0);
  const [method, setMethod]     = useState('percentage'); // 'percentage' | 'fixed'
  const [income, setIncome]     = useState('');
  const [preset, setPreset]     = useState(0);
  const [customSplit, setCustomSplit] = useState({ needs: 50, wants: 30, savings: 20 });
  const [fixedGroups, setFixedGroups] = useState({ needs: '', wants: '', savings: '' });
  const [catBudgets, setCatBudgets]   = useState({});
  const [isSaving, setIsSaving]       = useState(false);
  const [error, setError]             = useState('');

  const expenseCats = useMemo(
    () => (categories?.raw || []).filter(c => c.type === 'expense'),
    [categories],
  );

  const incomeNum = Number(income) || 0;

  const getAlloc = () => {
    if (method === 'percentage') {
      const split = preset === -1 ? customSplit : PERCENTAGE_PRESETS[preset];
      return {
        needs:   Math.round((incomeNum * split.needs)   / 100),
        wants:   Math.round((incomeNum * split.wants)   / 100),
        savings: Math.round((incomeNum * split.savings) / 100),
      };
    }
    return {
      needs:   Number(fixedGroups.needs)   || 0,
      wants:   Number(fixedGroups.wants)   || 0,
      savings: Number(fixedGroups.savings) || 0,
    };
  };

  const alloc = getAlloc();
  const totalAllocated = Object.values(catBudgets).reduce((a, v) => a + (Number(v) || 0), 0);
  const totalBudgetable = alloc.needs + alloc.wants;

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      const base = (col) => collection(db, 'artifacts', appId, 'users', userId, col);

      // Update each category budget
      const catDocs = await getDocs(query(base('categories')));
      const updates = catDocs.docs.map(d => {
        const cat = d.data();
        if (cat.type !== 'expense') return null;
        const newBudget = Number(catBudgets[cat.name]) || cat.budget || 0;
        return updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'categories', d.id), {
          budget: newBudget, updatedAt: serverTimestamp(),
        });
      }).filter(Boolean);
      await Promise.all(updates);

      // Optionally update monthly_controls for this month
      if (selectedMonth && incomeNum > 0) {
        const mcRef = doc(db, 'artifacts', appId, 'users', userId, 'monthly_controls', selectedMonth);
        const mcSnap = await getDoc(mcRef);
        const existing = mcSnap.exists() ? mcSnap.data() : {};
        await setDoc(mcRef, {
          ...existing,
          expenseBudget: totalBudgetable,
          wizardApplied: true,
          wizardMethod:  method,
          wizardAlloc:   alloc,
          updatedAt:     serverTimestamp(),
        }, { merge: true });
      }

      onClose(true); // true = refresh
    } catch (err) {
      console.error(err);
      setError('Gagal menyimpan: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in"
      onClick={e => { if (e.target === e.currentTarget) onClose(false); }}
    >
      <div className="bg-surface-container-lowest rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95">

        {/* Header */}
        <div className="p-6 border-b border-outline-variant/20 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-xl font-bold text-on-surface flex items-center gap-2">
              <Icon name="auto_fix_high" size={22} className="text-primary"/> Budget Setup Wizard
            </h2>
            <p className="text-sm text-on-surface-variant mt-0.5">
              Langkah {step + 1} dari {STEPS.length}: {STEPS[step]}
            </p>
          </div>
          <button onClick={() => onClose(false)} className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors">
            <Icon name="close" size={22}/>
          </button>
        </div>

        {/* Step progress dots */}
        <div className="px-6 pt-4 flex justify-center gap-2 shrink-0">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                onClick={() => i < step && setStep(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step  ? 'bg-primary text-on-primary cursor-pointer'
                  : i === step ? 'bg-primary text-on-primary ring-4 ring-primary/20'
                  : 'bg-surface-container text-on-surface-variant cursor-default'
                }`}
              >
                {i < step ? <Icon name="check" size={14}/> : i + 1}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 rounded-full transition-all ${i < step ? 'bg-primary' : 'bg-surface-container'}`}/>
              )}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* Step 0: Method */}
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-on-surface-variant">Pilih pendekatan budgeting yang ingin kamu gunakan:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => setMethod('percentage')}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${method === 'percentage' ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-outline'}`}
                >
                  <p className="font-bold text-on-surface mb-1">Percentage Budget</p>
                  <p className="text-sm text-on-surface-variant">Bagi pendapatanmu berdasarkan persentase (mis. 50/30/20). Mudah dan fleksibel.</p>
                  {method === 'percentage' && <span className="mt-2 inline-block text-xs bg-primary text-on-primary px-2 py-0.5 rounded-full">Dipilih</span>}
                </button>
                <button
                  onClick={() => setMethod('fixed')}
                  className={`p-5 rounded-2xl border-2 text-left transition-all ${method === 'fixed' ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-outline'}`}
                >
                  <p className="font-bold text-on-surface mb-1">Fixed Budget</p>
                  <p className="text-sm text-on-surface-variant">Tentukan nominal pasti untuk setiap kelompok pengeluaran. Cocok untuk yang sudah tahu angkanya.</p>
                  {method === 'fixed' && <span className="mt-2 inline-block text-xs bg-primary text-on-primary px-2 py-0.5 rounded-full">Dipilih</span>}
                </button>
              </div>
            </div>
          )}

          {/* Step 1: Income */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-on-surface-variant">Berapa total pendapatan kamu bulan ini?</p>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Total Pendapatan (Rp)</label>
                <input
                  type="number" min={1}
                  value={income}
                  onChange={e => setIncome(e.target.value)}
                  className="w-full p-3 bg-surface-container-low border-none rounded-2xl text-lg font-bold focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"
                  placeholder="5000000"
                  autoFocus
                />
              </div>
              {incomeNum > 0 && (
                <div className="p-4 bg-primary/5 rounded-2xl text-sm text-primary">
                  Total pendapatan: <b>Rp {incomeNum.toLocaleString('id-ID')}</b>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Allocation */}
          {step === 2 && method === 'percentage' && (
            <div className="space-y-4">
              <p className="text-on-surface-variant">Pilih preset atau atur persentase sendiri:</p>
              <div className="space-y-2">
                {PERCENTAGE_PRESETS.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPreset(i)}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex justify-between items-center transition-all ${preset === i ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-outline'}`}
                  >
                    <span className="font-semibold text-on-surface">{p.label}</span>
                    <div className="text-xs text-on-surface-variant flex gap-3">
                      <span className="text-secondary">Kebutuhan {p.needs}%</span>
                      <span className="text-tertiary">Keinginan {p.wants}%</span>
                      <span className="text-primary">Tabungan {p.savings}%</span>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => setPreset(-1)}
                  className={`w-full p-4 rounded-2xl border-2 text-left transition-all ${preset === -1 ? 'border-primary bg-primary/5' : 'border-outline-variant hover:border-outline'}`}
                >
                  <span className="font-semibold text-on-surface">Custom</span>
                  {preset === -1 && (
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      {['needs','wants','savings'].map(k => (
                        <div key={k} className="space-y-1">
                          <label className="text-xs text-on-surface-variant capitalize">{k === 'needs' ? 'Kebutuhan' : k === 'wants' ? 'Keinginan' : 'Tabungan'} (%)</label>
                          <input
                            type="number" min={0} max={100}
                            value={customSplit[k]}
                            onChange={e => setCustomSplit(prev => ({ ...prev, [k]: Number(e.target.value) }))}
                            className="w-full p-2 bg-surface-container-low border-none rounded-xl text-sm text-on-surface outline-none focus:ring-1 focus:ring-primary/20"
                            onClick={e => e.stopPropagation()}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </button>
              </div>
              {incomeNum > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-2">
                  {[['Kebutuhan', alloc.needs,'blue'], ['Keinginan', alloc.wants,'purple'], ['Tabungan', alloc.savings,'emerald']].map(([label, val, color]) => (
                    <div key={label} className={`p-3 rounded-xl bg-${color}-50 dark:bg-${color}-900/20 text-center`}>
                      <p className={`text-xs font-semibold text-${color}-600 dark:text-${color}-400`}>{label}</p>
                      <p className={`text-sm font-bold text-${color}-700 dark:text-${color}-300`}>Rp {val.toLocaleString('id-ID')}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && method === 'fixed' && (
            <div className="space-y-4">
              <p className="text-on-surface-variant">Tentukan nominal untuk setiap kelompok:</p>
              {[['needs','Kebutuhan (wajib)','mis. sewa, makan, transportasi'], ['wants','Keinginan (optional)','mis. hiburan, makan luar, belanja'], ['savings','Tabungan / Investasi','mis. dana darurat, reksa dana, saham']].map(([k, label, hint]) => (
                <div key={k} className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface-variant">{label}</label>
                  <p className="text-xs text-on-surface-variant/60">{hint}</p>
                  <input
                    type="number" min={0}
                    value={fixedGroups[k]}
                    onChange={e => setFixedGroups(prev => ({ ...prev, [k]: e.target.value }))}
                    className="w-full p-2.5 bg-surface-container-low border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Step 3: Categories */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-on-surface-variant">Distribusikan ke kategori pengeluaran:</p>
                <span className={`text-xs font-semibold ${totalAllocated > totalBudgetable ? 'text-error' : 'text-primary'}`}>
                  {totalAllocated > totalBudgetable ? '⚠ Melebihi batas!' : `Sisa: Rp ${Math.max(0, totalBudgetable - totalAllocated).toLocaleString('id-ID')}`}
                </span>
              </div>
              <div className="bg-primary/5 p-3 rounded-2xl text-sm text-primary">
                Total untuk kategori: <b>Rp {totalBudgetable.toLocaleString('id-ID')}</b> (Kebutuhan + Keinginan)
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {expenseCats.length === 0 && (
                  <p className="text-on-surface-variant text-sm text-center py-4">Belum ada kategori pengeluaran. Tambahkan di menu Kategori.</p>
                )}
                {expenseCats.map(cat => (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-on-surface font-medium">{cat.name}</span>
                    <span className="text-xs text-on-surface-variant w-24 text-right">
                      {cat.budget > 0 ? `Saat ini: ${cat.budget.toLocaleString('id-ID')}` : ''}
                    </span>
                    <input
                      type="number" min={0}
                      value={catBudgets[cat.name] ?? cat.budget ?? ''}
                      onChange={e => setCatBudgets(prev => ({ ...prev, [cat.name]: e.target.value }))}
                      className="w-36 p-2 bg-surface-container-low border-none rounded-xl text-sm text-on-surface focus:ring-1 focus:ring-primary/20 outline-none text-right"
                      placeholder="Budget Rp"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Review */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-on-surface-variant">Review semua setting sebelum disimpan:</p>
              <div className="bg-surface-container-low rounded-2xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-on-surface-variant">Metode</span><span className="font-semibold text-on-surface">{method === 'percentage' ? 'Percentage Budget' : 'Fixed Budget'}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Pendapatan</span><span className="font-semibold text-on-surface">Rp {incomeNum.toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Alokasi Kebutuhan</span><span className="font-semibold text-secondary">Rp {alloc.needs.toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Alokasi Keinginan</span><span className="font-semibold text-tertiary">Rp {alloc.wants.toLocaleString('id-ID')}</span></div>
                <div className="flex justify-between"><span className="text-on-surface-variant">Tabungan/Investasi</span><span className="font-semibold text-primary">Rp {alloc.savings.toLocaleString('id-ID')}</span></div>
              </div>
              {Object.keys(catBudgets).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-on-surface-variant mb-2">Budget per Kategori yang Diubah:</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {Object.entries(catBudgets).filter(([, v]) => Number(v) > 0).map(([name, val]) => (
                      <div key={name} className="flex justify-between text-sm">
                        <span className="text-on-surface-variant">{name}</span>
                        <span className="font-semibold text-on-surface">Rp {Number(val).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {error && <p className="text-sm text-error bg-error-container/30 p-3 rounded-2xl">{error}</p>}
            </div>
          )}

        </div>

        {/* Footer nav */}
        <div className="p-6 border-t border-outline-variant/20 flex justify-between shrink-0">
          <button
            onClick={() => step === 0 ? onClose(false) : setStep(s => s - 1)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface px-4 py-2 rounded-xl hover:bg-surface-container transition-colors"
          >
            <Icon name="chevron_left" size={18}/> {step === 0 ? 'Batal' : 'Kembali'}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={(step === 1 && incomeNum <= 0)}
              className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold hover:scale-[0.98] active:scale-95 shadow-lg shadow-primary/20"
            >
              Lanjut <Icon name="chevron_right" size={18}/>
            </button>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 bg-primary text-on-primary px-6 py-2 rounded-xl disabled:opacity-40 transition-all font-semibold hover:scale-[0.98] active:scale-95 shadow-lg shadow-primary/20"
            >
              {isSaving ? 'Menyimpan…' : <><Icon name="check" size={18}/> Terapkan Budget</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BudgetWizard;
