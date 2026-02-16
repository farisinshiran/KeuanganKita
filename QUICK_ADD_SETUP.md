# 🤖 Quick Add - AI Receipt Scanner Setup Guide

## 📋 Daftar Isi
1. [Fitur Quick Add](#fitur-quick-add)
2. [Setup Google Cloud Vision API](#setup-google-cloud-vision-api)
3. [Deployment ke Production](#deployment-ke-production)
4. [Cara Menggunakan](#cara-menggunakan)
5. [Troubleshooting](#troubleshooting)

---

## 🎯 Fitur Quick Add

**Quick Add** adalah fitur AI-powered yang memungkinkan Anda:
- ✨ Upload screenshot atau foto struk belanja
- 🤖 AI otomatis mendeteksi transaksi (nominal, tanggal, merchant)
- ✏️ Edit & verifikasi multi-transaksi sekaligus
- ✅ Approve bulk transaksi ke daftar transaksi

**Teknologi:** Google Cloud Vision API (OCR + Text Detection)

---

## 🔧 Setup Google Cloud Vision API

### Step 1: Buat Project di Google Cloud Console

1. **Buka Google Cloud Console**
   - Kunjungi: https://console.cloud.google.com
   - Login dengan akun Google Anda

2. **Buat Project Baru**
   - Klik dropdown project (atas kiri)
   - Klik "New Project"
   - Nama: `dompet-keluarga-vision`
   - Klik "Create"

### Step 2: Enable Vision API

1. **Aktifkan API**
   - Di sidebar, pilih **APIs & Services** > **Library**
   - Cari: `Cloud Vision API`
   - Klik **Cloud Vision API**
   - Klik tombol **ENABLE**

2. **Tunggu proses enable selesai** (±30 detik)

### Step 3: Setup Billing (Required)

⚠️ **PENTING:** Vision API membutuhkan billing account, tapi memiliki **FREE TIER**:

**Free Tier Limits:**
- 1,000 request pertama per bulan: **GRATIS**
- 1,001 - 5,000,000: $1.50 per 1,000 request
- Lebih dari 5M: lebih murah lagi

**Untuk setup billing:**

1. Buka **Billing** di sidebar
2. Klik **Link a billing account**
3. Pilih billing account yang ada ATAU buat baru:
   - Isi data kartu kredit (untuk verifikasi)
   - Pilih negara: Indonesia
   - Isi alamat penagihan
4. Klik **Set Account**

> 💡 **Tips:** Dengan 1,000 free requests/month, jika Anda scan 10 struk/hari = ±300 struk/bulan (masih gratis!)

### Step 4: Buat API Key

1. **Generate API Key**
   - Di sidebar, pilih **APIs & Services** > **Credentials**
   - Klik **+ CREATE CREDENTIALS**
   - Pilih **API key**
   - Copy API key yang muncul (contoh: `AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX`)

2. **Restrict API Key (Recommended untuk Security)**
   - Klik icon pensil di sebelah API key
   - Scroll ke **API restrictions**
   - Pilih **Restrict key**
   - Centang hanya: **Cloud Vision API**
   - Klik **Save**

3. **Restrict by Domain (Optional - untuk production)**
   - Di bagian **Application restrictions**
   - Pilih **HTTP referrers (web sites)**
   - Tambahkan domain Anda:
     ```
     https://your-domain.com/*
     https://your-domain.firebaseapp.com/*
     ```
   - Klik **Save**

---

## 🚀 Deployment ke Production

### Option A: Firebase Hosting (Recommended)

```bash
# 1. Install Firebase CLI (jika belum)
npm install -g firebase-tools

# 2. Login ke Firebase
firebase login

# 3. Build project
npm run build

# 4. Deploy
firebase deploy --only hosting
```

**URL Production:** `https://dompet-keluarga-prod.web.app`

### Option B: Vercel / Netlify

```bash
# Vercel
npm install -g vercel
vercel --prod

# Netlify
npm install -g netlify-cli
netlify deploy --prod
```

---

## 📱 Cara Menggunakan

### 1. Setup Pertama Kali

1. Buka aplikasi Dompet Keluarga
2. Klik tombol **Quick Add** (icon robot) di pojok kanan bawah
3. Pertama kali akan muncul form untuk input **API Key**
4. Paste API Key dari Google Cloud Console
5. Klik **Simpan** (API Key akan tersimpan di browser)

### 2. Scan Receipt

1. **Upload Gambar**
   - Klik tombol "Pilih Gambar"
   - Pilih screenshot atau foto struk
   - Format support: JPG, PNG, HEIC

2. **Analisis dengan AI**
   - Klik tombol **"Analisis dengan AI"**
   - Tunggu beberapa detik (proses OCR)
   - AI akan mendeteksi transaksi otomatis

3. **Preview & Edit**
   - Tabel transaksi terdeteksi akan muncul
   - Anda bisa edit:
     - ✏️ Nominal
     - 📁 Kategori
     - 💳 Akun/Wallet
     - 📅 Tanggal
     - 📝 Catatan
   - ✅ Centang transaksi yang ingin disimpan
   - ❌ Hapus transaksi yang tidak perlu

4. **Approve & Simpan**
   - Klik **"Approve & Simpan"**
   - Transaksi yang dipilih akan masuk ke daftar transaksi
   - ✨ Selesai!

---

## 💡 Tips Penggunaan

### Untuk Hasil Terbaik:

1. **Kualitas Gambar**
   - ✅ Foto yang jelas dan terang
   - ✅ Teks mudah terbaca
   - ❌ Hindari gambar blur atau gelap

2. **Jenis Struk yang Didukung**
   - ✅ E-commerce (Tokopedia, Shopee, dll)
   - ✅ Retail (Indomaret, Alfamart, dll)
   - ✅ Restaurant receipt
   - ✅ Bank statements
   - ✅ Screenshot transfer

3. **Format yang Direkomendasikan**
   - Screenshot langsung dari HP
   - Foto struk fisik (gunakan kamera HP)
   - PDF receipt → convert ke image dulu

---

## 🐛 Troubleshooting

### Error: "No text detected in image"

**Solusi:**
- Pastikan gambar berisi teks yang jelas
- Coba foto ulang dengan pencahayaan lebih baik
- Crop gambar agar fokus ke area struk

### Error: "API Key invalid"

**Solusi:**
1. Pastikan API Key sudah dicopy dengan benar
2. Cek apakah Vision API sudah di-enable
3. Pastikan billing account sudah terhubung
4. Coba generate API Key baru

### Error: "Quota exceeded"

**Solusi:**
- Anda sudah melebihi 1,000 requests/bulan (free tier)
- Tunggu hingga bulan berikutnya ATAU
- Upgrade ke paid plan

### Transaksi Tidak Terdeteksi dengan Akurat

**Solusi:**
1. Edit manual di tabel preview sebelum approve
2. Pastikan gambar berkualitas baik
3. Untuk struk kompleks, lebih baik input manual

### Button Quick Add Tidak Muncul

**Solusi:**
- Clear cache browser: Ctrl + Shift + Delete
- Hard reload: Ctrl + F5
- Logout dan login kembali

---

## 🔒 Security & Privacy

### 🛡️ Image Privacy & Auto-Cleanup
**PENTING:** Screenshot/foto struk Anda **OTOMATIS DIHAPUS** setelah transaksi disimpan!

- ✅ Image hanya ada di memory browser sementara
- ✅ Otomatis dihapus setelah "Approve & Simpan" berhasil
- ✅ Otomatis dihapus saat modal ditutup
- ✅ Tidak pernah di-upload ke server atau cloud
- ✅ Tidak tersimpan di database Firebase
- ✅ Memory browser di-clear otomatis

**Bagaimana Cara Kerjanya:**
1. Upload gambar → Tersimpan di memory browser (temporary)
2. Gambar dikirim ke Vision API untuk OCR (via HTTPS)
3. Response diterima → Gambar langsung dihapus dari memory
4. Approve transaksi → Cleanup final
5. Close modal → Cleanup final

**Keamanan:**
- 🔒 Image tidak pernah menyentuh server Firebase
- 🔒 Tidak ada storage/caching di aplikasi
- 🔒 OCR processing via secure HTTPS
- 🔒 Vision API tidak menyimpan image (sesuai Google policy)

### API Key Storage
**UPDATE: API Key sekarang tersimpan di Firestore per akun!**

- ✅ **Disimpan di Firestore** (bukan localStorage lagi)
- ✅ **Tersinkronisasi di semua device** yang login dengan akun Google yang sama
- ✅ **Otomatis ter-load** saat login di device baru
- ✅ **Terenkripsi** dengan Firestore security rules
- ✅ **Migration otomatis** dari localStorage ke Firestore

**Struktur Firestore:**
```
artifacts/{appId}/users/{userId}/settings/visionApi
  └─ apiKey: "your-api-key"
  └─ updatedAt: timestamp
```

**Keuntungan:**
- 🌐 Login di laptop → API Key tersedia
- 📱 Login di HP → API Key otomatis tersinkronisasi
- 🔄 Ganti device → Tidak perlu input ulang API Key
- 🔒 Data terproteksi dengan Firebase Auth

### Best Practices:
1. ✅ Gunakan API key restriction (by domain)
2. ✅ Set budget alerts di Google Cloud Console
3. ✅ Monitor usage di Google Cloud Console
4. ❌ Jangan share API key ke publik
5. ✅ Pastikan cleanup otomatis berjalan (sudah built-in)

### Setup Budget Alert:

1. Buka Google Cloud Console
2. **Billing** > **Budgets & alerts**
3. **CREATE BUDGET**
4. Set budget: $5 atau $10 per bulan
5. Set alert: 50%, 90%, 100%
6. Email notification akan dikirim jika mendekati limit

---

## 📊 Monitoring Usage

### Cek Penggunaan API:

1. Buka Google Cloud Console
2. **APIs & Services** > **Dashboard**
3. Pilih **Cloud Vision API**
4. Lihat grafik request per hari/bulan

### Estimasi Biaya:

| Penggunaan | Request/Bulan | Biaya |
|------------|---------------|-------|
| Ringan | 0 - 1,000 | **GRATIS** |
| Sedang | 1,500 | ~$0.75 |
| Aktif | 3,000 | ~$3.00 |
| Heavy | 5,000 | ~$6.00 |

---

## 🎓 Tutorial Video (Coming Soon)

- [ ] Setup Google Cloud Vision API
- [ ] Cara menggunakan Quick Add
- [ ] Tips & Tricks untuk hasil terbaik

---

## 📞 Support

Jika ada pertanyaan atau kendala:
- Email: fauzanalfi@example.com
- GitHub Issues: [Link ke repo]
- WhatsApp: [Nomor Anda]

---

## 🔄 Changelog

### v1.0.0 (2026-02-12)
- ✨ Initial release fitur Quick Add
- 🤖 Google Cloud Vision API integration
- ✏️ Multi-transaction preview & edit
- ✅ Bulk approval system

---

## 📝 License

MIT License - © 2026 Dompet Keluarga by @fauzanalfi
