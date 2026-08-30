# 🩸 FindMyDonor

**India's real-time emergency blood donor matching platform.**

FindMyDonor connects blood requesters with verified donors in real time — powered by intelligent matching, instant WhatsApp/email alerts, and a live institutional blood bank network.

> 🔴 **Live at** [findmydonor.online](https://findmydonor.online)

---

## ✨ Features

### For Requesters
- **Emergency Blood Requests** — Submit a request with blood group, location, and urgency
- **Smart Donor Matching** — Intelligent engine matches compatible donors by proximity, availability, and blood group compatibility
- **Real-Time Tracking** — Track your request status with live updates
- **Requester Portal** — Dashboard to manage active requests, view matched donors, and track fulfillment

### For Donors
- **Quick Registration** — Register with blood group, location, and availability preferences
- **Instant Alerts** — Get notified via WhatsApp and email when someone nearby needs your blood group
- **Donor Dashboard** — View match history, donation records, manage profile and notification settings
- **Privacy Controls** — Full control over what personal information is shared

### For Institutions (Beta)
- **Hospital & Blood Bank Registration** — Dedicated onboarding for medical institutions
- **Live Inventory Dashboard** — Real-time view of donor availability and blood stock
- **Camp Management** — Organize and track blood donation camps
- **Emergency Console** — Priority matching for critical/urgent hospital requirements
- **Worklist & Request Management** — Institutional workflow for handling incoming blood requests

### Platform
- **Bilingual** — Full Hindi (हिन्दी) and English support
- **Admin Console** — Comprehensive admin panel with user/donor/request management, system stats, and moderation tools
- **Blood Compatibility Hub** — Interactive guide showing donor-recipient compatibility for all 8 blood groups
- **City Donor Directory** — Browse registered donors by city
- **Blood Bank Directory** — Find nearby blood banks across India

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19 · TypeScript · Vite · Tailwind CSS v4 · Framer Motion |
| **Backend** | Express.js · TypeScript · tsx |
| **Database** | Upstash Redis (serverless, REST-based) |
| **Auth** | Firebase Authentication (Email/Password + Google) |
| **Notifications** | WhatsApp via WAHA · Email via Resend |
| **Maps** | Leaflet.js |
| **Charts** | Recharts |
| **AI** | Google GenAI SDK |
| **Deployment** | Node.js 20+ · PM2 (production) |

---

## 📁 Project Structure

```
├── src/                    # Frontend (React + Vite)
│   ├── components/
│   │   ├── home/           # Landing page (Hero, Navbar, Footer)
│   │   ├── hospital/       # Institutional dashboard & views
│   │   ├── admin/          # Admin console & views
│   │   ├── DonorDashboard/ # Donor dashboard components
│   │   ├── RequesterPortal/# Requester portal components
│   │   ├── rev3/           # Auth flows (onboarding wizards)
│   │   └── AuthHub/        # Auth intent selector
│   ├── lib/                # Contexts, auth, API helpers, translations
│   ├── data/               # Static data (hospitals, pincodes)
│   └── types.ts            # Shared TypeScript types
│
├── backend/                # Backend (Express API)
│   ├── routes/             # API route handlers
│   ├── services/           # Matching engine & business logic
│   ├── helpers/            # Utility functions
│   ├── middleware/         # Auth middleware
│   ├── worker/             # Background workers (sweep, cleanup)
│   ├── src/lib/            # Store, email, messaging services
│   └── tests/              # Test suite
│
├── public/                 # Static assets
├── data/                   # Runtime data (gitignored)
├── data-test/              # Test fixtures
├── scripts/                # Utility scripts
└── skills/                 # Agent skills & documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **npm** (comes with Node.js)
- A **Firebase** project with Authentication enabled
- An **Upstash Redis** database
- (Optional) **WAHA** instance for WhatsApp notifications
- (Optional) **Resend** account for email notifications

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Stealmount/FindMyD0n0r.git
   cd FindMyD0n0r
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Fill in the required values in `.env` — see the [Environment Variables](#-environment-variables) section below.

4. **Start development server**
   ```bash
   npm run dev
   ```
   This starts both the API server (port 5001) and Vite dev server (port 5173) concurrently.

5. **Open in browser**
   ```
   http://localhost:5173
   ```

---

## 🔑 Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_URL` | ✅ | Public application URL |
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | ✅ | Firebase Admin SDK service account email |
| `FIREBASE_PRIVATE_KEY` | ✅ | Firebase Admin SDK private key |
| `VITE_FIREBASE_*` | ✅ | Firebase frontend config (6 values) |
| `UPSTASH_REDIS_REST_URL` | ✅ | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ | Upstash Redis auth token |
| `ADMIN_EMAIL` | ✅ | Admin panel login email |
| `ADMIN_PASSWORD` | ✅ | Admin panel login password |
| `WAHA_BASE_URL` | ⬜ | WAHA WhatsApp API base URL |
| `WAHA_API_KEY` | ⬜ | WAHA API authentication key |
| `RESEND_API_KEY` | ⬜ | Resend email API key |
| `RESEND_SENDER_EMAIL` | ⬜ | Sender email for notifications |

See [`.env.example`](.env.example) for the full list with inline documentation.

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + Vite dev server (concurrently) |
| `npm run dev:api` | Start only the API server |
| `npm run dev:web` | Start only the Vite frontend |
| `npm run build` | Production build (frontend + backend) |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |
| `npm test` | Run the full test suite |
| `npm run test:auth` | Run auth tests only |
| `npm run test:matching` | Run matching engine tests only |
| `npm run test:all` | Run all test files |

---

## 🧪 Testing

```bash
# Run the full P0 test suite
npm test

# Run specific test suites
npm run test:auth
npm run test:matching
npm run test:security

# Run all tests (including non-P0)
npm run test:all
```

Tests use Node's built-in test runner with `tsx` and run against a test-namespaced Upstash instance (`fmdt:` prefix).

---

## 🏗️ Deployment

### Production Build
```bash
npm run build
```
This produces:
- `dist/` — Vite frontend bundle (static files)
- `dist/server.cjs` — Bundled Express backend

### PM2 (Production)
```bash
pm2 start ecosystem.config.cjs
```

---

## 🤝 Contributing

This is a private repository. For access or collaboration inquiries, reach out to the maintainers.

---

## 📄 License

All rights reserved. This is proprietary software.

---

<p align="center">
  <strong>FindMyDonor</strong> — Every second counts. Every donor matters. 🩸
</p>
