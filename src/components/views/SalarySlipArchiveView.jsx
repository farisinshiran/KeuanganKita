import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, ScanLine, CheckCircle, AlertTriangle, Coins, Minus, X } from 'lucide-react';
import { collection, addDoc, doc, serverTimestamp, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip } from 'recharts';

const SalarySlipArchiveView = ({ userId, appId, fmt }) => {
  const [salarySlips, setSalarySlips] = useState([]);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  useEffect(() => {
    if (!userId) return;
    const unsubscribe = onSnapshot(
      collection(db, 'artifacts', appId, 'users', userId, 'salarySlips'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .sort((a, b) => { if (b.year !== a.year) return b.year - a.year; return b.month - a.month; });
        setSalarySlips(data);
      },
      (error) => { console.error('Error loading salary slips:', error); }
    );
    return () => unsubscribe();
  }, [userId, appId]);

  const extractTextFromPDF = async (file) => {
    const pdfjsLib = await import('pdfjs-dist');
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageTexts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => (typeof item.str === 'string' ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim();
      if (pageText) pageTexts.push(pageText);
    }
    return pageTexts.join('\n');
  };

  const parseSalarySlip = (text) => {
    let items = [], totalAmount = 0, month = null, year = null;
    const normalizeLabel = (s = '') => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const parseIDR = (raw) => {
      if (!raw) return 0;
      let s = String(raw).replace(/rp|idr/gi, '').replace(/[Oo]/g, '0').replace(/[Il]/g, '1').replace(/\s+/g, '').trim();
      s = s.replace(/[^\d.,-]/g, '');
      if (s.includes('.') && s.includes(',')) { s = s.split(',')[0].replace(/\./g, ''); }
      else if (s.includes(',') && !s.includes('.')) { const parts = s.split(','); s = parts.length > 2 ? parts.join('') : parts[0]; }
      else { s = s.replace(/\./g, ''); }
      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    };
    const findAmountByLabel = (sourceText, labelRegex) => {
      const re = new RegExp(`${labelRegex}(?:[\\s\\S]{0,90}?)(?:Rp|IDR)?\\s*([\\dIlOo][\\dIlOo.,]{1,24})`, 'i');
      const match = sourceText.match(re);
      return match ? parseIDR(match[1]) : 0;
    };
    const monthNames = { 'januari': 1, 'februari': 2, 'maret': 3, 'april': 4, 'mei': 5, 'juni': 6, 'juli': 7, 'agustus': 8, 'september': 9, 'oktober': 10, 'november': 11, 'desember': 12 };
    const normalizedText = (text || '').replace(/\r/g, '').replace(/[""]/g, '"').replace(/[–—]/g, '-').replace(/\t/g, ' ').replace(/\u00A0/g, ' ');
    const lowerText = normalizedText.toLowerCase();
    const monthMatch = lowerText.match(/periode[:\s]*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s*(\d{4})/) || lowerText.match(/(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s*(\d{4})/);
    if (monthMatch) { month = monthNames[monthMatch[1]]; year = parseInt(monthMatch[2]); }
    const grossAmount = findAmountByLabel(normalizedText, 'total\\s*penghasilan\\s*kotor') || findAmountByLabel(normalizedText, 'jumlah\\s*gaji\\s*kotor');
    const deductionAmount = findAmountByLabel(normalizedText, 'jumlah\\s*potongan');
    const netAmount = findAmountByLabel(normalizedText, 'total\\s*penghasilan\\s*bersih');
    totalAmount = netAmount || (grossAmount - deductionAmount) || grossAmount;
    return { month, year, items, totalAmount, grossAmount, deductionAmount, netAmount, breakdown: null };
  };

  const handlePDFUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') { alert('Mohon pilih file PDF'); return; }
    setIsUploadingPDF(true);
    try {
      const text = await extractTextFromPDF(file);
      if (!text || text.length < 30) throw new Error('Teks PDF tidak terbaca. Pastikan file PDF bukan hasil scan gambar murni.');
      const parsedData = parseSalarySlip(text);
      await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'salarySlips'), {
        fileName: file.name, month: parsedData.month || new Date().getMonth() + 1, year: parsedData.year || new Date().getFullYear(),
        items: parsedData.items, breakdown: parsedData.breakdown || null, grossAmount: parsedData.grossAmount || 0,
        deductionAmount: parsedData.deductionAmount || 0, netAmount: parsedData.netAmount || parsedData.totalAmount, totalAmount: parsedData.totalAmount,
        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
      });
      alert('✅ Slip gaji berhasil dianalisis dan disimpan!');
      e.target.value = '';
    } catch (error) { console.error('Error processing salary slip PDF:', error); alert(`Gagal menganalisis slip gaji: ${error.message}`); }
    finally { setIsUploadingPDF(false); }
  };

  const deleteSalarySlip = async (id) => {
    if (confirm('Hapus arsip slip gaji ini?')) {
      try { await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'salarySlips', id)); }
      catch (error) { console.error('Error deleting slip:', error); alert('Gagal menghapus arsip'); }
    }
  };

  const salaryTrendData = useMemo(() => {
    const data = salarySlips.slice(0, 12).reverse().map(slip => ({
      month: `${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'][slip.month - 1]} ${slip.year}`,
      amount: slip.totalAmount || 0, change: 0
    }));
    return data.map((item, idx) => {
      if (idx > 0) { const prev = data[idx - 1].amount; if (prev > 0) return { ...item, change: ((item.amount - prev) / prev) * 100 }; }
      return item;
    });
  }, [salarySlips]);

  const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2"><ScanLine size={28} className="text-purple-600" />Arsip Slip Gaji</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Upload & tracking slip gaji dengan AI parsing</p>
        </div>
        <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex gap-2 cursor-pointer transition-colors">
          {isUploadingPDF ? (<><RefreshCw size={18} className="animate-spin"/><span>Menganalisis...</span></>) : (<><Plus size={18}/><span>Upload PDF</span></>)}
          <input type="file" accept="application/pdf" onChange={handlePDFUpload} disabled={isUploadingPDF} className="hidden"/>
        </label>
      </div>

      {salaryTrendData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">Trend Pendapatan Bulanan</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={salaryTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb"/>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#6b7280"/>
              <YAxis tick={{ fontSize: 12 }} stroke="#6b7280" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`}/>
              <ReTooltip formatter={(v) => fmt(v)} contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px' }}/>
              <Line type="monotone" dataKey="amount" stroke="#8b5cf6" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">Riwayat Slip Gaji</h3>
        {salarySlips.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <ScanLine size={48} className="mx-auto mb-3 opacity-50"/>
            <p className="text-sm">Belum ada arsip slip gaji</p>
            <p className="text-xs mt-1">Upload PDF untuk ekstrak data (privacy-friendly, file tidak disimpan)</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-purple-50 dark:bg-purple-900/20 border-b-2 border-purple-200 dark:border-purple-800">
                  <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Periode</th>
                  <th className="text-right p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Total Pendapatan</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Perubahan</th>
                  <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">File</th>
                  <th className="text-center p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {salarySlips.map((slip, idx) => {
                  const prevSlip = salarySlips[idx + 1];
                  const change = prevSlip ? ((slip.totalAmount - prevSlip.totalAmount) / prevSlip.totalAmount) * 100 : 0;
                  const isIncrease = change > 0;
                  return (
                    <tr key={slip.id} onClick={() => setSelectedSlip(slip)} className="border-b border-gray-100 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer transition-colors">
                      <td className="p-3"><div className="font-semibold text-gray-800 dark:text-gray-100">{MONTHS[slip.month - 1]} {slip.year}</div></td>
                      <td className="p-3 text-right"><div className="font-bold text-purple-600 dark:text-purple-400">{fmt(slip.totalAmount)}</div></td>
                      <td className="p-3 text-center">
                        {idx > 0 && change !== 0 ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${isIncrease ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                            {isIncrease ? '📈' : '📉'} {change > 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        ) : <span className="text-xs text-gray-400">-</span>}
                      </td>
                      <td className="p-3"><div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">{slip.fileName}</div></td>
                      <td className="p-3 text-center">
                        <button onClick={(e) => { e.stopPropagation(); deleteSalarySlip(slip.id); }} className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg inline-flex" title="Hapus">
                          <Trash2 size={16}/>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSlip && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSlip(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">Detail Slip Gaji</h3>
                  <p className="text-purple-100">{MONTHS[selectedSlip.month - 1]} {selectedSlip.year}</p>
                </div>
                <button onClick={() => setSelectedSlip(null)} className="p-2 hover:bg-white/20 rounded-lg transition-colors"><X size={24} className="text-white"/></button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Penghasilan Bersih</p>
                <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">{fmt(selectedSlip.netAmount || selectedSlip.totalAmount)}</p>
              </div>
              {selectedSlip.grossAmount > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">Total Penghasilan Kotor</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmt(selectedSlip.grossAmount || 0)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-300 mb-1">Jumlah Potongan</p>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{fmt(selectedSlip.deductionAmount || 0)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-1">Take Home Pay</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{fmt(selectedSlip.netAmount || selectedSlip.totalAmount || 0)}</p>
                  </div>
                </div>
              )}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <ScanLine size={16}/><span className="font-medium">File:</span><span className="truncate">{selectedSlip.fileName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mt-2">
                  <CheckCircle size={14}/><span>Parsed only (file tidak disimpan untuk privacy)</span>
                </div>
              </div>
              <button onClick={() => setSelectedSlip(null)} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipArchiveView;
