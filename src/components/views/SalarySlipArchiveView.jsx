import React, { useState, useMemo, useEffect } from 'react';
import Icon from '../ui/Icon';
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
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-on-surface flex items-center gap-2">
            <Icon name="document_scanner" size={28} className="text-primary" />
            Arsip Slip Gaji
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">Upload &amp; tracking slip gaji dengan AI parsing</p>
        </div>
        <label className={`bg-primary text-on-primary px-4 py-2.5 rounded-xl font-semibold flex gap-2 items-center cursor-pointer shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all ${isUploadingPDF ? 'opacity-75 cursor-wait' : ''}`}>
          {isUploadingPDF
            ? <><Icon name="progress_activity" size={18} className="animate-spin" /><span>Menganalisis...</span></>
            : <><Icon name="upload" size={18} /><span>Upload PDF</span></>}
          <input type="file" accept="application/pdf" onChange={handlePDFUpload} disabled={isUploadingPDF} className="hidden" />
        </label>
      </div>

      {/* ── OCR upload card (empty state hint) ── */}
      {salarySlips.length === 0 && (
        <div className="bg-surface-container-low rounded-3xl p-10 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-4">
            <Icon name="document_scanner" size={32} className="text-on-surface-variant" />
          </div>
          <p className="font-bold text-on-surface text-lg mb-1">Belum ada arsip slip gaji</p>
          <p className="text-sm text-on-surface-variant mb-6">Upload PDF untuk ekstrak data — privacy-friendly, file tidak disimpan</p>
          <label className="inline-flex items-center gap-2 bg-primary text-on-primary px-6 py-2.5 rounded-xl font-semibold cursor-pointer shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all">
            <Icon name="upload" size={18} /> Pilih File PDF
            <input type="file" accept="application/pdf" onChange={handlePDFUpload} disabled={isUploadingPDF} className="hidden" />
          </label>
        </div>
      )}

      {/* ── Trend chart ── */}
      {salaryTrendData.length > 0 && (
        <div className="bg-surface-container-low rounded-2xl p-6">
          <h4 className="font-bold text-on-surface mb-4">Trend Pendapatan Bulanan</h4>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={salaryTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#bfcaba" opacity={0.4} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#40493d' }} />
              <YAxis tick={{ fontSize: 11, fill: '#40493d' }} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
              <ReTooltip formatter={(v) => fmt(v)} contentStyle={{ backgroundColor: '#eef4ff', border: 'none', borderRadius: '12px', fontSize: '12px' }} />
              <Line type="monotone" dataKey="amount" stroke="#0d631b" strokeWidth={2.5} dot={{ fill: '#0d631b', r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Slip cards grid ── */}
      {salarySlips.length > 0 && (
        <div className="bg-surface-container-low rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-outline-variant/20">
            <h3 className="font-bold text-on-surface">Riwayat Slip Gaji</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-surface-container border-b border-outline-variant/20">
                <tr>
                  <th className="text-left p-4 text-sm font-semibold text-on-surface-variant">Periode</th>
                  <th className="text-right p-4 text-sm font-semibold text-on-surface-variant">Total Pendapatan</th>
                  <th className="text-center p-4 text-sm font-semibold text-on-surface-variant">Perubahan</th>
                  <th className="text-left p-4 text-sm font-semibold text-on-surface-variant">File</th>
                  <th className="text-center p-4 text-sm font-semibold text-on-surface-variant">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {salarySlips.map((slip, idx) => {
                  const prevSlip = salarySlips[idx + 1];
                  const change = prevSlip ? ((slip.totalAmount - prevSlip.totalAmount) / prevSlip.totalAmount) * 100 : 0;
                  const isIncrease = change > 0;
                  return (
                    <tr key={slip.id} onClick={() => setSelectedSlip(slip)} className="hover:bg-surface-container-high/40 cursor-pointer transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-on-surface">{MONTHS[slip.month - 1]} {slip.year}</div>
                      </td>
                      <td className="p-4 text-right">
                        <div className="font-bold text-primary">{fmt(slip.totalAmount)}</div>
                      </td>
                      <td className="p-4 text-center">
                        {idx > 0 && change !== 0 ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${isIncrease ? 'text-on-secondary-container bg-secondary-container' : 'text-on-error-container bg-error-container'}`}>
                            {isIncrease ? '📈' : '📉'} {change > 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        ) : <span className="text-xs text-on-surface-variant">-</span>}
                      </td>
                      <td className="p-4">
                        <div className="text-xs text-on-surface-variant truncate max-w-[200px]">{slip.fileName}</div>
                      </td>
                      <td className="p-4 text-center">
                        <button onClick={(e) => { e.stopPropagation(); deleteSalarySlip(slip.id); }} className="p-2 text-on-surface-variant hover:text-on-error-container hover:bg-error-container rounded-lg inline-flex transition-colors">
                          <Icon name="delete" size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Slip detail modal ── */}
      {selectedSlip && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedSlip(null)}>
          <div className="bg-surface rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-gradient-to-br from-primary to-primary-container p-6 rounded-t-3xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-on-primary mb-1">Detail Slip Gaji</h3>
                  <p className="text-on-primary/70">{MONTHS[selectedSlip.month - 1]} {selectedSlip.year}</p>
                </div>
                <button onClick={() => setSelectedSlip(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <Icon name="close" size={24} className="text-on-primary" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-5">
              <div className="bg-surface-container-low rounded-2xl p-6 text-center">
                <p className="text-sm text-on-surface-variant mb-2">Total Penghasilan Bersih</p>
                <p className="text-4xl font-bold text-primary">{fmt(selectedSlip.netAmount || selectedSlip.totalAmount)}</p>
              </div>
              {selectedSlip.grossAmount > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-2xl bg-secondary-container">
                    <p className="text-xs text-on-secondary-container font-semibold mb-1">Total Kotor</p>
                    <p className="text-lg font-bold text-on-secondary-container">{fmt(selectedSlip.grossAmount || 0)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-error-container">
                    <p className="text-xs text-on-error-container font-semibold mb-1">Jumlah Potongan</p>
                    <p className="text-lg font-bold text-on-error-container">{fmt(selectedSlip.deductionAmount || 0)}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface-container">
                    <p className="text-xs text-on-surface-variant font-semibold mb-1">Take Home Pay</p>
                    <p className="text-lg font-bold text-primary">{fmt(selectedSlip.netAmount || selectedSlip.totalAmount || 0)}</p>
                  </div>
                </div>
              )}
              <div className="bg-surface-container rounded-xl p-4">
                <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                  <Icon name="document_scanner" size={16} />
                  <span className="font-medium">File:</span>
                  <span className="truncate">{selectedSlip.fileName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-on-surface-variant mt-2">
                  <Icon name="lock" size={14} />
                  <span>Parsed only — file tidak disimpan untuk privacy</span>
                </div>
              </div>
              <button onClick={() => setSelectedSlip(null)} className="w-full bg-primary text-on-primary py-3 rounded-xl font-semibold shadow-lg shadow-primary/20 hover:scale-[0.99] active:scale-95 transition-all">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalarySlipArchiveView;
