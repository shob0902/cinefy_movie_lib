# Cinefy

**Discover movies like you mean it.** Browse trending, search ruthlessly, filter obsessively, save forever.

## The Pitch

Full-stack movie discovery: React UI → Express API → SQLite wishlist → TMDB data. Offline-first caching, instant prefetch, your list survives the app closing.

---

## Quick Start

```bash
npm install
cp server/.env.example server/.env
# Add TMDB_ACCESS_TOKEN from https://www.themoviedb.org/settings/api
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/health

---

## What's Clever

| Feature | How |
|---------|-----|
| **Search + Browse unified** | One endpoint that picks the strategy (discover, search, windowed search with filters) |
| **Instant context restore** | URL state + scroll memory + page cache = back button works perfectly |
| **Windowed search** | Filter/sort a text query by scanning the 100 most relevant results, not all thousands |
| **Two-tier cache** | In-memory LRU + SQLite = warm restarts, survives TMDB outages with stale data |
| **Wishlist snapshots** | Save the movie as it appeared when you clicked it — works offline, never vanishes from your list |
| **Resilient by default** | Circuit breaker, token bucket limiter, abort propagation, retry with backoff, lenient parsing |

---

## Architecture

```
Browser (React + React Query)
    ↓ /api/* (debounced, abortable)
Express API (routes → services → TMDB)
    ↓ (single-flight, retries, cache)
LayeredCache (memory LRU + SQLite TTLs)
    ↓ (stale-while-revalidate, stale-if-error)
SQLite (wishlist + cache table)
```

**Key boundary:** TMDB types stop at `server/src/tmdb/`. Everything above speaks the domain model, so swapping the data source costs one new client.

---

## Deploy

| Service | Setup |
|---------|-------|
| **Render** (API) | Build: `npm ci --include=dev && npm run build --workspace server` |
| **Netlify** (Web) | Auto from `netlify.toml` — proxies `/api/*` to Render |

Env: `TMDB_ACCESS_TOKEN` (required), `NODE_ENV=production`, `NODE_VERSION=22`, `CORS_ORIGINS=https://<site>.netlify.app`

 Free tier: SQLite on ephemeral disk (wishlists reset on redeploy), ~50s cold start.

---

## Made With

**Server:** Express, Zod, better-sqlite3, built primitives (cache, breaker, limiter, single-flight).  
**Client:** React, React Router, React Query.  
No bloat. Behaviour is explicit and testable.

---

## Known Edges

- Windowed search: filters + sort apply to the 100 most relevant, not all results
- Wishlist snapshots: stale until re-saved
- Paging caps at 500 (TMDB hard limit)
- Genre filters are OR, not AND

---

## Next

1. Tests (Vitest + Playwright)
2. Redis for multi-process scaling
3. Real accounts + cross-device wishlist
4. List virtualisation for 1000s of cards
