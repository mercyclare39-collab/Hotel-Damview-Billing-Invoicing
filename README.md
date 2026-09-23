# 🏨 Hotel Damview - Enterprise Billing, Invoicing & Google ERP Suite

An offline-first, production-grade billing, invoicing, quotation, receipt, and client account management application designed for **Hotel Damview** (Machakos, Kenya). Features real-time vector PDF generation, client statements of account, POS sales, and background synchronization with Google Workspace (Google Sheets & Google Drive).

---

## 🚀 Key Features

- **Offline-First Architecture**: Powered by IndexedDB and dual-tier L1 synchronous caching for zero latency.
- **Dynamic A4 PDF Generator**: Live vector-rendered Invoices, Proformas, Quotations, Receipts, and Statements of Account with customizable Hotel Damview header, official KRA PIN, and bank details.
- **Google Workspace Sync**: Automatic and manual sync to Google Sheets (11 dynamic tabs) and PDF document archival to Google Drive.
- **Progressive Web App (PWA)**: Installable on Desktop, iOS, and Android devices with offline service worker support.
- **Point of Sale (POS) & Restaurant Module**: Itemized order generation for dining, bar, and conference events.
- **Audit Logging & Tombstones**: Zero orphaned files and durable tombstone protection against deleted record resurrections.
- **Customizable Settlement Accounts**: Easily configure or clear bank accounts and M-Pesa Till credentials in Hotel Settings.

---

## 💼 Business Details & Settings

Default business details configured in application settings:

- **Hotel Name**: HOTEL DAMVIEW
- **Tagline**: Scenic Luxury, Conferences & Dining by Maruba Dam
- **KRA PIN**: P051982741Z
- **Email**: `reservations@damviewhotel.co.ke`
- **Phone**: `+254 722 890 123` / `+254 733 456 789`
- **Location**: Off Machakos-Wote Road, Adjacent to Maruba Dam, Machakos
- **Bank & Settlement Accounts**: Customizable or optional via **Hotel Settings > Bank & Settlement Accounts**.

---

## 🛠️ Local Development & GitHub Setup

### Prerequisites
- Node.js >= 20.0.0 (Supports Node 24+)
- npm / yarn / pnpm

### Quick Start
```bash
# Clone repository
git clone https://github.com/your-username/hotel-damview-erp.git
cd hotel-damview-erp

# Install dependencies
npm install

# Start local full-stack dev server (Express + Vite)
npm run dev
```

### Building for Production / CI
```bash
# Type-check and lint
npm run lint

# Build full-stack application bundle (Vite client + Express server)
npm run build

# Start production server
npm run start
```

---

## 📁 Repository Structure

```
├── src/
│   ├── components/        # React UI modules (Invoices, POS, Settings, Drive, Ledger, etc.)
│   ├── services/          # StorageEngine (IndexedDB), SyncManager (Google Workspace), BackupService
│   ├── types.ts           # Shared TypeScript interfaces & types
│   └── utils/             # Vector PDF generators & export utilities
├── server.ts              # Node/Express production & development entry point
├── Code.gs                # Google Apps Script for Google Workspace backend integration
├── index.html             # Application HTML entry point
├── package.json           # Dependencies and build scripts
├── vite.config.ts         # Vite configuration & PWA manifest setup
└── .gitignore             # Standard git ignore list
```

---

## 📄 Deploying Google Apps Script (`Code.gs`)

1. Open your Google Sheet named **Hotel Damview ERP**.
2. Click **Extensions > Apps Script**.
3. Replace the content in `Code.gs` with the `Code.gs` script included in this repository.
4. Click **Deploy > Manage deployments > Edit (Pencil icon) > New version**.
5. Set **Execute as**: `Me` and **Who has access**: `Anyone`.
6. Click **Deploy**, authorize permissions, and copy the **Web App URL**.
7. Paste the Web App URL into the **Google Workspace Sync** module in Hotel Settings.

---

## 📜 License

Private & Proprietary - All rights reserved by **Hotel Damview Enterprises Ltd**.
