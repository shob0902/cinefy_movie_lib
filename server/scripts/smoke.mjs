/**
 * Fixture-based smoke checks for the logic that is hardest to eyeball and most
 * likely to break quietly: lenient parsing of upstream data, and the cache
 * state machine.
 *
 * Not a substitute for a real test suite (see the README) — it is a fast,
 * dependency-free way to prove the resilience behaviour actually behaves.
 *
 *   npm run smoke        (from server/, builds first)
 */
import { parseList, tmdbMovieSummarySchema } from '../dist/tmdb/schemas.js';
import { isRenderable, toMovieSummary } from '../dist/tmdb/mappers.js';
import { LayeredCache } from '../dist/lib/cache.js';

let failures = 0;

function check(name, condition, actual) {
  if (condition) {
    console.log(`  ok    ${name}`);
  } else {
    failures += 1;
    console.log(`  FAIL  ${name}`, actual === undefined ? '' : JSON.stringify(actual));
  }
}

function section(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
section('Upstream records that are incomplete, wrongly typed, or unusable');

const hostile = [
  {
    id: 1,
    title: 'Good Film',
    original_title: 'Good Film',
    overview: 'ok',
    release_date: '2021-06-04',
    poster_path: '/abc.jpg',
    backdrop_path: null,
    vote_average: 7.8888,
    vote_count: 1200,
    popularity: 55.12345,
    genre_ids: [28, 878],
    original_language: 'en',
    adult: false,
  },
  // Unreleased: empty date, no poster, a perfect score from zero voters.
  {
    id: 2,
    title: 'Unreleased',
    overview: '',
    release_date: '',
    poster_path: null,
    vote_average: 10,
    vote_count: 0,
    popularity: 0.1,
    genre_ids: [28, 99999],
    original_language: null,
    adult: false,
  },
  // Wrong type in nearly every field, but a usable id and title.
  {
    id: 3,
    title: 'Typo Film',
    overview: null,
    release_date: 12345,
    poster_path: 42,
    vote_average: 'nope',
    vote_count: '350',
    popularity: '9.5',
    genre_ids: 'not-an-array',
    adult: 'yes',
  },
  { title: 'No Id' }, // unusable
  'a string', // unusable
  { id: 6, original_title: 'Solo Original', vote_count: 5, vote_average: 6 },
];

const { items, dropped } = parseList(tmdbMovieSummarySchema, hostile);
check('unusable records are dropped', dropped === 2, { dropped });
check('usable records survive', items.length === 4, { kept: items.length });
check('every survivor is renderable', items.filter(isRenderable).length === 4);

const genreMap = new Map([
  [28, 'Action'],
  [878, 'Sci-Fi'],
]);
const [good, unreleased, typo, solo] = items.map((raw) => toMovieSummary(raw, genreMap));

check('rating rounded to one decimal', good.rating === 7.9, good.rating);
check('genre ids resolved to names', good.genres.map((g) => g.name).join() === 'Action,Sci-Fi');
check('release year extracted', good.releaseYear === 2021);
check('poster becomes a responsive srcSet', good.poster?.srcSet.includes(' 342w') === true);
check('absent backdrop is null, not a broken URL', good.backdrop === null);

check('empty release_date becomes null', unreleased.releaseDate === null);
check('no year without a date', unreleased.releaseYear === null);
check('zero votes means unrated, not 10/10', unreleased.rating === null, unreleased.rating);
check('absent poster is null', unreleased.poster === null);
check('unknown genre id is dropped', unreleased.genres.length === 1);

check('non-string overview falls back to empty', typo.overview === '');
check('unparseable date falls back to null', typo.releaseDate === null, typo.releaseDate);
check('numeric string vote_count is coerced', typo.voteCount === 350);
check('non-numeric rating becomes unrated', typo.rating === null);
check('non-array genre_ids becomes empty', typo.genres.length === 0);
check('non-boolean adult becomes false', typo.adult === false);
check('missing title falls back to original_title', solo.title === 'Solo Original');

// ---------------------------------------------------------------------------
section('Cache: fresh hit, stale-while-revalidate');

const cache = new LayeredCache(10);
let loads = 0;
const load = async () => `v${(loads += 1)}`;
const opts = { ttlMs: 50, graceMs: 5000, persist: false };

const first = await cache.swr('k', opts, load);
check('cold read is a miss and loads', first.state === 'miss' && first.value === 'v1');

const second = await cache.swr('k', opts, load);
check('warm read is a fresh hit with no reload', second.state === 'fresh' && loads === 1);

await new Promise((resolve) => setTimeout(resolve, 70));
const third = await cache.swr('k', opts, load);
check('expired entry is served immediately', third.state === 'revalidating' && third.value === 'v1');
await new Promise((resolve) => setTimeout(resolve, 40));
check('...and refreshed in the background', loads === 2, { loads });

// ---------------------------------------------------------------------------
section('Single-flight: a burst of identical requests');

const burstCache = new LayeredCache(10);
let upstreamCalls = 0;
const slowLoad = async () => {
  upstreamCalls += 1;
  await new Promise((resolve) => setTimeout(resolve, 40));
  return 'x';
};

await Promise.all(
  Array.from({ length: 25 }, () =>
    burstCache.swr('same', { ttlMs: 1000, graceMs: 1000, persist: false }, slowLoad),
  ),
);
check('25 concurrent callers cause 1 upstream call', upstreamCalls === 1, { upstreamCalls });

// ---------------------------------------------------------------------------
section('Stale-if-error: the upstream fails after the entry expires');

const errorCache = new LayeredCache(10);
const shortLived = { ttlMs: 20, graceMs: 0, persist: false };
await errorCache.swr('e', shortLived, async () => 'last-good-value');
await new Promise((resolve) => setTimeout(resolve, 40));

const degraded = await errorCache.swr('e', shortLived, async () => {
  throw new Error('TMDB is down');
});
check(
  'the last good value is served instead of an error',
  degraded.state === 'stale' && degraded.value === 'last-good-value',
  degraded.state,
);

// ---------------------------------------------------------------------------
console.log(failures === 0 ? '\nAll smoke checks passed.\n' : `\n${failures} check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
