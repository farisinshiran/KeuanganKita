import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from '../ui/Icon';
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
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-tertiary-fixed/30 flex items-center justify-center">
          <Icon name="workspace_premium" size={22} className="text-tertiary" />
        </div>
        <h2 className="text-2xl font-extrabold text-on-surface">Kalkulator Zakat Mal</h2>
      </div>

      {/* ── Gold price card ── */}
      <div className="bg-surface-container-low rounded-2xl p-6">
        <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2">
          <Icon name="diamond" size={18} className="text-tertiary" /> Harga Emas Terkini
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <p className="text-xs text-on-surface-variant font-semibold uppercase mb-2">Harga (Per Gram)</p>
            {loading ? (
              <p className="text-lg font-bold text-on-surface-variant animate-pulse">Memuat...</p>
            ) : (
              <div>
                <p className="text-xl font-bold text-on-surface">{fmt(currentPrice || 0)}</p>
                <p className="mt-1.5">
                  {goldSource === 'live' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-container text-on-secondary-container">
                      <Icon name="check_circle" size={11} /> Live API
                    </span>
                  )}
                  {goldSource === 'cache' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-tertiary-fixed/30 text-tertiary">
                      <Icon name="inventory_2" size={11} /> Cache · {new Date(JSON.parse(localStorage.getItem('dompet_gold_price') || '{}').timestamp || 0).toLocaleDateString('id-ID')}
                    </span>
                  )}
                  {goldSource === 'default' && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-error-container text-on-error-container">
                      <Icon name="warning" size={11} /> Estimasi default
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs text-on-surface-variant font-semibold uppercase">Ubah Harga Manual (Rp)</label>
            <input
              type="number"
              value={customGoldPrice}
              onChange={(e) => setCustomGoldPrice(e.target.value)}
              placeholder="Masukkan harga emas..."
              className="w-full p-2.5 bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20 outline-none text-on-surface text-sm"
            />
          </div>
          <div>
            <p className="text-xs text-on-surface-variant font-semibold uppercase mb-2">Nisab (85 gram)</p>
            <p className="text-xl font-bold text-on-surface">{fmt(nisab)}</p>
            <button
              onClick={() => { setCustomGoldPrice(''); loadGoldPrice(); }}
              disabled={loading}
              className="mt-3 px-3 py-1.5 bg-surface-container-high text-on-surface rounded-xl text-xs font-medium flex items-center gap-1.5 hover:bg-surface-container-highest transition-colors disabled:opacity-50"
            >
              <Icon name="refresh" size={13} className={loading ? 'animate-spin' : ''} /> Muat Ulang
            </button>
          </div>
        </div>
      </div>


      {/* ── Asset cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-container-low rounded-2xl p-5">
          <p className="text-xs text-on-surface-variant font-semibold uppercase mb-2">Saldo Kas</p>
          <p className="text-2xl font-bold text-on-surface">
            {fmt((summary.walletBalances || []).filter(w => w.type !== 'credit_card').reduce((a, w) => a + w.currentBalance, 0))}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">Dompet &amp; rekening aktif</p>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5">
          <p className="text-xs text-on-surface-variant font-semibold uppercase mb-2">Nilai Investasi</p>
          <p className="text-2xl font-bold text-on-surface">
            {fmt(investments.reduce((a, c) => a + (Number(c.currentValue) || 0), 0))}
          </p>
          <p className="text-xs text-on-surface-variant mt-1">Saham, RD, emas, dll.</p>
        </div>
        <div className="bg-surface-container-low rounded-2xl p-5">
          <p className="text-xs text-on-surface-variant font-semibold uppercase mb-2">Total Aset Cair</p>
          <p className="text-2xl font-bold text-on-surface">{fmt(totalLiquidAssets)}</p>
          <p className="text-xs text-on-surface-variant mt-1">Kas + investasi</p>
        </div>
      </div>

      {/* ── Nisab status ── */}
      <div className={`p-6 rounded-2xl ${isNisabReached ? 'bg-secondary-container' : 'bg-error-container/20'}`}>
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isNisabReached ? 'bg-on-secondary-container/20' : 'bg-error-container'}`}>
            <Icon name={isNisabReached ? 'check_circle' : 'warning'} size={22} className={isNisabReached ? 'text-on-secondary-container' : 'text-on-error-container'} />
          </div>
          <div>
            <h3 className={`font-bold text-lg mb-2 ${isNisabReached ? 'text-on-secondary-container' : 'text-on-error-container'}`}>
              {isNisabReached ? 'Sudah Mencapai Nisab' : 'Belum Mencapai Nisab'}
            </h3>
            <div className={`text-sm space-y-1 ${isNisabReached ? 'text-on-secondary-container/80' : 'text-on-error-container/80'}`}>
              <p>Total aset Anda: <span className="font-bold">{fmt(totalLiquidAssets)}</span></p>
              <p>{isNisabReached ? 'Telah melampaui nisab' : 'Nisab yang dibutuhkan'}: <span className="font-bold">{fmt(nisab)}</span></p>
              <p className="mt-1">{isNisabReached ? 'Selisih' : 'Masih kurang'}: <span className="font-bold">{fmt(Math.abs(totalLiquidAssets - nisab))}</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Zakat hero ── */}
      {isNisabReached && (
        <div className="bg-gradient-to-br from-primary to-primary-container rounded-3xl p-8">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="volunteer_activism" size={22} className="text-on-primary" />
            <h3 className="font-bold text-lg text-on-primary">Zakat Mal yang Perlu Dibayarkan</h3>
          </div>
          <p className="text-xs text-on-primary/70 mb-6">2,5% dari total aset cair dan investasi</p>
          <div className="bg-on-primary/10 rounded-2xl p-6 text-center mb-4">
            <p className="text-sm text-on-primary/70 mb-2">Jumlah Zakat Mal</p>
            <p className="text-5xl font-extrabold text-on-primary">{fmt(zakatAmount)}</p>
            <p className="text-xs text-on-primary/60 mt-2">{totalLiquidAssets.toLocaleString('id-ID')} × 2,5%</p>
          </div>
          <p className="text-sm text-on-primary/70 text-center">Zakat baru wajib jika mencapai nisab selama 1 tahun penuh (haul)</p>
        </div>
      )}
    </div>
  );
};

export default ZakatView;
