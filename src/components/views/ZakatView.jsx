import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Globe, AlertTriangle, CheckCircle, Heart, RefreshCw } from 'lucide-react';
import { fetchGoldPrice } from '../../utils/api';

const ZakatView = ({ summary, investments, fmt }) => {
  const [goldPrice, setGoldPrice] = useState(null);
  const [goldSource, setGoldSource] = useState(''); // 'live' | 'cache' | 'default'
  const [loading, setLoading] = useState(true);
  const [customGoldPrice, setCustomGoldPrice] = useState('');
  const NISAB_GOLD_GRAMS = 85;

  const loadGoldPrice = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('https://api.metals.live/v1/spot/gold');
      if (res.ok) {
        const data = await res.json();
        const rateRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=IDR');
        const rateData = await rateRes.json();
        const rate = rateData.rates.IDR;
        if (rate && data.gold) {
          const price = (data.gold * rate) / 31.1035;
          setGoldPrice(price);
          setGoldSource('live');
          // Persist to shared localStorage cache
          await fetchGoldPrice();
          setLoading(false);
          return;
        }
      }
    } catch { /* fall through to fallback */ }

    const fallback = await fetchGoldPrice();
    const isCached = !!localStorage.getItem('dompet_gold_price');
    setGoldPrice(fallback);
    setGoldSource(isCached ? 'cache' : 'default');
    setLoading(false);
  }, []);

  // loadGoldPrice is async — all setState calls happen after awaited fetches, not synchronously
  // eslint-disable-next-line react-compiler/react-compiler
  useEffect(() => { loadGoldPrice(); }, [loadGoldPrice]);


  const nisab = useMemo(() => {
    const price = customGoldPrice ? Number(customGoldPrice) : goldPrice;
    return price ? NISAB_GOLD_GRAMS * price : 0;
  }, [goldPrice, customGoldPrice]);

  const totalLiquidAssets = useMemo(() => {
    const liquidWallets = (summary.walletBalances || [])
      .filter(w => w.type !== 'credit_card')
      .reduce((a, w) => a + w.currentBalance, 0);
    const investmentValue = investments.reduce((a, c) => a + (Number(c.currentValue) || 0), 0);
    return liquidWallets + investmentValue;
  }, [summary, investments]);

  const isNisabReached = totalLiquidAssets >= nisab;
  const zakatAmount = isNisabReached ? totalLiquidAssets * 0.025 : 0;
  const currentPrice = customGoldPrice ? Number(customGoldPrice) : goldPrice;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Kalkulator Zakat Mal</h2>

      <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-100 dark:border-amber-800">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Globe size={18} className="text-amber-600"/> Harga Emas Terkini
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase mb-1">Harga Emas (Per Gram)</p>
          {loading ? (
              <p className="text-lg font-bold text-gray-400 animate-pulse">Memuat...</p>
            ) : (
              <div>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(currentPrice || 0)}</p>
                <p className="text-xs mt-1">
                  {goldSource === 'live' && <span className="text-green-600 dark:text-green-400">✅ Live API</span>}
                  {goldSource === 'cache' && <span className="text-amber-500 dark:text-amber-400">📦 Dari cache ({new Date(JSON.parse(localStorage.getItem('dompet_gold_price') || '{}').timestamp || 0).toLocaleDateString('id-ID')})</span>}
                  {goldSource === 'default' && <span className="text-gray-400">⚠️ Estimasi default</span>}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase">Ubah Harga Manual (Rp)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={customGoldPrice}
                onChange={(e) => setCustomGoldPrice(e.target.value)}
                placeholder="Masukkan harga emas..."
                className="flex-1 p-2.5 border border-amber-200 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-amber-900/20 dark:text-white text-sm"
              />
              <button
                onClick={() => setCustomGoldPrice(customGoldPrice)}
                disabled={!customGoldPrice}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-3 py-2.5 rounded-lg text-sm font-medium"
              >
                Terapkan
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase mb-1">Nisab (85 gr)</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(nisab)}</p>
            <button
                onClick={() => { setCustomGoldPrice(''); loadGoldPrice(); }}
                disabled={loading}
                className="text-xs mt-2 px-2 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300 rounded disabled:opacity-50 flex items-center gap-1"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''}/> Muat Ulang
              </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Saldo Kas</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {fmt((summary.walletBalances || []).filter(w => w.type !== 'credit_card').reduce((a, w) => a + w.currentBalance, 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Nilai Investasi</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {fmt(investments.reduce((a, c) => a + (Number(c.currentValue) || 0), 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Total Aset Cair</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalLiquidAssets)}</p>
        </div>
      </div>

      <div className={`p-6 rounded-xl border ${isNisabReached ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'}`}>
        <div className="flex items-start gap-4">
          {isNisabReached ? <CheckCircle className="text-green-600 dark:text-green-400 mt-1 shrink-0" size={24} /> : <AlertTriangle className="text-red-600 dark:text-red-400 mt-1 shrink-0" size={24} />}
          <div>
            <h3 className={`font-bold text-lg mb-2 ${isNisabReached ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {isNisabReached ? '✓ Sudah Mencapai Nisab' : '✗ Belum Mencapai Nisab'}
            </h3>
            <div className={`text-sm ${isNisabReached ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              <p>Total aset Anda: <span className="font-bold">{fmt(totalLiquidAssets)}</span></p>
              <p>{isNisabReached ? 'Telah melampaui' : 'Nisab yang dibutuhkan'}: <span className="font-bold">{fmt(nisab)}</span></p>
              <p className="mt-2">{isNisabReached ? 'Selisih' : 'Masih kurang'}: <span className="font-bold">{fmt(Math.abs(totalLiquidAssets - nisab))}</span></p>
            </div>
          </div>
        </div>
      </div>

      {isNisabReached && (
        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 p-8 rounded-xl border border-emerald-200 dark:border-emerald-800">
          <h3 className="font-bold text-2xl text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-2">
            <Heart size={24} className="text-red-500"/> Zakat Mal yang Perlu Dibayarkan
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">2,5% dari total aset cair dan investasi</p>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-emerald-200 dark:border-emerald-700 mb-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Jumlah Zakat Mal</p>
            <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(zakatAmount)}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">({totalLiquidAssets.toLocaleString('id-ID')} × 2,5%)</p>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center">Zakat baru wajib jika mencapai nisab selama 1 tahun penuh (haul)</p>
        </div>
      )}
    </div>
  );
};

export default ZakatView;
