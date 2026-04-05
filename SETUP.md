# TeachMap — Setup Guide

## Prerequisites
- Node.js 18+
- npm 9+
- Supabase account
- Anthropic (Claude) API key
- Perplexity API key
- Mapbox account

---

## 1. Clone & Install

```bash
# Install root devDependencies (concurrently)
npm install

# Install server and client dependencies
npm run install:all
```

---

## 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/migrations/001_initial.sql`
3. Copy your **Project URL** and **Service Role Key** from Settings → API

---

## 3. Environment Variables

**Server** — copy `server/.env.example` to `server/.env` and fill in:
```
CURRICULLM_API_KEY=your_curricullm_key...
PERPLEXITY_API_KEY=pplx-...
MAPBOX_TOKEN=pk.eyJ1...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
PORT=3001
```

**Client** — copy `client/.env.example` to `client/.env` and fill in:
```
REACT_APP_MAPBOX_TOKEN=pk.eyJ1...
REACT_APP_SUPABASE_URL=https://xxx.supabase.co
REACT_APP_SUPABASE_ANON_KEY=eyJ...
```

---

## 4. Run the App

```bash
# From the root directory, run both server and client concurrently
npm run dev
```

- **Client**: http://localhost:3000
- **Server API**: http://localhost:3001

---

## Architecture

```
teachmap/
├── client/          # React + Tailwind frontend
│   └── src/
│       ├── App.js
│       ├── services/api.js        # All API calls to the Express server
│       └── components/
│           ├── Onboarding/        # 3-step fingerprint flow
│           ├── MapView/           # Mapbox map + sidebar
│           ├── Scorecard/         # Slide-out trust scorecard
│           ├── CompanionGuide/    # Localisation guide
│           ├── ClassPulse/        # Post-use feedback
│           └── CrossInstitution/  # Import from external URL
└── server/          # Express API
    ├── routes/
    │   ├── fingerprint.js   # POST /api/fingerprint
    │   ├── resources.js     # POST /api/resources/search, /localise, /save
    │   ├── pulse.js         # POST /api/pulse
    │   └── import.js        # POST /api/import
    └── services/
        ├── claude.js        # Anthropic SDK calls
        ├── perplexity.js    # Perplexity API calls
        └── supabase.js      # Supabase client
```

## API Keys Notes

- **CurricuLLM**: Get from console.curricullm.com — model auto-selected based on teacher location (AU, AU-VIC, AU-WA, NZ)
- **Perplexity**: Get from perplexity.ai/settings/api
- **Mapbox**: Get from account.mapbox.com — create a public token
- **Supabase**: Service role key for server (never expose to client), anon key for client
