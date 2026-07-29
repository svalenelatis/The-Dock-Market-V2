# Dock Market

An open-source market simulator game. Trade goods between islands, manage your empire of ships, collect factories and goods, and try to make a fortune.

Dock Market is built with the intent of being self-hosted via free online hosting tools — primarily **Vercel** (frontend), **Railway** (backend), and **Supabase** (database & auth).

## Architecture

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────┐
│   Frontend  │──────▶│     Backend     │──────▶│   Supabase   │
│  React/Vite │       │    Express.js   │       │  PostgreSQL  │
│   Vercel    │       │    Railway      │       │  + Auth      │
└─────────────┘       └─────────────────┘       └──────────────┘
```

### Frontend
- **React 18** with React Router for SPA navigation
- **Vite** for dev server and production builds
- **Tailwind CSS** for styling
- Hosted on **Vercel**

### Backend
- **Express.js** REST API
- Admin-protected routes for game management
- Daily update handler for market simulation, transaction resolution, and factory production
- Structured logging with **Pino**
- Hosted on **Railway**

### Database & Auth
- **Supabase** PostgreSQL for all persistent data
- **Supabase Auth** for player and admin authentication
- Row-Level Security policies for data isolation

## Game Systems

- **Dynamic Market** — Prices fluctuate daily via a PID-style simulation algorithm influenced by city tags, supply/demand, and random events
- **Trading** — Buy and sell 18+ item types across 14+ cities with travel time between ports
- **Ships** — Multiple ships with different speeds and cargo capacities
- **Factories** — Production facilities that consume inputs and generate outputs each day
- **Random Events** — Temporary city tags that shake up local market conditions

## Project Structure

```
├── frontend/          React SPA (Vite + Tailwind)
├── backend/           Express API server
│   ├── routes/        API route handlers
│   ├── middleware/    Auth, admin, error handling
│   ├── utils/         Validators, calculations, constants
│   └── lib/           Supabase client, logger, lifecycle
├── docs/              Architecture and implementation docs
└── dataObjects.json   Static game data (cities, items, tags, events)
```

## Getting Started

### Prerequisites
- Node.js 18+
- A Supabase project (free tier works)

### Setup

1. **Clone the repo**
   ```bash
   git clone <repo-url>
   cd dock-market
   ```

2. **Backend**
   ```bash
   cd backend
   cp .env.example .env
   # Fill in your Supabase URL and keys in .env
   npm install
   npm start
   ```

3. **Frontend**
   ```bash
   cd frontend
   cp .env.example .env
   # Fill in your Supabase public URL and anon key in .env
   npm install
   npm run dev
   ```

### Environment Variables

**Backend** (`.env`):
- `SUPABASE_URL` — Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-side only)
- `SUPABASE_ANON_KEY` - Generated anon key
- `PORT` — Server port (default 3000)
- `FRONTEND_URL` - Frontend URL pointer

**Frontend** (`.env`):
- `VITE_SUPABASE_URL` — Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key
- `VITE_API_URL` - Backend URL, Railway if hosted on Railway

## Development

```bash
# Run backend
cd backend && npm start

# Run frontend dev server
cd frontend && npm run dev

# Run tests
cd backend && npm test
cd frontend && npm test
```

## Deployment

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | Connect repo, set root to `frontend/` |
| Backend | Railway | Connect repo, set root to `backend/` |
| Database | Supabase | Free tier, apply migrations |

## License

Open source. See LICENSE for details.
