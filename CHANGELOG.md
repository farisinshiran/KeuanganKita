# Changelog

All notable changes to Dompet Keluarga project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-02-12

### 🚀 Added - Quick Add AI Scanner Feature

#### New Features
- **Quick Add Modal Component**: Upload & scan receipt dengan AI
- **Google Cloud Vision API Integration**: OCR untuk extract text dari gambar
- **Smart Transaction Parser**: Parse text menjadi structured transaction data
- **Multi-Transaction Preview Table**: Editable table untuk review & edit transaksi
- **Bulk Approval System**: Approve multiple transactions sekaligus
- **Merchant Categorization**: Auto-categorize berdasarkan merchant name
- **Date Detection**: Otomatis detect tanggal dari receipt
- **API Key Management**: Secure storage di localStorage
- **Floating Action Button (FAB)**: Quick Add button di UI

#### Technical Implementation
- Added `analyzeReceiptWithVision()` function untuk Vision API calls
- Added `parseReceiptText()` function untuk parse OCR results
- Added `categorizeMerchant()` function untuk smart categorization
- Added `QuickAddModal` component dengan:
  - Image upload & preview
  - API key input & validation
  - Processing states & loading indicators
  - Editable transaction table
  - Select/unselect functionality
  - Delete individual transaction
  - Bulk save to Firestore

#### UI/UX Improvements
- New FAB group dengan 2 buttons:
  - Quick Add (AI Scanner) - icon robot
  - Manual Add (existing) - icon plus
- Quick Add button dengan hover effect & label
- Modal dengan responsive design
- Dark mode support untuk semua komponen baru
- Loading states dengan spinner animation
- Success/error alerts

#### Security & Privacy Enhancements
- **Auto-cleanup uploaded images**: Screenshot otomatis dihapus setelah transaksi disimpan
- **Memory management**: URL.revokeObjectURL() untuk free browser memory
- **Modal cleanup**: Image dihapus otomatis saat modal ditutup
- **No server upload**: Image hanya di browser, tidak pernah ke Firebase
- **Secure transmission**: OCR via HTTPS ke Vision API
- **Zero storage**: Tidak ada caching atau storage untuk uploaded images

#### Documentation
- Added `QUICK_ADD_SETUP.md` - Panduan lengkap setup Vision API
- Added `VISION_API_QUICKSTART.md` - Quick start guide 5 menit
- Added `QUICK_ADD_EXAMPLES.md` - Contoh penggunaan & best practices
- Added `.env.example` - Template environment variables
- Updated main `README.md` dengan info Quick Add
- Updated feature table di README

### 🐛 Fixed - Duplicate Wallets & Credit Cards (v2.0.1)

#### Critical Bug Fixes
- **FIXED: Race condition causing duplicates**: Completely resolved duplicate wallets/credit cards issue
- **Root cause #1**: `onSnapshot` callback triggered multiple times during async initialization
- **Root cause #2**: `forEach` with `addDoc` creates race condition (all docs added simultaneously)

#### Solutions Implemented (3-Layer Protection):

**Layer 1: Async/Await with Promise.all**
```javascript
// Before (causes race condition):
DEFAULT_WALLETS.forEach(w => addDoc(batchRef, w));

// After (atomic operation):
await Promise.all(DEFAULT_WALLETS.map(w => addDoc(batchRef, w)));
```

**Layer 2: Deduplication on Read**
```javascript
// Check for duplicates by name and filter them out
const uniqueWallets = [];
const seenNames = new Set();
for (const wallet of data) {
  if (!seenNames.has(wallet.name)) {
    seenNames.add(wallet.name);
    uniqueWallets.push(wallet);
  }
}
setWallets(uniqueWallets);
```

**Layer 3: Error Handling with Flag Reset**
```javascript
try {
  await Promise.all(DEFAULT_WALLETS.map(w => addDoc(batchRef, w)));
  console.log('✅ Wallets initialized');
} catch (error) {
  console.error('❌ Error:', error);
  walletsInitialized.current = false; // Reset on error
}
```

#### What Changed:
- ✅ Changed all `forEach + addDoc` to `await Promise.all(map + addDoc)`
- ✅ Added deduplication logic pada read (filter by name)
- ✅ Added error handling dengan flag reset
- ✅ Added console logging untuk debugging
- ✅ Applied fix untuk wallets, investment_types, dan categories

#### For Existing Duplicates:
- Added `CLEANUP_DUPLICATES.md` - Guide untuk cleanup duplikasi yang sudah ada
- 3 cleanup options: Manual (Firebase Console), Script, atau Database Reset

#### Technical Details
- Modified `useEffect` for data sync dengan async callbacks
- Added `if (data.length === 0 && !flag.current)` checks
- Added `else if (data.length > 0)` dengan deduplication
- Reset flags pada user login/logout
- Promise.all ensures atomic batch operations

---

## [1.5.0] - 2026-02-10

### Added
- Salary Allocator feature dengan template system
- Multiple salary sources support
- Apply allocation to budget dengan satu klik
- Allocation visualization dengan pie chart
- Auto-save state functionality

### Changed
- Improved mobile responsiveness
- Updated color scheme untuk better contrast
- Enhanced dark mode support

---

## [1.4.0] - 2026-02-05

### Added
- Subscription management feature
- Auto icon mapping untuk 50+ layanan populer
- Langganan tracking dengan reminder

### Fixed
- Budget calculation accuracy
- Chart rendering issues di mobile

---

## [1.3.0] - 2026-01-28

### Added
- Investment tracking dengan multiple asset types
- Real-time gold price fetching
- Investment progress visualization
- Target setting untuk investment goals

### Changed
- Improved dashboard layout
- Better chart responsiveness

---

## [1.2.0] - 2026-01-20

### Added
- Zakat calculator feature
- Multi-currency support (7 currencies)
- Real-time exchange rate fetching
- Custom category management

### Fixed
- Transaction filtering bugs
- Dark mode color inconsistencies

---

## [1.1.0] - 2026-01-15

### Added
- Budget monitoring dengan alerts
- Privacy mode untuk hide financial data
- Wallet limit tracking untuk credit cards
- Transfer antar akun feature

### Changed
- Improved transaction form UX
- Better error handling

---

## [1.0.0] - 2026-01-01

### Initial Release
- Dashboard dengan analytics
- Transaction management (Income/Expense)
- Wallet/Account management
- Firebase authentication
- Firestore database integration
- Dark mode support
- Responsive design
- Category management

---

## [Unreleased]

### Planned Features
- [ ] Export data ke Excel/PDF
- [ ] Recurring transaction templates
- [ ] Budget recommendations based on AI
- [ ] Bill payment reminders
- [ ] Savings goals tracker
- [ ] Family member accounts
- [ ] Shared expenses tracking
- [ ] Receipt storage di Cloud Storage
- [ ] Notification system
- [ ] Mobile app (React Native)

---

## Notes

### Breaking Changes
- v2.0.0: Requires Google Cloud Vision API setup untuk Quick Add feature
- v1.5.0: Database schema update untuk salary allocator

### Migration Guide

#### From v1.x to v2.0.0
1. Update kode dari repository
2. Run `npm install` untuk dependencies
3. Setup Google Cloud Vision API (optional - untuk Quick Add)
4. Deploy update ke production

#### API Key Management
- Vision API Key disimpan di localStorage
- User perlu input API Key pertama kali
- Tidak ada perubahan pada Firebase config

### Security Updates
- v2.0.0: Added Vision API key restrictions documentation
- v1.3.0: Enhanced Firestore security rules
- v1.0.0: Initial security implementation

---

## Contributors

- [@fauzanalfi](https://github.com/fauzanalfi) - Creator & Maintainer

---

## Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Email: fauzanalfi@example.com
- WhatsApp: [Your number]

---

**Last Updated:** February 12, 2026
