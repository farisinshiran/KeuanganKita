import React, { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { 
  Plus, Minus, Wallet, TrendingUp, PieChart, Settings, Trash2, Save, X, 
  Menu, ArrowUpRight, ArrowDownRight, Coins, LogOut, Landmark, AlertTriangle, Target, Edit2, LogIn,
  User, Calendar, CheckCircle, Eye, EyeOff, Moon, Sun, Heart, CreditCard, Banknote, Smartphone, ArrowRightLeft, Repeat, Briefcase, Globe, RefreshCw, Bot, ListFilter, DollarSign, BarChart3, ScanLine, GraduationCap, Baby, School
} from 'lucide-react';
import { 
  PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip as ReTooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithPopup,
  GoogleAuthProvider,
  signOut
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, where, onSnapshot, 
  deleteDoc, doc, orderBy, serverTimestamp, updateDoc, setDoc, getDoc
} from 'firebase/firestore';

// --- 1. KONFIGURASI FIREBASE (MODULAR - SECURITY IMPROVED) ---
// Import from separate config file (uses environment variables)
import { app, auth, db, appId, APP_VERSION } from './config/firebase';

// --- 2. UTILITY FUNCTIONS (MODULAR) ---
import { formatCurrency, formatDate, formatDateInput, parseDate } from './utils/formatters';
import { categorizeBankingTransaction, categorizeMerchant } from './utils/parsers/categorize';
import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_INCOME_CATEGORIES, DEFAULT_INVESTMENT_TYPES, DEFAULT_WALLETS } from './constants/categories';
import { CURRENCIES, COLORS } from './constants/currencies';

const fetchExchangeRate = async (currency) => {
  if (currency === 'IDR') return 1;
  try {
    const res = await fetch(`https://api.frankfurter.app/latest?from=${currency}&to=IDR`);
    const data = await res.json();
    return data.rates.IDR;
  } catch (error) {
    console.error("Gagal mengambil kurs:", error);
    return null;
  }
};

// Function to fetch gold price (in IDR per gram)
const fetchGoldPrice = async () => {
  try {
    // Try primary API: metals.live
    try {
      const res = await fetch('https://api.metals.live/v1/spot/gold');
      if (res.ok) {
        const data = await res.json();
        const goldPricePerOz = data.gold;
        const rate = await fetchExchangeRate('USD');
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

// ============================================================
// ROBUST RECEIPT & BANKING TRANSACTION PARSER v3.0
// Supports: All banking apps, e-wallets, retail receipts, invoices, QRIS
// ============================================================

// Vision API Integration
const analyzeReceiptWithVision = async (imageFile, apiKey) => {
  try {
    const base64Image = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(imageFile);
    });

    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [
              { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 },
              { type: 'TEXT_DETECTION' } // Additional text detection for better accuracy
            ],
            imageContext: { 
              languageHints: ['id', 'en'],
              textDetectionParams: {
                enableTextDetectionConfidenceScore: true
              }
            }
          }]
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Vision API error');
    if (!data.responses?.[0]) throw new Error('No response from Vision API');

    const fullTextAnnotation = data.responses[0].fullTextAnnotation;
    const textAnnotations = data.responses[0].textAnnotations;
    if (!textAnnotations?.length && !fullTextAnnotation) {
      throw new Error('No text detected in image');
    }

    const fullText = fullTextAnnotation?.text || textAnnotations[0].description;
    console.log('📝 OCR Raw Text:\n', fullText);
    return parseReceiptText(fullText);
  } catch (error) {
    console.error('Vision API Error:', error);
    throw error;
  }
};

// --- Helper: Extract ALL amounts from a string ---
const extractAmounts = (str) => {
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
const extractDate = (str, allowPartial = false) => {
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
const detectTxType = (ctxArr) => {
  const ctx = ctxArr.join(' ').toLowerCase();
  const expSigs = [/-\s*(?:rp|idr)/i, /\bDB\b|\bdebet\b|\bdebit\b/i, /keluar|out\b/i, /pembelian|purchase|bayar|payment/i, /transfer\s*ke|kirim|send/i, /tarik|withdraw/i, /belanja|beli\b/i, /biaya|fee|charge/i, /pengeluaran/i];
  const incSigs = [/\+\s*(?:rp|idr)/i, /\bCR\b|\bkredit\b|\bcredit\b/i, /masuk|in\b/i, /terima|receive/i, /deposit|top\s?up/i, /gaji|salary/i, /cashback|reward|bonus/i, /pemasukan/i, /dari\b.*(?:transfer|trf)/i];
  let e=0, i=0;
  for (const p of expSigs) if (p.test(ctx)) e++;
  for (const p of incSigs) if (p.test(ctx)) i++;
  return i > e ? 'income' : 'expense';
};

// --- Main parser ---
const parseReceiptText = (text) => {
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

// --- 3. CONSTANTS (Using imported modules) ---
// Constants are imported from ./constants/categories and ./constants/currencies

// Mapping service name to icon
const SERVICE_ICONS = {
  netflix: '🎬', 'netflix premium': '🎬',
  spotify: '🎵', 'spotify premium': '🎵',
  youtube: '📺', 'youtube premium': '📺',
  disney: '🎭', 'disney+': '🎭',
  apple: '🍎', 'apple tv': '🍎', 'apple music': '🎶',
  hbo: '📺', 'hbo max': '📺',
  prime: '📦', 'amazon prime': '📦',
  canva: '🎨',
  figma: '🎨',
  github: '💻', 'github pro': '💻',
  slack: '💬',
  notion: '📝',
  adobe: '🖼️', 'creative cloud': '🖼️',
  dropbox: '☁️',
  onedrive: '☁️',
  icloud: '☁️',
  google: '🔍', 'google drive': '☁️', 'google one': '☁️',
  microsoft: '💻', 'office 365': '💻',
  zoom: '📹',
  telegram: '✈️', 'telegram premium': '✈️',
  whatsapp: '💬',
  duolingo: '🦉',
  udemy: '🎓',
  coursera: '🎓',
  linkedin: '💼',
  chatgpt: '🤖',
  grammarly: '✍️',
  nordvpn: '🔒',
  plex: '🎬',
  tidal: '🎵',
  deezer: '🎵',
  lastpass: '🔐', 'password': '🔐',
  evernote: '📓',
  todoist: '✅',
  trello: '📋',
  asana: '📋',
  miro: '🎨',
  photoshop: '🖼️',
  lightroom: '📷',
  illustrator: '🎨',
  indesign: '📄',
  audible: '🎧',
  skillshare: '🎓',
  masterclass: '🎓',
  funimation: '🎭',
  crunchyroll: '🎭',
  showtime: '📺',
  cinemax: '📺',
  starz: '📺',
  paramount: '📺',
  peacock: '📺',
  vpn: '🔒',
  wix: '🌐',
  squarespace: '🌐',
  hosting: '🌐',
  domain: '🌐',
  email: '📧',
  mailchimp: '📧',
  sendgrid: '📧',
  stripe: '💳',
  paypal: '💳',
  wise: '💰',
  revolut: '💳',
  twitch: '🎮',
  gamepass: '🎮', 'xbox': '🎮',
  playstation: '🎮', 'ps plus': '🎮',
  nintendo: '🎮', 'switch': '🎮',
  steam: '🎮',
  epic: '🎮',
  origin: '🎮',
  ubisoft: '🎮',
  elden: '🎮',
  roblox: '🎮',
  // Untuk kategori umum
  'listrik': '⚡', 'gas': '🔥', 'air': '💧', 'internet': '📡', 'pulsa': '📱',
  'tagihan': '📄', 'cicilan': '💰', 'asuransi': '🛡️', 'kesehatan': '⚕️',
  'gym': '💪', 'olahraga': '⚽', 'kendaraan': '🚗', 'rumah': '🏠',
  'sekolah': '🏫', 'kursus': '📚', 'langganan': '🔔'
};

// Helper function to get icon for subscription
const getSubscriptionIcon = (name) => {
  if (!name) return '🔔';
  const lowerName = name.toLowerCase();
  
  // Direct match
  if (SERVICE_ICONS[lowerName]) return SERVICE_ICONS[lowerName];
  
  // Partial match - check if name contains any key
  for (const [key, icon] of Object.entries(SERVICE_ICONS)) {
    if (lowerName.includes(key)) return icon;
  }
  
  // Default icon
  return '🔔';
};

// --- 4. SMALL COMPONENTS ---

const LoginPage = ({ onLogin }) => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4 transition-colors duration-300">
    <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg max-w-md w-full text-center border dark:border-gray-700">
      <div className="bg-emerald-100 dark:bg-emerald-900 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"><Wallet className="w-8 h-8 text-emerald-600 dark:text-emerald-400" /></div>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Dompet Keluarga</h1>
      <p className="text-gray-500 dark:text-gray-400 mb-8">Kelola keuangan dan investasi keluarga.</p>
      <button onClick={onLogin} className="w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-white font-semibold py-3 px-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center justify-center gap-3 transition-colors">
        <LogIn size={20} className="text-emerald-600 dark:text-emerald-400"/> Masuk dengan Google
      </button>
    </div>
  </div>
);

const NavBtn = ({ id, active, set, icon, label }) => (
  <button onClick={()=>set(id)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active===id ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-bold' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
    {icon}<span>{label}</span>
  </button>
);

const MobileNavBtn = ({ id, active, set, icon, label }) => (
  <button onClick={()=>set(id)} className={`flex flex-col items-center gap-1 ${active===id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>
    {icon}<span className="text-[10px] font-medium">{label}</span>
  </button>
);

const Card = ({ title, amount, icon, color, fmt }) => (
  <div className={`bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border-l-4 ${color} flex justify-between items-start transition-colors duration-300`}>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 font-medium">{title}</p>
      <h3 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white">{fmt(amount)}</h3>
    </div>
    <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">{icon}</div>
  </div>
);

// --- 5. VIEW COMPONENTS ---

const DashboardView = ({ summary, transactions, investments, categories, investTypes, setActiveTab, fmt, privacyMode, darkMode }) => {
  const expensePie = useMemo(() => {
    const d = {};
    const now = new Date();
    transactions.filter(t => t.type === 'expense' && t.date?.getMonth() === now.getMonth() && t.date?.getFullYear() === now.getFullYear())
      .forEach(t => d[t.category] = (d[t.category]||0) + Number(t.amount));
    return Object.entries(d).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
  }, [transactions]);

  const budgetProgress = useMemo(() => {
    const spending = {};
    const now = new Date();
    transactions.filter(t => t.type === 'expense' && t.date?.getMonth() === now.getMonth() && t.date?.getFullYear() === now.getFullYear())
      .forEach(t => spending[t.category] = (spending[t.category]||0) + Number(t.amount));
    
    return categories.raw.filter(c => c.type === 'expense' && c.budget > 0)
      .map(c => ({ ...c, spent: spending[c.name] || 0, percent: ((spending[c.name]||0)/c.budget)*100 }))
      .sort((a,b) => b.percent - a.percent);
  }, [transactions, categories]);

  const trendData = useMemo(() => {
    const months = [];
    const today = new Date();
    for(let i=5; i>=0; i--) {
       const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
       months.push({ 
         monthStr: d.toLocaleString('id-ID', { month: 'short', year: '2-digit' }), 
         monthIdx: d.getMonth(), 
         year: d.getFullYear(),
         income: 0, 
         expense: 0 
       });
    }
    transactions.forEach(t => {
       if (!t.date) return;
       const match = months.find(m => m.monthIdx === t.date.getMonth() && m.year === t.date.getFullYear());
       if (match) {
         if (t.type === 'income') match.income += parseFloat(t.amount);
         if (t.type === 'expense') match.expense += parseFloat(t.amount);
       }
    });
    return months;
  }, [transactions]);

  const assetGrowthData = useMemo(() => {
    const months = [];
    const today = new Date();
    for(let i=5; i>=0; i--) {
       const endOfMonth = new Date(today.getFullYear(), today.getMonth() - i + 1, 0); 
       const monthStr = endOfMonth.toLocaleString('id-ID', { month: 'short', year: '2-digit' });
       const activeAssets = investments.filter(inv => {
         if (!inv.createdAt) return true;
         return inv.createdAt <= endOfMonth;
       });
       const totalModal = activeAssets.reduce((acc, curr) => acc + (Number(curr.purchaseValue)||0), 0);
       const totalValue = activeAssets.reduce((acc, curr) => acc + (Number(curr.currentValue)||0), 0);
       months.push({ monthStr, modal: totalModal, value: totalValue });
    }
    return months;
  }, [investments]);

  const investProgress = useMemo(() => {
    return investTypes.map(t => {
      const currentTotal = investments
        .filter(i => i.typeId === t.id || (!i.typeId && i.type === t.name))
        .reduce((a, c) => a + (Number(c.currentValue)||0), 0);
      const percent = t.target > 0 ? (currentTotal / t.target) * 100 : 0;
      return { ...t, currentTotal, percent };
    }).sort((a,b) => b.percent - a.percent);
  }, [investments, investTypes]);

  const chartStroke = darkMode ? '#94a3b8' : '#64748b';
  const gridStroke = darkMode ? '#374151' : '#eee';
  const tooltipStyle = darkMode ? { backgroundColor: '#1f2937', border: '1px solid #374151', color: '#f3f4f6' } : { backgroundColor: '#fff', color: '#333' };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Ringkasan Saldo (Top Cards) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="Total Aset Bersih" amount={summary.netWorth} icon={<Landmark className="text-emerald-600 dark:text-emerald-400"/>} color="border-emerald-500" fmt={fmt} />
        <Card title="Total Saldo Kas" amount={summary.balance} icon={<Wallet className="text-blue-600 dark:text-blue-400"/>} color="border-blue-500" fmt={fmt} />
        <Card title="Total Investasi" amount={summary.investment} icon={<TrendingUp className="text-amber-500 dark:text-amber-400"/>} color="border-amber-500" fmt={fmt} />
      </div>

      {/* Wallet Breakdown */}
      <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
         <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <CreditCard size={18} className="text-blue-500"/> Saldo per Akun
            </h3>
            <button onClick={()=>setActiveTab('wallets')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Kelola</button>
         </div>
         <div className="flex gap-4 overflow-x-auto pb-2 custom-scrollbar">
            {summary.walletBalances.map(w => (
              <div key={w.id} className={`min-w-[180px] p-3 rounded-lg border ${w.type === 'credit_card' ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800' : 'border-gray-100 bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600'} flex flex-col justify-between`}>
                 <div className="flex items-center gap-2 mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                    {w.icon ? (
                       <span className="text-lg leading-none">{w.icon}</span>
                    ) : (
                       <>
                         {w.type === 'bank' && <Landmark size={12}/>}
                         {w.type === 'cash' && <Banknote size={12}/>}
                         {w.type === 'ewallet' && <Smartphone size={12}/>}
                         {w.type === 'credit_card' && <CreditCard size={12} className="text-red-500"/>}
                         {w.type === 'rdn' && <Briefcase size={12} className="text-amber-600"/>}
                       </>
                    )}
                    <span className="truncate">{w.name}</span>
                 </div>
                 <div>
                    <div className={`font-bold ${w.type === 'credit_card' ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-gray-100'}`}>
                      {w.type === 'credit_card' ? `Utang: ${fmt(Math.abs(w.currentBalance))}` : fmt(w.currentBalance)}
                    </div>
                    {w.type === 'credit_card' && (
                      <div className="mt-1">
                        <div className="w-full bg-red-200 dark:bg-red-900 rounded-full h-1.5 mb-1">
                          <div className="bg-red-500 h-1.5 rounded-full" style={{width: `${Math.min((Math.abs(w.currentBalance)/w.limit)*100, 100)}%`}}></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                          <span>Sisa: {fmt(w.limit - Math.abs(w.currentBalance))}</span>
                        </div>
                      </div>
                    )}
                 </div>
              </div>
            ))}
         </div>
      </div>

      {budgetProgress.some(b => b.percent >= 90) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-xl flex gap-3">
           <AlertTriangle className="text-red-600 dark:text-red-400 mt-1 shrink-0" size={20} />
           <div>
             <h3 className="font-bold text-red-700 dark:text-red-400 text-sm">Peringatan Budget!</h3>
             <div className="text-xs text-red-600 dark:text-red-300 mt-1 space-y-1">
               {budgetProgress.filter(b => b.percent >= 90).map(b => (
                 <p key={b.id}><b>{b.name}</b>: {b.percent.toFixed(0)}% ({fmt(b.spent)} / {fmt(b.budget)})</p>
               ))}
             </div>
           </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[300px] transition-colors duration-300">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500"/> Tren Arus Kas (6 Bulan)
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={trendData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="monthStr" tick={{fontSize: 12, fill: chartStroke}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 10, fill: chartStroke}} tickFormatter={(val) => privacyMode ? '•' : `${val/1000}k`} tickLine={false} axisLine={false} />
                <ReTooltip formatter={(value) => fmt(value)} contentStyle={tooltipStyle} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Pemasukan" stroke="#10B981" strokeWidth={2} dot={{r:4}} />
                <Line type="monotone" dataKey="expense" name="Pengeluaran" stroke="#EF4444" strokeWidth={2} dot={{r:4}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[300px] transition-colors duration-300">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-amber-500"/> Tren Nilai Aset (6 Bulan)
          </h3>
          <div className="flex-1">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={assetGrowthData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="monthStr" tick={{fontSize: 12, fill: chartStroke}} tickLine={false} axisLine={false} />
                <YAxis tick={{fontSize: 10, fill: chartStroke}} tickFormatter={(val) => privacyMode ? '•' : `${val/1000000}jt`} tickLine={false} axisLine={false} />
                <ReTooltip formatter={(value) => fmt(value)} contentStyle={tooltipStyle} />
                <Legend />
                <Area type="monotone" dataKey="modal" name="Total Modal" stroke="#94a3b8" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                <Area type="monotone" dataKey="value" name="Nilai Pasar" stroke="#F59E0B" fillOpacity={1} fill="url(#colorValue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col min-h-[300px] transition-colors duration-300">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2"><PieChart size={18}/> Pengeluaran Bulan Ini</h3>
            {expensePie.length > 0 ? (
              <div className="flex-1"><ResponsiveContainer width="100%" height={250}><RePieChart><Pie data={expensePie} innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" stroke={darkMode ? "#1f2937" : "#fff"}>{expensePie.map((e,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><ReTooltip formatter={v=>fmt(v)} contentStyle={tooltipStyle} /><Legend verticalAlign="bottom"/></RePieChart></ResponsiveContainer></div>
            ) : <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">Belum ada data</div>}
          </div>

          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col transition-colors duration-300">
            <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2"><Target size={18}/> Monitoring Budget</h3><button onClick={()=>setActiveTab('categories')} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Atur</button></div>
            <div className="flex-1 overflow-y-auto max-h-[250px] space-y-4 pr-2 custom-scrollbar">
              {budgetProgress.length===0 ? <div className="text-center text-gray-400 dark:text-gray-500 py-8 text-sm">Belum ada budget diset</div> : budgetProgress.map(b => (
                <div key={b.id}>
                  <div className="flex justify-between text-sm mb-1"><span className="font-medium text-gray-700 dark:text-gray-300">{b.name}</span><span className={b.percent>90?'text-red-600 dark:text-red-400':'text-gray-500 dark:text-gray-400'}>{b.percent.toFixed(0)}%</span></div>
                  <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2"><div className={`h-2 rounded-full ${b.percent>=100?'bg-red-600':b.percent>=75?'bg-amber-500':'bg-emerald-500'}`} style={{width:`${Math.min(b.percent,100)}%`}}></div></div>
                </div>
              ))}
            </div>
          </div>
      </div>
    </div>
  );
};

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
        // Don't fail the whole process if saving key fails
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
      
      // Reset state on error
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
          quickAddSource: true, // Penanda transaksi dari Quick Add AI Scanner
          createdAt: serverTimestamp()
        };
        return addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), payload);
      });

      await Promise.all(batch);
      
      // Success - cleanup everything
      console.log(`✅ ${selected.length} transaksi berhasil disimpan`);
      alert(`${selected.length} transaksi berhasil ditambahkan!`);
      
      // Clear uploaded image dan semua data
      handleReset();
      
      // Close modal
      onClose();
    } catch (error) {
      console.error('❌ Bulk add error:', error);
      alert('Gagal menambahkan transaksi');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    // Revoke object URL untuk free memory
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    
    // Clear all states
    setUploadedImage(null);
    setImagePreview(null);
    setDetectedTransactions([]);
    setIsProcessing(false); // Ensure processing state is always reset
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    
    console.log('🔄 Quick Add reset complete');
  };

  const handleDeleteTransaction = (id) => {
    setDetectedTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Cleanup saat modal ditutup
  const handleClose = () => {
    // Reset semua data termasuk image
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

          {/* Upload Section - Show only if API key is loaded */}
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
                    
                    {/* Tips untuk hasil terbaik */}
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
                          <input
                            type="checkbox"
                            checked={t.selected}
                            onChange={() => handleToggleSelect(t.id)}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="number"
                            value={t.amount}
                            onChange={(e) => handleUpdateTransaction(t.id, 'amount', e.target.value)}
                            className="w-32 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={t.category}
                            onChange={(e) => handleUpdateTransaction(t.id, 'category', e.target.value)}
                            className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm"
                          >
                            {categories.expense.map((cat) => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={t.walletId}
                            onChange={(e) => handleUpdateTransaction(t.id, 'walletId', e.target.value)}
                            className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm"
                          >
                            {wallets.map((w) => (
                              <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="date"
                            value={formatDateInput(t.date)}
                            onChange={(e) => handleUpdateTransaction(t.id, 'date', new Date(e.target.value))}
                            className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={t.note}
                            onChange={(e) => handleUpdateTransaction(t.id, 'note', e.target.value)}
                            className="w-full px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 dark:text-white text-sm"
                            placeholder="Catatan..."
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                          >
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
                        <input
                          type="checkbox"
                          checked={t.selected}
                          onChange={() => handleToggleSelect(t.id)}
                          className="rounded min-w-[24px] min-h-[24px]"
                        />
                        <div className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          Rp {Number(t.amount).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteTransaction(t.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded min-h-[48px] min-w-[48px] touch-manipulation flex items-center justify-center"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Nominal</label>
                        <input
                          type="number"
                          value={t.amount}
                          onChange={(e) => handleUpdateTransaction(t.id, 'amount', e.target.value)}
                          className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Kategori</label>
                        <select
                          value={t.category}
                          onChange={(e) => handleUpdateTransaction(t.id, 'category', e.target.value)}
                          className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation"
                        >
                          {categories.expense.map((cat) => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Akun</label>
                        <select
                          value={t.walletId}
                          onChange={(e) => handleUpdateTransaction(t.id, 'walletId', e.target.value)}
                          className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation"
                        >
                          {wallets.map((w) => (
                            <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Tanggal</label>
                        <input
                          type="date"
                          value={formatDateInput(t.date)}
                          onChange={(e) => handleUpdateTransaction(t.id, 'date', new Date(e.target.value))}
                          className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Catatan</label>
                        <input
                          type="text"
                          value={t.note}
                          onChange={(e) => handleUpdateTransaction(t.id, 'note', e.target.value)}
                          className="w-full px-3 py-2.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-white text-sm min-h-[48px] touch-manipulation"
                          placeholder="Catatan..."
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3">
                <button
                  onClick={handleReset}
                  className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium min-h-[48px] touch-manipulation"
                >
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

const TransactionModal = ({ isOpen, onClose, categories, wallets, userId, appId, fmt }) => {
  const [formData, setFormData] = useState({ id: null, type: 'expense', amount: '', category: '', walletId: '', sourceWalletId: '', targetWalletId: '', note: '', date: formatDateInput(new Date()) });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      ...formData, 
      amount: Number(formData.amount), 
      date: new Date(formData.date), 
      updatedAt: serverTimestamp() 
    };
    delete payload.id;

    try {
      if (formData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'transactions', formData.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), { ...payload, createdAt: serverTimestamp() });
      }
      setFormData({ id: null, type: 'expense', amount: '', category: '', walletId: '', sourceWalletId: '', targetWalletId: '', note: '', date: formatDateInput(new Date()) });
      onClose();
    } catch (err) { 
      console.error(err); 
      alert('Gagal menyimpan transaksi');
    }
  };

  const cats = formData.type === 'expense' ? categories.expense : categories.income;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-4 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b dark:border-gray-700 p-6 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Plus size={24} className="text-emerald-600 dark:text-emerald-400"/>
            Transaksi Baru
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
            <X size={24}/>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jenis Transaksi</label>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>setFormData({...formData, type:'income', category:'', sourceWalletId: '', targetWalletId: ''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='income'?'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 ring-2 ring-green-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pemasukan</button>
                  <button type="button" onClick={()=>setFormData({...formData, type:'expense', category:'', sourceWalletId: '', targetWalletId: ''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='expense'?'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 ring-2 ring-red-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pengeluaran</button>
                  <button type="button" onClick={()=>setFormData({...formData, type:'transfer', category:''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='transfer'?'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Transfer</button>
                </div>
             </div>
             
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jumlah (Rp)</label>
                <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
             </div>

             {formData.type === 'transfer' ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Dari (Sumber)</label>
                    <select required value={formData.sourceWalletId} onChange={e=>setFormData({...formData, sourceWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Sumber...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Ke (Tujuan)</label>
                    <select required value={formData.targetWalletId} onChange={e=>setFormData({...formData, targetWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Tujuan...</option>
                      {wallets.filter(w => w.id !== formData.sourceWalletId).map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                </>
             ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kantong / Akun</label>
                    <select required value={formData.walletId} onChange={e=>setFormData({...formData, walletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Akun...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori</label>
                    <select required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white transition-all dark:[&>option]:bg-gray-800"><option value="">Pilih Kategori...</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
                  </div>
                </>
             )}

             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Tanggal</label>
                <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white"/>
             </div>
             <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Catatan</label>
                <input value={formData.note} onChange={e=>setFormData({...formData, note:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="Opsional"/>
             </div>
          </div>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-6 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">Batal</button>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-200/50 dark:shadow-emerald-900/30 transition-all"><Save size={18}/> Simpan Transaksi</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const TransactionView = ({ transactions, categories, wallets, userId, appId, fmt }) => {
  const [formData, setFormData] = useState({ id: null, type: 'expense', amount: '', category: '', walletId: '', sourceWalletId: '', targetWalletId: '', note: '', date: formatDateInput(new Date()) });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filters, setFilters] = useState({ startDate: '', endDate: '', walletId: '' });

  // Filter Logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = t.date;
      if (!d || isNaN(d.getTime())) return false;

      let matchesDate = true;
      if (filters.startDate) {
        matchesDate = matchesDate && d >= new Date(filters.startDate);
      }
      if (filters.endDate) {
        const e = new Date(filters.endDate);
        e.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && d <= e;
      }

      let matchesWallet = true;
      if (filters.walletId) {
        matchesWallet = t.walletId === filters.walletId || t.sourceWalletId === filters.walletId || t.targetWalletId === filters.walletId;
      }

      return matchesDate && matchesWallet;
    });
  }, [transactions, filters]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { 
      ...formData, 
      amount: Number(formData.amount), 
      date: new Date(formData.date), 
      updatedAt: serverTimestamp() 
    };
    delete payload.id;

    try {
      if (formData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'transactions', formData.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), { ...payload, createdAt: serverTimestamp() });
      }
      setIsFormOpen(false); setFormData({ id: null, type: 'expense', amount: '', category: '', walletId: '', sourceWalletId: '', targetWalletId: '', note: '', date: formatDateInput(new Date()) });
    } catch (err) { console.error(err); }
  };

  const handleEdit = (t) => {
    setFormData({ 
      id: t.id, 
      type: t.type, 
      amount: t.amount, 
      category: t.category || '', 
      walletId: t.walletId || '', 
      sourceWalletId: t.sourceWalletId || '',
      targetWalletId: t.targetWalletId || '',
      note: t.note, 
      date: formatDateInput(t.date) 
    });
    setIsFormOpen(true);
  };
  
  const handleDelete = async (id) => { if (confirm('Hapus transaksi?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'transactions', id)); };

  const cats = formData.type === 'expense' ? categories.expense : categories.income;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Transaksi</h2>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setFormData({ id: null, type: 'expense', amount: '', category: '', walletId: '', sourceWalletId: '', targetWalletId: '', note: '', date: formatDateInput(new Date()) }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">{isFormOpen ? <X size={18}/> : <Plus size={18}/>} <span>{isFormOpen ? 'Batal' : 'Baru'}</span></button>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col md:flex-row gap-3 items-end">
        <div className="w-full md:w-auto flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm font-semibold">
           <ListFilter size={16}/> Filter:
        </div>
        <div className="w-full md:w-auto space-y-1">
           <label className="text-xs text-gray-500 dark:text-gray-400">Dari Tanggal</label>
           <input type="date" value={filters.startDate} onChange={e=>setFilters({...filters, startDate:e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
        </div>
        <div className="w-full md:w-auto space-y-1">
           <label className="text-xs text-gray-500 dark:text-gray-400">Sampai Tanggal</label>
           <input type="date" value={filters.endDate} onChange={e=>setFilters({...filters, endDate:e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"/>
        </div>
        <div className="w-full md:w-auto space-y-1 flex-1">
           <label className="text-xs text-gray-500 dark:text-gray-400">Rekening / Dompet</label>
           <select value={filters.walletId} onChange={e=>setFilters({...filters, walletId:e.target.value})} className="w-full p-2 border rounded-lg text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:[&>option]:bg-gray-800">
             <option value="">Semua Rekening</option>
             {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
           </select>
        </div>
        <button onClick={()=>setFilters({startDate:'', endDate:'', walletId:''})} className="text-sm text-red-500 hover:text-red-700 underline pb-2">Reset</button>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 mb-6 transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jenis Transaksi</label>
                <div className="flex gap-2">
                  <button type="button" onClick={()=>setFormData({...formData, type:'income', category:'', sourceWalletId: '', targetWalletId: ''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='income'?'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700 ring-2 ring-green-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pemasukan</button>
                  <button type="button" onClick={()=>setFormData({...formData, type:'expense', category:'', sourceWalletId: '', targetWalletId: ''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='expense'?'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700 ring-2 ring-red-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Pengeluaran</button>
                  <button type="button" onClick={()=>setFormData({...formData, type:'transfer', category:''})} className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all border ${formData.type==='transfer'?'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700 ring-2 ring-blue-500/20':'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}>Mutasi / Transfer</button>
                </div>
             </div>
             
             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jumlah (Rp)</label>
                <input type="number" required value={formData.amount} onChange={e=>setFormData({...formData, amount:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
             </div>

             {/* Dynamic Fields based on Type */}
             {formData.type === 'transfer' ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Dari (Sumber)</label>
                    <select required value={formData.sourceWalletId} onChange={e=>setFormData({...formData, sourceWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Sumber...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name} ({fmt(w.currentBalance)})</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Ke (Tujuan)</label>
                    <select required value={formData.targetWalletId} onChange={e=>setFormData({...formData, targetWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Tujuan...</option>
                      {wallets.filter(w => w.id !== formData.sourceWalletId).map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                </>
             ) : (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kantong / Akun</label>
                    <select required value={formData.walletId} onChange={e=>setFormData({...formData, walletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Pilih Akun...</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori</label>
                    <select required value={formData.category} onChange={e=>setFormData({...formData, category:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white transition-all dark:[&>option]:bg-gray-800"><option value="">Pilih Kategori...</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
                  </div>
                </>
             )}

             <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Tanggal</label>
                <input type="date" required value={formData.date} onChange={e=>setFormData({...formData, date:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white"/>
             </div>
             <div className="md:col-span-2 space-y-2">
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Catatan</label>
                <input value={formData.note} onChange={e=>setFormData({...formData, note:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-gray-700 dark:text-white" placeholder="Opsional (misal: Mutasi ke e-wallet)"/>
             </div>
          </div>
          <div className="flex justify-end"><button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-200/50 transition-all"><Save size={18}/> {formData.id ? 'Update Data' : 'Simpan Transaksi'}</button></div>
        </form>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600"><tr><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">TANGGAL</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">AKUN/DETAIL</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">KATEGORI</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300">CATATAN</th><th className="p-4 text-xs font-semibold text-gray-500 dark:text-gray-300 text-right">JUMLAH</th><th className="p-4 w-20"></th></tr></thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredTransactions.length===0 ? <tr><td colSpan="6" className="p-8 text-center text-gray-400 dark:text-gray-500">Belum ada data</td></tr> : filteredTransactions.map(t => {
                const w = wallets.find(x => x.id === t.walletId);
                const wSource = wallets.find(x => x.id === t.sourceWalletId);
                const wTarget = wallets.find(x => x.id === t.targetWalletId);
                
                return (
                  <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 group transition-colors">
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{formatDate(t.date)}</td>
                    <td className="p-4 text-sm text-gray-700 dark:text-gray-300 font-medium">
                      {t.type === 'transfer' ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500">{wSource?.icon} {wSource?.name || '?'}</span>
                          <ArrowRightLeft size={10} />
                          <span className="text-gray-900 dark:text-white font-bold">{wTarget?.icon} {wTarget?.name || '?'}</span>
                        </div>
                      ) : t.type === 'investment' ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Briefcase size={12}/> Investasi</span>
                      ) : (
                        w ? <span>{w.icon} {w.name}</span> : <span className="text-gray-400 italic">Terhapus</span>
                      )}
                    </td>
                    <td className="p-4 text-sm">
                      {t.type === 'transfer' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Mutasi Saldo</span>
                      ) : t.type === 'investment' ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Beli Aset</span>
                      ) : (
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type==='income'?'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400':'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{t.category}</span>
                      )}
                      {t.subscriptionId && (
                         <span className="ml-2" title="Auto-generated"><Bot size={12} className="inline text-purple-500"/></span>
                      )}
                      {t.quickAddSource && (
                         <span className="ml-2" title="Ditambahkan via Quick Add AI Scanner"><ScanLine size={12} className="inline text-emerald-500"/></span>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-600 dark:text-gray-400 truncate max-w-xs">{t.note||'-'}</td>
                    <td className={`p-4 text-sm font-medium text-right whitespace-nowrap ${t.type==='income'?'text-green-600 dark:text-green-400': t.type === 'expense' || t.type === 'investment' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                      {t.type==='income' ? '+' : (t.type === 'expense' || t.type === 'investment') ? '-' : ''}{fmt(t.amount)}
                    </td>
                    <td className="p-4 text-right flex justify-end gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                      {t.type !== 'investment' && (
                        <button onClick={()=>handleEdit(t)} className="text-blue-400 hover:text-blue-600"><Edit2 size={16}/></button>
                      )}
                      <button onClick={()=>handleDelete(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={16}/></button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden divide-y divide-gray-100 dark:divide-gray-700">
          {filteredTransactions.length===0 ? (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500">Belum ada data</div>
          ) : filteredTransactions.map(t => {
            const w = wallets.find(x => x.id === t.walletId);
            const wSource = wallets.find(x => x.id === t.sourceWalletId);
            const wTarget = wallets.find(x => x.id === t.targetWalletId);

            return (
              <div key={t.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{formatDate(t.date)}</p>
                    <div className="mt-1 text-sm text-gray-700 dark:text-gray-200 font-medium">
                      {t.type === 'transfer' ? (
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-gray-500">{wSource?.icon} {wSource?.name || '?'}</span>
                          <ArrowRightLeft size={10} />
                          <span className="text-gray-900 dark:text-white font-bold">{wTarget?.icon} {wTarget?.name || '?'}</span>
                        </div>
                      ) : t.type === 'investment' ? (
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1"><Briefcase size={12}/> Investasi</span>
                      ) : (
                        w ? <span>{w.icon} {w.name}</span> : <span className="text-gray-400 italic">Terhapus</span>
                      )}
                    </div>
                  </div>
                  <div className={`text-sm font-bold whitespace-nowrap ${t.type==='income'?'text-green-600 dark:text-green-400': t.type === 'expense' || t.type === 'investment' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
                    {t.type==='income' ? '+' : (t.type === 'expense' || t.type === 'investment') ? '-' : ''}{fmt(t.amount)}
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  {t.type === 'transfer' ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Mutasi Saldo</span>
                  ) : t.type === 'investment' ? (
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Beli Aset</span>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${t.type==='income'?'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400':'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>{t.category}</span>
                  )}
                  {t.subscriptionId && (
                    <span title="Auto-generated"><Bot size={12} className="text-purple-500"/></span>
                  )}
                  {t.quickAddSource && (
                    <span title="Ditambahkan via Quick Add AI Scanner"><ScanLine size={12} className="text-emerald-500"/></span>
                  )}
                </div>

                <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{t.note||'-'}</p>

                <div className="flex items-center justify-end gap-2 pt-1">
                  {t.type !== 'investment' && (
                    <button onClick={()=>handleEdit(t)} className="min-h-[40px] px-3 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-1">
                      <Edit2 size={14}/> Edit
                    </button>
                  )}
                  <button onClick={()=>handleDelete(t.id)} className="min-h-[40px] px-3 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-1">
                    <Trash2 size={14}/> Hapus
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  );
};

const WalletView = ({ wallets, transactions, userId, appId, fmt, privacyMode }) => {
  const [form, setForm] = useState({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    try {
      const payload = { 
        name: form.name, 
        type: form.type, 
        initialBalance: Number(form.initialBalance)||0,
        limit: form.type === 'credit_card' ? (Number(form.limit)||0) : 0,
        icon: form.icon
      };

      if (form.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'wallets', form.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'wallets'), payload);
      }
      setForm({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' });
      setIsFormOpen(false);
    } catch(err) { console.error(err); }
  };

  const handleEdit = (w) => {
    setForm({ id: w.id, name: w.name, type: w.type, initialBalance: w.initialBalance, limit: w.limit || '', icon: w.icon || '' });
    setIsFormOpen(true);
  }

  const handleDelete = async (id) => {
    if(confirm('Hapus akun ini? Transaksi terkait akan tetap ada tapi tanpa nama akun.')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'wallets', id));
    }
  };

  const handleWalletClick = (wallet) => {
    setSelectedWallet(wallet);
    setIsTransactionModalOpen(true);
  };

  const getWalletTransactions = () => {
    if (!selectedWallet || !transactions) return [];
    
    return transactions.filter(t => {
      // Filter transactions related to this wallet
      if (t.walletId === selectedWallet.id) return true;
      if (t.sourceWalletId === selectedWallet.id) return true;
      if (t.targetWalletId === selectedWallet.id) return true;
      return false;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Rekening & Kartu Kredit</h2>
        <button onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', type: 'bank', initialBalance: '', limit: '', icon: '' }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">{isFormOpen ? <X size={18}/> : <Plus size={18}/>} <span>{isFormOpen ? 'Batal' : 'Tambah'}</span></button>
      </div>
      
      {isFormOpen && (
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end transition-colors duration-300 animate-in fade-in slide-in-from-top-4">
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tipe Akun</label>
           <select value={form.type} onChange={e=>setForm({...form, type:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
             <option value="bank">Bank</option>
             <option value="ewallet">E-Wallet</option>
             <option value="cash">Tunai</option>
             <option value="credit_card">Kartu Kredit</option>
             <option value="rdn">RDN (Rekening Dana Nasabah)</option>
           </select>
        </div>
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Icon (Emoji)</label>
           <input value={form.icon} onChange={e=>setForm({...form, icon:e.target.value})} placeholder="Contoh: 💰" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white text-center text-lg"/>
        </div>
        <div className="space-y-1 lg:col-span-2">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Akun</label>
           <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="Contoh: BCA / Kartu Kredit" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
        </div>
        <div className="space-y-1 lg:col-span-1">
           <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Saldo Awal (Rp)</label>
           <input type="number" value={form.initialBalance} onChange={e=>setForm({...form, initialBalance:e.target.value})} placeholder="0" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
        </div>
        {form.type === 'credit_card' && (
          <div className="space-y-1 lg:col-span-1">
             <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Limit Pagu (Rp)</label>
             <input type="number" value={form.limit} onChange={e=>setForm({...form, limit:e.target.value})} placeholder="Limit Kredit" className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
          </div>
        )}
        <button type="submit" className="md:col-span-2 lg:col-span-1 bg-emerald-600 text-white px-6 py-2.5 rounded-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors h-[46px]"><Save size={18}/> {form.id ? 'Simpan' : 'Tambah'}</button>
      </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {wallets.map(w => (
          <div key={w.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-between transition-colors duration-300 group relative cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all" onClick={() => handleWalletClick(w)}>
             <div className="flex justify-between items-start">
               <div className="flex items-center gap-3">
                 <div className="text-3xl p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                   {w.icon || (
                     w.type === 'bank' ? <Landmark size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'ewallet' ? <Smartphone size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'cash' ? <Banknote size={24} className="text-emerald-600 dark:text-emerald-400"/> :
                     w.type === 'credit_card' ? <CreditCard size={24} className="text-red-500"/> :
                     <Briefcase size={24} className="text-amber-600 dark:text-amber-400"/>
                   )}
                 </div>
                 <div>
                   <h3 className="font-bold text-gray-800 dark:text-gray-100">{w.name}</h3>
                   <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{w.type.replace('_', ' ')}</p>
                 </div>
               </div>
               <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-4 bg-white dark:bg-gray-800 p-1 rounded-lg shadow-sm">
                  <button onClick={(e)=>{e.stopPropagation();handleEdit(w)}} className="text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 p-1 rounded"><Edit2 size={16}/></button>
                  <button onClick={(e)=>{e.stopPropagation();handleDelete(w.id)}} className="text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"><Trash2 size={16}/></button>
               </div>
             </div>
             <div className="mt-4 pt-4 border-t border-dashed dark:border-gray-700">
               <div className="flex justify-between items-end mb-1">
                 <div>
                   <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{w.type === 'credit_card' ? 'Total Tagihan' : 'Saldo Saat Ini'}</p>
                   <p className={`text-xl font-bold ${w.type === 'credit_card' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                     {w.type === 'credit_card' ? fmt(Math.abs(w.currentBalance)) : fmt(w.currentBalance)}
                   </p>
                 </div>
                 {w.initialBalance !== 0 && <span className="text-[10px] text-gray-400">Awal: {fmt(w.initialBalance)}</span>}
               </div>
               {w.type === 'credit_card' && w.limit > 0 && (
                 <div className="mt-2 text-xs">
                   <div className="flex justify-between mb-1 text-gray-500 dark:text-gray-400">
                     <span>Terpakai {((Math.abs(w.currentBalance)/w.limit)*100).toFixed(0)}%</span>
                     <span>Limit: {fmt(w.limit)}</span>
                   </div>
                   <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                     <div className="bg-red-500 h-1.5 rounded-full transition-all" style={{width: `${Math.min((Math.abs(w.currentBalance)/w.limit)*100, 100)}%`}}></div>
                   </div>
                 </div>
               )}
             </div>
          </div>
        ))}
      </div>

      {/* Transaction List Modal */}
      {isTransactionModalOpen && selectedWallet && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-in fade-in" onClick={() => setIsTransactionModalOpen(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="text-4xl p-3 bg-white/20 rounded-xl">
                    {selectedWallet.icon || (
                      selectedWallet.type === 'bank' ? <Landmark size={28}/> :
                      selectedWallet.type === 'ewallet' ? <Smartphone size={28}/> :
                      selectedWallet.type === 'cash' ? <Banknote size={28}/> :
                      selectedWallet.type === 'credit_card' ? <CreditCard size={28}/> :
                      <Briefcase size={28}/>
                    )}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">{selectedWallet.name}</h2>
                    <p className="text-emerald-100 text-sm uppercase tracking-wider">{selectedWallet.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <button onClick={() => setIsTransactionModalOpen(false)} className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors">
                  <X size={24}/>
                </button>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-emerald-100 text-sm">{selectedWallet.type === 'credit_card' ? 'Total Tagihan' : 'Saldo Saat Ini'}:</span>
                <span className="text-3xl font-bold">{selectedWallet.type === 'credit_card' ? fmt(Math.abs(selectedWallet.currentBalance)) : fmt(selectedWallet.currentBalance)}</span>
              </div>
            </div>

            {/* Transaction List */}
            <div className="p-6 overflow-y-auto" style={{maxHeight: 'calc(85vh - 180px)'}}>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-600"/>
                Riwayat Transaksi ({getWalletTransactions().length})
              </h3>
              
              {getWalletTransactions().length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-gray-400 mb-2">
                    <TrendingUp size={48} className="mx-auto opacity-30"/>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400">Belum ada transaksi untuk akun ini</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Tanggal</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Kategori</th>
                        <th className="text-left py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Catatan</th>
                        <th className="text-right py-3 px-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getWalletTransactions().map((t, idx) => {
                        const isIncome = t.type === 'income';
                        const isExpense = t.type === 'expense';
                        const isTransfer = t.type === 'transfer';
                        const isTransferOut = isTransfer && t.sourceWalletId === selectedWallet.id;
                        const isTransferIn = isTransfer && t.targetWalletId === selectedWallet.id;
                        
                        return (
                          <tr key={t.id || idx} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                            <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-300">
                              {new Date(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="py-3 px-2">
                              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                                {isTransfer ? (isTransferOut ? 'Transfer Keluar' : 'Transfer Masuk') : (t.category || 'Lainnya')}
                              </span>
                            </td>
                            <td className="py-3 px-2 text-sm text-gray-800 dark:text-gray-200">
                              {t.note || '-'}
                            </td>
                            <td className="py-3 px-2 text-right">
                              <span className={`font-bold text-sm ${
                                isIncome || isTransferIn ? 'text-emerald-600 dark:text-emerald-400' :
                                isExpense || isTransferOut ? 'text-red-600 dark:text-red-400' :
                                'text-gray-600 dark:text-gray-400'
                              }`}>
                                {(isIncome || isTransferIn) && '+'}
                                {(isExpense || isTransferOut) && '-'}
                                {fmt(t.amount)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SubscriptionView = ({ subscriptions, wallets, userId, appId, fmt }) => {
  const [form, setForm] = useState({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) });
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [sortBy, setSortBy] = useState('paymentDay'); // 'paymentDay' | 'cost' | 'name'

  // New function to handle manual rate fetch
  const handleFetchRate = async () => {
    if (form.currency === 'IDR' || !form.currency) return;
    setIsLoadingRate(true);
    const rate = await fetchExchangeRate(form.currency);
    if (rate && form.foreignCost) {
       setForm(prev => ({ ...prev, cost: Math.round(prev.foreignCost * rate) }));
    }
    setIsLoadingRate(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.cost) return;
    const payload = {
      ...form,
      cost: Number(form.cost),
      foreignCost: form.currency !== 'IDR' ? Number(form.foreignCost) : 0,
      paymentDay: Number(form.paymentDay),
      updatedAt: serverTimestamp(),
      startDate: new Date(form.startDate) // Save start date
    };
    delete payload.id;

    try {
      if (form.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'subscriptions', form.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'subscriptions'), { ...payload, createdAt: serverTimestamp() });
      }
      setForm({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) });
      setIsFormOpen(false);
    } catch (err) { console.error(err); }
  };

  const handleEdit = (sub) => {
    const startDateValue = sub.startDate ? (
      typeof sub.startDate.toDate === 'function' 
        ? formatDateInput(sub.startDate.toDate())
        : formatDateInput(new Date(sub.startDate))
    ) : formatDateInput(new Date());
    
    setForm({ 
      ...sub, 
      id: sub.id,
      startDate: startDateValue
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus langganan ini?')) {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'subscriptions', id));
    }
  };

  // Sorting logic
  const sortedSubscriptions = useMemo(() => {
    const sorted = [...subscriptions];
    if (sortBy === 'paymentDay') {
      sorted.sort((a, b) => (Number(a.paymentDay) || 31) - (Number(b.paymentDay) || 31));
    } else if (sortBy === 'cost') {
      sorted.sort((a, b) => Number(b.cost) - Number(a.cost)); // Descending
    } else if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    }
    return sorted;
  }, [subscriptions, sortBy]);

  // Calculate stats
  const totalMonthly = subscriptions.reduce((acc, sub) => {
    return acc + (sub.cycle === 'monthly' ? sub.cost : sub.cost / 12);
  }, 0);

  const totalYearly = totalMonthly * 12;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Langganan Rutin</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
            <ListFilter size={16} className="text-gray-500"/>
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-transparent outline-none text-gray-700 dark:text-gray-200 w-full dark:[&>option]:bg-gray-800"
            >
              <option value="paymentDay">Sortir: Tanggal Bayar</option>
              <option value="cost">Sortir: Nominal (Tertinggi)</option>
              <option value="name">Sortir: Nama</option>
            </select>
          </div>
          <button onClick={() => { setIsFormOpen(!isFormOpen); setForm({ id: null, name: '', cost: '', cycle: 'monthly', paymentDay: '', walletId: '', currency: 'IDR', foreignCost: '', startDate: formatDateInput(new Date()) }); }} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors shrink-0">{isFormOpen ? <X size={18}/> : <Plus size={18}/>} <span>{isFormOpen ? 'Batal' : 'Tambah'}</span></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800 flex justify-between items-center">
          <div>
            <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase">Estimasi Bulanan</p>
            <p className="text-xl font-bold text-blue-800 dark:text-blue-100">{fmt(totalMonthly)}</p>
          </div>
          <Calendar className="text-blue-400 opacity-50" size={32} />
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-100 dark:border-purple-800 flex justify-between items-center">
          <div>
            <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold uppercase">Estimasi Tahunan</p>
            <p className="text-xl font-bold text-purple-800 dark:text-purple-100">{fmt(totalYearly)}</p>
          </div>
          <Coins className="text-purple-400 opacity-50" size={32} />
        </div>
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Layanan</label>
              <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Netflix" />
            </div>
            
            <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mata Uang & Nominal Asing</label>
               <div className="flex gap-2">
                 <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })} className="w-1/3 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                 </select>
                 <input type="number" 
                   disabled={form.currency === 'IDR'}
                   value={form.foreignCost} 
                   onChange={e => setForm({ ...form, foreignCost: e.target.value })} 
                   className="w-2/3 p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800" 
                   placeholder={form.currency === 'IDR' ? '-' : 'Nominal Asli'}
                 />
               </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex justify-between">
                <span>{form.currency !== 'IDR' ? `Estimasi (Rp)` : `Biaya (Rp)`}</span>
                {form.currency !== 'IDR' && (
                  <button type="button" onClick={handleFetchRate} disabled={isLoadingRate} className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    {isLoadingRate ? <RefreshCw size={10} className="animate-spin"/> : <Globe size={10}/>} Ambil Kurs Terkini
                  </button>
                )}
              </label>
              <input type="number" required value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Siklus</label>
              <select value={form.cycle} onChange={e => setForm({ ...form, cycle: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                <option value="monthly">Bulanan</option>
                <option value="yearly">Tahunan</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tanggal Bayar (Tgl 1-31)</label>
              <input type="number" min="1" max="31" value={form.paymentDay} onChange={e => setForm({ ...form, paymentDay: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Tgl berapa?" />
            </div>
            <div className="space-y-1">
               <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mulai Berlangganan</label>
               <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sumber Dana</label>
              <select value={form.walletId} onChange={e => setForm({ ...form, walletId: e.target.value })} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                <option value="">Pilih Dompet/Kartu...</option>
                {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg flex items-center gap-2 font-medium shadow-sm transition-colors">
              <Save size={18} /> {form.id ? 'Simpan Perubahan' : 'Tambah Langganan'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedSubscriptions.map(sub => {
          const wallet = wallets.find(w => w.id === sub.walletId);
          const curr = CURRENCIES.find(c => c.code === sub.currency) || CURRENCIES[0];
          return (
            <div key={sub.id} className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex justify-between items-center group hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="text-3xl p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  {getSubscriptionIcon(sub.name)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 dark:text-gray-100">{sub.name}</h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1"><Calendar size={10} /> Tgl {sub.paymentDay || '?'}</span>
                    {wallet && <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 px-1.5 rounded text-[10px]"><Wallet size={10} /> {wallet.name}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800 dark:text-gray-100">{fmt(sub.cost)}</p>
                {sub.currency !== 'IDR' && (
                  <p className="text-xs text-gray-400">{curr.symbol} {sub.foreignCost}</p>
                )}
                <div className="flex justify-end gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleEdit(sub)} className="text-blue-400 hover:text-blue-600"><Edit2 size={14} /></button>
                  <button onClick={() => handleDelete(sub.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
        {subscriptions.length === 0 && (
          <div className="col-span-full text-center py-10 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
            Belum ada langganan. Tambahkan Netflix, Spotify, atau tagihan rutin lainnya.
          </div>
        )}
      </div>
    </div>
  );
};

const InvestmentView = ({ investments, investTypes, wallets, userId, appId, fmt }) => {
  const [editingType, setEditingType] = useState(null);
  const [assetForm, setAssetForm] = useState({ id: null, name: '', typeId: '', amount: '', purchaseValue: '', currentValue: '', sourceWalletId: '', icon: '' });
  const [isAssetFormOpen, setIsAssetFormOpen] = useState(false);
  const [filterGoal, setFilterGoal] = useState(''); // State untuk filter
  const scrollRef = useRef(null);

  const typeStats = useMemo(() => {
    return investTypes.map(type => {
      const relatedInv = investments.filter(i => i.typeId === type.id || (!i.typeId && i.type === type.name));
      const currentTotal = relatedInv.reduce((a, c) => a + (Number(c.currentValue)||0), 0);
      const percent = type.target > 0 ? (currentTotal / type.target) * 100 : 0;
      return { ...type, currentTotal, percent: isNaN(percent) ? 0 : percent };
    });
  }, [investments, investTypes]);

  // Filter Logic untuk List Aset
  const filteredAssets = useMemo(() => {
    if (!filterGoal) return investments;
    return investments.filter(inv => {
       // Handle legacy data (cocokkan ID atau Name jika ID kosong)
       const typeId = inv.typeId || investTypes.find(t => t.name === inv.type)?.id;
       return typeId === filterGoal;
    });
  }, [investments, filterGoal, investTypes]);

  const handleSaveType = async (e) => {
    e.preventDefault();
    const payload = { ...editingType, target: Number(editingType.target) };
    try {
      if (editingType.id) await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'investment_types', editingType.id), payload);
      else await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'investment_types'), payload);
      setEditingType(null);
    } catch(err){console.error(err)}
  };

  const handleSaveAsset = async (e) => {
    e.preventDefault();
    const payload = { ...assetForm, amount: Number(assetForm.amount)||0, purchaseValue: Number(assetForm.purchaseValue)||0, currentValue: Number(assetForm.currentValue)||0, updatedAt: serverTimestamp() };
    delete payload.id;
    delete payload.sourceWalletId; // Don't save this to asset, used for transaction creation only

    try {
      if (assetForm.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'investments', assetForm.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'investments'), { ...payload, createdAt: serverTimestamp() });
        
        // Auto-create transaction if wallet selected
        if (assetForm.sourceWalletId) {
           await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'transactions'), {
              type: 'investment',
              walletId: assetForm.sourceWalletId,
              amount: Number(assetForm.purchaseValue),
              category: 'Investasi',
              note: `Beli Aset: ${assetForm.name}`,
              date: new Date(),
              createdAt: serverTimestamp()
           });
        }
      }
      setIsAssetFormOpen(false); setAssetForm({ id: null, name: '', typeId: '', amount: '', purchaseValue: '', currentValue: '', sourceWalletId: '', icon: '' });
    } catch(err){console.error(err)}
  };

  const handleEditAsset = (inv) => {
    setAssetForm({ 
      id: inv.id, name: inv.name, 
      typeId: inv.typeId || investTypes.find(t => t.name === inv.type)?.id || '', 
      amount: inv.amount ?? '', purchaseValue: inv.purchaseValue ?? '', currentValue: inv.currentValue ?? '',
      icon: inv.icon || '',
      sourceWalletId: '' // No source wallet editing for existing assets
    });
    setIsAssetFormOpen(true);
    // Auto-scroll ke form
    setTimeout(() => {
       if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };
  const handleDeleteAsset = async (id) => { if(confirm('Hapus aset ini?')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'investments', id)); };
  const handleDeleteType = async (id) => { if(confirm('Hapus kategori ini? Aset di dalamnya tidak akan terhapus tapi jadi tidak berkategori.')) await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'investment_types', id)); };

  return (
    <div className="space-y-8" ref={scrollRef}>
      {/* SECTION 1: GOALS & TYPES */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Target className="text-emerald-600 dark:text-emerald-400"/> Goal & Kategori Investasi</h3>
          <button onClick={()=>setEditingType({name:'', target:'', deadline:'', icon:''})} className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline">+ Buat Goal Baru</button>
        </div>
        
        {editingType && (
           <form onSubmit={handleSaveType} className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-5 gap-4 animate-in fade-in border border-gray-200 dark:border-gray-600">
             <div className="md:col-span-1 space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Icon</label>
                <input value={editingType.icon} onChange={e=>setEditingType({...editingType, icon:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white text-center" placeholder="💰"/>
             </div>
             <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Nama Kategori/Goal</label>
                <input required value={editingType.name} onChange={e=>setEditingType({...editingType, name:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" placeholder="Misal: Dana Haji"/>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Target (Rp)</label>
                <input type="number" required value={editingType.target} onChange={e=>setEditingType({...editingType, target:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
             </div>
             <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">Deadline</label>
                <input type="date" value={editingType.deadline||''} onChange={e=>setEditingType({...editingType, deadline:e.target.value})} className="w-full p-2 border rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"/>
             </div>
             <div className="md:col-span-5 flex justify-end gap-2 pt-2">
               <button type="button" onClick={()=>setEditingType(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg">Batal</button>
               <button type="submit" className="px-6 py-2 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg font-medium shadow-sm">Simpan Goal</button>
             </div>
           </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {typeStats.map(t => (
            <div key={t.id} className="border dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow group relative dark:bg-gray-700/50">
              <div className="flex justify-between items-start mb-2">
                 <div className="flex items-center gap-2">
                   <span className="text-xl">{t.icon||'💰'}</span>
                   <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">{t.name}</span>
                 </div>
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>setEditingType(t)} className="text-gray-300 hover:text-blue-500"><Edit2 size={14}/></button>
                    <button onClick={()=>handleDeleteType(t.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                 </div>
              </div>
              <div className="space-y-1 cursor-pointer" onClick={() => setFilterGoal(t.id === filterGoal ? '' : t.id)}>
                 <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                   <span>Tercapai: {fmt(t.currentTotal)}</span>
                   <span>Target: {fmt(t.target)}</span>
                 </div>
                 <div className="w-full bg-gray-100 dark:bg-gray-600 rounded-full h-2">
                   <div className="bg-emerald-500 h-2 rounded-full transition-all duration-1000" style={{width: `${Math.min(t.percent, 100)}%`}}></div>
                 </div>
                 <div className="flex justify-between items-center mt-1">
                   <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{t.percent.toFixed(1)}%</span>
                   {t.deadline && <span className="text-[10px] bg-gray-100 dark:bg-gray-600 px-1 rounded text-gray-500 dark:text-gray-300 flex items-center gap-1"><Calendar size={8}/> {t.deadline}</span>}
                 </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 2: ASSETS LIST */}
      <div>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Portofolio Aset</h2>
          <div className="flex items-center gap-2 w-full md:w-auto">
             {/* FILTER DROPDOWN */}
             <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm flex-1 md:flex-none">
                <ListFilter size={16} className="text-gray-500"/>
                <select 
                  value={filterGoal} 
                  onChange={(e) => setFilterGoal(e.target.value)}
                  className="bg-transparent outline-none text-gray-700 dark:text-gray-200 w-full dark:[&>option]:bg-gray-800 dark:[&>option]:text-gray-200"
                >
                  <option value="">Semua Kategori</option>
                  {investTypes.map(t => <option key={t.id} value={t.id}>{t.icon} {t.name}</option>)}
                </select>
             </div>
             <button onClick={()=>{setIsAssetFormOpen(!isAssetFormOpen); setAssetForm({id:null, name:'', typeId:'', amount:'', purchaseValue:'', currentValue:''})}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors shrink-0">{isAssetFormOpen?<X size={18}/>:<Plus size={18}/>} <span className="hidden md:inline">{isAssetFormOpen?'Batal':'Tambah'}</span></button>
          </div>
        </div>

        {isAssetFormOpen && (
          <form onSubmit={handleSaveAsset} className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700 mb-6 animate-in fade-in slide-in-from-top-4 transition-colors duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Nama Produk</label>
                  <input required value={assetForm.name} onChange={e=>setAssetForm({...assetForm, name:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Antam 5g"/>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Icon (Emoji)</label>
                  <input value={assetForm.icon} onChange={e=>setAssetForm({...assetForm, icon:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white text-center" placeholder="Default: ❓"/>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Kategori/Goal</label>
                  <select required value={assetForm.typeId} onChange={e=>setAssetForm({...assetForm, typeId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800"><option value="">Pilih...</option>{investTypes.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Jumlah Unit</label>
                  <input type="number" value={assetForm.amount} onChange={e=>setAssetForm({...assetForm, amount:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
               </div>
               <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Modal Awal (Rp)</label>
                  <input type="number" required value={assetForm.purchaseValue} onChange={e=>setAssetForm({...assetForm, purchaseValue:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white"/>
               </div>
               <div className="md:col-span-2 space-y-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Nilai Saat Ini (Rp)</label>
                  <input type="number" required value={assetForm.currentValue} onChange={e=>setAssetForm({...assetForm, currentValue:e.target.value})} className="w-full p-2.5 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-emerald-900 dark:text-emerald-300"/>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Nilai pasar terkini untuk menghitung profit/loss.</p>
               </div>
               {!assetForm.id && (
                 <div className="md:col-span-2 space-y-2">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Sumber Dana (Opsional)</label>
                    <select value={assetForm.sourceWalletId || ''} onChange={e=>setAssetForm({...assetForm, sourceWalletId:e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                      <option value="">Tidak ada (Hanya catat)</option>
                      {wallets.map(w=><option key={w.id} value={w.id}>{w.icon || '💰'} {w.name} ({fmt(w.currentBalance)})</option>)}
                    </select>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Jika dipilih, saldo akan berkurang otomatis sebagai "Mutasi Keluar" ke Aset.</p>
                 </div>
               )}
            </div>
            <div className="flex justify-end"><button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-lg font-medium flex items-center gap-2 shadow-lg shadow-emerald-200/50 transition-all"><Save size={18}/> {assetForm.id ? 'Update Aset' : 'Simpan Aset'}</button></div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
           {filteredAssets.length === 0 ? (
             <div className="col-span-full text-center py-10 text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
               Tidak ada aset di kategori ini.
             </div>
           ) : filteredAssets.map(inv => {
             const roi = inv.currentValue - inv.purchaseValue;
             const roiP = inv.purchaseValue > 0 ? (roi/inv.purchaseValue)*100 : 0;
             const type = investTypes.find(t => t.id === inv.typeId) || { name: inv.type || 'Lainnya', icon: '❓' };
             
             return (
               <div key={inv.id} className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md transition-all duration-300">
                 <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl bg-gray-50 dark:bg-gray-700 p-2 rounded-lg">{inv.icon || type?.icon || '❓'}</div>
                      <div><h3 className="font-bold text-gray-800 dark:text-gray-200">{inv.name}</h3><p className="text-xs text-gray-500 dark:text-gray-400">{type?.name || 'Lainnya'} • {inv.amount} unit</p></div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={()=>handleEditAsset(inv)} className="p-1 text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"><Edit2 size={16}/></button>
                      <button onClick={()=>handleDeleteAsset(inv.id)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"><Trash2 size={16}/></button>
                    </div>
                 </div>
                 <div className="space-y-1 text-sm border-t dark:border-gray-700 border-b py-2 mb-2 border-dashed">
                    <div className="flex justify-between text-gray-500 dark:text-gray-400"><span>Modal</span><span>{fmt(inv.purchaseValue)}</span></div>
                    <div className="flex justify-between font-medium dark:text-gray-200"><span>Nilai</span><span>{fmt(inv.currentValue)}</span></div>
                 </div>
                 <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 dark:text-gray-500">ROI</span>
                    <span className={`text-sm font-bold ${roi>=0?'text-green-600 dark:text-green-400':'text-red-600 dark:text-red-400'}`}>{roi>=0?'+':''}{roiP.toFixed(1)}% ({fmt(roi)})</span>
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    </div>
  );
};

const ZakatView = ({ summary, investments, fmt }) => {
  const [goldPrice, setGoldPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [customGoldPrice, setCustomGoldPrice] = useState('');

  // Nisab: 85 grams of gold
  const NISAB_GOLD_GRAMS = 85;

  useEffect(() => {
    const loadGoldPrice = async () => {
      setLoading(true);
      const price = await fetchGoldPrice();
      if (price) {
        setGoldPrice(price);
        setCustomGoldPrice('');
      }
      setLoading(false);
    };
    loadGoldPrice();
  }, []);

  // Calculate nisab based on current gold price
  const nisab = useMemo(() => {
    const price = customGoldPrice ? Number(customGoldPrice) : goldPrice;
    if (!price) return 0;
    return NISAB_GOLD_GRAMS * price;
  }, [goldPrice, customGoldPrice]);

  // Total liquid assets (kas + investasi)
  const totalLiquidAssets = useMemo(() => {
    const liquidWallets = summary.walletBalances
      .filter(w => w.type !== 'credit_card')
      .reduce((a, w) => a + w.currentBalance, 0);
    const investmentValue = investments.reduce((a, c) => a + (Number(c.currentValue) || 0), 0);
    return liquidWallets + investmentValue;
  }, [summary, investments]);

  // Check if nisab is reached
  const isNisabReached = totalLiquidAssets >= nisab;

  // Calculate zakat mal (2.5%)
  const zakatAmount = useMemo(() => {
    if (!isNisabReached) return 0;
    return (totalLiquidAssets * 0.025);
  }, [totalLiquidAssets, isNisabReached]);

  const handleUpdateGoldPrice = () => {
    if (customGoldPrice) {
      setGoldPrice(Number(customGoldPrice));
    }
  };

  const currentPrice = customGoldPrice ? Number(customGoldPrice) : goldPrice;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Kalkulator Zakat Mal</h2>

      {/* Gold Price Section */}
      <div className="bg-amber-50 dark:bg-amber-900/20 p-6 rounded-xl border border-amber-100 dark:border-amber-800 transition-colors duration-300">
        <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <Globe size={18} className="text-amber-600"/> Harga Emas Terkini
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase mb-1">Harga Emas (Per Gram)</p>
            {loading ? (
              <p className="text-lg font-bold text-gray-400 dark:text-gray-500 animate-pulse">Memuat...</p>
            ) : currentPrice > 0 ? (
              <div>
                <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(currentPrice)}</p>
                {!customGoldPrice && goldPrice && goldPrice < 500000 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">⚠️ Estimasi</p>
                )}
              </div>
            ) : (
              <p className="text-lg font-bold text-gray-400 dark:text-gray-500">—</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase">Update Harga Manual (Rp)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={customGoldPrice}
                onChange={(e) => setCustomGoldPrice(e.target.value)}
                placeholder={currentPrice > 0 ? fmt(currentPrice) : "Masukkan harga emas..."}
                className="flex-1 p-2.5 border border-amber-200 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white dark:bg-amber-900/20 dark:text-white text-sm"
              />
              <button
                onClick={handleUpdateGoldPrice}
                disabled={!customGoldPrice}
                className="bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              >
                Update
              </button>
            </div>
          </div>
          <div>
            <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase mb-1">Nisab (85 gr)</p>
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{fmt(nisab)}</p>
            <button
              onClick={() => {
                setLoading(true);
                fetchGoldPrice().then(price => {
                  setGoldPrice(price);
                  setCustomGoldPrice('');
                  setLoading(false);
                });
              }}
              disabled={loading}
              className="text-xs mt-2 px-2 py-1 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-300 rounded disabled:opacity-50 transition-colors"
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Assets Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Saldo Kas</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {fmt(summary.walletBalances.filter(w => w.type !== 'credit_card').reduce((a, w) => a + w.currentBalance, 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Nilai Investasi</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {fmt(investments.reduce((a, c) => a + (Number(c.currentValue) || 0), 0))}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Total Aset Cair</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {fmt(totalLiquidAssets)}
          </p>
        </div>
      </div>

      {/* Nisab Status */}
      <div className={`p-6 rounded-xl border transition-colors duration-300 ${
        isNisabReached
          ? 'bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800'
      }`}>
        <div className="flex items-start gap-4">
          {isNisabReached ? (
            <CheckCircle className="text-green-600 dark:text-green-400 mt-1 shrink-0" size={24} />
          ) : (
            <AlertTriangle className="text-red-600 dark:text-red-400 mt-1 shrink-0" size={24} />
          )}
          <div>
            <h3 className={`font-bold text-lg mb-2 ${
              isNisabReached
                ? 'text-green-700 dark:text-green-300'
                : 'text-red-700 dark:text-red-300'
            }`}>
              {isNisabReached ? '✓ Sudah Mencapai Nisab' : '✗ Belum Mencapai Nisab'}
            </h3>
            <div className={`text-sm ${
              isNisabReached
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {isNisabReached ? (
                <>
                  <p>Total aset Anda: <span className="font-bold">{fmt(totalLiquidAssets)}</span></p>
                  <p>Telah melampaui nisab: <span className="font-bold">{fmt(nisab)}</span></p>
                  <p className="mt-2">Selisih: <span className="font-bold">{fmt(totalLiquidAssets - nisab)}</span></p>
                </>
              ) : (
                <>
                  <p>Total aset Anda: <span className="font-bold">{fmt(totalLiquidAssets)}</span></p>
                  <p>Nisab yang dibutuhkan: <span className="font-bold">{fmt(nisab)}</span></p>
                  <p className="mt-2">Masih kurang: <span className="font-bold">{fmt(nisab - totalLiquidAssets)}</span></p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Zakat Calculation */}
      {isNisabReached && (
        <div className="bg-gradient-to-br from-emerald-50 to-blue-50 dark:from-emerald-900/20 dark:to-blue-900/20 p-8 rounded-xl border border-emerald-200 dark:border-emerald-800 transition-colors duration-300">
          <h3 className="font-bold text-2xl text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-2">
            <Heart size={24} className="text-red-500"/> Zakat Mal yang Perlu Dibayarkan
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">2,5% dari total aset cair dan investasi</p>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-emerald-200 dark:border-emerald-700 mb-4">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Jumlah Zakat Mal</p>
              <p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(zakatAmount)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                ({totalLiquidAssets.toLocaleString('id-ID')} × 2,5%)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Metode Pembayaran</p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Langsung ke yang berhak menerima zakat</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Melalui lembaga zakat terpercaya</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-600">✓</span>
                  <span>Disimpan dengan niat zakat</span>
                </li>
              </ul>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase mb-2">Catatan Penting</p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">ℹ</span>
                  <span>Zakat baru wajib jika mencapai nisab selama 1 tahun penuh</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600">ℹ</span>
                  <span>Aset utang tidak dikurangi dari perhitungan zakat</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {!isNisabReached && (
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 transition-colors duration-300">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Zakat mal baru wajib dibayarkan setelah total aset mencapai nisab (setara dengan 85 gram emas) selama minimal 1 tahun qamariyah.
          </p>
        </div>
      )}
    </div>
  );
};

const CategoryView = ({ categories, userId, appId, fmt }) => {
  const [editingId, setEditingId] = useState(null);
  const [editBudget, setEditBudget] = useState('');
  const [newCatForm, setNewCatForm] = useState({ type: 'expense', name: '', budget: '' });
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  
  const handleSaveBudget = async (catId, budget) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'categories', catId), { budget: Number(budget) || 0 });
      setEditingId(null);
    } catch(err) { console.error(err); }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatForm.name.trim()) return;
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'categories'), {
        name: newCatForm.name.trim(),
        type: newCatForm.type,
        budget: Number(newCatForm.budget) || 0
      });
      setNewCatForm({ type: 'expense', name: '', budget: '' });
      setIsAddingCategory(false);
    } catch(err) { console.error(err); }
  };

  const handleDeleteCategory = async (catId) => {
    if (confirm('Hapus kategori ini?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'categories', catId));
      } catch(err) { console.error(err); }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Kategori & Budget</h2>
        <button onClick={() => setIsAddingCategory(!isAddingCategory)} className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors">{isAddingCategory ? <X size={18}/> : <Plus size={18}/>} <span>{isAddingCategory ? 'Batal' : 'Tambah'}</span></button>
      </div>

      {isAddingCategory && (
        <form onSubmit={handleAddCategory} className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 transition-colors duration-300">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Tipe</label>
              <select value={newCatForm.type} onChange={e => setNewCatForm({...newCatForm, type: e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800">
                <option value="expense">Pengeluaran</option>
                <option value="income">Pemasukan</option>
              </select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">Nama Kategori</label>
              <input required type="text" value={newCatForm.name} onChange={e => setNewCatForm({...newCatForm, name: e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="Contoh: Hobi & Rekreasi"/>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">{newCatForm.type === 'expense' ? 'Budget (Rp)' : 'Target (Rp)'}</label>
              <input type="number" value={newCatForm.budget} onChange={e => setNewCatForm({...newCatForm, budget: e.target.value})} className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white" placeholder="0"/>
            </div>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 shadow-sm transition-colors h-[46px]"><Save size={18}/> Tambah</button>
          </div>
        </form>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><ArrowDownRight size={18} className="text-red-500"/> Kategori Pengeluaran</h3>
          <div className="space-y-3">
            {categories.raw.filter(c => c.type === 'expense').length === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">Belum ada kategori</div>
            ) : categories.raw.filter(c => c.type === 'expense').map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-700 group hover:shadow-sm transition-all">
                <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                {editingId === cat.id ? (
                  <div className="flex gap-2">
                    <input type="number" value={editBudget} onChange={e => setEditBudget(e.target.value)} className="w-24 p-1 border rounded text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white" />
                    <button onClick={() => handleSaveBudget(cat.id, editBudget)} className="text-xs text-green-600 hover:text-green-700 dark:text-green-400 font-bold">Simpan</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500">Batal</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className={`font-bold ${cat.budget > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'}`}>{cat.budget > 0 ? fmt(cat.budget) : '-'}</span>
                    <button onClick={() => { setEditingId(cat.id); setEditBudget(cat.budget); }} className="text-blue-500 hover:text-blue-700 dark:text-blue-400"><Edit2 size={14}/></button>
                    <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><Trash2 size={14}/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2"><ArrowUpRight size={18} className="text-green-500"/> Kategori Pemasukan</h3>
          <div className="space-y-3">
            {categories.raw.filter(c => c.type === 'income').length === 0 ? (
              <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">Belum ada kategori</div>
            ) : categories.raw.filter(c => c.type === 'income').map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 border dark:border-gray-700 group hover:shadow-sm transition-all">
                <span className="font-medium text-gray-700 dark:text-gray-300">{cat.name}</span>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-xs text-gray-400 dark:text-gray-500">Untuk referensi</span>
                  <button onClick={() => handleDeleteCategory(cat.id)} className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SalaryAllocatorView = ({ categories, wallets, userId, appId, fmt }) => {
  const [salaries, setSalaries] = useState([{ id: Date.now(), source: '', amount: '' }]);
  const [allocations, setAllocations] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState('');
  const [savedTemplates, setSavedTemplates] = useState([]);

  // Calculate total salary from all sources
  const totalSalary = useMemo(() => {
    return salaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
  }, [salaries]);

  // Load state from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem(`salaryState_${userId}`);
    if (savedState) {
      try {
        const { salaries: sal, selectedWallet: w, allocations: a } = JSON.parse(savedState);
        // Backward compatibility: convert old single salary to array
        if (sal && Array.isArray(sal)) {
          setSalaries(sal.length > 0 ? sal : [{ id: Date.now(), source: '', amount: '' }]);
        } else if (savedState.salary) {
          // Old format
          setSalaries([{ id: Date.now(), source: 'Gaji Utama', amount: savedState.salary }]);
        }
        setSelectedWallet(w || '');
        setAllocations(a || []);
      } catch (e) {
        console.error('Error loading state:', e);
      }
    }

    // Load saved templates
    const templates = localStorage.getItem(`salaryTemplates_${userId}`);
    if (templates) {
      try {
        setSavedTemplates(JSON.parse(templates));
      } catch (e) {
        console.error('Error loading templates:', e);
      }
    }
  }, [userId]);

  // Auto-save state to localStorage whenever it changes
  useEffect(() => {
    if (userId) {
      const state = { salaries, selectedWallet, allocations };
      localStorage.setItem(`salaryState_${userId}`, JSON.stringify(state));
    }
  }, [salaries, selectedWallet, allocations, userId]);

  // Save allocations helper
  const saveAllocations = (data) => {
    setAllocations(data);
  };

  // Salary sources management
  const handleAddSalarySource = () => {
    setSalaries([...salaries, { id: Date.now(), source: '', amount: '' }]);
  };

  const handleUpdateSalarySource = (id, field, value) => {
    setSalaries(salaries.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleDeleteSalarySource = (id) => {
    if (salaries.length === 1) {
      alert('Minimal harus ada 1 sumber gaji');
      return;
    }
    setSalaries(salaries.filter(s => s.id !== id));
  };

  const handleAddAllocation = () => {
    if (totalSalary === 0 || !selectedWallet) {
      alert('Masukkan gaji dan pilih rekening terlebih dahulu');
      return;
    }
    const newAlloc = {
      id: Date.now(),
      category: '',
      amount: '',
      percentage: 0,
      wallet: selectedWallet
    };
    saveAllocations([...allocations, newAlloc]);
  };

  const handleUpdateAllocation = (id, field, value) => {
    const updated = allocations.map(a => {
      if (a.id === id) {
        const newA = { ...a };
        
        if (field === 'amount') {
          newA.amount = value;
          // Auto calculate percentage if amount changes and salary is set
          if (totalSalary && value !== '') {
            newA.percentage = ((parseFloat(value) || 0) / totalSalary) * 100;
          } else {
            newA.percentage = 0;
          }
        } else if (field === 'percentage') {
          newA.percentage = parseFloat(value) || 0;
          // Auto calculate amount if percentage changes and salary is set
          if (totalSalary) {
            newA.amount = ((parseFloat(value) || 0) / 100 * totalSalary).toString();
          } else {
            newA.amount = '';
          }
        } else {
          // For other fields like category, wallet
          newA[field] = value;
        }
        
        return newA;
      }
      return a;
    });
    saveAllocations(updated);
  };

  const handleDeleteAllocation = (id) => {
    saveAllocations(allocations.filter(a => a.id !== id));
  };

  const handleReset = () => {
    if (confirm('Reset semua alokasi? Data akan dihapus.')) {
      setSalaries([{ id: Date.now(), source: '', amount: '' }]);
      setSelectedWallet('');
      setAllocations([]);
    }
  };

  const handleSaveTemplate = () => {
    if (totalSalary === 0 || allocations.length === 0) {
      alert('Masukkan gaji dan minimal 1 alokasi terlebih dahulu');
      return;
    }
    const name = prompt('Nama template (contoh: Gaji Bulanan Januari):');
    if (!name) return;
    
    const template = {
      id: Date.now(),
      name,
      salaries,
      selectedWallet,
      allocations,
      createdAt: new Date().toISOString()
    };

    const updated = [...savedTemplates, template];
    setSavedTemplates(updated);
    localStorage.setItem(`salaryTemplates_${userId}`, JSON.stringify(updated));
    alert(`Template "${name}" berhasil disimpan!`);
  };

  const handleLoadTemplate = (template) => {
    if (confirm(`Load template "${template.name}"?`)) {
      // Backward compatibility
      if (template.salaries && Array.isArray(template.salaries)) {
        setSalaries(template.salaries.map(s => ({ ...s, id: Date.now() + Math.random() })));
      } else if (template.salary) {
        setSalaries([{ id: Date.now(), source: 'Gaji Utama', amount: template.salary }]);
      }
      setSelectedWallet(template.selectedWallet);
      setAllocations(template.allocations.map(a => ({ ...a, id: Date.now() + Math.random() })));
    }
  };

  const handleDeleteTemplate = (id) => {
    if (confirm('Hapus template ini?')) {
      const updated = savedTemplates.filter(t => t.id !== id);
      setSavedTemplates(updated);
      localStorage.setItem(`salaryTemplates_${userId}`, JSON.stringify(updated));
    }
  };

  const handleApplyToBudget = async () => {
    if (allocations.length === 0) {
      alert('Tidak ada alokasi untuk diaplikasikan ke budget');
      return;
    }

    if (!confirm('Aplikasikan alokasi ini sebagai budget limit untuk kategori terkait?')) {
      return;
    }

    try {
      let successCount = 0;
      for (const alloc of allocations) {
        if (alloc.category && alloc.amount) {
          // Find category in categories.raw
          const category = categories.raw.find(c => c.name === alloc.category && c.type === 'expense');
          if (category) {
            const catRef = doc(db, 'artifacts', appId, 'users', userId, 'categories', category.id);
            await updateDoc(catRef, {
              budget: parseFloat(alloc.amount) || 0
            });
            successCount++;
          }
        }
      }

      alert(`Budget berhasil diaplikasikan ke ${successCount} kategori!`);
    } catch (error) {
      console.error('Error applying budget:', error);
      alert('Gagal mengaplikasikan budget: ' + error.message);
    }
  };

  const totalAllocated = allocations.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);
  const remaining = totalSalary - totalAllocated;
  const remainingPercent = totalSalary ? (remaining / totalSalary) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <DollarSign size={28} className="text-emerald-600 dark:text-emerald-400"/>
          Kalkulator Pengalokasian Gaji
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={handleApplyToBudget}
            disabled={allocations.length === 0}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors"
          >
            <Target size={16}/> Apply ke Budget
          </button>
          <button 
            onClick={handleSaveTemplate} 
            disabled={totalSalary === 0 || allocations.length === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors"
          >
            <Save size={16}/> Simpan Template
          </button>
          <button 
            onClick={handleReset}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors"
          >
            <RefreshCw size={16}/> Reset
          </button>
        </div>
      </div>

      {/* Saved Templates */}
      {savedTemplates.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
          <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
            <Briefcase size={18} className="text-purple-500"/>
            Template Tersimpan
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {savedTemplates.map(template => (
              <div key={template.id} className="p-3 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{template.name}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {template.salaries ? 
                        fmt(template.salaries.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)) : 
                        fmt(template.salary || 0)
                      }
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">{template.allocations.length} alokasi</p>
                  </div>
                  <button 
                    onClick={() => handleDeleteTemplate(template.id)}
                    className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={14}/>
                  </button>
                </div>
                <button 
                  onClick={() => handleLoadTemplate(template)}
                  className="w-full mt-2 bg-purple-600 hover:bg-purple-700 text-white text-xs py-1.5 rounded-lg transition-colors font-medium"
                >
                  Load Template
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Salary Input */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200">Sumber Gaji</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <CheckCircle size={14}/> Auto-save aktif
            </span>
            <button
              onClick={handleAddSalarySource}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex gap-1 items-center transition-colors"
            >
              <Plus size={14}/> Tambah Sumber
            </button>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {salaries.map((sal, index) => (
            <div key={sal.id} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Sumber Gaji #{index + 1}</label>
                <input
                  type="text"
                  value={sal.source}
                  onChange={(e) => handleUpdateSalarySource(sal.id, 'source', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-800 dark:text-white text-sm"
                  placeholder="Contoh: Gaji Utama, Bonus"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400">Nominal (Rp)</label>
                <input
                  type="number"
                  value={sal.amount}
                  onChange={(e) => handleUpdateSalarySource(sal.id, 'amount', e.target.value)}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => handleDeleteSalarySource(sal.id)}
                  disabled={salaries.length === 1}
                  className="w-full p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm font-medium"
                >
                  <Trash2 size={16} className="inline mr-1"/> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">Rekening Default</label>
            <select
              value={selectedWallet}
              onChange={(e) => setSelectedWallet(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white dark:bg-gray-700 dark:text-white dark:[&>option]:bg-gray-800"
            >
              <option value="">Pilih Rekening...</option>
              {wallets.map(w => <option key={w.id} value={w.id}>{w.icon} {w.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">
            <div className="w-full p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mb-1">TOTAL GAJI</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{fmt(totalSalary)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Allocations Summary */}
      {totalSalary > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">TOTAL DIALOKASIKAN</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(totalAllocated)}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{((totalAllocated / parseFloat(salary)) * 100).toFixed(1)}%</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">SISA GAJI</p>
            <h3 className={`text-2xl font-bold ${remaining >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
              {fmt(remaining)}
            </h3>
            <p className={`text-xs mt-1 ${remaining >= 0 ? 'text-blue-500 dark:text-blue-400' : 'text-red-500 dark:text-red-400'}`}>
              {remaining >= 0 ? `${remainingPercent.toFixed(1)}% tersedia` : `Kurang ${fmt(Math.abs(remaining))}`}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">ALOKASI ITEM</p>
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">{allocations.length}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">kategori teralokasi</p>
          </div>
        </div>
      )}

      {/* Allocations Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors duration-300">
        <div className="p-4 border-b dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-500"/>
              Daftar Alokasi
            </h3>
            <button 
              onClick={handleAddAllocation} 
              disabled={totalSalary === 0 || !selectedWallet}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex gap-2 items-center transition-colors"
            >
              <Plus size={16}/> Tambah Alokasi
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            💡 Tip: Input bisa dilakukan dengan nominal atau persentase. Sistem akan otomatis menghitung yang lainnya.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600">
              <tr>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Kategori</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Rekening</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Nominal</th>
                <th className="p-4 font-semibold text-gray-600 dark:text-gray-300">Persentase</th>
                <th className="p-4 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {allocations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-gray-400 dark:text-gray-500">
                    Belum ada alokasi
                  </td>
                </tr>
              ) : (
                allocations.map(alloc => (
                  <tr key={alloc.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                    <td className="p-4">
                      <select 
                        value={alloc.category} 
                        onChange={(e) => handleUpdateAllocation(alloc.id, 'category', e.target.value)}
                        className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm dark:[&>option]:bg-gray-700"
                      >
                        <option value="">Pilih Kategori...</option>
                        {categories.expense.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <select 
                        value={alloc.wallet} 
                        onChange={(e) => handleUpdateAllocation(alloc.id, 'wallet', e.target.value)}
                        className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm dark:[&>option]:bg-gray-700"
                      >
                        {wallets.map(w => (
                          <option key={w.id} value={w.id}>{w.icon} {w.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-4">
                      <input 
                        type="number" 
                        value={alloc.amount || ''} 
                        onChange={(e) => handleUpdateAllocation(alloc.id, 'amount', e.target.value)}
                        className="w-full p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold"
                        placeholder="0"
                        min="0"
                      />
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          value={((alloc.percentage || 0)).toFixed(1)} 
                          onChange={(e) => handleUpdateAllocation(alloc.id, 'percentage', e.target.value)}
                          className="w-20 p-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white text-sm font-semibold"
                          step="0.1"
                          min="0"
                          max="100"
                        />
                        <span className="text-gray-500 dark:text-gray-400">%</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => handleDeleteAllocation(alloc.id)}
                        className="text-gray-300 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16}/>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {allocations.length > 0 && remaining < 0 && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800 flex gap-3">
            <AlertTriangle className="text-red-600 dark:text-red-400 shrink-0" size={20}/>
            <div>
              <p className="text-sm font-semibold text-red-700 dark:text-red-300">Perhatian: Total alokasi melebihi gaji!</p>
              <p className="text-xs text-red-600 dark:text-red-300 mt-1">Kurang {fmt(Math.abs(remaining))} untuk seimbangkan alokasi.</p>
            </div>
          </div>
        )}
      </div>

      {/* Allocation Breakdown Chart */}
      {allocations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col transition-colors duration-300">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4">Distribusi Alokasi</h3>
            {allocations.filter(a => a.amount).length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <RePieChart>
                  <Pie 
                    data={allocations.filter(a => a.amount).map(a => ({
                      name: a.category || 'Tanpa Kategori',
                      value: parseFloat(a.amount) || 0
                    }))} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={60} 
                    outerRadius={90} 
                    paddingAngle={2} 
                    dataKey="value"
                  >
                    {allocations.map((_, i) => (
                      <Cell key={i} fill={['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1'][i % 7]}/>
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v) => fmt(v)} />
                  <Legend verticalAlign="bottom" />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-500">
                Masukkan nominal alokasi untuk melihat diagram
              </div>
            )}
          </div>

          {/* Tips & Suggestions */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors duration-300">
            <h3 className="font-bold text-gray-700 dark:text-gray-200 mb-4 flex items-center gap-2">
              <Target size={18} className="text-amber-500"/>
              Saran Pengalokasian
            </h3>
            <div className="space-y-3 text-sm">
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800">
                <p className="font-semibold text-amber-900 dark:text-amber-300">Kebutuhan Primer (60%)</p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">{fmt(totalSalary * 0.6)}</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <p className="font-semibold text-blue-900 dark:text-blue-300">Kebutuhan Sekunder (30%)</p>
                <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">{fmt(totalSalary * 0.3)}</p>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-100 dark:border-purple-800">
                <p className="font-semibold text-purple-900 dark:text-purple-300">Investasi & Tabungan (10%)</p>
                <p className="text-xs text-purple-700 dark:text-purple-400 mt-1">{fmt(totalSalary * 0.1)}</p>
              </div>
            </div>
            <div className="space-y-2 mt-4 text-xs text-gray-500 dark:text-gray-400">
              <p>💡 <strong>Panduan:</strong> Alokasikan gaji sesuai prioritas keluarga Anda.</p>
              <p>🎯 <strong>Apply ke Budget:</strong> Klik tombol "Apply ke Budget" untuk otomatis mengatur limit budget kategori sesuai alokasi Anda.</p>
              <p>💾 <strong>Simpan Template:</strong> Simpan konfigurasi alokasi untuk digunakan di bulan berikutnya.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- 5. EDUCATION FUND PLANNER VIEW ---
const EducationFundView = ({ userId, appId, fmt }) => {
  const [children, setChildren] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    birthYear: new Date().getFullYear(),
    currentAge: 0,
    currentSavings: 0
  });

  // Educational level cost structure
  const educationLevels = [
    { level: 'TK', startAge: 4, duration: 2, estimatedCost: 5000000, icon: '🎨' },
    { level: 'SD', startAge: 6, duration: 6, estimatedCost: 15000000, icon: '📚' },
    { level: 'SMP', startAge: 12, duration: 3, estimatedCost: 25000000, icon: '📖' },
    { level: 'SMA', startAge: 15, duration: 3, estimatedCost: 35000000, icon: '🎓' },
    { level: 'Kuliah', startAge: 18, duration: 4, estimatedCost: 150000000, icon: '🎯' }
  ];

  const EDUCATION_INFLATION = 0.12; // 12% per year

  // Load children data from Firestore
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'artifacts', appId, 'users', userId, 'children')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          birthYear: doc.data().birthYear || new Date().getFullYear()
        }));
        setChildren(data);
      }
    );

    return () => unsubscribe();
  }, [userId, appId]);

  // Calculate future cost with inflation
  const calculateFutureCost = (baseCost, yearsFromNow) => {
    return baseCost * Math.pow(1 + EDUCATION_INFLATION, yearsFromNow);
  };

  // Calculate monthly savings needed
  const calculateMonthlySavings = (targetAmount, currentSavings, monthsUntil) => {
    if (monthsUntil <= 0) return 0;
    return (targetAmount - currentSavings) / monthsUntil;
  };

  // Generate education plan for a child
  const generateEducationPlan = (child) => {
    const currentYear = new Date().getFullYear();
    const currentAge = currentYear - child.birthYear;

    return educationLevels.map(level => {
      const yearsUntil = level.startAge - currentAge;
      const startYear = currentYear + yearsUntil;
      const futureCost = calculateFutureCost(level.estimatedCost, yearsUntil);
      const monthsUntil = yearsUntil * 12;
      const monthlySavings = calculateMonthlySavings(futureCost, child.currentSavings || 0, monthsUntil);

      return {
        ...level,
        yearsUntil,
        startYear,
        futureCost,
        monthlySavings: monthlySavings > 0 ? monthlySavings : 0,
        status: yearsUntil > 0 ? 'upcoming' : yearsUntil >= -level.duration ? 'ongoing' : 'completed'
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name) {
      alert('Nama anak harus diisi');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        birthYear: Number(formData.birthYear),
        currentSavings: Number(formData.currentSavings) || 0,
        updatedAt: serverTimestamp()
      };

      if (formData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'children', formData.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'children'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }

      setIsFormOpen(false);
      setFormData({ id: null, name: '', birthYear: new Date().getFullYear(), currentAge: 0, currentSavings: 0 });
    } catch (error) {
      console.error('Error saving child data:', error);
      alert('Gagal menyimpan data');
    }
  };

  const handleEdit = (child) => {
    setFormData({
      id: child.id,
      name: child.name,
      birthYear: child.birthYear,
      currentAge: new Date().getFullYear() - child.birthYear,
      currentSavings: child.currentSavings || 0
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus data anak ini?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'children', id));
      } catch (error) {
        console.error('Error deleting child:', error);
        alert('Gagal menghapus data');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <GraduationCap size={28} className="text-emerald-600" />
            Dana Pendidikan Anak
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Rencanakan biaya pendidikan anak dengan inflasi 12% per tahun
          </p>
        </div>
        <button
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            setFormData({ id: null, name: '', birthYear: new Date().getFullYear(), currentAge: 0, currentSavings: 0 });
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors"
        >
          {isFormOpen ? <X size={18} /> : <Plus size={18} />}
          <span>{isFormOpen ? 'Batal' : 'Tambah Anak'}</span>
        </button>
      </div>

      {/* Form Input */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Nama Anak
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"
                placeholder="Contoh: Ahmad"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Tahun Lahir
              </label>
              <input
                type="number"
                required
                min="2000"
                max={new Date().getFullYear()}
                value={formData.birthYear}
                onChange={(e) => setFormData({ ...formData, birthYear: e.target.value })}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Tabungan Saat Ini (Rp)
              </label>
              <input
                type="number"
                min="0"
                value={formData.currentSavings}
                onChange={(e) => setFormData({ ...formData, currentSavings: e.target.value })}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2"
            >
              <Save size={18} />
              {formData.id ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      {/* Children List */}
      {children.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 text-center">
          <Baby size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 dark:text-gray-400">
            Belum ada data anak. Tambahkan data anak untuk mulai merencanakan dana pendidikan.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {children.map((child) => {
            const currentAge = new Date().getFullYear() - child.birthYear;
            const educationPlan = generateEducationPlan(child);
            const upcomingLevels = educationPlan.filter(p => p.status === 'upcoming');
            const nextLevel = upcomingLevels[0];

            return (
              <div
                key={child.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
              >
                {/* Child Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-2xl font-bold flex items-center gap-2">
                        <Baby size={24} />
                        {child.name}
                      </h3>
                      <p className="text-emerald-100 mt-1">
                        {currentAge} tahun • Lahir {child.birthYear}
                      </p>
                      <div className="mt-3 bg-white/20 backdrop-blur-sm rounded-lg px-4 py-2 inline-block">
                        <p className="text-sm">Tabungan Saat Ini</p>
                        <p className="text-xl font-bold">{fmt(child.currentSavings || 0)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(child)}
                        className="p-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(child.id)}
                        className="p-2 bg-white/20 hover:bg-red-500 rounded-lg transition-colors"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Next Milestone */}
                {nextLevel && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-800 p-6">
                    <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-3 flex items-center gap-2">
                      <Target size={16} />
                      Target Berikutnya
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Jenjang</p>
                        <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                          {nextLevel.icon} {nextLevel.level}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Tahun Masuk</p>
                        <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                          {nextLevel.startYear}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Estimasi Biaya</p>
                        <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                          {fmt(nextLevel.futureCost)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-amber-700 dark:text-amber-400">Nabung per Bulan</p>
                        <p className="text-lg font-bold text-amber-900 dark:text-amber-200">
                          {fmt(nextLevel.monthlySavings)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Education Timeline */}
                <div className="p-6">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                    <School size={16} />
                    Rencana Pendidikan Lengkap
                  </h4>
                  <div className="space-y-3">
                    {educationPlan.map((level, idx) => {
                      const progress = level.status === 'completed' ? 100 :
                                     level.status === 'ongoing' ? 50 : 0;

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-lg border ${
                            level.status === 'upcoming'
                              ? 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'
                              : level.status === 'ongoing'
                              ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                          }`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="font-bold text-gray-800 dark:text-gray-100">
                                {level.icon} {level.level}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {level.yearsUntil > 0
                                  ? `${level.yearsUntil} tahun lagi • ${level.startYear}`
                                  : level.status === 'ongoing'
                                  ? 'Sedang Berjalan'
                                  : 'Sudah Selesai'}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-800 dark:text-gray-100">
                                {fmt(level.futureCost)}
                              </p>
                              {level.monthlySavings > 0 && (
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                                  {fmt(level.monthlySavings)}/bln
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                level.status === 'completed'
                                  ? 'bg-gray-400'
                                  : level.status === 'ongoing'
                                  ? 'bg-green-500'
                                  : 'bg-blue-500'
                              }`}
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Summary */}
                  <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-purple-700 dark:text-purple-400">Total Biaya hingga Kuliah</p>
                        <p className="text-xl font-bold text-purple-900 dark:text-purple-200">
                          {fmt(educationPlan.reduce((sum, level) => sum + level.futureCost, 0))}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-purple-700 dark:text-purple-400">Rekomendasi Nabung/Bulan</p>
                        <p className="text-xl font-bold text-purple-900 dark:text-purple-200">
                          {fmt(nextLevel ? nextLevel.monthlySavings : 0)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
        <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
          <AlertTriangle size={18} />
          Tentang Perhitungan
        </h4>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <p>📈 <strong>Inflasi Pendidikan:</strong> 12% per tahun (rata-rata Indonesia)</p>
          <p>💰 <strong>Estimasi Biaya:</strong> Berdasarkan biaya rata-rata sekolah swasta menengah</p>
          <p>🎯 <strong>Rekomendasi:</strong> Mulai menabung sedini mungkin untuk meringankan beban</p>
          <p>📊 <strong>Tips:</strong> Diversifikasi investasi (deposito, reksadana, emas) untuk hasil maksimal</p>
        </div>
      </div>
    </div>
  );
};

// --- 6. SALARY SLIP ARCHIVE VIEW ---
const SalarySlipArchiveView = ({ userId, appId, fmt }) => {
  const [salarySlips, setSalarySlips] = useState([]);
  const [isUploadingPDF, setIsUploadingPDF] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState(null);

  // Load salary slips from Firestore
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onSnapshot(
      collection(db, 'artifacts', appId, 'users', userId, 'salarySlips'),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .sort((a, b) => {
          // Sort by year desc, then month desc
          if (b.year !== a.year) return b.year - a.year;
          return b.month - a.month;
        });
        console.log('✅ Loaded salary slips:', data.length, 'items', data);
        setSalarySlips(data);
      },
      (error) => {
        console.error('❌ Error loading salary slips:', error);
        alert('Error loading data: ' + error.message);
      }
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
      const pageText = content.items
        .map(item => (typeof item.str === 'string' ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        pageTexts.push(pageText);
      }
    }

    return pageTexts.join('\n');
  };

  // Parse PDF salary slip (without storing file)
  const handlePDFUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Mohon pilih file PDF');
      return;
    }

    setIsUploadingPDF(true);

    try {
      const text = await extractTextFromPDF(file);
      console.log('📄 PDF text extracted:', (text || '').substring(0, 300) + '...');

      if (!text || text.length < 30) {
        throw new Error('Teks PDF tidak terbaca. Pastikan file PDF bukan hasil scan gambar murni atau gunakan PDF yang memiliki teks.');
      }

      // Parse salary slip data
      const parsedData = parseSalarySlip(text);
      console.log('🔍 Parsed data:', parsedData);

      // Save only parsed data to Firestore (no PDF file)
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'salarySlips'), {
        fileName: file.name,
        month: parsedData.month || new Date().getMonth() + 1,
        year: parsedData.year || new Date().getFullYear(),
        items: parsedData.items,
        breakdown: parsedData.breakdown || null,
        grossAmount: parsedData.grossAmount || 0,
        deductionAmount: parsedData.deductionAmount || 0,
        netAmount: parsedData.netAmount || parsedData.totalAmount,
        totalAmount: parsedData.totalAmount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      console.log('✅ Saved to Firestore with ID:', docRef.id);

      alert('✅ Slip gaji berhasil dianalisis dan disimpan!');
      e.target.value = ''; // Reset input
    } catch (error) {
      console.error('Error processing salary slip PDF:', error);
      alert(`Gagal menganalisis slip gaji: ${error.message}`);
    } finally {
      setIsUploadingPDF(false);
    }
  };

  // Parse salary slip text - Enhanced for ITB format
  const parseSalarySlip = (text) => {
    let items = [];
    let totalAmount = 0;
    let month = null;
    let year = null;

    console.log('🔍 Parsing salary slip text...');

    const normalizeLabel = (s = '') => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const parseIDR = (raw) => {
      if (!raw) return 0;
      let s = String(raw)
        .replace(/rp|idr/gi, '')
        .replace(/[Oo]/g, '0')
        .replace(/[Il]/g, '1')
        .replace(/\s+/g, '')
        .trim();

      // Keep only numeric separators
      s = s.replace(/[^\d.,-]/g, '');

      // Common Indonesian format: 17.198.370,00
      if (s.includes('.') && s.includes(',')) {
        s = s.split(',')[0].replace(/\./g, '');
      } else if (s.includes(',') && !s.includes('.')) {
        // Could be 17198370,00 or 17,198,370
        const parts = s.split(',');
        s = parts.length > 2 ? parts.join('') : parts[0];
      } else {
        s = s.replace(/\./g, '');
      }

      const n = parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    };

    const findAmountByLabel = (sourceText, labelRegex) => {
      // Label and amount usually appear close in same visual row; allow line breaks in OCR output.
      const re = new RegExp(`${labelRegex}(?:[\\s\\S]{0,90}?)(?:Rp|IDR)?\\s*([\\dIlOo][\\dIlOo.,]{1,24})`, 'i');
      const match = sourceText.match(re);
      return match ? parseIDR(match[1]) : 0;
    };

    // Extract month and year
    const monthNames = {
      'januari': 1, 'februari': 2, 'maret': 3, 'april': 4,
      'mei': 5, 'juni': 6, 'juli': 7, 'agustus': 8,
      'september': 9, 'oktober': 10, 'november': 11, 'desember': 12
    };

    const normalizedText = (text || '')
      .replace(/\r/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/\t/g, ' ')
      .replace(/\u00A0/g, ' ');

    const lowerText = normalizedText.toLowerCase();

    // More flexible month/year matching
    const monthMatch = lowerText.match(/periode[:\s]*(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s*(\d{4})/) ||
                       lowerText.match(/(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s*(\d{4})/);
    if (monthMatch) {
      month = monthNames[monthMatch[1]];
      year = parseInt(monthMatch[2]);
      console.log('📅 Period:', monthMatch[1], year);
    }

    // ITB fixed-structure breakdown fields
    const incomeMainDefs = [
      { name: 'Gaji Pokok', re: 'gaji\\s*pokok' },
      { name: 'Tunjangan Istri/Suami', re: 'tunjangan\\s*istri\\s*\\/\\s*suami|tunjangan\\s*istri\\s*suami' },
      { name: 'Tunjangan Anak', re: 'tunjangan\\s*anak' },
      { name: 'Tunjangan Perbaikan Penghasilan', re: 'tunjangan\\s*perbaikan\\s*penghasilan' },
      { name: 'Tunjangan Struktural', re: 'tunjangan\\s*struktural' },
      { name: 'Tunjangan Fungsional', re: 'tunjangan\\s*fungsional' },
      { name: 'Pembulatan', re: 'pembulatan' },
      { name: 'Tunjangan Beras', re: 'tunjangan\\s*beras' },
      { name: 'Tunjangan Pajak Penghasilan Gaji', re: 'tunjangan\\s*pajak\\s*penghasilan\\s*gaji' },
      { name: 'Tunjangan BPJS Kesehatan', re: 'tunjangan\\s*bpjs\\s*kesehatan' },
      { name: 'Tunjangan BPJS Ketenagakerjaan', re: 'tunjangan\\s*bpjs\\s*ketenagakerjaan' },
      { name: 'Tabungan Hari Tua', re: 'tabungan\\s*hari\\s*tua' },
    ];

    const incomeAdditionalDefs = [
      { name: 'Tunjangan Jabatan', re: 'tunjangan\\s*jabatan' },
      { name: 'Tunjangan Kehormatan', re: 'tunjangan\\s*kehormatan' },
      { name: 'Tunjangan Profesi', re: 'tunjangan\\s*profesi' },
      { name: 'Tunjangan Kehadiran', re: 'tunjangan\\s*kehadiran' },
      { name: 'Tunjangan Makan', re: 'tunjangan\\s*makan' },
      { name: 'Insentif Kinerja', re: 'insentif\\s*kinerja' },
      { name: 'THR / Gaji Ke-13 Bonus', re: 'thr\\s*\\/\\s*gaji\\s*ke-?13\\s*bonus|gaji\\s*ke-?13\\s*bonus' },
      { name: 'Tunjangan Penyesuaian', re: 'tunjangan\\s*penyesuaian' },
      { name: 'Honorarium Beban Lebih (Dosen)', re: 'honorarium\\s*beban\\s*lebih' },
      { name: 'Honorarium Kegiatan Penelitian/Pengabdian', re: 'honorarium\\s*kegiatan\\s*penelitian|pengabdian\\s*pada\\s*masyarakat' },
      { name: 'Honorarium Kegiatan Internal', re: 'honorarium\\s*kegiatan\\s*internal' },
      { name: 'Honorarium Kegiatan Kerjasama', re: 'honorarium\\s*kegiatan\\s*kerjasama|kerja\\s*sama' },
    ];

    const deductionDefs = [
      { name: 'DPLK', re: '\\bdplk\\b' },
      { name: 'Perumahan (BTN)', re: 'perumahan\\s*\\(\\s*btn\\s*\\)|perumahan\\s*btn' },
      { name: 'BPJS Kesehatan', re: '(?<!tunjangan\\s*)bpjs\\s*kesehatan' },
      { name: 'BPJS Ketenagakerjaan', re: '(?<!tunjangan\\s*)bpjs\\s*ketenagakerjaan' },
      { name: 'Lain lain', re: 'lain\\s*lain' },
      { name: 'Pajak Penghasilan', re: 'pajak\\s*penghasilan' },
    ];

    const incomeMain = incomeMainDefs.map(d => ({ name: d.name, amount: findAmountByLabel(normalizedText, d.re) }));
    const incomeAdditional = incomeAdditionalDefs.map(d => ({ name: d.name, amount: findAmountByLabel(normalizedText, d.re) }));
    const deductions = deductionDefs.map(d => ({ name: d.name, amount: findAmountByLabel(normalizedText, d.re) }));

    const jumlahGajiKotor = findAmountByLabel(normalizedText, 'jumlah\\s*gaji\\s*kotor');
    const totalPenghasilanKotor = findAmountByLabel(normalizedText, 'total\\s*penghasilan\\s*kotor');
    const jumlahPotongan = findAmountByLabel(normalizedText, 'jumlah\\s*potongan');
    const totalPenghasilanBersih = findAmountByLabel(normalizedText, 'total\\s*penghasilan\\s*bersih');

    const calcIncomeMain = incomeMain.reduce((s, x) => s + x.amount, 0);
    const calcIncomeAdditional = incomeAdditional.reduce((s, x) => s + x.amount, 0);
    const calcGross = calcIncomeMain + calcIncomeAdditional;
    const calcDeduction = deductions.reduce((s, x) => s + x.amount, 0);
    const calcNet = calcGross - calcDeduction;

    const grossAmount = totalPenghasilanKotor || jumlahGajiKotor || calcGross;
    const deductionAmount = jumlahPotongan || calcDeduction;
    const netAmount = totalPenghasilanBersih || (grossAmount - deductionAmount) || calcNet;
    totalAmount = netAmount || grossAmount || calcGross;

    // Backward-compatible summary items (non-zero income components)
    items = [...incomeMain, ...incomeAdditional].filter(x => x.amount > 0);

    // Fallback when OCR order is very noisy and structured extraction failed
    if (items.length === 0 && totalAmount === 0) {
      const lines = normalizedText.split('\n').map(l => l.trim()).filter(Boolean);
      const fallbackItems = [];
      for (const line of lines) {
        const m = line.match(/(.+?)\s+(?:Rp|IDR)?\s*([\dIlOo][\dIlOo.,]{1,24})\s*$/i);
        if (!m) continue;
        const label = normalizeLabel(m[1]);
        const amount = parseIDR(m[2]);
        if (!amount) continue;
        if (/total|jumlah|potongan|bersih/.test(label)) continue;
        if (/gaji|tunjangan|honor|insentif|bonus|lembur|pembulatan|beras/.test(label)) {
          fallbackItems.push({
            name: m[1].replace(/\s+/g, ' ').trim(),
            amount,
          });
        }
      }
      if (fallbackItems.length) {
        items = fallbackItems;
        totalAmount = fallbackItems.reduce((s, x) => s + x.amount, 0);
      }
    }

    const breakdown = {
      incomeMain,
      incomeAdditional,
      deductions,
      totals: {
        jumlahGajiKotor: jumlahGajiKotor || calcIncomeMain,
        totalPenghasilanKotor: grossAmount,
        jumlahPotongan: deductionAmount,
        totalPenghasilanBersih: netAmount,
      },
    };

    console.log('📋 Summary:', {
      month,
      year,
      itemCount: items.length,
      grossAmount,
      deductionAmount,
      netAmount,
      totalAmount,
    });

    return { month, year, items, totalAmount, grossAmount, deductionAmount, netAmount, breakdown };
  };

  const deleteSalarySlip = async (id) => {
    if (confirm('Hapus arsip slip gaji ini?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'salarySlips', id));
      } catch (error) {
        console.error('Error deleting slip:', error);
        alert('Gagal menghapus arsip');
      }
    }
  };

  // Salary slip trend data
  const salaryTrendData = useMemo(() => {
    const data = salarySlips
      .slice(0, 12) // Last 12 months
      .reverse()
      .map(slip => ({
        month: `${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'][slip.month - 1]} ${slip.year}`,
        amount: slip.totalAmount || 0,
        change: 0
      }));
    
    // Calculate month-to-month changes
    return data.map((item, idx) => {
      if (idx > 0) {
        const prev = data[idx - 1].amount;
        if (prev > 0) {
          return { ...item, change: ((item.amount - prev) / prev) * 100 };
        }
      }
      return item;
    });
  }, [salarySlips]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <ScanLine size={28} className="text-purple-600" />
            Arsip Slip Gaji
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Upload & tracking slip gaji dengan AI parsing
          </p>
        </div>
        <label className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex gap-2 cursor-pointer transition-colors">
          {isUploadingPDF ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              <span>Menganalisis...</span>
            </>
          ) : (
            <>
              <Plus size={18} />
              <span>Upload PDF</span>
            </>
          )}
          <input
            type="file"
            accept="application/pdf"
            onChange={handlePDFUpload}
            disabled={isUploadingPDF}
            className="hidden"
          />
        </label>
      </div>

      {/* Salary Trend Chart */}
      {salaryTrendData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Trend Pendapatan Bulanan
          </h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={salaryTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                stroke="#6b7280"
                tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`}
              />
              <ReTooltip 
                formatter={(v) => fmt(v)}
                contentStyle={{ 
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="amount" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ fill: '#8b5cf6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Salary Slips Table */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">
          Riwayat Slip Gaji
        </h3>
        {salarySlips.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <ScanLine size={48} className="mx-auto mb-3 opacity-50" />
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
                  const change = prevSlip 
                    ? ((slip.totalAmount - prevSlip.totalAmount) / prevSlip.totalAmount) * 100
                    : 0;
                  const isIncrease = change > 0;
                  const isDecrease = change < 0;

                  return (
                    <tr
                      key={slip.id}
                      onClick={() => setSelectedSlip(slip)}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/10 cursor-pointer transition-colors"
                    >
                      <td className="p-3">
                        <div className="font-semibold text-gray-800 dark:text-gray-100">
                          {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][slip.month - 1]} {slip.year}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="font-bold text-purple-600 dark:text-purple-400">
                          {fmt(slip.totalAmount)}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        {idx > 0 && change !== 0 ? (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                            isIncrease 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {isIncrease ? '📈' : '📉'} {change > 0 ? '+' : ''}{change.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                          {slip.fileName}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteSalarySlip(slip.id);
                          }}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg inline-flex"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
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

      {/* Detail Modal */}
      {selectedSlip && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedSlip(null)}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-indigo-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">
                    Detail Slip Gaji
                  </h3>
                  <p className="text-purple-100">
                    {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][selectedSlip.month - 1]} {selectedSlip.year}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSlip(null)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X size={24} className="text-white" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Total Amount */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Penghasilan Bersih</p>
                <p className="text-4xl font-bold text-purple-600 dark:text-purple-400">
                  {fmt(selectedSlip.netAmount || selectedSlip.totalAmount)}
                </p>
              </div>

              {selectedSlip.breakdown?.totals && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                    <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">Total Penghasilan Kotor</p>
                    <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{fmt(selectedSlip.breakdown.totals.totalPenghasilanKotor || selectedSlip.grossAmount || 0)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <p className="text-xs text-red-700 dark:text-red-300 mb-1">Jumlah Potongan</p>
                    <p className="text-lg font-bold text-red-700 dark:text-red-300">{fmt(selectedSlip.breakdown.totals.jumlahPotongan || selectedSlip.deductionAmount || 0)}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <p className="text-xs text-purple-700 dark:text-purple-300 mb-1">Take Home Pay</p>
                    <p className="text-lg font-bold text-purple-700 dark:text-purple-300">{fmt(selectedSlip.breakdown.totals.totalPenghasilanBersih || selectedSlip.netAmount || selectedSlip.totalAmount || 0)}</p>
                  </div>
                </div>
              )}

              {/* ITB Breakdown */}
              {selectedSlip.breakdown ? (
                <div className="space-y-5">
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <Coins size={20} className="text-emerald-600" />
                      A. Penghasilan (Gaji & Tunjangan Melekat)
                    </h4>
                    <div className="space-y-2">
                      {selectedSlip.breakdown.incomeMain?.map((item, i) => (
                        <div key={`m-${i}`} className="flex justify-between items-center p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-800/40">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{fmt(item.amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <Coins size={20} className="text-blue-600" />
                      Insentif / Tunjangan / Honorarium Lainnya
                    </h4>
                    <div className="space-y-2">
                      {selectedSlip.breakdown.incomeAdditional?.map((item, i) => (
                        <div key={`a-${i}`} className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800/40">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">{fmt(item.amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
                      <Minus size={20} className="text-red-600" />
                      B. Potongan
                    </h4>
                    <div className="space-y-2">
                      {selectedSlip.breakdown.deductions?.map((item, i) => (
                        <div key={`d-${i}`} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-800/40">
                          <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                          <span className="text-sm font-bold text-red-700 dark:text-red-300">{fmt(item.amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                selectedSlip.items && selectedSlip.items.length > 0 && (
                  <div>
                    <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
                      <Coins size={20} className="text-purple-600" />
                      Rincian Pendapatan
                    </h4>
                    <div className="space-y-2">
                      {selectedSlip.items.map((item, i) => (
                        <div 
                          key={i}
                          className="flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        >
                          <span className="font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400">{fmt(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* File Info */}
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <ScanLine size={16} />
                  <span className="font-medium">File:</span>
                  <span className="truncate">{selectedSlip.fileName}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500 mt-2">
                  <CheckCircle size={14} />
                  <span>Parsed only (file tidak disimpan untuk privacy)</span>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedSlip(null)}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg font-medium transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tips Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
        <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
          <AlertTriangle size={18} />
          Tips Arsip Slip Gaji
        </h4>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <p>📄 <strong>Upload Rutin:</strong> Upload slip gaji setiap bulan untuk tracking yang akurat</p>
          <p>🔒 <strong>Privacy:</strong> File PDF tidak disimpan, hanya hasil parsing yang tersimpan</p>
          <p>📈 <strong>Monitoring:</strong> Pantau perubahan pendapatan bulan ke bulan</p>
          <p>🤖 <strong>Smart Parsing:</strong> Sistem otomatis ekstrak detail slip gaji langsung dari teks PDF</p>
          <p>💡 <strong>Tips:</strong> Pastikan slip gaji terbaca jelas untuk hasil parsing optimal</p>
        </div>
      </div>
    </div>
  );
};

// --- 7. INCOME DIVERSIFICATION DASHBOARD ---
const IncomeDiversificationView = ({ userId, appId, fmt, transactions }) => {
  const [incomeSources, setIncomeSources] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [passiveIncomeGoal, setPassiveIncomeGoal] = useState(30); // Default 30%
  const [formData, setFormData] = useState({
    id: null,
    name: '',
    type: 'active', // active or passive
    category: '',
    monthlyAmount: 0,
    isRecurring: true,
    description: ''
  });

  // Income categories
  const incomeCategories = {
    active: [
      { value: 'salary-base', label: 'Gaji Pokok Dosen', icon: '💼' },
      { value: 'salary-certification', label: 'Tunjangan Sertifikasi', icon: '🎓' },
      { value: 'teaching-extra', label: 'Honor Mengajar Tambahan', icon: '👨‍🏫' },
      { value: 'research', label: 'Honorarium Penelitian', icon: '🔬' },
      { value: 'community-service', label: 'Honorarium Pengabdian', icon: '🤝' },
      { value: 'consultation', label: 'Konsultasi/Workshop', icon: '💡' },
      { value: 'freelance', label: 'Freelance/Proyek', icon: '💻' },
      { value: 'other-active', label: 'Lainnya (Aktif)', icon: '⚡' }
    ],
    passive: [
      { value: 'book-royalty', label: 'Royalti Buku', icon: '📚' },
      { value: 'investment-dividend', label: 'Dividen Investasi', icon: '📈' },
      { value: 'rental-income', label: 'Pendapatan Sewa', icon: '🏠' },
      { value: 'online-course', label: 'Kursus Online', icon: '🎥' },
      { value: 'affiliate', label: 'Affiliate/Komisi', icon: '🔗' },
      { value: 'patent-license', label: 'Lisensi/Paten', icon: '⚖️' },
      { value: 'other-passive', label: 'Lainnya (Pasif)', icon: '💤' }
    ]
  };

  // Load income sources from Firestore
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'artifacts', appId, 'users', userId, 'incomeSources')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setIncomeSources(data);
      }
    );

    return () => unsubscribe();
  }, [userId, appId]);

  // Load passive income goal
  useEffect(() => {
    if (!userId) return;

    const loadGoal = async () => {
      try {
        const goalDoc = await getDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'incomeGoal'));
        if (goalDoc.exists() && goalDoc.data().passiveIncomeGoal) {
          setPassiveIncomeGoal(goalDoc.data().passiveIncomeGoal);
        }
      } catch (error) {
        console.error('Error loading goal:', error);
      }
    };

    loadGoal();
  }, [userId, appId]);

  // Calculate statistics
  const stats = useMemo(() => {
    const activeIncome = incomeSources
      .filter(s => s.type === 'active')
      .reduce((sum, s) => sum + (s.monthlyAmount || 0), 0);
    
    const passiveIncome = incomeSources
      .filter(s => s.type === 'passive')
      .reduce((sum, s) => sum + (s.monthlyAmount || 0), 0);
    
    const totalIncome = activeIncome + passiveIncome;
    const passivePercentage = totalIncome > 0 ? (passiveIncome / totalIncome) * 100 : 0;
    const activePercentage = totalIncome > 0 ? (activeIncome / totalIncome) * 100 : 0;

    // Income from transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentIncome = transactions
      .filter(t => t.type === 'income' && t.date >= thirtyDaysAgo)
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      activeIncome,
      passiveIncome,
      totalIncome,
      passivePercentage,
      activePercentage,
      recentIncome,
      goalDiff: passivePercentage - passiveIncomeGoal,
      sourcesCount: incomeSources.length
    };
  }, [incomeSources, transactions, passiveIncomeGoal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category) {
      alert('Nama dan kategori harus diisi');
      return;
    }

    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        category: formData.category,
        monthlyAmount: Number(formData.monthlyAmount) || 0,
        isRecurring: formData.isRecurring,
        description: formData.description || '',
        updatedAt: serverTimestamp()
      };

      if (formData.id) {
        await updateDoc(doc(db, 'artifacts', appId, 'users', userId, 'incomeSources', formData.id), payload);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'users', userId, 'incomeSources'), {
          ...payload,
          createdAt: serverTimestamp()
        });
      }

      setIsFormOpen(false);
      setFormData({ id: null, name: '', type: 'active', category: '', monthlyAmount: 0, isRecurring: true, description: '' });
    } catch (error) {
      console.error('Error saving income source:', error);
      alert('Gagal menyimpan data');
    }
  };

  const handleEdit = (source) => {
    setFormData({
      id: source.id,
      name: source.name,
      type: source.type,
      category: source.category,
      monthlyAmount: source.monthlyAmount,
      isRecurring: source.isRecurring,
      description: source.description || ''
    });
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Hapus sumber pendapatan ini?')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'users', userId, 'incomeSources', id));
      } catch (error) {
        console.error('Error deleting income source:', error);
        alert('Gagal menghapus data');
      }
    }
  };

  const savePassiveIncomeGoal = async (goal) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', userId, 'settings', 'incomeGoal'), {
        passiveIncomeGoal: Number(goal),
        updatedAt: serverTimestamp()
      });
      setPassiveIncomeGoal(Number(goal));
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('Gagal menyimpan target');
    }
  };

  // Chart data
  const chartData = [
    { name: 'Active Income', value: stats.activeIncome, color: '#3b82f6' },
    { name: 'Passive Income', value: stats.passiveIncome, color: '#10b981' }
  ].filter(d => d.value > 0);

  const categoryIcon = (category) => {
    const allCategories = [...incomeCategories.active, ...incomeCategories.passive];
    return allCategories.find(c => c.value === category)?.icon || '💰';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <BarChart3 size={28} className="text-emerald-600" />
            Diversifikasi Pendapatan
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Kelola dan pantau sumber pendapatan aktif & pasif
          </p>
        </div>
        <button
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            setFormData({ id: null, name: '', type: 'active', category: '', monthlyAmount: 0, isRecurring: true, description: '' });
          }}
          className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex gap-2 hover:bg-emerald-700 transition-colors"
        >
          {isFormOpen ? <X size={18} /> : <Plus size={18} />}
          <span>{isFormOpen ? 'Batal' : 'Tambah Sumber'}</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <Briefcase size={24} />
            <span className="text-sm opacity-80">Active</span>
          </div>
          <p className="text-2xl font-bold">{fmt(stats.activeIncome)}</p>
          <p className="text-xs opacity-80 mt-1">{stats.activePercentage.toFixed(1)}% dari total</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp size={24} />
            <span className="text-sm opacity-80">Passive</span>
          </div>
          <p className="text-2xl font-bold">{fmt(stats.passiveIncome)}</p>
          <p className="text-xs opacity-80 mt-1">{stats.passivePercentage.toFixed(1)}% dari total</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-xl shadow-lg text-white">
          <div className="flex items-center justify-between mb-2">
            <Wallet size={24} />
            <span className="text-sm opacity-80">Total</span>
          </div>
          <p className="text-2xl font-bold">{fmt(stats.totalIncome)}</p>
          <p className="text-xs opacity-80 mt-1">{stats.sourcesCount} sumber</p>
        </div>

        <div className={`bg-gradient-to-br ${stats.goalDiff >= 0 ? 'from-emerald-500 to-emerald-600' : 'from-amber-500 to-amber-600'} p-6 rounded-xl shadow-lg text-white`}>
          <div className="flex items-center justify-between mb-2">
            <Target size={24} />
            <span className="text-sm opacity-80">Target</span>
          </div>
          <p className="text-2xl font-bold">{passiveIncomeGoal}%</p>
          <p className="text-xs opacity-80 mt-1">
            {stats.goalDiff >= 0 ? '✅ Target tercapai!' : `🎯 Kurang ${Math.abs(stats.goalDiff).toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Form Input */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md border border-emerald-100 dark:border-gray-700"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Nama Sumber Pendapatan
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"
                placeholder="Contoh: Gaji Universitas"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Tipe Pendapatan
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value, category: '' })}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="active">💼 Active Income (Bekerja Aktif)</option>
                <option value="passive">💤 Passive Income (Otomatis)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Kategori
              </label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"
              >
                <option value="">Pilih Kategori...</option>
                {incomeCategories[formData.type].map(cat => (
                  <option key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Jumlah per Bulan (Rp)
              </label>
              <input
                type="number"
                min="0"
                required
                value={formData.monthlyAmount}
                onChange={(e) => setFormData({ ...formData, monthlyAmount: e.target.value })}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"
                placeholder="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Deskripsi/Catatan
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-gray-700 dark:text-white"
                placeholder="Opsional: Detail tambahan..."
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <input
                type="checkbox"
                id="isRecurring"
                checked={formData.isRecurring}
                onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="isRecurring" className="text-sm text-gray-700 dark:text-gray-300">
                Pendapatan Rutin (Setiap Bulan)
              </label>
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg font-medium flex items-center gap-2"
            >
              <Save size={18} />
              {formData.id ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      )}

      {/* Passive Income Goal Setting */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-6 rounded-xl border border-amber-200 dark:border-amber-800">
        <h3 className="font-bold text-amber-900 dark:text-amber-300 mb-4 flex items-center gap-2">
          <Target size={20} />
          Target Passive Income
        </h3>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="100"
            value={passiveIncomeGoal}
            onChange={(e) => savePassiveIncomeGoal(e.target.value)}
            className="flex-1"
          />
          <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 min-w-[80px]">
            {passiveIncomeGoal}%
          </div>
        </div>
        <p className="text-sm text-amber-700 dark:text-amber-400 mt-3">
          Target: {fmt(stats.totalIncome * passiveIncomeGoal / 100)} dari passive income
        </p>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4">
            Proporsi Active vs Passive Income
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <RePieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => `${entry.name}: ${((entry.value / stats.totalIncome) * 100).toFixed(1)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ReTooltip formatter={(v) => fmt(v)} />
            </RePieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Income Sources List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Income */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Briefcase size={20} className="text-blue-600" />
            Active Income
          </h3>
          <div className="space-y-3">
            {incomeSources.filter(s => s.type === 'active').length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
                Belum ada sumber active income
              </p>
            ) : (
              incomeSources
                .filter(s => s.type === 'active')
                .map(source => (
                  <div
                    key={source.id}
                    className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-800"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                          <span>{categoryIcon(source.category)}</span>
                          {source.name}
                        </p>
                        {source.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {source.description}
                          </p>
                        )}
                        <p className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-2">
                          {fmt(source.monthlyAmount)}<span className="text-xs font-normal">/bulan</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(source)}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(source.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>

        {/* Passive Income */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-4 flex items-center gap-2">
            <TrendingUp size={20} className="text-green-600" />
            Passive Income
          </h3>
          <div className="space-y-3">
            {incomeSources.filter(s => s.type === 'passive').length === 0 ? (
              <p className="text-gray-400 dark:text-gray-500 text-sm text-center py-8">
                Belum ada sumber passive income
              </p>
            ) : (
              incomeSources
                .filter(s => s.type === 'passive')
                .map(source => (
                  <div
                    key={source.id}
                    className="p-4 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-100 dark:border-green-800"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                          <span>{categoryIcon(source.category)}</span>
                          {source.name}
                        </p>
                        {source.description && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {source.description}
                          </p>
                        )}
                        <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-2">
                          {fmt(source.monthlyAmount)}<span className="text-xs font-normal">/bulan</span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(source)}
                          className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/20 rounded-lg"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(source.id)}
                          className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>

      {/* Tips Panel */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
        <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
          <AlertTriangle size={18} />
          Tips Diversifikasi Pendapatan
        </h4>
        <div className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
          <p>💼 <strong>Active Income:</strong> Pendapatan dari pekerjaan aktif (gaji, honor, konsultasi)</p>
          <p>💤 <strong>Passive Income:</strong> Pendapatan yang berjalan otomatis (royalti, dividen, sewa)</p>
          <p>🎯 <strong>Target Ideal:</strong> 30-50% dari passive income untuk financial freedom</p>
          <p>📈 <strong>Strategi:</strong> Mulai dari passive income kecil (buku, kursus online) lalu kembangkan</p>
          <p>🔄 <strong>Diversifikasi:</strong> Jangan bergantung pada satu sumber pendapatan saja</p>
        </div>
      </div>
    </div>
  );
};

// --- 8. MAIN APP (Defined Last) ---
export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  
  // Pull to Refresh States
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const mainRef = useRef(null);
  
  // Data States
  const [transactions, setTransactions] = useState([]);
  const [investments, setInvestments] = useState([]);
  const [categories, setCategories] = useState({ expense: [], income: [], raw: [] });
  const [investTypes, setInvestTypes] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  
  // Refs to track initialization
  const walletsInitialized = useRef(false);
  const investTypesInitialized = useRef(false);
  const categoriesInitialized = useRef(false);

  // Version check on mount
  useEffect(() => {
    console.log(`🚀 Dompet Keluarga v${APP_VERSION} - Parser Loaded`);
    console.log(`📱 Device: ${/mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop'}`);
    console.log(`🔄 Timestamp: ${new Date().toISOString()}`);
  }, []);

  // Pull to Refresh Handlers
  const handleTouchStart = (e) => {
    if (!mainRef.current || window.scrollY > 0) return;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    if (!mainRef.current || window.scrollY > 0 || isRefreshing) return;
    
    const touchY = e.touches[0].clientY;
    const distance = touchY - touchStartY.current;
    
    if (distance > 0 && distance < 150) {
      setIsPulling(true);
      setPullDistance(distance);
    }
  };

  const handleTouchEnd = async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance > 80) {
      setIsRefreshing(true);
      console.log('🔄 Force refresh triggered...');
      
      // Wait a bit for animation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Force reload with cache bypass
      window.location.reload(true);
    } else {
      setPullDistance(0);
    }
  };

  // Attach pull to refresh on mobile
  useEffect(() => {
    const main = mainRef.current;
    if (!main || !/mobile|android|iphone|ipad/i.test(navigator.userAgent)) return;
    
    main.addEventListener('touchstart', handleTouchStart, { passive: true });
    main.addEventListener('touchmove', handleTouchMove, { passive: true });
    main.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    return () => {
      main.removeEventListener('touchstart', handleTouchStart);
      main.removeEventListener('touchmove', handleTouchMove);
      main.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isPulling, pullDistance, isRefreshing]);

  // Auth Handlers
  const handleLogin = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { alert(e.message); } };
  const handleLogout = async () => await signOut(auth);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
    return () => unsub();
  }, []);

  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Data Sync
  useEffect(() => {
    if (!user) {
      // Reset flags when user logs out
      walletsInitialized.current = false;
      investTypesInitialized.current = false;
      categoriesInitialized.current = false;
      return;
    }
    
    const uid = user.uid;
    
    // Reset flags for new user
    walletsInitialized.current = false;
    investTypesInitialized.current = false;
    categoriesInitialized.current = false;

    const unsubTrans = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'transactions'), orderBy('date', 'desc')), 
      (s) => setTransactions(s.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        date: parseDate(d.data().date) // Use helper function here
      }))));

    const unsubInv = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'investments')), 
      (s) => setInvestments(s.docs.map(d => ({ 
        id: d.id, 
        ...d.data(),
        createdAt: d.data().createdAt?.toDate() 
      }))));

    const unsubCats = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'categories')), async (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (data.length === 0 && !categoriesInitialized.current) {
        categoriesInitialized.current = true;
        try {
          const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'categories');
          const defaultCategories = [
            ...DEFAULT_EXPENSE_CATEGORIES.map(n => ({name: n, type: 'expense', budget: 0})),
            ...DEFAULT_INCOME_CATEGORIES.map(n => ({name: n, type: 'income', budget: 0}))
          ];
          // Use Promise.all to ensure all docs are added before next snapshot
          await Promise.all(defaultCategories.map(c => addDoc(batchRef, c)));
          console.log('✅ Categories initialized');
        } catch (error) {
          console.error('❌ Error initializing categories:', error);
          categoriesInitialized.current = false; // Reset on error
        }
      } else if (data.length > 0) {
        // Additional safeguard: Check for duplicates by name+type combination
        const uniqueCategories = [];
        const seenKeys = new Set();
        
        for (const cat of data) {
          const key = `${cat.name}-${cat.type}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueCategories.push(cat);
          } else {
            console.warn('⚠️ Duplicate category detected:', cat.name, cat.type, cat.id);
          }
        }
        
        setCategories({
          expense: uniqueCategories.filter(c => c.type === 'expense').map(c => c.name).sort(),
          income: uniqueCategories.filter(c => c.type === 'income').map(c => c.name).sort(),
          raw: uniqueCategories
        });
      }
    });

    const unsubInvTypes = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'investment_types')), async (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (data.length === 0 && !investTypesInitialized.current) {
        investTypesInitialized.current = true;
        try {
          const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'investment_types');
          // Use Promise.all to ensure all docs are added atomically
          await Promise.all(DEFAULT_INVESTMENT_TYPES.map(t => addDoc(batchRef, t)));
          console.log('✅ Investment types initialized');
        } catch (error) {
          console.error('❌ Error initializing investment types:', error);
          investTypesInitialized.current = false; // Reset on error
        }
      } else if (data.length > 0) {
        // Additional safeguard: Check for duplicates by name
        const uniqueTypes = [];
        const seenNames = new Set();
        
        for (const type of data) {
          if (!seenNames.has(type.name)) {
            seenNames.add(type.name);
            uniqueTypes.push(type);
          } else {
            console.warn('⚠️ Duplicate investment type detected:', type.name, type.id);
          }
        }
        
        setInvestTypes(uniqueTypes);
      }
    });

    const unsubWallets = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'wallets')), async (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      
      if (data.length === 0 && !walletsInitialized.current) {
        walletsInitialized.current = true;
        try {
          const batchRef = collection(db, 'artifacts', appId, 'users', uid, 'wallets');
          // Use Promise.all to ensure all docs are added atomically
          await Promise.all(DEFAULT_WALLETS.map(w => addDoc(batchRef, w)));
          console.log('✅ Wallets initialized');
        } catch (error) {
          console.error('❌ Error initializing wallets:', error);
          walletsInitialized.current = false; // Reset on error
        }
      } else if (data.length > 0) {
        // Additional safeguard: Check for duplicates by name
        const uniqueWallets = [];
        const seenNames = new Set();
        
        for (const wallet of data) {
          if (!seenNames.has(wallet.name)) {
            seenNames.add(wallet.name);
            uniqueWallets.push(wallet);
          } else {
            // Log duplicate found (for debugging)
            console.warn('⚠️ Duplicate wallet detected:', wallet.name, wallet.id);
          }
        }
        
        setWallets(uniqueWallets);
      }
    });

    const unsubSubs = onSnapshot(query(collection(db, 'artifacts', appId, 'users', uid, 'subscriptions')), (s) => {
      const data = s.docs.map(d => ({ id: d.id, ...d.data() }));
      setSubscriptions(data);
    });

    return () => { 
      unsubTrans(); 
      unsubInv(); 
      unsubCats(); 
      unsubInvTypes(); 
      unsubWallets(); 
      unsubSubs(); 
    };
  }, [user]);

  // --- AUTOMATION: Generate Subscription Transactions ---
  useEffect(() => {
    if (!user || loading || subscriptions.length === 0 || wallets.length === 0) return;

    const processAutoTransactions = async () => {
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

      for (const sub of subscriptions) {
        if (!sub.paymentDay || !sub.walletId || !sub.cost || sub.cycle !== 'monthly') continue;

        const targetDay = Math.min(sub.paymentDay, getDaysInMonth(currentYear, currentMonth));
        const targetDate = new Date(currentYear, currentMonth, targetDay);

        // Check if subscription has started
        const startDate = sub.startDate ? sub.startDate.toDate() : null;
        if (startDate && startDate > targetDate) continue;

        if (today >= targetDate) {
          const alreadyExists = transactions.some(t => 
            t.subscriptionId === sub.id && 
            t.date && 
            t.date.getMonth() === currentMonth && 
            t.date.getFullYear() === currentYear
          );

          if (!alreadyExists) {
            console.log("Generating auto transaction for:", sub.name);
            try {
              await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'transactions'), {
                type: 'expense',
                amount: sub.cost,
                category: 'Langganan', 
                walletId: sub.walletId,
                subscriptionId: sub.id, 
                note: `Tagihan Otomatis: ${sub.name}`,
                date: targetDate,
                createdAt: serverTimestamp()
              });
            } catch (err) {
              console.error("Auto-gen failed", err);
            }
          }
        }
      }
    };

    processAutoTransactions();
  }, [user, loading, subscriptions, wallets, transactions.length]);


  // Calculations
  const summary = useMemo(() => {
    const inc = transactions.filter(t => t.type === 'income').reduce((a, c) => a + (Number(c.amount)||0), 0);
    const exp = transactions.filter(t => t.type === 'expense').reduce((a, c) => a + (Number(c.amount)||0), 0);
    const inv = investments.reduce((a, c) => a + (Number(c.currentValue)||0), 0);
    
    const walletBalances = wallets.map(w => {
      let currentBalance = Number(w.initialBalance) || 0;
      
      currentBalance += transactions.filter(t => t.type === 'income' && t.walletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      currentBalance -= transactions.filter(t => t.type === 'expense' && t.walletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      currentBalance -= transactions.filter(t => t.type === 'transfer' && t.sourceWalletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      currentBalance += transactions.filter(t => t.type === 'transfer' && t.targetWalletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);
      currentBalance -= transactions.filter(t => t.type === 'investment' && t.walletId === w.id).reduce((a, c) => a + (Number(c.amount)||0), 0);

      return { ...w, currentBalance };
    });

    const liquidAssets = walletBalances.filter(w => w.type !== 'credit_card').reduce((a, w) => a + w.currentBalance, 0);
    const creditCardDebt = walletBalances.filter(w => w.type === 'credit_card').reduce((a, w) => a + w.currentBalance, 0);
    const netWorth = liquidAssets + inv + creditCardDebt;

    return { income: inc, expense: exp, balance: liquidAssets, ccDebt: creditCardDebt, investment: inv, netWorth: netWorth, walletBalances };
  }, [transactions, investments, wallets]);

  const fmt = (val) => privacyMode ? 'Rp ••••••' : formatCurrency(val);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-emerald-600 font-bold animate-pulse dark:bg-gray-900 dark:text-emerald-400">Memuat Dompet Keluarga...</div>;
  if (!user) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans text-gray-800 dark:text-gray-100 flex flex-col md:flex-row transition-colors duration-300">
      {/* Pull to Refresh Indicator */}
      {isPulling && (
        <div 
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center bg-emerald-500 text-white transition-all duration-200 ease-out"
          style={{ 
            height: `${Math.min(pullDistance, 80)}px`,
            opacity: pullDistance / 80 
          }}
        >
          <div className="flex items-center gap-2">
            <RefreshCw 
              size={20} 
              className={pullDistance > 80 ? 'animate-spin' : ''} 
            />
            <span className="text-sm font-medium">
              {pullDistance > 80 ? 'Release to refresh...' : 'Pull to refresh...'}
            </span>
          </div>
        </div>
      )}

      {/* Loading Overlay during Refresh */}
      {isRefreshing && (
        <div className="fixed inset-0 z-[100] bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={32} className="text-emerald-600 animate-spin" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Refreshing app...</p>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-gray-800 border-r dark:border-gray-700 h-screen sticky top-0 transition-colors duration-300">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8 text-emerald-700 dark:text-emerald-400">
            <Wallet className="w-8 h-8" />
            <h1 className="font-bold text-xl">Dompet Keluarga</h1>
          </div>
          <nav className="space-y-2">
            <NavBtn id="dashboard" active={activeTab} set={setActiveTab} icon={<PieChart size={20}/>} label="Dashboard" />
            <NavBtn id="transactions" active={activeTab} set={setActiveTab} icon={<ArrowUpRight size={20}/>} label="Transaksi" />
            <NavBtn id="subscriptions" active={activeTab} set={setActiveTab} icon={<Repeat size={20}/>} label="Langganan" />
            <NavBtn id="wallets" active={activeTab} set={setActiveTab} icon={<CreditCard size={20}/>} label="Rekening & CC" />
            <NavBtn id="investments" active={activeTab} set={setActiveTab} icon={<TrendingUp size={20}/>} label="Investasi & Goal" />
            <NavBtn id="education-fund" active={activeTab} set={setActiveTab} icon={<GraduationCap size={20}/>} label="Dana Pendidikan" />
            <NavBtn id="income-diversification" active={activeTab} set={setActiveTab} icon={<BarChart3 size={20}/>} label="Diversifikasi Pendapatan" />
            <NavBtn id="salary-slip-archive" active={activeTab} set={setActiveTab} icon={<ScanLine size={20}/>} label="Arsip Slip Gaji" />
            <NavBtn id="salary-allocator" active={activeTab} set={setActiveTab} icon={<DollarSign size={20}/>} label="Alokasi Gaji" />
            <NavBtn id="zakat" active={activeTab} set={setActiveTab} icon={<Heart size={20}/>} label="Kalkulator Zakat" />
            <NavBtn id="categories" active={activeTab} set={setActiveTab} icon={<Settings size={20}/>} label="Kategori" />
          </nav>
        </div>
        
        <div className="mt-auto p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="User" className="w-10 h-10 rounded-full border border-gray-200 dark:border-gray-600 shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0"><User size={20}/></div>
              )}
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-gray-800 dark:text-gray-200 truncate">{user.displayName || 'Pengguna'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setPrivacyMode(!privacyMode)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors" title={privacyMode ? "Tampilkan Saldo" : "Sembunyikan Saldo"}>
                {privacyMode ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button onClick={() => setDarkMode(!darkMode)} className="text-gray-400 hover:text-amber-500 transition-colors" title="Ganti Tema">
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg transition-colors">
            <LogOut size={16}/> Keluar
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 p-4 md:p-8 max-w-5xl mx-auto w-full pb-8 flex flex-col min-h-screen">
        <div className="md:hidden flex justify-between items-center mb-6">
           <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
             <Wallet className="w-6 h-6" />
             <h1 className="font-bold text-lg">Dompet Keluarga</h1>
           </div>
           <div className="flex items-center gap-4">
             <button onClick={() => setPrivacyMode(!privacyMode)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">
               {privacyMode ? <EyeOff size={20} /> : <Eye size={20} />}
             </button>
             <button onClick={() => setDarkMode(!darkMode)} className="text-gray-400 hover:text-amber-500">
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
             </button>
             <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400">
               <Menu size={24} />
             </button>
           </div>
        </div>

        {/* Mobile Hamburger Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="fixed right-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-800 shadow-2xl z-50 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="font-bold text-lg text-gray-800 dark:text-white">Menu</h2>
                  <button onClick={() => setIsMobileMenuOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                    <X size={24} />
                  </button>
                </div>
                
                {/* User Info */}
                <div className="flex items-center gap-3 mb-6 pb-6 border-b dark:border-gray-700">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="User" className="w-12 h-12 rounded-full border border-gray-200 dark:border-gray-600" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300"><User size={24}/></div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{user.displayName || 'Pengguna'}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                  </div>
                </div>

                {/* Navigation */}
                <nav className="space-y-2">
                  <NavBtn id="dashboard" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<PieChart size={20}/>} label="Dashboard" />
                  <NavBtn id="transactions" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<ArrowUpRight size={20}/>} label="Transaksi" />
                  <NavBtn id="subscriptions" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<Repeat size={20}/>} label="Langganan" />
                  <NavBtn id="wallets" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<CreditCard size={20}/>} label="Rekening & CC" />
                  <NavBtn id="investments" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<TrendingUp size={20}/>} label="Investasi & Goal" />
                  <NavBtn id="education-fund" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<GraduationCap size={20}/>} label="Dana Pendidikan" />
                  <NavBtn id="income-diversification" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<BarChart3 size={20}/>} label="Diversifikasi Pendapatan" />
                  <NavBtn id="salary-slip-archive" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<ScanLine size={20}/>} label="Arsip Slip Gaji" />
                  <NavBtn id="salary-allocator" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<DollarSign size={20}/>} label="Alokasi Gaji" />
                  <NavBtn id="zakat" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<Heart size={20}/>} label="Kalkulator Zakat" />
                  <NavBtn id="categories" active={activeTab} set={(id) => { setActiveTab(id); setIsMobileMenuOpen(false); }} icon={<Settings size={20}/>} label="Kategori" />
                </nav>

                {/* Logout */}
                <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 p-3 rounded-lg transition-colors mt-6">
                  <LogOut size={16}/> Keluar
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && <DashboardView summary={summary} transactions={transactions} investments={investments} categories={categories} investTypes={investTypes} setActiveTab={setActiveTab} fmt={fmt} privacyMode={privacyMode} darkMode={darkMode}/>}
        {activeTab === 'transactions' && <TransactionView transactions={transactions} categories={categories} wallets={wallets} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'subscriptions' && <SubscriptionView subscriptions={subscriptions} wallets={wallets} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'wallets' && <WalletView wallets={summary.walletBalances} transactions={transactions} userId={user.uid} appId={appId} fmt={fmt} privacyMode={privacyMode}/>}
        {activeTab === 'investments' && <InvestmentView investments={investments} investTypes={investTypes} wallets={wallets} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'education-fund' && <EducationFundView userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'income-diversification' && <IncomeDiversificationView userId={user.uid} appId={appId} fmt={fmt} transactions={transactions} />}
        {activeTab === 'salary-slip-archive' && <SalarySlipArchiveView userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'salary-allocator' && <SalaryAllocatorView categories={categories} wallets={summary.walletBalances} userId={user.uid} appId={appId} fmt={fmt} />}
        {activeTab === 'zakat' && <ZakatView summary={summary} investments={investments} fmt={fmt} />}
        {activeTab === 'categories' && <CategoryView categories={categories} userId={user.uid} appId={appId} fmt={fmt} />}

        {/* Transaction Modal */}
        <TransactionModal 
          isOpen={isTransactionModalOpen} 
          onClose={() => setIsTransactionModalOpen(false)} 
          categories={categories} 
          wallets={summary.walletBalances} 
          userId={user.uid} 
          appId={appId} 
          fmt={fmt}
        />

        {/* Quick Add Modal */}
        <QuickAddModal 
          isOpen={isQuickAddModalOpen} 
          onClose={() => setIsQuickAddModalOpen(false)} 
          categories={categories} 
          wallets={summary.walletBalances} 
          userId={user.uid} 
          appId={appId} 
          fmt={fmt}
        />

        {/* FOOTER */}
        <footer className="mt-auto pt-10 pb-4 text-center space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-600">
            <span>&copy; {new Date().getFullYear()} Dompet Keluarga dikembangkan oleh <span className="text-emerald-600 dark:text-emerald-500 font-medium">@fauzanalfi</span></span>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-600">
            <span className="flex items-center gap-1">
              <Bot size={12} />
              Parser v{APP_VERSION}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <RefreshCw size={12} />
              Pull to Refresh
            </span>
          </div>
        </footer>
      </main>

      {/* Floating Action Button (FAB) Group */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col gap-3 items-end">
        {/* Quick Add Button */}
        <button 
          onClick={() => setIsQuickAddModalOpen(true)} 
          className="group flex items-center gap-3 bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-gray-700 border-2 border-emerald-600 text-emerald-600 px-4 py-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 active:scale-95 touch-manipulation min-h-[48px] min-w-[48px]"
          title="Quick Add - AI Scanner"
          aria-label="Quick Add AI Scanner"
        >
          <span className="text-sm font-semibold hidden sm:group-hover:inline-block animate-in fade-in slide-in-from-right-2 duration-200">Quick Add</span>
          <ScanLine size={22} strokeWidth={2.5} />
        </button>
        
        {/* Manual Add Button */}
        <button 
          onClick={() => setIsTransactionModalOpen(true)} 
          className="w-14 h-14 sm:w-16 sm:h-16 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 active:scale-95 touch-manipulation"
          title="Tambah Transaksi Manual"
          aria-label="Tambah Transaksi Manual"
        >
          <Plus size={24} strokeWidth={2.5} className="sm:w-7 sm:h-7" />
        </button>
      </div>
    </div>
  );
}