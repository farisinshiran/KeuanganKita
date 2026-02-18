// ============================================================
// ROBUST RECEIPT & BANKING TRANSACTION PARSER v3.0
// Supports: All banking apps, e-wallets, retail receipts, invoices, QRIS
// ============================================================

import { categorizeBankingTransaction } from './categorize';

// --- Helper: Extract ALL amounts from a string ---
export const extractAmounts = (str) => {
  const results = [];
  const patterns = [
    /(?:Rp\.?\s*|IDR\s*|Rp\s*)([+-]?\s*\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)/gi,
    /(?:^|[\s(=:])([+-]?\s*\d{1,3}(?:\.\d{3})+(?:,\d{2})?)(?=[\s).,;]|$)/gm,
    /(?:^|[\s(=:])([+-]?\s*\d{1,3}(?:,\d{3})+(?:\.\d{2})?)(?=[\s).,;]|$)/gm,
    /(?:^|[\s(=:])([+-]?\s*\d{5,12})(?=[\s).,;]|$)/gm,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(str)) !== null) {
      let raw = m[1].replace(/\s/g, '');
      const sign = raw.startsWith('-') ? -1 : 1;
      raw = raw.replace(/^[+-]/, '');
      let num;
      if (/^\d{1,3}(\.\d{3})+(,\d{2})?$/.test(raw)) {
        num = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
      } else if (/^\d{1,3}(,\d{3})+(\.\d{2})?$/.test(raw)) {
        num = parseFloat(raw.replace(/,/g, ''));
      } else {
        num = parseFloat(raw.replace(/[.,]/g, ''));
      }
      if (!isNaN(num) && num >= 100 && num <= 99999999999) {
        results.push({ amount: Math.round(num) * sign, index: m.index, raw: m[0].trim() });
      }
    }
  }

  // Deduplicate by absolute value (keep first occurrence)
  const seen = new Set();
  return results.filter(r => {
    const key = Math.abs(r.amount);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// --- Helper: Extract date from a string (Enhanced for mobile banking) ---
export const extractDate = (str, allowPartial = false) => {
  const mm = { jan:0,feb:1,mar:2,apr:3,mei:4,may:4,jun:5,jul:6,aug:7,agu:7,sep:8,sept:8,oct:9,okt:9,nov:10,dec:11,des:11 };
  const currentYear = new Date().getFullYear();

  const pats = [
    // Full date formats
    { re: /(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{4})/, fn: m => new Date(+m[3], +m[2]-1, +m[1]) },
    { re: /(\d{4})[\/\-.\s](\d{1,2})[\/\-.\s](\d{1,2})/, fn: m => new Date(+m[1], +m[2]-1, +m[3]) },
    { re: /(\d{1,2})[\/\-.\s](\d{1,2})[\/\-.\s](\d{2})(?!\d)/, fn: m => new Date(2000+ +m[3], +m[2]-1, +m[1]) },

    // Month name formats
    { re: /(\d{1,2})\s+(jan|feb|mar|apr|mei|may|jun|jul|aug|agu|sep|sept|oct|okt|nov|dec|des)\w*[\s,]+(\d{4})/i, fn: m => new Date(+m[3], mm[m[2].toLowerCase().substring(0,3)], +m[1]) },
    { re: /(jan|feb|mar|apr|mei|may|jun|jul|aug|agu|sep|sept|oct|okt|nov|dec|des)\w*\s+(\d{1,2})[\s,]+(\d{4})/i, fn: m => new Date(+m[3], mm[m[1].toLowerCase().substring(0,3)], +m[2]) },
    { re: /(\d{1,2})\s+(jan|feb|mar|apr|mei|may|jun|jul|aug|agu|sep|sept|oct|okt|nov|dec|des)\w*(?:\s+(\d{2}))?/i, fn: m => new Date(m[3]?2000+ +m[3]:currentYear, mm[m[2].toLowerCase().substring(0,3)], +m[1]) },

    // Common mobile banking formats (compact)
    { re: /(\d{2})(\d{2})(\d{4})/, fn: m => new Date(+m[3], +m[2]-1, +m[1]) }, // ddmmyyyy
    { re: /(\d{4})(\d{2})(\d{2})/, fn: m => new Date(+m[1], +m[2]-1, +m[3]) }, // yyyymmdd

    // Partial dates (if allowed) - uses current year
    ...(allowPartial ? [
      { re: /(\d{1,2})[\/\-.\s](\d{1,2})(?!\d)/, fn: m => new Date(currentYear, +m[2]-1, +m[1]) },
      { re: /(\d{1,2})\s+(jan|feb|mar|apr|mei|may|jun|jul|aug|agu|sep|sept|oct|okt|nov|dec|des)\w*/i, fn: m => new Date(currentYear, mm[m[2].toLowerCase().substring(0,3)], +m[1]) },
    ] : [])
  ];

  for (const { re, fn } of pats) {
    const m = str.match(re);
    if (m) {
      const d = fn(m);
      if (d && !isNaN(d.getTime()) && d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
        return d;
      }
    }
  }
  return null;
};

// --- Helper: Detect income vs expense ---
export const detectTxType = (ctxArr) => {
  const ctx = ctxArr.join(' ').toLowerCase();
  const expSigs = [/-\s*(?:rp|idr)/i, /\bDB\b|\bdebet\b|\bdebit\b/i, /keluar|out\b/i, /pembelian|purchase|bayar|payment/i, /transfer\s*ke|kirim|send/i, /tarik|withdraw/i, /belanja|beli\b/i, /biaya|fee|charge/i, /pengeluaran/i];
  const incSigs = [/\+\s*(?:rp|idr)/i, /\bCR\b|\bkredit\b|\bcredit\b/i, /masuk|in\b/i, /terima|receive/i, /deposit|top\s?up/i, /gaji|salary/i, /cashback|reward|bonus/i, /pemasukan/i, /dari\b.*(?:transfer|trf)/i];
  let e=0, i=0;
  for (const p of expSigs) if (p.test(ctx)) e++;
  for (const p of incSigs) if (p.test(ctx)) i++;
  return i > e ? 'income' : 'expense';
};

// --- Main parser ---
export const parseReceiptText = (text) => {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const lower = text.toLowerCase();
  console.log('📄 Total lines:', lines.length);

  // ====== PHASE 1: Detect document type ======
  const bankKw = /mutasi|transaksi|saldo|transaction|balance|history|histori|riwayat|rekening|account|statement|e-?statement/i;
  const bankApp = /wondr|bank\s*jago|jago|bni|bca|mandiri|bri|cimb|btn|bsi|permata|danamon|ocbc|jenius|livin|digibank|blu|seabank|neo|line\s*bank|allo\s*bank|superbank|most/i;
  const ewallet = /gopay|ovo|dana|shopeepay|linkaja|isaku|sakuku|doku|flip/i;
  const rcptKw = /total|subtotal|tax|ppn|kembalian|change|tunai|cash\b|kasir|cashier|receipt|struk|nota|invoice|faktur/i;
  const qrisKw = /qris|qr\s*payment|scan.*bayar|merchant/i;

  const isBank = bankKw.test(lower) || bankApp.test(lower);
  const isEwallet = ewallet.test(lower);
  const isReceipt = rcptKw.test(lower) && !isBank && !isEwallet;
  const isQris = qrisKw.test(lower);

  let source = 'unknown';
  const srcMatch = text.match(bankApp) || text.match(ewallet);
  if (srcMatch) source = srcMatch[0];
  console.log(`🔍 Type: bank=${isBank}, ewallet=${isEwallet}, receipt=${isReceipt}, qris=${isQris}, src=${source}`);

  // ====== PHASE 2: Global date ======
  let globalDate = new Date();
  for (const line of lines.slice(0, 15)) {
    const d = extractDate(line, false);
    if (d) {
      globalDate = d;
      console.log(`📅 Global date detected: ${d.toLocaleDateString('id-ID')} from line: "${line}"`);
      break;
    }
  }
  if (!globalDate || globalDate.getTime() === new Date().getTime()) {
    console.log('⚠️ No global date found, using today');
  }

  // ====== PHASE 3A: Banking / E-Wallet ======
  if (isBank || isEwallet) {
    console.log('🏦 Parsing as BANKING / E-WALLET');
    const txs = [];
    const used = new Set();
    const noise = /^(mutasi|transaksi|histori|riwayat|saldo\s*(awal|akhir|tersedia|efektif)|opening|closing|rekening|account|period|no\.|halaman|page|\d{10,}|total\s*(?:debit|kredit|credit))/i;
    const balanceNoise = /saldo\s*(awal|akhir|tersedia|efektif)|opening.*balance|closing.*balance|available.*balance/i;

    // Find all amount-bearing lines
    const amtLines = [];
    for (let i = 0; i < lines.length; i++) {
      if (noise.test(lines[i]) || balanceNoise.test(lines[i])) continue;
      const amts = extractAmounts(lines[i]);
      if (amts.length > 0) amtLines.push({ idx: i, line: lines[i], amts });
    }
    console.log(`💰 ${amtLines.length} lines with amounts`);

    for (const al of amtLines) {
      if (used.has(al.idx)) continue;
      const i = al.idx;
      const ctx = [];
      for (let j = Math.max(0,i-3); j <= Math.min(lines.length-1,i+3); j++) ctx.push(lines[j]);

      const primary = al.amts.reduce((a,b) => Math.abs(a.amount) > Math.abs(b.amount) ? a : b);
      const amount = Math.abs(primary.amount);

      const txType = detectTxType(ctx);

      // Enhanced date search - look further and try harder
      let txDate = null;

      // Strategy 1: Check surrounding lines (wider radius)
      for (let j = Math.max(0,i-4); j <= Math.min(lines.length-1,i+2); j++) {
        txDate = extractDate(lines[j], false);
        if (txDate) break;
      }

      // Strategy 2: Try combining adjacent lines (for split dates)
      if (!txDate) {
        for (let j = Math.max(0,i-3); j < Math.min(lines.length-1,i+2); j++) {
          const combined = lines[j] + ' ' + lines[j+1];
          txDate = extractDate(combined, false);
          if (txDate) break;
        }
      }

      // Strategy 3: Allow partial dates (dd/mm without year)
      if (!txDate) {
        for (let j = Math.max(0,i-3); j <= Math.min(lines.length-1,i+2); j++) {
          txDate = extractDate(lines[j], true);
          if (txDate) break;
        }
      }

      // Strategy 4: Look for isolated date patterns in context window
      if (!txDate) {
        const contextText = ctx.join(' ');
        txDate = extractDate(contextText, true);
      }

      // Fallback to global date
      if (!txDate) {
        console.log(`⚠️ No date found for line ${i}: "${al.line.substring(0, 50)}..." - using global date`);
        txDate = globalDate;
      } else {
        console.log(`📅 Date found for transaction: ${txDate.toLocaleDateString('id-ID')}`);
      }

      // Build description
      let desc = '';
      // Strategy 1: same line minus amount
      const cleaned = al.line.replace(/(?:Rp\.?\s*|IDR\s*)?[+-]?\s*\d[\d.,\s]*\d/g, '').replace(/[+-]/g, '').trim();
      if (cleaned.length > 2 && !/^[\d\s\/\-.,]+$/.test(cleaned)) desc = cleaned;

      // Strategy 2-4: neighbor lines
      if (!desc || desc.length < 3) {
        for (const off of [-1, 1, -2, 2]) {
          const ni = i + off;
          if (ni < 0 || ni >= lines.length || used.has(ni)) continue;
          const cand = lines[ni];
          if (noise.test(cand) || balanceNoise.test(cand)) continue;
          if (extractAmounts(cand).length > 0 && off > 0) continue;
          if (/^[\d\s\/\-.,]+$/.test(cand)) continue;
          const c2 = cand.replace(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g, '').replace(/\d{1,2}\s+(?:jan|feb|mar|apr|mei|jun|jul|aug|sep|oct|nov|dec)\w*/gi, '').trim();
          if (c2.length > 2) { desc = c2; used.add(ni); break; }
        }
      }

      desc = desc.replace(/^(tanggal|date|desc|keterangan|nominal|amount|jumlah|db|cr|debit|kredit|type)[:;\s-]*/gi, '').replace(/\s{2,}/g, ' ').trim();
      if (!desc || desc.length < 2) desc = `Transaksi ${source}`;
      if (desc.length > 120) desc = desc.substring(0, 117) + '...';

      txs.push({ amount, category: categorizeBankingTransaction(desc, txType === 'expense'), note: desc, date: txDate, type: txType, selected: true });
      used.add(i);
    }

    if (txs.length > 0) {
      console.log(`✅ Banking: ${txs.length} transactions`);
      return txs;
    }
    console.log('⚠️ Banking parser found 0, falling through...');
  }

  // ====== PHASE 3B: QRIS / Single payment ======
  if (isQris || (!isBank && !isEwallet && !isReceipt)) {
    const all = [];
    for (const line of lines) all.push(...extractAmounts(line));
    if (all.length > 0 && all.length <= 5) {
      const main = all.reduce((a,b) => Math.abs(a.amount) > Math.abs(b.amount) ? a : b);
      let desc = '';
      for (const line of lines) {
        if (/merchant|toko|nama|kepada|to\b|penerima|receiver/i.test(line)) {
          desc = line.replace(/merchant|toko|nama|kepada|to|penerima|receiver|[:;\s]/gi, '').trim();
          break;
        }
      }
      if (!desc) desc = lines.filter(l => !/^[\d\s\/\-.,+Rp]+$/i.test(l) && l.length > 3).sort((a,b) => b.length - a.length)[0] || 'Pembayaran';
      const t = detectTxType(lines);
      console.log(`✅ Single payment: ${desc}`);
      return [{ amount: Math.abs(main.amount), category: categorizeBankingTransaction(desc, t==='expense'), note: desc.substring(0,120), date: globalDate, type: t, selected: true }];
    }
  }

  // ====== PHASE 3C: Retail receipt ======
  console.log('🧾 Parsing as RETAIL RECEIPT');
  const txs = [];

  // Merchant detection
  const mdb = [
    [/indomaret/i,'Indomaret'],[/alfamart|alfamidi/i,'Alfamart'],[/superindo/i,'Super Indo'],
    [/giant|hero/i,'Giant'],[/carrefour|transmart/i,'Transmart'],[/hypermart/i,'Hypermart'],
    [/mcdonald|mcd\b/i,"McDonald's"],[/kfc/i,'KFC'],[/burger\s*king/i,'Burger King'],
    [/pizza\s*hut/i,'Pizza Hut'],[/domino/i,"Domino's"],[/starbucks|sbux/i,'Starbucks'],
    [/jco|j\.co/i,'J.CO'],[/chatime/i,'Chatime'],[/mixue/i,'Mixue'],
    [/hokben|hoka/i,'HokBen'],[/solaria/i,'Solaria'],[/yoshinoya/i,'Yoshinoya'],
    [/grab/i,'Grab'],[/gojek|goto/i,'Gojek'],[/shopee/i,'Shopee'],
    [/tokopedia|tokped/i,'Tokopedia'],[/lazada/i,'Lazada'],[/bukalapak/i,'Bukalapak'],
    [/blibli/i,'Blibli'],[/pertamina/i,'Pertamina'],[/shell/i,'Shell'],
    [/ikea/i,'IKEA'],[/uniqlo/i,'Uniqlo'],[/miniso/i,'Miniso'],
    [/ace\s*hardware/i,'ACE Hardware'],[/guardian|watsons/i,'Guardian'],
    [/daiso/i,'Daiso'],[/mr\.?\s*diy/i,'Mr. DIY'],[/lotte/i,'Lotte Mart'],
  ];
  let merchant = '';
  for (const line of lines.slice(0,8)) {
    for (const [re,name] of mdb) { if (re.test(line)) { merchant = name; break; } }
    if (merchant) break;
  }
  if (!merchant) merchant = lines.slice(0,5).find(l => l.length > 3 && !/^[\d\s\/\-.,+:]+$/.test(l) && !/tanggal|date|kasir|receipt|struk/i.test(l)) || '';

  // Find total
  let totalAmt = 0, totalIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/(?:grand\s*)?total|total\s*(?:bayar|belanja|harga|pembayaran|tagihan)|amount\s*due|jumlah\s*(?:bayar|total)?/i.test(lines[i])) {
      let amts = extractAmounts(lines[i]);
      if (!amts.length && i+1 < lines.length) amts = extractAmounts(lines[i+1]);
      if (amts.length) {
        const big = amts.reduce((a,b) => Math.abs(a.amount)>Math.abs(b.amount)?a:b);
        totalAmt = Math.abs(big.amount);
        totalIdx = i;
      }
    }
  }

  // Parse items
  for (let i = 0; i < lines.length; i++) {
    if (i === totalIdx) continue;
    const line = lines[i];
    if (/kasir|cashier|struk|receipt|terima\s*kasih|thank|member|nota|invoice|no\.|telp|alamat|address/i.test(line)) continue;
    if (/total|subtotal|tax|ppn|diskon|discount|kembalian|change|tunai|cash\b|debit|kredit|credit|visa|master/i.test(line)) continue;

    const amts = extractAmounts(line);
    if (amts.length > 0) {
      const a = amts.reduce((x,y) => Math.abs(x.amount)>Math.abs(y.amount)?x:y);
      const abs = Math.abs(a.amount);
      if (abs < 500 || (totalAmt > 0 && abs === totalAmt)) continue;

      let item = line.replace(/(?:Rp\.?\s*|IDR\s*)?[+-]?\s*\d[\d.,\s]*\d/g, '').replace(/[xX*@]\s*\d+/g, '').trim();
      if (item.length < 2 && i > 0 && !extractAmounts(lines[i-1]).length) item = lines[i-1].trim();
      if (item.length < 2) item = `Item ${txs.length+1}`;

      txs.push({ amount: abs, category: categorizeBankingTransaction(merchant||item, true), note: merchant ? `${merchant} - ${item}` : item, date: globalDate, type: 'expense', selected: true });
    }
  }

  if (!txs.length && totalAmt > 0) {
    txs.push({ amount: totalAmt, category: categorizeBankingTransaction(merchant, true), note: merchant || 'Pembelian', date: globalDate, type: 'expense', selected: true });
  }

  // ====== PHASE 4: Ultimate fallback ======
  if (!txs.length) {
    console.log('🔄 Fallback: extracting all amounts');
    const all = [];
    for (const line of lines) for (const a of extractAmounts(line)) if (Math.abs(a.amount)>=1000) all.push({...a,line});
    const seen = new Set();
    const uniq = all.filter(a => { const k=Math.abs(a.amount); if(seen.has(k))return false; seen.add(k); return true; }).sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount));
    for (const a of uniq.slice(0,10)) {
      let note = a.line.replace(/(?:Rp\.?\s*|IDR\s*)?[+-]?\s*\d[\d.,\s]*\d/g,'').trim();
      if (note.length < 2) note = merchant || 'Transaksi';
      txs.push({ amount: Math.abs(a.amount), category: 'Belanja Bulanan', note: note.substring(0,120), date: globalDate, type: 'expense', selected: false });
    }
  }

  if (!txs.length) {
    return [{ amount: 0, category: 'Belanja Bulanan', note: '⚠️ Gagal baca otomatis: '+text.substring(0,150), date: new Date(), type: 'expense', selected: false }];
  }

  console.log(`✅ Total: ${txs.length} transactions`);
  return txs;
};
