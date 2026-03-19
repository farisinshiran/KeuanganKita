# Changelog

All notable changes to Dompet Keluarga project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-03-20

### 🎨 Redesign — Material Design 3 UI Overhaul

Full visual redesign of every view and the layout shell. The app now uses a cohesive Material Design 3 token system instead of ad-hoc Tailwind color utilities.

#### Design System
- Defined MD3 color roles as Tailwind CSS custom tokens in `tailwind.config.js`: `primary`, `on-primary`, `primary-container`, `on-primary-container`, `secondary-container`, `on-secondary-container`, `tertiary`, `tertiary-fixed`, `surface`, `surface-container-lowest/low/default/high/highest`, `on-surface`, `on-surface-variant`, `outline-variant`, `error-container`, `on-error-container`
- Switched typography to **Manrope** (Google Fonts) throughout
- Switched icon library from **Lucide React** to **Material Symbols Outlined** (variable font, loaded via `index.html`)
- Added `Icon.jsx` wrapper component (`name`, `fill`, `weight`, `size`, `className` props)

#### Layout Shell
- `Sidebar.jsx` — rebuilt with 3-group navigation, MD3 surface containers, active state pill
- `App.jsx` — updated layout shell to match new surface hierarchy

#### Views Restyled (Phase 3 — Core)
- **DashboardView** — MD3 stat cards, chart containers, budget progress bars
- **WalletView** — bento layout, all 6 wallet types, RDN wallet type added
- **InvestmentView** — asset list, P&L badges with `secondary-container` / `error-container`
- **AIAdvisorView** — model switcher overlay, chat bubbles, settings panel

#### Views Restyled (Phase 4 — Planning)
- **SavingsGoalView** — 3-col goal cards, status badge variants
- **EducationFundView** — child pill tabs, 12% inflation roadmap cards
- **CategoryView** — expense/income pill tabs, category tile grid
- **SalaryAllocatorView** — period navigator, hero stat strip, allocation tables, pie chart summary
- **IncomeDiversificationView** — 4-stat strip, active/passive bar, SVG passive-% gauge
- **SalarySlipArchiveView** — OCR upload card, trend chart, slip detail modal with gradient header

#### Views Restyled (Phase 5 — Services)
- **SubscriptionView** — brand-colored icon squares per service, annual projection on every card, 3-stat strip
- **ZakatView** — MD3 source badges (live / cache / default), `secondary-container` nisab card, `from-primary to-primary-container` zakat hero
- **WalletView** (RDN) — Rekening Dana Nasabah added to wallet-type selector
- **AIAdvisorView** (model switcher) — gear → settings overlay with all OR_MODELS preserved
- **TransactionView** (`investment_sale`) — filter chip present for investment-sale transactions

#### Consistent Patterns Established
- Cards: `bg-surface-container-low rounded-2xl p-5`
- Featured / hero cards: `rounded-3xl` with gradient `from-primary to-primary-container`
- Form inputs: `bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20`
- Primary buttons: `bg-primary text-on-primary rounded-xl shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95 transition-all`
- Table rows: `hover:bg-surface-container-high/40`, dividers `divide-outline-variant/10`
- Badges: expense = `error-container`, income = `secondary-container`, investment = `primary-fixed/30`, investment_sale = `tertiary-fixed/30`

---

## [2.1.0] - 2026-03-20

### 🎨 Redesign — Material Design 3 UI Overhaul

Full visual redesign of every view and the layout shell. The app now uses a cohesive Material Design 3 token system instead of ad-hoc Tailwind color utilities.

#### Design System
- Defined MD3 color roles as Tailwind CSS custom tokens in `tailwind.config.js`: `primary`, `on-primary`, `primary-container`, `secondary-container`, `on-secondary-container`, `tertiary`, `tertiary-fixed`, `surface-container-lowest/low/default/high/highest`, `on-surface`, `on-surface-variant`, `outline-variant`, `error-container`, `on-error-container`
- Switched typography to **Manrope** (Google Fonts) throughout
- Replaced **Lucide React** icons with **Material Symbols Outlined** variable font loaded via `index.html`
- Added `src/components/ui/Icon.jsx` wrapper component (`name`, `fill`, `weight`, `size`, `className` props)

#### Layout Shell
- `Sidebar.jsx` rebuilt with 3-group navigation, MD3 surface containers, active state pill
- `App.jsx` layout shell updated to match new surface hierarchy

#### Views Restyled — Core (Phase 3)
- **DashboardView** — MD3 stat cards, chart containers, budget progress bars
- **WalletView** — bento layout, all 6 wallet types including new RDN type
- **InvestmentView** — asset list, P&L badges using `secondary-container` / `error-container`
- **AIAdvisorView** — model switcher settings overlay, chat bubbles

#### Views Restyled — Planning (Phase 4)
- **SavingsGoalView** — 3-col goal cards with status badge variants
- **EducationFundView** — child pill tabs, 12% inflation roadmap cards
- **CategoryView** — expense/income pill tabs, category tile grid
- **SalaryAllocatorView** — period navigator, hero stat strip, allocation tables, pie chart summary
- **IncomeDiversificationView** — 4-stat strip, active/passive bar, SVG passive-% gauge
- **SalarySlipArchiveView** — OCR upload card, trend chart, slip detail modal with gradient header

#### Views Restyled — Services (Phase 5)
- **SubscriptionView** — brand-colored icon squares per service (Netflix, Spotify, GitHub…), annual projection on every card, 3-stat strip
- **ZakatView** — MD3 source badges (live / cache / default), `secondary-container` nisab status card, `from-primary to-primary-container` zakat hero gradient

#### Consistent Patterns
- Cards: `bg-surface-container-low rounded-2xl p-5`
- Hero/featured: `rounded-3xl` + `bg-gradient-to-br from-primary to-primary-container`
- Form inputs: `bg-surface-container-lowest border-none rounded-xl focus:ring-1 focus:ring-primary/20`
- Primary buttons: `bg-primary text-on-primary rounded-xl shadow-lg shadow-primary/20 hover:scale-[0.98] active:scale-95`
- Type badges: expense = `error-container`, income = `secondary-container`, investment = `primary-fixed/30`, investment_sale = `tertiary-fixed/30`

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
