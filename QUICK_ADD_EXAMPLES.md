# 📸 Quick Add - Usage Examples

## Contoh Penggunaan Quick Add

### 1️⃣ Upload Screenshot E-Commerce (Tokopedia/Shopee)

**Input:**
```
Screenshot pesanan dari Tokopedia:
- Total: Rp 125.000
- Tanggal: 10 Feb 2026
- Item: Beras 5kg, Minyak Goreng, Gula Pasir
```

**Output AI:**
```
✅ Transaksi 1: Rp 125.000 | Belanja Bulanan | 10 Feb 2026 | "Tokopedia - Receipt Total"
```

---

### 2️⃣ Upload Foto Struk Minimarket

**Input:**
```
Foto struk Indomaret:
INDOMARET
-----------------------
Susu Ultra 1L      Rp 18.000
Roti Tawar         Rp 12.500
Telur 1kg          Rp 28.000
Minyak Bimoli      Rp 35.000
-----------------------
TOTAL              Rp 93.500
10/02/2026 15:30
```

**Output AI:**
```
✅ Transaksi 1: Rp 18.000 | Belanja Bulanan | 10 Feb 2026 | "Susu Ultra 1L"
✅ Transaksi 2: Rp 12.500 | Belanja Bulanan | 10 Feb 2026 | "Roti Tawar"
✅ Transaksi 3: Rp 28.000 | Belanja Bulanan | 10 Feb 2026 | "Telur 1kg"
✅ Transaksi 4: Rp 35.000 | Belanja Bulanan | 10 Feb 2026 | "Minyak Bimoli"
```

**User Action:**
- Bisa uncheck item yang tidak perlu
- Edit kategori jika perlu
- Approve hanya yang dipilih

---

### 3️⃣ Upload Screenshot Transfer Bank

**Input:**
```
Screenshot BCA Mobile:
Transfer Berhasil
Ke: Toko Buku Gramedia
Jumlah: Rp 250.000
Tanggal: 12 Feb 2026 10:15
```

**Output AI:**
```
✅ Transaksi 1: Rp 250.000 | Belanja Bulanan | 12 Feb 2026 | "Transfer - Toko Buku Gramedia"
```

**User Edit:**
- Ubah kategori: Belanja Bulanan → Pendidikan (SPP)
- Edit catatan: "Beli buku pelajaran anak"
- Approve

---

### 4️⃣ Upload Struk Restaurant

**Input:**
```
McD Drive Thru
========================
Paket Hemat 1       Rp 45.000
Es Teh             Rp  8.000
Kentang Goreng     Rp 15.000
------------------------
Total              Rp 68.000
11/02/2026 19:45
```

**Output AI:**
```
✅ Transaksi 1: Rp 68.000 | Makan Luar | 11 Feb 2026 | "McD Drive Thru - Receipt Total"
```

---

### 5️⃣ Upload Screenshot Grab/Gojek

**Input:**
```
GrabFood - Pesanan Selesai
Nasi Goreng Special    Rp 35.000
Es Jeruk               Rp 10.000
Ongkir                 Rp  8.000
----------------------------------
Total                  Rp 53.000
Tanggal: 12 Feb 2026
```

**Output AI:**
```
✅ Transaksi 1: Rp 53.000 | Makan Luar | 12 Feb 2026 | "GrabFood - Receipt Total"
```

---

### 6️⃣ Upload Struk SPBU

**Input:**
```
PERTAMINA
SPBU 34.11203
Pertalite
Liter: 10.5
Harga/L: Rp 10.000
Total: Rp 105.000
12/02/2026 08:30
```

**Output AI:**
```
✅ Transaksi 1: Rp 105.000 | Transportasi | 12 Feb 2026 | "PERTAMINA - Receipt Total"
```

---

## 🎯 Tips untuk Hasil Terbaik

### ✅ DO - Lakukan Ini:
1. **Foto Jelas & Terang**
   - Pastikan teks terbaca dengan jelas
   - Gunakan pencahayaan yang cukup
   
2. **Crop ke Area Penting**
   - Focus ke area yang berisi transaksi
   - Hilangkan background yang tidak perlu

3. **Screenshot Langsung dari App**
   - Screenshot dari app e-commerce lebih akurat
   - Format digital lebih mudah dibaca AI

4. **Verifikasi Sebelum Approve**
   - Selalu cek nominal, kategori, dan tanggal
   - Edit jika ada yang tidak sesuai

### ❌ DON'T - Hindari Ini:
1. **Gambar Blur atau Gelap**
   - AI sulit membaca teks yang tidak jelas
   
2. **Multiple Receipts dalam 1 Gambar**
   - Upload satu-satu untuk hasil lebih akurat
   
3. **Struk yang Sudah Pudar**
   - Tinta struk thermal yang sudah hilang sulit dibaca

4. **Approve Tanpa Cek**
   - AI bisa salah, selalu verifikasi dulu

---

## 🔄 Workflow Terbaik

### Harian:
```
1. Simpan semua struk/screenshot hari ini
2. Malam hari: buka Quick Add
3. Upload & scan satu per satu
4. Edit & categorize
5. Bulk approve
```

### Mingguan:
```
1. Review transaksi yang sudah disimpan
2. Cross-check dengan saldo rekening
3. Update kategori jika ada yang salah
4. Analisis pengeluaran per kategori
```

### Bulanan:
```
1. Export data untuk rekap bulanan
2. Review budget vs actual
3. Adjust budget untuk bulan depan
```

---

## 📊 Akurasi AI

| Jenis Struk | Akurasi | Catatan |
|-------------|---------|---------|
| E-Commerce Screenshot | ⭐⭐⭐⭐⭐ | Sangat akurat |
| Struk Minimarket | ⭐⭐⭐⭐ | Baik, kadang perlu edit item |
| Struk Restaurant | ⭐⭐⭐⭐ | Baik untuk total |
| Transfer Bank | ⭐⭐⭐⭐⭐ | Sangat akurat |
| Struk Thermal (pudar) | ⭐⭐ | Perlu foto ulang atau manual |
| Handwritten Receipt | ⭐⭐ | Lebih baik input manual |

---

## 🆘 Troubleshooting

### Transaksi Tidak Terdeteksi
**Solusi:**
1. Crop gambar lebih fokus
2. Tambahkan kontras/brightness
3. Foto ulang dengan pencahayaan lebih baik

### Nominal Salah
**Solusi:**
- Edit manual di tabel preview
- AI kadang salah parse format angka

### Kategori Tidak Sesuai
**Solusi:**
- Edit dropdown kategori di tabel
- AI categorize berdasarkan merchant name

### Multiple Items Jadi 1 Transaksi
**Solusi:**
- Biarkan sebagai 1 transaksi (total)
- ATAU hapus dan input manual per item

---

## 💡 Pro Tips

1. **Batch Upload di Akhir Hari**
   - Kumpulkan semua struk
   - Upload sekaligus malam hari
   - Lebih efisien daripada satu-satu

2. **Gunakan Naming Convention**
   - Edit catatan dengan format: "Merchant - Item"
   - Contoh: "Alfamart - Belanja Bulanan Minggu 1"

3. **Create Custom Categories**
   - Buat kategori spesifik di settings
   - Contoh: "Makan Siang Kantor", "Bensin Motor"

4. **Set Default Wallet**
   - Pilih wallet yang paling sering digunakan
   - Hemat waktu edit

5. **Use Tags in Notes**
   - Tambahkan hashtag: #keluarga #pribadi #penting
   - Mudah untuk search nanti

---

## 📈 Metrics & Analytics

Setelah menggunakan Quick Add selama 1 bulan:

```
Waktu Input Manual vs AI:
- Manual: ~2 menit per transaksi
- Quick Add: ~15 detik per transaksi (dengan bulk)

Efisiensi:
- 30 transaksi/bulan manual = 60 menit
- 30 transaksi/bulan Quick Add = 7.5 menit
- Hemat: ~52.5 menit per bulan! ⚡
```

---

**Happy Scanning! 🎉**
