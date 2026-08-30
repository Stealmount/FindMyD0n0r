# Backend Architecture — FindMyDonor

Express.js API server (`server.ts`) built with TypeScript, bundled with esbuild, deployed under PM2.

---

## Key Files

| File | Purpose |
|------|---------|
| `server.ts` | Main API server (port 5000) |
| `admin-server.ts` | Legacy redundant admin server (port 6001) — pending retirement; the live admin console is `AdminConsole.tsx` in `src/components/admin/`, which talks to `routes/admin.ts` mounted in the main server. `AdminDashboard.tsx` was removed. |
| `src/lib/firebase.ts` | Firebase Admin SDK initialization (Firestore + Auth) |
| `src/lib/serverDb.ts` | Firestore helper functions (getDoc, saveDoc, getCollection, etc.) |
| `src/lib/redisCache.ts` | Redis caching layer |
| `src/lib/matching.ts` | Matching engine logic |
| `src/lib/waha.ts` | WhatsApp WAHA integration |
| `src/lib/geo.ts` | Haversine distance + pincode geolocation |
| `middleware/auth.ts` | Firebase ID token verification + profile resolution |
| `middleware/jwt.ts` | Admin JWT verification |
| `middleware/rateLimiter.ts` | Rate limiting |
| `middleware/security.ts` | CORS, helmet, security headers |

---

## API Endpoints

### Auth
- `GET /api/auth/me` — Current user profile + donor status
- `POST /api/auth/complete-verification` — Google OAuth profile completion

### Onboarding
- `POST /api/onboarding/basic` — Save basic profile
- `POST /api/onboarding/intent` — Set user intent

### Donor
- `GET /api/donor/profile` — Get donor profile
- `PUT /api/donor/profile` — Update donor profile
- `PATCH /api/donor/availability` — Toggle availability

### Blood Requests
- `POST /api/requests` — Create blood request
- `POST /api/requests/:id/broadcast` — Broadcast to donors
- `GET /api/requester/requests` — Requester's requests + matches
- `PATCH /api/requests/:code/fulfill` — Mark fulfilled

### Matching
- `POST /api/matching/accept` — Donor accepts
- `POST /api/matching/decline` — Donor declines

### Tracking
- `GET /api/tracking/:code` — Public request tracking

### Institutions
- `POST /api/institutions/register` — Register institution
- `GET /api/institutions/me` — My institution

### Admin
- `POST /api/admin/verify-key` — Admin auth
- `GET /api/admin/*` — Platform management

### Health
- `GET /api/health` — System health check

---

## Running Locally

```bash
npm run dev           # Start backend server
npm run test          # Core tests
npm run test:all      # All tests
npm run test:matching # Matching tests
```
