# Cinefy — Movie Discovery

A full-stack movie discovery app: browse and search a large catalogue, filter and
sort it, open a film for details, and keep a wishlist that survives closing the
app.

React + TypeScript on the front, Node + Express + SQLite on the back, TMDB as the
data source. The browser never talks to TMDB directly.

---

## Contents

- [Quick start](#quick-start)
- [What it does](#what-it-does)
- [Architecture](#architecture)
- [API reference](#api-reference)
- [Technical decisions](#technical-decisions)
- [Handling the real world](#handling-the-real-world)
- [Data model](#data-model)
- [Assumptions](#assumptions)
- [Known limitations](#known-limitations)
- [Use of AI](#use-of-ai)
- [With more time](#with-more-time)

---

## Quick start

**Requirements:** Node 20.11+ (Node 22 LTS recommended) and npm 10+.

```bash
# 1. install (npm workspaces — one install covers both packages)
npm install

# 2. configure the backend
cp server/.env.example server/.env
#    then open server/.env and set TMDB_ACCESS_TOKEN

# 3. run both processes
npm run dev
```

- Web app → <http://localhost:5173>
- API → <http://localhost:4000/api/health>

### Getting a TMDB key

1. Create a free account at <https://www.themoviedb.org/>.
2. Go to **Settings → API** and request a key (choose "Developer"; any
   non-commercial description is accepted).
3. Copy the **API Read Access Token** (the long `eyJ…` JWT) into
   `TMDB_ACCESS_TOKEN` in `server/.env`.

The short v3 API key also works — put it in `TMDB_API_KEY` instead. The v4 token
is preferred because it travels in an `Authorization` header rather than the
query string, which keeps the credential out of URLs, logs and cache keys.

Without a key the server still starts, logs a warning, and every movie endpoint
returns `503 NOT_CONFIGURED`; the UI shows a message saying exactly that rather
than a generic failure.

### Other commands

```bash
npm run build       # typecheck + compile server, bundle client
npm run typecheck   # both packages
npm run smoke       # fixture checks for the parsing + cache logic
npm start           # run the compiled server (after npm run build)
```

---

## What it does

| Requirement | Where it lives |
| --- | --- |
| Discover without searching | Trending spotlight + popular grid on load — `BrowsePage`, `HeroSpotlight` |
| Search | Debounced input → `GET /api/movies?q=` |
| Explore by category | Genre chips, year range, minimum rating — `FilterBar` |
| Reorder results | Six sort modes, pushed to TMDB where possible |
| Keep exploring | Infinite scroll + explicit "Load more" — `MovieGrid` |
| Movie details | `/movie/:id` — cast, crew, trailer, recommendations |
| Persistent wishlist | SQLite on the server, keyed by an anonymous device id |
| Keep context | Filters live in the URL; scroll position and loaded pages are restored |
| Feedback | Skeletons, empty states, typed error states, toasts, offline banner |
| Stays usable at scale | Server-side paging, memoised cards, bounded caches |

---

## Architecture

```
┌───────────────┐   /api/*    ┌──────────────────────────────┐        ┌──────────┐
│    Browser    │ ──────────► │          Node / Express      │ ─────► │   TMDB   │
│  React + RQ   │ ◄────────── │                              │ ◄───── │          │
└───────────────┘   domain    │  routes → services → tmdb    │  raw   └──────────┘
       │            objects   │            │                 │
       │                      │            ▼                 │
       │                      │   LayeredCache (mem + SQLite)│
       │                      │   single-flight · retries    │
       │                      │   token bucket · breaker     │
       │                      └──────────────┬───────────────┘
       │                                     │
       │                                     ▼
       │                              ┌─────────────┐
       └──── wishlist (own data) ────►│   SQLite    │
                                      └─────────────┘
```

### Backend layering

Each layer has exactly one job, and nothing skips a layer:

```
routes/       HTTP: validate input (zod), set cache headers, shape the response
services/     Business logic: which upstream endpoint, filtering, sorting, paging
tmdb/         Integration: HTTP client, resilience, schemas, mapping to domain
db/           Persistence: migrations, wishlist repository, durable cache tier
lib/          Primitives: cache, single-flight, limiter, breaker, errors, logger
domain/       The vocabulary the API speaks — no TMDB types leak past tmdb/
```

The important boundary is `tmdb/`. TMDB's shapes (`poster_path`, `vote_average`,
`genre_ids`, snake_case, `""` for missing dates) stop there. Everything above it
speaks the domain model in `server/src/domain/movie.ts`. Replacing TMDB with
another provider means writing a new client and mapper — no route, service, or
component would change.

### Frontend structure

```
api/          Typed client, query hooks, query keys — the only place fetch() is called
components/   Presentational and reusable (Poster, MovieCard, FilterBar, States…)
pages/        One per route; composes components and owns URL state
hooks/        Cross-cutting behaviour (debounce, infinite scroll, scroll restore)
lib/          Pure helpers (formatting, URL <-> params, client id)
styles/       Design tokens + base styles; components use CSS Modules
```

---

## API reference

All responses are JSON. Errors always use the same envelope:

```jsonc
{
  "error": {
    "code": "UPSTREAM_UNAVAILABLE",   // stable, branchable
    "message": "TMDB is currently unreachable",
    "details": { "reason": "circuit-open" },
    "requestId": "0f1c…"              // also in the x-request-id header
  }
}
```

Codes: `BAD_REQUEST`, `NOT_FOUND`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`,
`UPSTREAM_TIMEOUT`, `UPSTREAM_ERROR`, `NOT_CONFIGURED`, `INTERNAL`.

### `GET /api/movies`

Browse **and** search — the client sends the same request shape either way and
the server decides how to answer it.

| Param | Type | Notes |
| --- | --- | --- |
| `q` | string ≤ 120 | Omit to browse rather than search |
| `genres` | csv of ids | `28,878` — matches **any** of them |
| `sort` | `relevance`\|`popularity`\|`rating`\|`newest`\|`oldest`\|`title` | |
| `yearFrom`, `yearTo` | int | Swapped values are corrected, not rejected |
| `minRating` | 0–10 | |
| `page` | int ≥ 1 | |

```jsonc
{
  "items": [ /* MovieSummary[] */ ],
  "page": 1, "pageSize": 20,
  "totalItems": 8421, "totalPages": 422,
  "hasMore": true, "nextPage": 2,
  "meta": {
    "mode": "discover",        // discover | search | search-window
    "cacheState": "fresh",     // fresh | revalidating | stale | miss
    "degraded": false,         // true ⇒ upstream failed, this is stale data
    "windowedResults": { "scannedPages": 5, "scannedItems": 97, "upstreamTotal": 1204 }
  }
}
```

### Other endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/movies/trending?window=day\|week` | Spotlight rail |
| `GET` | `/api/movies/:id` | Full detail: credits, videos, recommendations |
| `GET` | `/api/genres` | Genre list for the filter chips |
| `GET` | `/api/wishlist?sort=&page=&pageSize=` | Paginated saved films |
| `GET` | `/api/wishlist/ids` | Id set for rendering hearts |
| `POST` | `/api/wishlist` | `{ movieId, movie? }` |
| `DELETE` | `/api/wishlist/:id` | |
| `GET` | `/api/health` | Uptime, breaker state, cache hit rate |

Wishlist routes require an `X-Client-Id` header (a UUID the browser mints on
first load and keeps in `localStorage`).

---

## Technical decisions

### One endpoint for browse and search

TMDB splits these across `/discover/movie` (filters and sorting, no text query)
and `/search/movie` (text query, no filters, no sorting). Exposing that split
would push a third party's limitation into our UI, so `GET /api/movies` accepts
every combination and the service layer picks a strategy:

| Input | Strategy | Upstream cost |
| --- | --- | --- |
| No `q` | `/discover/movie` — filters and sort map onto TMDB params | 1 request per page |
| `q`, no filters, `sort=relevance` | `/search/movie` passthrough | 1 request per page |
| `q` **+** a filter or a sort | **windowed search** (below) | ≤ 5 requests, all cached |

**Windowed search.** TMDB's search endpoint cannot filter or sort, so that work
has to happen on our side. Doing it over the complete result set would mean
downloading every page — for a query like "the" that is hundreds of requests per
keystroke. Instead we scan the first 5 pages (the 100 most *relevant* matches,
which is what a search user actually cares about), then filter, sort and
re-paginate that window ourselves.

The response says so explicitly via `meta.windowedResults`, and the UI prints
"Sorted and filtered across the 97 most relevant of 1,204 matches". I would
rather be honest about a bounded result set than silently return something
subtly wrong. Because each upstream page is cached independently, switching sort
or toggling a genre on the same query costs **zero** additional TMDB requests.

### Caching: two tiers, stale-while-revalidate, stale-if-error

`LayeredCache` (`server/src/lib/cache.ts`) is a bounded in-memory LRU in front of
a SQLite table:

- **fresh** → returned immediately.
- **stale but inside the grace window** → returned immediately, refreshed in the
  background. The user never waits for a revalidation.
- **miss** → the loader runs, deduplicated across concurrent callers.
- **miss and the loader fails** → a stale value is served if we still hold one,
  flagged `degraded: true`, and the UI shows a banner.

The SQLite tier matters for restarts: a redeployed process starts warm instead of
re-hammering TMDB, and it has something to serve if TMDB is down at boot.

TTLs are tuned to how fast the data actually changes — lists 5 min, details 1 h,
genres and image configuration 24 h.

### Avoiding unnecessary requests

Six mechanisms, each solving a different problem:

1. **Debounce (350 ms)** — most keystrokes never become a request.
2. **Request cancellation** — React Query aborts the superseded request, and the
   server propagates that `AbortSignal` all the way into the TMDB `fetch`. Work
   nobody is waiting for gets dropped rather than finished.
3. **Single-flight** — concurrent identical requests share one upstream call.
4. **Server cache** — repeat requests never leave the process.
5. **React Query cache** — repeat requests never leave the tab.
6. **HTTP `Cache-Control` + `stale-while-revalidate`** — back/forward navigation
   is free, and a CDN could be dropped in front with no code changes.

Prefetching runs the other way: hovering or focusing a card warms the detail
query, so opening a film is usually instant.

### Wishlist: server-side, snapshot-backed

The list lives in SQLite, not `localStorage`, because it is *our* data — the
brief asks for persistence, and a real product would need it to follow the user
across devices. `localStorage` holds only an anonymous UUID.

Each row also stores a **denormalised snapshot** of the movie as it was when
saved. This means rendering the wishlist makes zero TMDB requests, the page works
during an outage, and a film later removed upstream does not vanish from
someone's list. The cost is staleness — a poster swapped upstream will not update
until the entry is re-saved. For a wishlist that trade is clearly worth it.

`POST /api/wishlist` also accepts the snapshot the client already has on screen,
used as a fallback when TMDB cannot be reached. Losing a save because a third
party is down would be the wrong outcome.

### State in the URL

Every browse control — query, genres, sort, years, rating — is serialised into
the query string. The back button restores the exact result set, a filtered view
is shareable, and a refresh does not discard the user's work. Typing uses
`replace` (so a ten-character search does not bury the previous page under ten
history entries) while filter changes push real entries.

Paired with `useInfiniteQuery` keeping loaded pages and `useScrollRestoration`
remembering the offset, "open a movie → press back" returns to precisely where
the user was, which is the context-preservation the brief asks for.

### Why these dependencies (and not more)

Server: `express`, `zod`, `better-sqlite3`, `cors`, `dotenv`. Client: `react`,
`react-router-dom`, `@tanstack/react-query`. That is the whole list.

Caching, rate limiting, the circuit breaker, single-flight, toasts and the
skeletons are all hand-written — each is a few dozen readable lines, and writing
them keeps the behaviour explicit and explainable rather than delegated to
configuration I would have to defend second-hand. React Query is the one place I
did reach for a library: hand-rolling request deduplication, cancellation,
optimistic updates and infinite-query cache management would be a worse version
of a well-tested solution.

`better-sqlite3` is synchronous, which is the right call here: queries are
sub-millisecond primary-key lookups, and avoiding a connection pool and a layer
of promises makes the repository code much simpler to read.

---

## Handling the real world

Every scenario the brief lists, and what happens:

| Scenario | Behaviour |
| --- | --- |
| Same information requested repeatedly | Served from memory, SQLite, the browser cache, or React Query — usually without touching TMDB |
| User types quickly | Debounced; superseded requests aborted client- **and** server-side |
| Filters changed rapidly | Previous results stay on screen (dimmed) via `keepPreviousData`; no layout collapse |
| Upstream slow | 8 s deadline per attempt, retried twice with exponential backoff + jitter |
| Upstream unavailable | Circuit breaker opens after 5 consecutive failures and fails fast; cache serves stale data with a visible banner |
| Upstream rate limits us | Outbound token bucket keeps us under the ceiling; `429` is retried per `Retry-After` |
| Incomplete/unexpected data | Lenient zod schemas: unusable records are dropped and counted, the rest render. `runtime: 0`, `release_date: ""`, missing posters and unrated films all have explicit handling |
| Client floods the API | Per-identity fixed-window limiter returns `429` with `Retry-After` |
| Missing poster | Labelled placeholder, never a broken image |
| Poster fails to load | `onError` falls back to the same placeholder |
| Long titles | Two-line clamp with `overflow-wrap: anywhere` — grid rhythm holds |
| Large result sets | Server-side paging, memoised cards, bounded caches |
| Offline | Banner from the `online`/`offline` events; cached data stays readable |
| Render-time bug | `ErrorBoundary` catches it instead of blanking the app |

**Errors the user can act on.** `ErrorState` distinguishes what will fix itself
from what will not: a 5xx, a timeout or a network drop gets a retry button; a
400 or a 404 does not, because retrying would produce the same answer. Every
error carries a request id, so a report can be traced to a single log line.

**Responsive design.** The grid is one `repeat(auto-fill, minmax(150px, 1fr))` —
column count follows available width from two tiles on a small phone to seven on
a wide desktop, with no breakpoints to maintain. Posters render into a reserved
`aspect-ratio` box so nothing reflows as images arrive, and `srcset`/`sizes`
means a phone downloads a 185px poster rather than a 500px one.

---

## Data model

```sql
users (
  id           TEXT PRIMARY KEY,   -- anonymous UUID from the browser
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
)

wishlist_items (
  user_id             TEXT    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id            INTEGER NOT NULL,
  added_at            TEXT    NOT NULL,
  snapshot_json       TEXT    NOT NULL,  -- MovieSummary as saved
  snapshot_updated_at TEXT    NOT NULL,
  PRIMARY KEY (user_id, movie_id)
)
CREATE INDEX idx_wishlist_user_added ON wishlist_items (user_id, added_at DESC);

http_cache (
  key         TEXT    PRIMARY KEY,  -- canonical, credential-free request key
  value_json  TEXT    NOT NULL,
  fetched_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,     -- end of "fresh"
  purge_at    INTEGER NOT NULL      -- end of "usable when degraded"
)
CREATE INDEX idx_http_cache_purge ON http_cache (purge_at);
```

**What we store vs. what we fetch.** We store what is ours and what must outlive
an outage: wishlist rows, their snapshots, and cached upstream responses.
Everything else — the catalogue itself, ratings, images — stays TMDB's, fetched
and cached rather than copied. Mirroring TMDB into our own tables would mean
owning a synchronisation problem with no upside for this product.

Migrations are forward-only and tracked with `PRAGMA user_version`
(`server/src/db/schema.ts`); adding a step to the array is all that is needed to
evolve an existing database file.

---

## Assumptions

- **No user accounts.** An anonymous per-browser id is enough to demonstrate
  persistence without building auth. It is explicitly not a security boundary —
  anyone who knew a UUID could read that wishlist. Real accounts would slot in
  at `requireClientId` and populate the same `users` table.
- **Single server process.** The in-memory cache tier and the inbound rate
  limiter are per-process. Multiple instances would still be correct (SQLite is
  shared, and the memory tier is just a cache) but less efficient; the fix is
  Redis, and the interfaces are already shaped for it.
- **English-language metadata.** `language=en-US` throughout. TMDB is fully
  localised; exposing a locale would be a parameter change, not a redesign.
- **Adult content excluded** (`include_adult=false`).
- Search relevance is TMDB's; I did not attempt to re-rank it.

---

## Known limitations

- **Windowed search is bounded to 100 results.** Sorting or filtering a text
  search covers the 100 most relevant matches, not the full set — the honest
  consequence of TMDB not supporting those operations on `/search`. The response
  and the UI both say so. Removing the bound properly would need our own search
  index.
- **TMDB caps paging at 500 pages** (~10,000 results). We clamp to that rather
  than letting the upstream 400.
- **Wishlist snapshots go stale.** No background refresh job yet; re-saving a
  film updates it.
- **Genre filters are OR, not AND.** "Action or Comedy", not "Action and
  Comedy". A toggle would be a small addition.
- **No proper test suite.** `npm run smoke` covers the two areas most likely to
  break quietly — lenient parsing of malformed upstream records, and the cache
  state machine (fresh / stale-while-revalidate / single-flight / stale-if-error)
  — but it is a script, not a framework. Real unit and integration tests are the
  first thing I would add; the pure logic was written to be testable
  (dependency-free functions with explicit inputs).
- **Wishlist sorting uses `json_extract`**, so those columns are unindexed. Fine
  for a list of tens or hundreds; a promoted column plus an index would be the
  fix if it grew.
- **No virtualised list.** Infinite scroll keeps every loaded card mounted. It is
  comfortable to several hundred cards; beyond that, windowing would be needed.

---

## Use of AI

I used Claude (via Claude Code) throughout this build, mainly for:

- Checking TMDB endpoint behaviour and parameter names — particularly which
  `sort_by` values `/discover` accepts and the fact that `/search` supports
  neither sorting nor filtering, which is what drove the windowed-search design.
- Generating boilerplate: type definitions, zod schemas, CSS scaffolding, and
  repetitive JSX.
- Reviewing the resilience code (breaker thresholds, retry/jitter, abort
  propagation) and talking through edge cases.

The architecture and the decisions in this README are mine: the layering and the
domain boundary at `tmdb/`, the single browse/search endpoint and its three
strategies, the bounded search window and the choice to surface it in the UI, the
two-tier cache with stale-if-error, snapshot-backed wishlist rows, and URL-as-state
on the client. I wrote or rewrote the parts that carry the reasoning, and I can
walk through, debug and extend any file here.

---

## With more time

In the order I would actually do them:

1. **Tests.** Promote `server/scripts/smoke.mjs` into Vitest and extend it to the
   comparators and param parsing; Supertest against the routes with a mocked
   TMDB; a Playwright pass over search → detail → wishlist.
2. **Redis** for the cache and rate limiter, so the app scales past one process.
3. **A wishlist refresh job** to re-fetch snapshots older than a few days.
4. **Real accounts**, so a wishlist follows the user rather than the browser.
5. **Richer discovery** — people search, "because you saved X" rails, watch
   providers.
6. **A shared types package** generated from the server schemas, removing the
   hand-maintained mirror in `web/src/api/types.ts`.
7. **List virtualisation** and a `/metrics` endpoint for real observability.
