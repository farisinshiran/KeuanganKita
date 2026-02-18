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

/**
 * Fetch gold price in IDR per gram
 * @returns {number} Gold price in IDR per gram
 */
export const fetchGoldPrice = async () => {
  try {
    // Try primary API: metals.live
    try {
      const res = await fetch("https://api.metals.live/v1/spot/gold");
      if (res.ok) {
        const data = await res.json();
        const goldPricePerOz = data.gold;
        const rate = await fetchExchangeRate("USD");
        if (rate && goldPricePerOz) {
          const pricePerGram = (goldPricePerOz * rate) / 31.1035;
          return pricePerGram;
        }
      }
    } catch (err) {
      console.warn("API metals.live gagal, mencoba fallback...", err);
    }

    // Fallback: Menggunakan harga emas historis yang stabil
    // Harga emas terkini berkisar 600.000-750.000 IDR per gram
    console.warn("Menggunakan harga emas fallback: 700.000 IDR");
    return 700000; // Fallback yang lebih realistis
  } catch (error) {
    console.error("Gagal mengambil harga emas:", error);
    return 700000; // Return default fallback price
  }
};
