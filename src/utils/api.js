// API Utility Functions

/**
 * Fetch exchange rate from IDR
 * @param {string} currency - Currency code (e.g. 'USD', 'SGD')
 * @returns {number|null} Exchange rate to IDR, or null on failure
 */
export const fetchExchangeRate = async (currency) => {
  if (currency === "IDR") return 1;
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${currency}&to=IDR`,
    );
    const data = await res.json();
    return data.rates.IDR;
  } catch (error) {
    console.error("Gagal mengambil kurs:", error);
    return null;
  }
};

const GOLD_CACHE_KEY = 'dompet_gold_price';
const GOLD_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in ms

/** Read cached gold price from localStorage (returns null if expired or missing) */
const readGoldCache = () => {
  try {
    const raw = localStorage.getItem(GOLD_CACHE_KEY);
    if (!raw) return null;
    const { price, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp < GOLD_CACHE_TTL) return price;
  } catch { /* ignore */ }
  return null;
};

/** Persist gold price to localStorage */
const writeGoldCache = (price) => {
  try {
    localStorage.setItem(GOLD_CACHE_KEY, JSON.stringify({ price, timestamp: Date.now() }));
  } catch { /* ignore — storage may be full */ }
};

/**
 * Fetch gold price in IDR per gram.
 * Sources tried in order:
 *   1. goldprice.org  — free, no key, CORS-friendly
 *   2. metals.live    — fallback (may be blocked on some networks)
 *   3. localStorage   — cached value up to 24 h old
 *   4. 700 000 IDR    — hardcoded estimate
 * Successful results are cached to localStorage.
 * @returns {number} Gold price in IDR per gram
 */
export const fetchGoldPrice = async () => {
  // ── Source 1: goldprice.org (CORS-friendly, no API key needed) ──
  try {
    const res = await fetch('https://data-asg.goldprice.org/dbXRates/IDR', {
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      // Response: { items: [{ curr: "IDR", xauPrice: <price-per-troy-oz> }] }
      const item = data?.items?.find(i => i.curr === 'IDR');
      if (item?.xauPrice) {
        const pricePerGram = item.xauPrice / 31.1035;
        writeGoldCache(pricePerGram);
        return pricePerGram;
      }
    }
  } catch {
    // no-op — try next source
  }

  // ── Source 2: metals.live ──
  try {
    const res = await fetch('https://api.metals.live/v1/spot/gold');
    if (res.ok) {
      const data = await res.json();
      const rate = await fetchExchangeRate('USD');
      if (rate && data.gold) {
        const pricePerGram = (data.gold * rate) / 31.1035;
        writeGoldCache(pricePerGram);
        return pricePerGram;
      }
    }
  } catch {
    // no-op — try next source
  }

  // ── Source 3: localStorage cache (up to 24 h old) ──
  const cached = readGoldCache();
  if (cached) {
    console.warn('Harga emas dari cache localStorage:', cached);
    return cached;
  }

  // ── Source 4: hardcoded realistic estimate ──
  console.warn('Menggunakan harga emas default: 700.000 IDR');
  return 700000;
};

