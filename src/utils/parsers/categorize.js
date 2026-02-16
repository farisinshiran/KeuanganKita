// Transaction Categorizer Utility
// Comprehensive pattern matching for 100+ transaction types

/**
 * Categorize banking transaction based on description
 * @param {string} description - Transaction description
 * @param {boolean} isExpense - Whether this is an expense transaction
 * @returns {string} Category name
 */
export const categorizeBankingTransaction = (description, isExpense) => {
  const l = description.toLowerCase();

  // Pocket/Kantong (Jago, BNI Wondr)
  if (/pocket|kantong|saving|tabungan/i.test(l)) return 'Transfer Antar Kantong';
  
  // Investment
  if (/investasi|investment|deposito|reksadana|reksa\s*dana|saham|obligasi/i.test(l)) {
    return isExpense ? 'Investasi' : 'Hasil Investasi';
  }
  
  // Cashback
  if (/cashback|reward|poin|point|promo|voucher|kupon/i.test(l)) return 'Bonus/THR';

  // Transfer
  if (/transfer|trf|tfr|kirim|send|remittance|flip|bi-?fast|rtgs|kliring|sknbi/i.test(l)) {
    return isExpense ? 'Transfer Uang' : 'Transfer Masuk';
  }

  // E-commerce & Retail
  if (/indomaret|alfamart|alfamidi|superindo|giant|carrefour|transmart|hypermart|lotte|farmers|ranch|hari-?hari|yogya|griya|borma/i.test(l)) {
    return 'Belanja Bulanan';
  }
  if (/shopee|tokopedia|tokped|lazada|bukalapak|blibli|zalora|jd\.?id|tiktok\s*shop|amazon/i.test(l)) {
    return 'Belanja Bulanan';
  }
  if (/uniqlo|h&m|zara|miniso|ikea|ace\s*hardware|mr\.?\s*diy|daiso|guardian|watsons|century/i.test(l)) {
    return 'Belanja Bulanan';
  }

  // Food & Beverage
  if (/mcdonald|mcd\b|kfc|burger\s*king|pizza\s*hut|domino|starbucks|sbux|jco|j\.co|chatime|mixue|hokben|yoshinoya|solaria|bakmi|marugame|sushi|ramen|nasi|ayam|geprek|warteg|warung|kantin/i.test(l)) {
    return 'Makan Luar';
  }
  if (/resto|restaurant|cafe|coffee|kopi|kenangan|janji\s*jiwa|fore|tomoro|makan|food|catering|richeese/i.test(l)) {
    return 'Makan Luar';
  }
  if (/gofood|grabfood|shopeefood/i.test(l)) return 'Makan Luar';

  // Transport
  if (/grab(?!food)|gojek|goride|gocar|maxim|taxi|uber|indrive/i.test(l)) return 'Transportasi';
  if (/parkir|parking|tol|toll|e-?toll|bensin|pertamina|shell|spbu|vivo|bp\b/i.test(l)) return 'Transportasi';
  if (/kereta|train|krl|mrt|lrt|transjakarta|busway|bus\b|pesawat|flight|tiket|ticket|traveloka|tiket\.com/i.test(l)) {
    return 'Transportasi';
  }

  // Utilities
  if (/listrik|pln|token\s*listrik|air\b|pdam/i.test(l)) return 'Listrik & Air';
  if (/telkom|indosat|xl\b|tri\b|smartfren|pulsa|paket\s*data|internet|wifi|indihome|biznet|first\s*media|mnc|myrepublic|cbn/i.test(l)) {
    return 'Pulsa & Internet';
  }

  // Subscriptions
  if (/netflix|spotify|youtube|disney|vidio|viu|hbo|apple|google\s*play|icloud|zoom|canva|adobe|microsoft|github|chatgpt|openai/i.test(l)) {
    return 'Langganan';
  }

  // Insurance & Health
  if (/bpjs|asuransi|insurance|prudential|allianz|manulife|aia\b|zurich|sinarmas/i.test(l)) return 'Kesehatan';
  if (/apotek|pharmacy|obat|dokter|doctor|rs\b|rumah\s*sakit|hospital|klinik|clinic|lab\b|halodoc|alodokter|kimia\s*farma/i.test(l)) {
    return 'Kesehatan';
  }

  // Education
  if (/spp|sekolah|school|kuliah|universitas|kursus|course|les\b|bimbel|ruangguru|zenius|skill\s*academy/i.test(l)) {
    return 'Pendidikan (SPP)';
  }

  // Housing
  if (/kos|sewa|rent\b|kontrakan|cicilan|mortgage|kpr|apartemen|apartment|hotel|penginapan|airbnb/i.test(l)) {
    return 'Cicilan Rumah';
  }

  // ATM / Admin / Fees
  if (/tarik\s*tunai|withdrawal|atm/i.test(l)) return 'Tarik Tunai';
  if (/biaya\s*admin|admin\s*fee|monthly\s*fee|biaya\s*bulanan|biaya\s*transaksi|service\s*charge|materai|stamp/i.test(l)) {
    return 'Biaya Admin';
  }
  if (/bunga|interest/i.test(l)) return isExpense ? 'Biaya Bunga' : 'Bunga Bank';

  // Donation
  if (/zakat|infaq|sedekah|donasi|donation|charity|wakaf|sumbangan/i.test(l)) return 'Zakat & Infaq';

  // Salary & Income
  if (/gaji|salary|payroll|honor|upah|wage/i.test(l)) return 'Gaji Pokok';
  if (/bonus|thr|insentif|incentive|komisi|commission/i.test(l)) return 'Bonus/THR';
  if (/dividen|dividend|return\b|yield|profit/i.test(l)) return 'Dividen';
  if (/freelance|sampingan|side.*job|project/i.test(l)) return 'Sampingan';

  // Top-up
  if (/top\s*up|topup|isi\s*saldo|deposit/i.test(l)) {
    return isExpense ? 'Top Up' : 'Pendapatan Lain';
  }

  // Default fallback
  return isExpense ? 'Belanja Bulanan' : 'Pendapatan Lain';
};

/**
 * Categorize merchant name
 * @param {string} merchant - Merchant name
 * @returns {string} Category
 */
export const categorizeMerchant = (merchant) => categorizeBankingTransaction(merchant, true);
