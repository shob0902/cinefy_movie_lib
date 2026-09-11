// Maps raw TMDB payloads into our domain shapes.
import type {
  CastMember,
  CrewMember,
  Genre,
  MovieDetail,
  MovieSummary,
  Video,
} from '../domain/movie.js';
import { buildImageSet, buildProfileUrl } from './images.js';
import type { TmdbMovieDetail, TmdbMovieSummary } from './schemas.js';
export type GenreMap = ReadonlyMap<number, string>;
function normaliseRating(voteAverage: number | null, voteCount: number): number | null {
  if (!voteAverage || voteCount <= 0) return null;
  return Math.round(voteAverage * 10) / 10;
}
function parseYear(releaseDate: string | null): number | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  return Number.isInteger(year) && year > 1800 && year < 2200 ? year : null;
}
function resolveGenres(raw: TmdbMovieSummary, genreMap?: GenreMap): Genre[] {
  if (raw.genres?.length) {
    return raw.genres
      .filter((genre) => genre.name.length > 0)
      .map((genre) => ({ id: genre.id, name: genre.name }));
  }
  if (!genreMap) return [];
  return raw.genre_ids
    .map((id) => {
      const name = genreMap.get(id);
      return name ? { id, name } : null;
    })
    .filter((genre): genre is Genre => genre !== null);
}
export function toMovieSummary(raw: TmdbMovieSummary, genreMap?: GenreMap): MovieSummary {
  const releaseDate = raw.release_date;
  return {
    id: raw.id,
    title: raw.title ?? raw.original_title ?? 'Untitled',
    originalTitle: raw.original_title,
    overview: raw.overview,
    releaseDate,
    releaseYear: parseYear(releaseDate),
    poster: buildImageSet(raw.poster_path, 'poster'),
    backdrop: buildImageSet(raw.backdrop_path, 'backdrop'),
    rating: normaliseRating(raw.vote_average, raw.vote_count),
    voteCount: Math.max(0, Math.round(raw.vote_count)),
    popularity: Number(raw.popularity.toFixed(3)),
    genres: resolveGenres(raw, genreMap),
    originalLanguage: raw.original_language,
    adult: raw.adult,
  };
}
export function isRenderable(raw: TmdbMovieSummary): boolean {
  return Boolean(raw.id) && Boolean(raw.title ?? raw.original_title);
}
function toCast(raw: TmdbMovieDetail['credits']['cast']): CastMember[] {
  return raw
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, 20)
    .filter((member) => member.name.length > 0)
    .map((member) => ({
      id: member.id,
      name: member.name,
      character: member.character,
      profileUrl: buildProfileUrl(member.profile_path),
    }));
}
function pickCrew(raw: TmdbMovieDetail['credits']['crew'], jobs: string[]): CrewMember[] {
  const wanted = new Set(jobs.map((job) => job.toLowerCase()));
  const seen = new Set<number>();
  return raw
    .filter((member) => wanted.has(member.job.toLowerCase()) && member.name.length > 0)
    .filter((member) => {
      if (seen.has(member.id)) return false;
      seen.add(member.id);
      return true;
    })
    .slice(0, 6)
    .map((member) => ({
      id: member.id,
      name: member.name,
      job: member.job,
      profileUrl: buildProfileUrl(member.profile_path),
    }));
}
function pickTrailer(videos: TmdbMovieDetail['videos']['results']): Video | null {
  const playable = videos.filter(
    (video) => video.key.length > 0 && (video.site === 'YouTube' || video.site === 'Vimeo'),
  );
  if (playable.length === 0) return null;
  const score = (video: (typeof playable)[number]) => {
    let value = 0;
    if (video.type.toLowerCase() === 'trailer') value += 4;
    else if (video.type.toLowerCase() === 'teaser') value += 2;
    if (video.official) value += 2;
    if (video.site === 'YouTube') value += 1;
    return value;
  };
  const best = playable.reduce((a, b) => (score(b) > score(a) ? b : a));
  const site = best.site === 'Vimeo' ? 'Vimeo' : 'YouTube';
  return {
    key: best.key,
    site,
    name: best.name || 'Trailer',
    type: best.type || 'Trailer',
    url:
      site === 'YouTube'
        ? `https://www.youtube.com/watch?v=${best.key}`
        : `https://vimeo.com/${best.key}`,
    thumbnailUrl:
      site === 'YouTube' ? `https://img.youtube.com/vi/${best.key}/hqdefault.jpg` : null,
  };
}
export function toMovieDetail(
  raw: TmdbMovieDetail,
  recommendations: MovieSummary[],
  genreMap?: GenreMap,
): MovieDetail {
  return {
    ...toMovieSummary(raw, genreMap),
    tagline: raw.tagline,
    status: raw.status,
    runtimeMinutes: raw.runtime && raw.runtime > 0 ? Math.round(raw.runtime) : null,
    homepage: raw.homepage,
    imdbId: raw.imdb_id,
    budget: raw.budget && raw.budget > 0 ? raw.budget : null,
    revenue: raw.revenue && raw.revenue > 0 ? raw.revenue : null,
    productionCompanies: raw.production_companies.map((entry) => entry.name).filter(Boolean),
    productionCountries: raw.production_countries.map((entry) => entry.name).filter(Boolean),
    spokenLanguages: raw.spoken_languages
      .map((entry) => entry.english_name ?? entry.name)
      .filter((name): name is string => Boolean(name)),
    cast: toCast(raw.credits.cast),
    directors: pickCrew(raw.credits.crew, ['Director']),
    writers: pickCrew(raw.credits.crew, ['Writer', 'Screenplay', 'Story']),
    trailer: pickTrailer(raw.videos.results),
    recommendations,
  };
}
