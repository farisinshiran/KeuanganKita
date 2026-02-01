# 💰 Dompet Keluarga

**Dompet Keluarga** adalah aplikasi manajemen keuangan keluarga yang komprehensif dan modern. Aplikasi ini membantu Anda mengelola pengeluaran, investasi, langganan, dan perencanaan keuangan keluarga dengan fitur-fitur canggih berbasis cloud.

![Dompet Keluarga](https://img.shields.io/badge/Status-Production-brightgreen?style=flat-square)
![React](https://img.shields.io/badge/React-18+-blue?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-5+-purple?style=flat-square)
![Firebase](https://img.shields.io/badge/Firebase-Firestore-orange?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

## 🌟 Fitur Utama

### 📊 Dashboard Analitik
- **Ringkasan Aset**: Tampilkan total aset bersih, saldo kas, dan total investasi dalam satu pandangan
- **Tren Arus Kas (6 Bulan)**: Visualisasi tren pemasukan dan pengeluaran dengan grafik line chart interaktif
- **Tren Nilai Aset**: Monitor pertumbuhan nilai aset dengan area chart yang menampilkan modal dan nilai pasar
- **Analisis Pengeluaran**: Pie chart untuk melihat breakdown pengeluaran kategori bulan ini
- **Monitoring Budget**: Progress bar real-time dengan peringatan otomatis ketika budget mencapai 90%
- **Saldo Per Akun**: Tampilan scrollable semua akun/dompet dengan saldo terkini dan indikator limit kredit

### 💳 Manajemen Transaksi
- **Tiga Tipe Transaksi**: Pemasukan, Pengeluaran, dan Transfer antar akun
- **Kategori Fleksibel**: 
  - Pengeluaran: Belanja Bulanan, Makan Luar, Transportasi, Listrik & Air, Pulsa & Internet, Zakat & Infaq, Pendidikan, Cicilan Rumah, Kesehatan, Langganan, dll
  - Pemasukan: Gaji Pokok, Bonus/THR, Sampingan, Dividen
- **Filter & Pencarian**: Filter berdasarkan tanggal, akun/dompet untuk analisis mendalam
- **Riwayat Lengkap**: Tabel terstruktur dengan tanggal, detail, kategori, catatan, dan jumlah

### 👛 Manajemen Dompet/Akun
- **Tipe Akun Beragam**:
  - **Dompet Tunai** 💵 - Kas fisik
  - **Bank** 🏦 - Rekening tabungan/giro
  - **Kartu Kredit** 💳 - Dengan limit dan tracking utang
  - **E-Wallet** 📱 - Dompet digital
  - **Reksadana** 📊 - Investasi reksadana
- **Manajemen Custom**: Tambah, edit, atau hapus akun sesuai kebutuhan
- **Tracking Limit Kredit**: Progress bar visual untuk status penggunaan kartu kredit

### 📺 Manajemen Langganan (Subscription)
- **Auto Icon Mapping**: 50+ layanan populer dengan icon otomatis (Netflix, Spotify, YouTube, Adobe, GitHub, Figma, dll)
- **Kategori Langganan**: Streaming, Software, Musik, Hosting, VPN, Gaming, dll
- **Tracking Biaya Rutin**: Monitor semua langganan berkelanjutan
- **Custom Subscription**: Dukung langganan kustom dengan ikon pilihan
- **Detail Lengkap**: Nama layanan, biaya, tanggal perpanjangan, dan catatan

### 📈 Manajemen Investasi
- **Jenis Investasi Bawaan**:
  - Emas (Logam Mulia) 🥇 - Target: Rp 100 juta
  - Saham Bluechip 📊 - Target: Rp 500 juta
  - Reksadana Pasar Uang 📈 - Target: Rp 50 juta
- **Tracking Dinamis**: Input pembelian, tracking nilai pasar real-time
- **Progress Visualization**: Monitor capaian target investasi per jenis
- **Harga Emas Real-Time**: Fetch harga emas terkini dari API eksternal
- **Custom Investment Types**: Buat tipe investasi sesuai kebutuhan

### � Kalkulator Pengalokasian Gaji
- **Input Gaji & Rekening**: Masukkan total gaji dan pilih rekening default
- **Alokasi Fleksibel**: Input alokasi dengan nominal atau persentase (auto-calculate keduanya)
- **Real-time Summary**: 
  - Total Dialokasikan
  - Sisa Gaji
  - Jumlah Kategori Teralokasi
- **Visualisasi Pie Chart**: Lihat distribusi alokasi gaji secara visual
- **Auto-Save State**: Data tersimpan otomatis ketika berpindah menu
- **Template System**: 
  - Simpan konfigurasi alokasi sebagai template
  - Load template untuk bulan berikutnya
  - Kelola multiple templates- **Apply to Budget**: Aplikasikan alokasi langsung sebagai budget limit kategori dengan satu klik- **Fitur Reset**: Reset semua isian untuk memulai dari awal
- **Saran Alokasi**: Panduan alokasi ideal (60% primer, 30% sekunder, 10% investasi)
- **Alert System**: Peringatan jika total alokasi melebihi gaji

### �📝 Zakat Calculator
- **Perhitungan Zakat**: Hitung zakat berdasarkan jenis investasi (emas, saham, reksadana)
- **Nisab Emas**: Perhitungan otomatis berdasarkan harga emas terkini
- **Summary by Type**: Breakdown zakat per jenis investasi
- **Islamic Finance**: Sesuai dengan prinsip keuangan Islam

### 🏷️ Manajemen Kategori
- **Custom Categories**: Buat kategori pengeluaran/pemasukan sesuai kebutuhan keluarga
- **Budget Setting**: Set budget target untuk setiap kategori
- **Edit & Hapus**: Kelola kategori dengan mudah
- **Validasi Otomatis**: Cegah duplikasi kategori

### 💱 Multi-Currency Support
Mendukung 7 mata uang utama:
- **IDR** - Rupiah (Rp) [Default]
- **USD** - US Dollar ($)
- **SGD** - Singapore Dollar (S$)
- **EUR** - Euro (€)
- **MYR** - Malaysian Ringgit (RM)
- **JPY** - Japanese Yen (¥)
- **AUD** - Australian Dollar (A$)

Dengan **real-time exchange rate** fetching dari API eksternal.

### 🌙 Dark Mode
- **Tema Gelap Penuh**: Mendukung dark mode di semua halaman dan komponen
- **System Preference**: Auto-detect tema berdasarkan preferensi sistem
- **Toggle Mudah**: Switch antar mode dengan satu klik

### 🔒 Privacy Mode
- **Tersembunyi Nilai Finansial**: Gantikan angka dengan bullet points (•) pada dashboard
- **Keamanan Data**: Tampilkan hanya data yang diperlukan

### 🔐 Keamanan & Autentikasi
- **Google OAuth**: Login aman dengan akun Google
- **Firebase Authentication**: Autentikasi terpercaya
- **Firestore Database**: Penyimpanan cloud yang aman
- **User-Specific Data**: Setiap pengguna melihat hanya data miliknya

## 🛠️ Tech Stack

- **Frontend**: React 18+ dengan Vite untuk fast refresh
- **Styling**: Tailwind CSS dengan dark mode support
- **Backend/Database**: Firebase + Firestore
- **Authentication**: Firebase Auth (Google Sign-In)
- **Charts**: Recharts untuk visualisasi data interaktif
- **Icons**: Lucide React untuk UI icons
- **Formatting**: Intl API untuk currency dan date formatting
- **Build Tool**: Vite 5+

## 📋 Prerequisites

- Node.js v16+ atau lebih tinggi
- npm atau yarn
- Akun Firebase (production atau development)

## 🚀 Getting Started

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/dompet-keluarga.git
cd dompet-keluarga
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Setup Firebase Configuration
Edit `src/App.jsx` dan pastikan konfigurasi Firebase sudah benar:
```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

### 4. Setup Firestore Rules
Pastikan Firestore rules di Firebase Console sudah dikonfigurasi untuk keamanan:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth.uid == userId;
    }
  }
}
```

### 5. Jalankan Development Server
```bash
npm run dev
```

Aplikasi akan berjalan di `http://localhost:5173`

### 6. Build untuk Production
```bash
npm run build
```

### 7. Preview Production Build
```bash
npm run preview
```

## 📁 Project Structure

```
src/
├── App.jsx              # Main application component
├── App.css              # Global styles
├── main.jsx             # Entry point
├── index.css            # Base styles
└── assets/              # Static assets
```

## 🔄 Data Flow

```
Google Auth
    ↓
Firestore Database
    ↓
App State (React Hooks)
    ↓
Components (Dashboard, Transactions, Wallets, etc.)
    ↓
UI Rendering & User Interaction
```

## 📊 Database Schema (Firestore)

### Collections

- **users/{userId}/transactions** - Riwayat transaksi
- **users/{userId}/wallets** - Data akun/dompet
- **users/{userId}/categories** - Kategori custom
- **users/{userId}/subscriptions** - Data langganan
- **users/{userId}/investments** - Data investasi
- **users/{userId}/investmentTypes** - Jenis investasi

## 🎨 Color Scheme & Theme

- **Primary**: Emerald (#10B981) - Untuk aksi positif
- **Secondary**: Blue (#3B82F6) - Untuk informasi
- **Warning**: Amber (#F59E0B) - Untuk peringatan
- **Danger**: Red (#EF4444) - Untuk pengeluaran/alert
- **Accent**: Purple (#8B5CF6), Pink (#EC4899), Indigo (#6366F1)

## 🌐 External APIs

- **Exchange Rate API**: Untuk fetch real-time currency exchange rates
- **Gold Price API**: Untuk fetch harga emas terkini

## 📱 Responsive Design

- Mobile-first approach
- Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
- Fully responsive pada semua ukuran layar

## 🔔 Features Highlights

| Feature | Status | Description |
|---------|--------|-------------|
| Dashboard Analytics | ✅ | Real-time financial overview |
| Transaction Management | ✅ | Income, Expense, Transfer tracking |
| Wallet Management | ✅ | Multi-wallet support with limits |
| Subscription Tracker | ✅ | Auto icon mapping untuk 50+ services |
| Investment Tracking | ✅ | Multiple asset types dengan targets |
| Salary Allocator | ✅ | Salary allocation calculator with templates |
| Zakat Calculator | ✅ | Islamic finance calculations |
| Budget Monitoring | ✅ | Real-time alerts & progress tracking |
| Multi-Currency | ✅ | 7 major currencies support |
| Dark Mode | ✅ | Full dark theme support |
| Privacy Mode | ✅ | Hide sensitive financial data |
| Google Auth | ✅ | Secure authentication |
| Cloud Sync | ✅ | Real-time Firestore sync |

## 🛡️ Security Considerations

1. **Never commit Firebase credentials** - Gunakan environment variables
2. **Firestore Rules** - Implementasikan security rules yang ketat
3. **HTTPS Only** - Deploy hanya dengan HTTPS
4. **Data Encryption** - Sensitive data dienkripsi di Firestore
5. **Auth Validation** - Server-side validation di backend rules

## 🐛 Troubleshooting

### Firebase Connection Error
- Pastikan konfigurasi Firebase benar
- Cek Firebase Console untuk status layanan
- Verifikasi Firestore region

### Exchange Rate API Error
- Cek koneksi internet
- Verify API rate limits
- Check API documentation

### Gold Price Fetch Fails
- Verify API endpoint accessibility
- Check CORS configuration
- Monitor API service status

## 📈 Performance Optimization

- Lazy loading untuk chart components
- Memoization dengan `useMemo` untuk data processing
- Efficient filtering dan sorting algorithms
- Optimized Firestore queries dengan indexing

## 🤝 Contributing

Kami menerima kontribusi! Silakan:

1. Fork repository
2. Buat feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push ke branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Proyek ini dilisensikan di bawah MIT License - lihat file [LICENSE](LICENSE) untuk detail.

## 📧 Support & Contact

Untuk pertanyaan, saran, atau laporan bug:
- Open an issue di GitHub
- Email: support@dompet-keluarga.com

## 🙏 Acknowledgments

- [React](https://react.dev) - UI library
- [Vite](https://vitejs.dev) - Build tool
- [Firebase](https://firebase.google.com) - Backend services
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [Recharts](https://recharts.org) - Chart visualization
- [Lucide Icons](https://lucide.dev) - Icon library

---

**Dompet Keluarga** - Kelola Keuangan Keluarga dengan Bijak 💚
