# ⚡ Quick Start - Vision API Setup

## 🚀 5 Menit Setup

### 1. Google Cloud Console
```
1. Buka: https://console.cloud.google.com
2. Buat project baru: "dompet-keluarga-vision"
3. Enable "Cloud Vision API"
4. Setup billing (ada free tier 1000 request/bulan)
5. Create Credentials > API Key
6. Copy API Key
```

### 2. Restrict API Key (Security)
```
APIs & Services > Credentials > [Your API Key]
- Application restrictions: 
  - HTTP referrers
  - Add: https://YOUR_PROJECT_ID.web.app/*
- API restrictions:
  - Restrict key
  - Select: Cloud Vision API only
- Save
```

### 3. Di Aplikasi
```
1. Klik tombol "Quick Add" (icon robot)
2. Paste API Key
3. Upload screenshot/foto struk
4. Klik "Analisis dengan AI"
5. Edit & approve transaksi
```

## 💰 Biaya

| Penggunaan | Cost |
|------------|------|
| 0-1000 request/bulan | **GRATIS** |
| 1001-5000 | $1.50/1000 |

**Tips:** 10 scan/hari = ~300/bulan = **GRATIS** ✨

## 🔗 Links

- **Dokumentasi Lengkap:** [QUICK_ADD_SETUP.md](./QUICK_ADD_SETUP.md)
- **Google Cloud Console:** https://console.cloud.google.com
- **Vision API Pricing:** https://cloud.google.com/vision/pricing

## 🐛 Troubleshooting

| Error | Solusi |
|-------|--------|
| "API Key invalid" | Cek API Key & enable Vision API |
| "No text detected" | Gunakan gambar yang lebih jelas |
| "Quota exceeded" | Upgrade atau tunggu bulan depan |

## 📦 Production Deployment

```bash
# Build
npm run build

# Deploy ke Firebase Hosting
firebase deploy --only hosting

# Setelah deploy, update API key restrictions dengan domain production
```

---

**Need Help?** Baca dokumentasi lengkap: [QUICK_ADD_SETUP.md](./QUICK_ADD_SETUP.md)
