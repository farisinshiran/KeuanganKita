<div align="center">

# 💰 Dompet Keluarga

**Personal & Family Finance Management — Built with React + Firebase**

*Dompet Keluarga* ("Family Wallet") is a full-featured, cloud-synced personal finance web app for Indonesian families. Track transactions, investments, savings goals, budgets, and subscriptions — all from one place.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=for-the-badge&logo=github)](https://fauzanalfi.github.io/dompet-keluarga)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Firebase](https://img.shields.io/badge/Firebase-Firestore-FFA611?style=for-the-badge&logo=firebase&logoColor=white)](https://firebase.google.com)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38BDF8?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com)

</div>

---

## ✨ Features

### 📊 Dashboard & Analytics
| Feature | Description |
|---|---|
| **Financial Health Score** | 0–100 score based on savings rate, budget adherence, debt ratio, and investment coverage |
| **Cash Flow Trend** | 6-month income vs. expense line chart |
| **Asset Growth** | Area chart tracking investment portfolio growth |
| **Month-over-Month** | Grouped bar chart comparing top spending categories vs. prior month |
| **Budget Monitoring** | Real-time progress bars with alerts at 90% threshold |
| **Per-Account Balances** | Scrollable snapshot of all wallets with credit-limit indicators |

### 💳 Transactions
- Income, Expense, and Transfer between accounts
- Filter by date range and wallet
- **Export to CSV** (UTF-8 BOM for Excel compatibility)
- Automatic categorisation with full edit history

### 👛 Wallets
- **Bank**, **Cash**, **Credit Card** (with limit tracking), **E-Wallet**, **PayLater** (GoPay Later, Kredivo, etc.)
- Custom name, icon, and emoji support
- Running balance computed from transaction history

### 🎯 Savings Goals
- Set a name, target amount, target date, and linked wallet
- Progress bar with months remaining and required monthly contribution
- Status badges: On Track / Needs Attention / Overdue / Achieved

### 📅 Budget Wizard & Salary Allocator
- **5-step Budget Wizard**: choose 50/30/20, 70/20/10, or fully custom % splits
- Per-category monthly allocation with auto-save to Firestore
- **Salary Allocator**: multi-source income, carry-over from previous month, pie-chart visualisation
- Monthly transaction history table with totals

### 📈 Investments
- Gold, stocks, mutual funds, and custom asset types
- Market value tracking with unrealised P&L per asset
- Zakat calculator with real-time gold-price integration

### 📺 Subscriptions
- Auto-icon mapping for 50+ popular services (Netflix, Spotify, Adobe, GitHub…)
- Renewal date tracking and monthly cost summary

### 🤖 AI Financial Advisor
- Chat interface powered by **Google Gemini** or any **OpenRouter** model (incl. free Llama 3.3, Qwen3)
- Contextual prompts auto-populated with your current financial snapshot
- API keys stored only in `localStorage` — never sent to the app server

### 📸 Quick Add — Receipt Scanner
- Upload a receipt screenshot → Google Cloud Vision OCR extracts line items automatically
- Multi-transaction preview table: edit amount, category, account, date
- Privacy-first: the image is deleted from memory immediately after saving; it is **never** stored in Firebase

### 🌐 Other
| | |
|---|---|
| **Multi-currency** | IDR, USD, SGD, EUR, MYR, JPY, AUD with live exchange rates |
| **Bahasa / English** | Full i18n toggle |
| **Dark mode** | Full dark theme across all views |
| **Privacy mode** | Replace all numbers with bullets ( • ) |
| **Education Fund** | Dedicated savings planner for education costs |
| **Income Diversification** | Track multiple income streams |
| **Salary Slip Archive** | Store and parse payslip PDFs |
| **Google Sign-In** | Firebase Auth — one-click, no passwords |
| **Real-time sync** | `onSnapshot` Firestore listeners |
| **Mobile-first** | Responsive layout with pull-to-refresh |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 7 |
| Styling | Tailwind CSS v3 |
| Database | Firebase Firestore (real-time) |
| Auth | Firebase Authentication (Google OAuth 2.0) |
| Charts | Recharts |
| Icons | Lucide React |
| AI | Google Gemini API, OpenRouter API |
| OCR | Google Cloud Vision API |
| i18n | Custom `useI18n` hook + `translations.js` |

---

## 🚀 Getting Started

### Prerequisites
- **Node.js ≥ 18**
- A [Firebase project](https://console.firebase.google.com) (free Spark plan is sufficient)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/dompet-keluarga.git
cd dompet-keluarga
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and paste your Firebase project values (found in **Project Settings → General → Your apps → SDK setup**):

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=my-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=my-project
VITE_FIREBASE_STORAGE_BUCKET=my-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
VITE_APP_ID=dompet-keluarga   # Firestore root namespace — change freely
```

### 3. Enable Google Sign-In

1. Firebase Console → **Authentication → Sign-in method**
2. Enable **Google**
3. Add `http://localhost:5173` to **Authorized domains**

### 4. Deploy Firestore security rules

```bash
# Install Firebase CLI if needed
npm install -g firebase-tools
firebase login

# Copy .env.example to .firebaserc (fill in your project ID), then:
firebase deploy --only firestore:rules
```

Or paste the contents of [`firestore.rules`](firestore.rules) manually in the Firebase Console.

### 5. Run locally

```bash
npm run dev
# → http://localhost:5173
```

---

## 🌐 Deploy

### Demo Mode (GitHub Pages without Firebase)

The app has a built-in **Demo Mode** that activates automatically when `VITE_FIREBASE_API_KEY` is not set.  
In Demo Mode:

- No Firebase account or project required — works fully offline
- All data is stored in **`localStorage`** on the visitor's browser
- A banner is shown at the top of the app making it clear it is a demo
- The Firebase SDK is completely excluded from the bundle (saves ~340 KB)
- Sign-in is instant with a pre-populated "Demo User"
- `vite.config.js` aliases `firebase/app`, `firebase/auth`, and `firebase/firestore` to stubs in `src/lib/` — no view or hook files need any demo-specific branching
- The Firestore mock supports: `collection`, `doc`, `addDoc`, `setDoc`, `updateDoc`, `deleteDoc`, `getDoc`, `getDocs`, **`writeBatch`**, `onSnapshot`, `serverTimestamp`, `increment`, `arrayUnion`, `arrayRemove`, `where`, `orderBy`, `query`

To deploy the live demo on GitHub Pages:

1. **Push the repo to GitHub.**
2. Enable Pages: **Settings → Pages → Source → GitHub Actions**
3. **Do NOT add any Firebase secrets** — leave them all blank (or simply skip step 3 of Option A)
4. Push to `main` → the workflow builds and deploys automatically in Demo Mode

### Option A — GitHub Pages (with Firebase backend)

For a fully functional deployment where each user has their own cloud-synced data:

1. **Push the repo to GitHub.**

2. Enable Pages: **Settings → Pages → Source → GitHub Actions**

3. Add your Firebase credentials as repository secrets:
   **Settings → Secrets and variables → Actions → New repository secret**

   | Secret name | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | Your API key |
   | `VITE_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
   | `VITE_FIREBASE_PROJECT_ID` | `your-project` |
   | `VITE_FIREBASE_STORAGE_BUCKET` | `your-project.firebasestorage.app` |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID |
   | `VITE_FIREBASE_APP_ID` | App ID |
   | `VITE_FIREBASE_MEASUREMENT_ID` | `G-XXXXXXXXXX` |
   | `VITE_APP_ID` | `dompet-keluarga` |

4. **Push to `main`** → the [deploy workflow](.github/workflows/deploy.yml) builds and publishes automatically.

5. Add the Pages URL to Firebase Auth **Authorized domains** (e.g. `YOUR_USERNAME.github.io`).

> The workflow automatically sets `VITE_BASE_URL=/dompet-keluarga/` so all asset paths resolve correctly under the sub-path.

### Option B — Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

### Option C — Any static host (Netlify, Vercel, Cloudflare Pages…)

```bash
npm run build   # output: dist/
```

Upload the `dist/` folder. For Netlify/Vercel, set the build command to `npm run build` and publish directory to `dist`. Remember to add the hosting domain to Firebase Auth **Authorized domains**.

---

## 📁 Project Structure

```
dompet-keluarga/
├── .env.example                # Environment variable template
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions — build & deploy to Pages
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Firestore composite indexes
├── public/
│   └── manifest.json           # PWA manifest
└── src/
    ├── App.jsx                 # Root: auth, routing, global state
    ├── config/
    │   └── firebase.js         # Firebase initialisation (env-var driven)
    ├── lib/
    │   ├── demoApp.js          # firebase/app stub (demo mode)
    │   ├── demoAuth.js         # firebase/auth stub — auto-logs in "Demo User"
    │   └── demoDb.js           # localStorage-backed Firestore mock (collection, doc,
    │                           #   addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
    │                           #   writeBatch, onSnapshot, serverTimestamp, increment,
    │                           #   arrayUnion, arrayRemove, where, orderBy, query…)
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.jsx         # Navigation sidebar + MobileMenu + AppFooter
    │   │   └── AIAdvisorPanel.jsx  # Slide-in AI chat panel
    │   ├── modals/
    │   │   ├── BudgetWizard.jsx       # 5-step budget setup wizard
    │   │   ├── TransactionModal.jsx   # Add/edit transaction
    │   │   └── QuickAddModal.jsx      # Receipt scanner (Vision API)
    │   ├── ui/
    │   │   ├── index.jsx       # Shared UI primitives (Card, NavBtn…)
    │   │   └── LoginPage.jsx
    │   └── views/              # Full-page view components (lazy-loaded)
    │       ├── DashboardView.jsx
    │       ├── TransactionView.jsx
    │       ├── WalletView.jsx
    │       ├── SavingsGoalView.jsx
    │       ├── AIAdvisorView.jsx
    │       ├── InvestmentView.jsx
    │       ├── SalaryAllocatorView.jsx
    │       ├── SubscriptionView.jsx
    │       ├── CategoryView.jsx
    │       ├── ZakatView.jsx
    │       └── ...
    ├── constants/              # Category lists, currency config, service icons
    ├── hooks/
    │   └── useAppData.js       # Firestore onSnapshot listeners for all collections
    ├── i18n/
    │   ├── I18nContext.jsx
    │   └── translations.js     # Indonesian + English strings
    └── utils/
        ├── api.js              # External API helpers (exchange rate, gold price)
        ├── formatters.js       # Currency & date formatting (Intl API)
        ├── healthScore.js      # Financial Health Score calculator
        └── parsers/            # Receipt / Vision API parsing utilities
```

---

## 🗄 Database Schema

All data lives under `/artifacts/{VITE_APP_ID}/users/{uid}/`:

| Collection | Description |
|---|---|
| `transactions` | Income, expense, transfer records |
| `wallets` | Account definitions (bank, CC, e-wallet…) |
| `categories` | Custom categories with monthly budget |
| `subscriptions` | Recurring service subscriptions |
| `investments` | Individual investment positions |
| `investmentTypes` | Custom asset types (gold, stocks…) |
| `savings_goals` | Savings targets with progress tracking |
| `monthly_controls/{month}` | Salary allocation snapshots per month |
| `settings/visionApi` | Vision API key (user-scoped, encrypted by Firestore rules) |

---

## 🔒 Security

- **No secrets in source code** — all credentials loaded via `import.meta.env` from `.env.local` (git-ignored).
- **Firestore rules enforce per-user isolation** — users can only read/write their own documents (`request.auth.uid == userId`).
- **AI API keys are localStorage-only** — never persisted to Firestore or transmitted to any first-party server.
- **Vision API images are ephemeral** — deleted from memory immediately after transaction extraction; never written to Firebase Storage.
- **`.firebaserc` is git-ignored** — your Firebase project alias stays local.

See [`PRIVACY_SECURITY.md`](PRIVACY_SECURITY.md) for a full security audit.

---

## 🤝 Contributing

Contributions are welcome! Here's how:

1. **Fork** the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with a clear message: `git commit -m 'feat: add your feature'`
4. Push and open a **Pull Request** against `main`

Please follow these guidelines:
- Keep PRs focused — one feature or fix per PR
- Run `npm run lint` before pushing
- Don't commit `.env.local` or `dist/`

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [React](https://react.dev) — UI library
- [Vite](https://vitejs.dev) — Build tool
- [Firebase](https://firebase.google.com) — Auth & database
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Recharts](https://recharts.org) — Chart library
- [Lucide Icons](https://lucide.dev) — Icon set
- [Budggt](https://budggt.com) — Feature inspiration

---

<div align="center">

**Dompet Keluarga** — Kelola Keuangan Keluarga dengan Bijak 💚

Made with ❤️ for Indonesian families

</div>


