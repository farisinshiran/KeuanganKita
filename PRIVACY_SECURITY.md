# 🔒 Quick Add - Privacy & Security Guide

## Keamanan Data Anda Adalah Prioritas Kami

Kami memahami bahwa screenshot struk/receipt berisi informasi sensitif. Berikut adalah penjelasan lengkap bagaimana kami menjaga privasi Anda:

---

## 🛡️ Bagaimana Data Anda Dilindungi

### 1. Image TIDAK Pernah Tersimpan

#### ✅ Yang Terjadi:
```
Upload Image → Memory Browser (temporary) → Vision API (OCR) → Langsung Dihapus
```

#### ❌ Yang TIDAK Terjadi:
- ❌ Upload ke Firebase Storage
- ❌ Simpan di database Firestore
- ❌ Cache di localStorage
- ❌ Store di server manapun
- ❌ Backup otomatis

### 2. Auto-Cleanup System

**Sistem kami otomatis menghapus image di 3 skenario:**

#### Skenario 1: Setelah Transaksi Disimpan ✅
```javascript
1. User klik "Approve & Simpan"
2. Transaksi disimpan ke Firestore
3. handleReset() dipanggil otomatis
4. Image dihapus dari memory
5. File input di-reset
6. Object URL di-revoke (free memory)
```

#### Skenario 2: Saat Modal Ditutup ✅
```javascript
1. User klik tombol X atau klik di luar modal
2. handleClose() dipanggil
3. handleReset() dijalankan
4. Semua data image dihapus
5. Modal ditutup
```

#### Skenario 3: Saat Ganti Gambar ✅
```javascript
1. User klik "Ganti Gambar"
2. handleReset() dipanggil
3. Image lama dihapus sebelum upload baru
4. File input di-reset
```

### 3. Memory Management

**Kami menggunakan best practices untuk memory management:**

```javascript
// Revoke object URL untuk free browser memory
if (imagePreview && imagePreview.startsWith('blob:')) {
  URL.revokeObjectURL(imagePreview);
}
```

**Manfaat:**
- ✅ Tidak ada memory leak
- ✅ Browser tetap responsive
- ✅ RAM tidak terpakai berlebihan

---

## 🔐 Data Flow & Privacy

### Complete Data Flow:

```
┌─────────────────────────────────────────────────────┐
│ 1. USER UPLOADS IMAGE                               │
│    └─> Stored in browser memory (temporary)         │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 2. SEND TO VISION API (via HTTPS)                  │
│    └─> Secure encrypted transmission                │
│    └─> Google Cloud Vision API (OCR Processing)     │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 3. RECEIVE TEXT RESPONSE                            │
│    └─> Only text data (no image returned)           │
│    └─> Parse into transaction data                  │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 4. IMAGE AUTO-DELETED                               │
│    └─> Image cleared from browser memory            │
│    └─> Object URL revoked                           │
│    └─> File input reset                             │
└─────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────┐
│ 5. SAVE TRANSACTIONS TO FIREBASE                    │
│    └─> Only transaction data saved                  │
│    └─> NO image data                                │
└─────────────────────────────────────────────────────┘
```

### Data Yang Disimpan di Firebase:
```json
{
  "type": "expense",
  "amount": 125000,
  "category": "Belanja Bulanan",
  "walletId": "wallet-123",
  "note": "Indomaret - Receipt Total",
  "date": "2026-02-12T10:30:00Z",
  "createdAt": "serverTimestamp"
}
```

**TIDAK ADA IMAGE DATA! ✅**

---

## 🔍 Google Cloud Vision API - Privacy Policy

### Apakah Google Menyimpan Image Saya?

**Menurut Google Cloud Vision API Privacy Policy:**

#### Processing Images:
- ✅ Image diproses secara real-time
- ✅ Tidak disimpan oleh Google Cloud
- ✅ Tidak digunakan untuk training model
- ✅ Tidak di-share dengan pihak ketiga

#### Data Retention:
- **Image data:** TIDAK disimpan
- **OCR results:** TIDAK disimpan
- **API logs:** Hanya metadata (timestamp, success/error)

**Official Policy:** https://cloud.google.com/vision/docs/data-usage

### Apa Yang Terlog di Google Cloud?

**Yang Terlog:**
- ✅ Timestamp request
- ✅ Success/error status
- ✅ API key yang digunakan
- ✅ Response time

**Yang TIDAK Terlog:**
- ❌ Image content
- ❌ OCR text results
- ❌ Personal information

---

## 🛠️ Cara Verifikasi Privacy

### Test 1: Cek localStorage

**Cara:**
1. Buka DevTools (F12)
2. Tab "Application" → Storage → Local Storage
3. Cek key `visionApiKey` (hanya API key, no images)

**Expected:**
```
visionApiKey: "AIzaSyXXXXXXXXXXXXXXXX" ✅
```

**Not Expected:**
```
uploadedImage: "data:image/png;base64..." ❌
receiptImage: "blob:..." ❌
```

### Test 2: Cek Network Traffic

**Cara:**
1. Buka DevTools (F12) → Network tab
2. Upload image & klik "Analisis"
3. Monitor semua requests

**Expected:**
```
✅ vision.googleapis.com (POST) - Vision API call
✅ firestore.googleapis.com (POST) - Save transactions
```

**Not Expected:**
```
❌ firebase storage upload
❌ firebasestorage.googleapis.com
❌ Any image upload to Firebase
```

### Test 3: Cek Firebase Storage

**Cara:**
1. Buka Firebase Console
2. Storage → Files
3. Lihat apakah ada file image

**Expected:**
```
✅ Storage kosong (no images)
```

### Test 4: Memory Leak Check

**Cara:**
1. Buka DevTools → Performance tab
2. Record performance
3. Upload 5 images berturut-turut
4. Check memory usage
5. Close modal
6. Force garbage collection (di Memory tab)

**Expected:**
```
✅ Memory usage turun setelah cleanup
✅ No retained objects
✅ Object URL revoked
```

---

## ⚠️ Best Practices untuk User

### DO ✅

1. **Upload Only When Needed**
   - Upload saat akan langsung diproses
   - Jangan upload lalu ditinggal

2. **Close Modal Setelah Selesai**
   - Klik X atau tombol close
   - Pastikan cleanup berjalan

3. **Use Secure Connection**
   - Pastikan URL menggunakan HTTPS
   - Jangan gunakan public WiFi untuk transaksi sensitif

4. **Monitor API Usage**
   - Cek Google Cloud Console secara berkala
   - Set budget alerts

5. **Restrict API Key**
   - Restrict by domain
   - Restrict by API (Vision API only)

### DON'T ❌

1. **Jangan Screenshot Info Sangat Sensitif**
   - Password, PIN, CVV
   - Full credit card number
   - OTP codes

2. **Jangan Share API Key**
   - Jangan post di public forum
   - Jangan commit ke GitHub
   - Jangan share ke orang lain

3. **Jangan Upload di Public Device**
   - Gunakan device pribadi
   - Logout setelah selesai

---

## 🚨 Jika Khawatir dengan Privacy

### Option 1: Gunakan Manual Input
Jika Anda tidak nyaman upload screenshot, selalu gunakan tombol **"Tambah Transaksi"** (icon +) untuk input manual.

### Option 2: Crop Screenshot
Sebelum upload, crop screenshot hanya ke area yang diperlukan. Hilangkan informasi sensitif lainnya.

### Option 3: Use Incognito Mode
1. Buka browser dalam Incognito/Private mode
2. Login & gunakan Quick Add
3. Close tab setelah selesai
4. Semua data (termasuk API key) akan terhapus

---

## 📊 Compliance & Standards

### GDPR Compliance
- ✅ No personal data stored without consent
- ✅ Right to deletion (auto-cleanup)
- ✅ Data minimization (only OCR text)
- ✅ Secure transmission (HTTPS)

### Security Best Practices
- ✅ No persistent storage of images
- ✅ Automatic cleanup mechanisms
- ✅ Memory leak prevention
- ✅ Secure API communication
- ✅ No third-party data sharing

---

## 🔐 Technical Security Details

### Encryption
- **In Transit:** HTTPS/TLS 1.3
- **At Rest:** N/A (images not stored)
- **API Communication:** OAuth 2.0 + API Key

### Authentication
- **User Auth:** Firebase Authentication (Google OAuth)
- **API Auth:** Google Cloud API Key with restrictions

### Data Isolation
- **User Data:** Isolated per Firebase UID
- **Firestore Rules:** User can only access own data
- **No Cross-User Access:** Enforced by security rules

---

## 📞 Privacy Questions?

Jika ada pertanyaan tentang privacy & security:

**Contact:**
- Email: fauzanalfi@example.com
- GitHub Issues: https://github.com/yourusername/dompet-keluarga/issues
- Subject: "Privacy & Security - Quick Add"

**Response Time:** 24-48 jam

---

## 📚 Additional Resources

- **Google Cloud Vision API Security:** https://cloud.google.com/vision/docs/security
- **Firebase Security Rules:** https://firebase.google.com/docs/firestore/security
- **HTTPS Best Practices:** https://web.dev/security-https/
- **Browser Memory Management:** https://developer.mozilla.org/en-US/docs/Web/API/URL/revokeObjectURL

---

## ✅ Privacy Summary

| Aspect | Status | Details |
|--------|--------|---------|
| Image Storage | ❌ TIDAK | Auto-deleted after use |
| Firebase Upload | ❌ TIDAK | Never uploaded |
| Google Storage | ❌ TIDAK | Only processed, not stored |
| Auto-Cleanup | ✅ YA | 3 cleanup triggers |
| Memory Management | ✅ YA | URL.revokeObjectURL() |
| Secure Transmission | ✅ YA | HTTPS/TLS |
| User Control | ✅ YA | Can use manual input |
| GDPR Compliant | ✅ YA | Data minimization |

---

**Last Updated:** February 12, 2026  
**Version:** 2.0.0

**Your privacy is our priority. Image processing is ephemeral - nothing is stored. 🔒**
