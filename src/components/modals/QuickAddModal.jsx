import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, AlertTriangle, RefreshCw, CheckCircle, Trash2 } from 'lucide-react';
import {
  getFirestore, collection, addDoc, doc, serverTimestamp, setDoc, getDoc
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { analyzeReceiptWithVision } from '../../utils/parsers/visionApi';
import { formatDateInput } from '../../utils/formatters';

const QuickAddModal = ({ isOpen, onClose, categories, wallets, userId, appId, fmt }) => {
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detectedTransactions, setDetectedTransactions] = useState([]);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [isLoadingApiKey, setIsLoadingApiKey] = useState(true);
  const fileInputRef = useRef(null);

  // Load API key from Firestore when modal opens
  useEffect(() => {
    if (!isOpen || !userId) return;

    const loadApiKey = async () => {
      try {
        setIsLoadingApiKey(true);
        const userSettingsRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'visionApi');
        const docSnap = await getDoc(userSettingsRef);

        if (docSnap.exists() && docSnap.data().apiKey) {
          const savedKey = docSnap.data().apiKey;
          setApiKey(savedKey);
          setShowApiKeyInput(false);
          console.log('✅ API Key loaded from Firestore');
        } else {
          // Fallback: check localStorage for migration
          const localKey = localStorage.getItem('visionApiKey');
          if (localKey) {
            setApiKey(localKey);
            // Migrate to Firestore
            await saveApiKeyToFirestore(localKey);
            localStorage.removeItem('visionApiKey'); // Clean up
            console.log('✅ API Key migrated from localStorage to Firestore');
          } else {
            setShowApiKeyInput(true);
          }
        }
      } catch (error) {
        console.error('❌ Error loading API key:', error);
        // Fallback to localStorage
        const localKey = localStorage.getItem('visionApiKey');
        if (localKey) {
          setApiKey(localKey);
        } else {
          setShowApiKeyInput(true);
        }
      } finally {
        setIsLoadingApiKey(false);
      }
    };

    loadApiKey();
  }, [isOpen, userId, appId]);

  // Reset all states when modal closes to prevent stuck states
  useEffect(() => {
    if (!isOpen) {
      console.log('🚪 Modal closed, resetting all Quick Add states');
      setUploadedImage(null);
      setImagePreview(null);
      setDetectedTransactions([]);
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  // Save API key to Firestore
  const saveApiKeyToFirestore = async (key) => {
    try {
      const userSettingsRef = doc(db, 'artifacts', appId, 'users', userId, 'settings', 'visionApi');
      await setDoc(userSettingsRef, {
        apiKey: key,
        updatedAt: serverTimestamp()
      });
      console.log('✅ API Key saved to Firestore');
    } catch (error) {
      console.error('❌ Error saving API key:', error);
      // Fallback: save to localStorage
      localStorage.setItem('visionApiKey', key);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!uploadedImage) {
      alert('Pilih gambar terlebih dahulu');
      return;
    }

    if (!apiKey.trim()) {
      alert('Masukkan API Key Google Cloud Vision terlebih dahulu');
      setShowApiKeyInput(true);
      return;
    }

    console.log('🚀 Starting analysis...');
    setIsProcessing(true);

    try {
      console.log('📸 Analyzing image with Vision API...');
      const transactions = await analyzeReceiptWithVision(uploadedImage, apiKey);

      console.log(`✅ Analysis complete: ${transactions.length} transactions found`);

      if (!transactions || transactions.length === 0) {
        throw new Error('No transactions detected from image');
      }

      // Initialize with default values
      const initializedTransactions = transactions.map((t, idx) => ({
        ...t,
        id: `temp-${Date.now()}-${idx}`,
        walletId: wallets[0]?.id || '',
        selected: true
      }));

      setDetectedTransactions(initializedTransactions);
      console.log('💾 Transactions set to state');

      // Save API key to Firestore for future use
      try {
        await saveApiKeyToFirestore(apiKey);
        setShowApiKeyInput(false);
        console.log('🔑 API Key saved');
      } catch (saveError) {
        console.warn('⚠️ Failed to save API key:', saveError);
      }
    } catch (error) {
      console.error('❌ Analysis error:', error);
      let errorMessage = 'Gagal menganalisis gambar. ';

      if (error.message && error.message.includes('No text detected')) {
        errorMessage += 'Tidak ada teks yang terdeteksi. Pastikan gambar jelas dan tidak blur.';
      } else if (error.message && error.message.includes('No transactions detected')) {
        errorMessage += 'Tidak ada transaksi yang terdeteksi. Pastikan screenshot adalah histori transaksi.';
      } else if (error.message && error.message.includes('API')) {
        errorMessage += 'Masalah dengan API Key. Pastikan API Key benar dan aktif.';
      } else if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += 'Pastikan:\n- Screenshot jelas & tidak blur\n- Text mudah dibaca\n- Format histori transaksi lengkap\n- API Key benar';
      }

      alert(errorMessage);
      setDetectedTransactions([]);
    } finally {
      console.log('🏁 Analysis finished, resetting processing state');
      setIsProcessing(false);
    }
  };

  const handleUpdateTransaction = (id, field, value) => {
    setDetectedTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, [field]: value } : t))
    );
  };

  const handleToggleSelect = (id) => {
    setDetectedTransactions(prev =>
      prev.map(t => (t.id === id ? { ...t, selected: !t.selected } : t))
    );
  };

  const handleApproveSelected = async () => {
    const selected = detectedTransactions.filter(t => t.selected);

    if (selected.length === 0) {
      alert('Pilih minimal 1 transaksi untuk disimpan');
      return;
    }

    // Validate
    const invalid = selected.find(t => !t.walletId || !t.category || !t.amount || t.amount <= 0);
    if (invalid) {
      alert('Pastikan semua transaksi yang dipilih memiliki nominal, kategori, dan akun yang valid');
      return;
    }

    setIsProcessing(true);
    try {
      const batch = selected.map(t => {
        const payload = {
          type: t.type,
          amount: Number(t.amount),
          category: t.category,
          walletId: t.walletId,
          note: t.note || '',
          date: t.date || new Date(),
          quickAddSource: true,
          createdAt: serverTimestamp()
        };
        return addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), payload);
      });

      await Promise.all(batch);

      console.log(`✅ ${selected.length} transaksi berhasil disimpan`);
      alert(`${selected.length} transaksi berhasil ditambahkan!`);

      handleReset();
      onClose();
    } catch (error) {
      console.error('❌ Bulk add error:', error);
      alert('Gagal menambahkan transaksi');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }

    setUploadedImage(null);
    setImagePreview(null);
    setDetectedTransactions([]);
    setIsProcessing(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    console.log('🔄 Quick Add reset complete');
  };

  const handleDeleteTransaction = (id) => {
    setDetectedTransactions(prev => prev.filter(t => t.id !== id));
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center animate-in fade-in duration-200" onClick={handleClose}>
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-6xl sm:w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-4 sm:p-6 flex justify-between items-center z-10">
          <h2 className="text-base sm:text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Bot size={20} className="text-emerald-600 dark:text-emerald-400 sm:w-6 sm:h-6" />
            <span className="hidden sm:inline">Quick Add - AI Receipt Scanner</span>
            <span className="sm:hidden">Quick Add AI</span>
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation" aria-label="Close">
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Loading State */}
          {isLoadingApiKey && (
            <div className="flex items-center justify-center gap-3 py-4">
              <RefreshCw size={20} className="animate-spin text-emerald-600" />
              <span className="text-sm text-gray-600 dark:text-gray-400">Memuat API Key...</span>
            </div>
          )}

          {/* API Key Section */}
          {!isLoadingApiKey && showApiKeyInput && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-yellow-600 dark:text-yellow-400 mt-0.5" size={20} />
                <div className="flex-1 space-y-3">
                  <div>
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Setup Google Cloud Vision API</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Masukkan API Key Anda untuk menggunakan fitur AI Scanner. API Key akan tersimpan di akun Anda dan tersinkronisasi di semua device.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste API Key di sini..."
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white text-sm"
                      disabled={isProcessing}
                    />
                    <button
                      onClick={async () => {
                        if (apiKey.trim()) {
                          setIsProcessing(true);
                          await saveApiKeyToFirestore(apiKey.trim());
                          setIsProcessing(false);
                          setShowApiKeyInput(false);
                        }
                      }}
                      disabled={!apiKey.trim() || isProcessing}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? 'Menyimpan...' : 'Simpan'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoadingApiKey && !showApiKeyInput && apiKey && (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <CheckCircle size={16} className="text-emerald-600 dark:text-emerald-400" />
                  <span className="font-medium">API Key tersimpan di akun Anda</span>
                  <span className="text-xs text-emerald-600 dark:text-emerald-500">(sync semua device)</span>
                </div>
                <button
                  onClick={() => setShowApiKeyInput(true)}
                  className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  Ubah
                </button>
              </div>
            </div>
          )}

          {/* Upload Section */}
          {!isLoadingApiKey && (
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 sm:p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              id="receipt-upload"
            />

            {!imagePreview ? (
              <label htmlFor="receipt-upload" className="cursor-pointer block">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                    <Bot size={32} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Upload Screenshot / Foto Struk</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Tap untuk memilih gambar</p>

                    <div className="mt-4 text-xs text-left bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <p className="font-semibold text-blue-700 dark:text-blue-400 mb-2">💡 Tips untuk hasil terbaik:</p>
                      <ul className="space-y-1 text-blue-600 dark:text-blue-300">
                        <li>• <strong>Screenshot histori transaksi lengkap</strong> (tanggal, deskripsi, nominal)</li>
                        <li>• Pastikan text <strong>jelas & tidak blur</strong></li>
                        <li>• Hindari <strong>refleksi cahaya</strong> pada layar</li>
                        <li>• Screenshot <strong>dari dalam aplikasi</strong>, bukan foto layar HP</li>
                        <li>• Support: BCA, Mandiri, BRI, Wondr BNI, Jago, OVO, GoPay, Dana, struk belanja</li>
                      </ul>
                    </div>
                  </div>
                  <div className="mt-3 px-6 py-3 sm:py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium active:bg-emerald-800 transition-colors min-h-[48px] flex items-center justify-center touch-manipulation">
                    Pilih Gambar
                  </div>
                </div>
              </label>
            ) : (
              <div className="space-y-4">
                <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg shadow-lg" />
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                  <button
                    onClick={handleReset}
                    className="px-4 py-3 sm:py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium touch-manipulation min-h-[48px]"
                  >
                    Ganti Gambar
                  </button>
                  <button
                    onClick={handleAnalyze}
                    disabled={isProcessing}
                    className="px-6 py-3 sm:py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 touch-manipulation min-h-[48px]"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Menganalisis...
                      </>
                    ) : (
                      <>
                        <Bot size={18} />
                        Analisis dengan AI
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Detected Transactions Table */}
          {!isLoadingApiKey && detectedTransactions.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-100">
                  Transaksi Terdeteksi ({detectedTransactions.filter(t => t.selected).length} dipilih)
                </h3>
                <button
                  onClick={() => setDetectedTransactions(prev => prev.map(t => ({ ...t, selected: !prev[0].selected })))}
                  className="text-xs sm:text-sm text-emerald-600 hover:underline min-h-[48px] px-2 touch-manipulation"
                >
                  {detectedTransactions[0]?.selected ? 'Unselect All' : 'Select All'}
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto border dark:border-gray-700 rounded-lg">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        <input type="checkbox" checked={detectedTransactions.every(t => t.selected)} onChange={() => setDetectedTransactions(prev => prev.map(t => ({ ...t, selected: !prev.every(x => x.selected) })))} className="rounded" />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Nominal</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Akun</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Tanggal</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-300">Catatan</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-gray-700">
                    {detectedTransactions.map((t) => (
                      <tr key={t.id} className={`${t.selected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'bg-white dark:bg-gray-800'}`}>
                        <td className="px-4 py-3">
                          <input type="checkbox" checked={t.selected} onChange={() => handleToggleSelect(t.id)} className="rounded" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="number" value={t.amount} onChange={(e) => handleUpdateTransaction(t.id, 'amount', e.target.value)} className="w-32 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <select value={t.category} onChange={(e) => handleUpdateTransaction(t.id, 'category', e.target.value)} className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm">
                            {categories.expense.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select value={t.walletId} onChange={(e) => handleUpdateTransaction(t.id, 'walletId', e.target.value)} className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm">
                            {wallets.map((w) => (
                              <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input type="date" value={formatDateInput(t.date)} onChange={(e) => handleUpdateTransaction(t.id, 'date', new Date(e.target.value))} className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm" />
                        </td>
                        <td className="px-4 py-3">
                          <input type="text" value={t.note} onChange={(e) => handleUpdateTransaction(t.id, 'note', e.target.value)} className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm" placeholder="Catatan..." />
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeleteTransaction(t.id)} className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden space-y-3">
                {detectedTransactions.map((t) => (
                  <div
                    key={t.id}
                    className={`border dark:border-gray-700 rounded-lg p-4 space-y-3 ${
                      t.selected ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-300 dark:border-emerald-700' : 'bg-white dark:bg-gray-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={t.selected} onChange={() => handleToggleSelect(t.id)} className="rounded min-w-[24px] min-h-[24px]" />
                        <div className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          Rp {Number(t.amount).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <button onClick={() => handleDeleteTransaction(t.id)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded min-h-[48px] min-w-[48px] touch-manipulation flex items-center justify-center">
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nominal</label>
                        <input type="number" value={t.amount} onChange={(e) => handleUpdateTransaction(t.id, 'amount', e.target.value)} className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kategori</label>
                        <select value={t.category} onChange={(e) => handleUpdateTransaction(t.id, 'category', e.target.value)} className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation">
                          {categories.expense.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Akun</label>
                        <select value={t.walletId} onChange={(e) => handleUpdateTransaction(t.id, 'walletId', e.target.value)} className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation">
                          {wallets.map((w) => (
                            <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tanggal</label>
                        <input type="date" value={formatDateInput(t.date)} onChange={(e) => handleUpdateTransaction(t.id, 'date', new Date(e.target.value))} className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catatan</label>
                        <input type="text" value={t.note} onChange={(e) => handleUpdateTransaction(t.id, 'note', e.target.value)} className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation" placeholder="Catatan..." />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button onClick={handleReset} className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium min-h-[48px] touch-manipulation">
                  Reset
                </button>
                <button
                  onClick={handleApproveSelected}
                  disabled={isProcessing || detectedTransactions.filter(t => t.selected).length === 0}
                  className="w-full sm:w-auto px-8 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[48px] touch-manipulation"
                >
                  <CheckCircle size={18} />
                  Approve & Simpan ({detectedTransactions.filter(t => t.selected).length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickAddModal;
