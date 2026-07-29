# Backend Authentication Architecture

## Overview

The backend uses **two types of Supabase clients** for different purposes:

1. **Service Role Client** (global singleton) — for privileged operations that bypass Row Level Security
2. **Per-Request User Client** — for JWT verification and potential user-scoped queries

## How Authentication Works

```
Frontend                    Backend                         Supabase
   │                          │                               │
   │ 1. User logs in          │                               │
   │─────────────────────────────────────────────────────────>│
   │                          │                               │
   │ 2. Gets JWT back         │                               │
   │<─────────────────────────────────────────────────────────│
   │                          │                               │
   │ 3. Sends request with    │                               │
   │    Authorization: Bearer │                               │
   │─────────────────────────>│                               │
   │                          │                               │
   │                          │ 4. Creates per-request client │
   │                          │    with user's JWT            │
   │                          │                               │
   │                          │ 5. Calls getClaims(token)     │
   │                          │    (verifies locally via JWKS │
   │                          │     — no network round-trip)  │
   │                          │                               │
   │                          │ 6. Extracts user ID from      │
   │                          │    claims.sub                 │
   │                          │                               │
   │ 7. Response              │                               │
   │<─────────────────────────│                               │
```

## JWT Verification: `getClaims()` vs `getUser()`

We use `getClaims()` instead of the older `getUser()` approach:

| | `getClaims()` (current) | `getUser()` (old) |
|---|---|---|
| **Speed** | Local verification via cached JWKS | Network request every time |
| **Network** | One-time JWKS fetch, then cached | Round-trip per request |
| **Revocation** | Doesn't detect revoked tokens until expiry | Catches revoked tokens immediately |
| **Signing Keys** | Requires asymmetric keys (default for new projects) | Works with any key type |

The tradeoff (no immediate revocation detection) is acceptable for a game — tokens expire within an hour, and the performance gain matters more for frequent player actions.

## Client Architecture

### Service Role Client (`backend/lib/supabase.js`)

```js
const supabase = require('./lib/supabase')

// Use for admin/system operations
const { data } = await supabase.from('players').select('*')
```

- Bypasses RLS entirely
- Used by admin routes and system tasks
- Single instance shared across the app
- **Never** send this client or its key to the frontend

### Per-Request User Client (`createUserClient`)

```js
const { createUserClient } = require('./lib/supabase')

const userClient = createUserClient(jwtToken)
const { data } = await userClient.auth.getClaims(jwtToken)
```

- Scoped to a single user's JWT
- Created fresh per request in the auth middleware
- Available on `req.userClient` after auth middleware runs
- Respects RLS if used for database queries

## Auth Middleware Flow

The middleware (`backend/middleware/auth.js`) runs on all authenticated routes:

1. Extracts Bearer token from `Authorization` header
2. Creates a per-request Supabase client scoped to that token
3. Calls `getClaims(token)` to verify the JWT
4. On success: attaches `req.userId` and `req.userClient` to the request
5. On failure: returns 401 (bad token) or 500 (service unavailable)

### What's available after auth middleware

```js
router.post('/some-action', authMiddleware, async (req, res) => {
  req.userId      // The verified user's UUID (from claims.sub)
  req.userClient  // A Supabase client scoped to this user's session
})
```

## Environment Variables

| Variable | Purpose | Where to find |
|---|---|---|
| `SUPABASE_URL` | Project URL | Dashboard > Settings > API |
| `SUPABASE_ANON_KEY` | Public key for per-request clients | Dashboard > Settings > API > anon/public |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged key for admin operations | Dashboard > Settings > API > service_role |

## When to Use Which Client

| Scenario | Client |
|---|---|
| Verifying a user's JWT | Per-request (`req.userClient`) |
| Reading user-scoped data with RLS | Per-request (`req.userClient`) |
| Admin operations (manage users, system updates) | Service role (`require('./lib/supabase')`) |
| Daily batch processing | Service role |
| Anything that bypasses RLS | Service role |

## Security Notes

- The **anon key** is safe to include in per-request clients — it has minimal permissions by default and RLS still applies
- The **service role key** must never be exposed; it bypasses all RLS
- `getClaims()` relies on your project using **asymmetric JWT signing keys** (the default). If you're on symmetric keys, it falls back to a server-side call automatically
- Tokens are short-lived (default 1 hour). A revoked token will stop working after expiry even without `getUser()` checks
