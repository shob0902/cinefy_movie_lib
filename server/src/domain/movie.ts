// The shapes this API speaks, deliberately not TMDB's.
export interface Genre {
  id: number;
  name: string;
}
export interface GenreWithArtwork extends Genre {
  artwork: ImageSet | null;
  artworkTitle: string | null;
}
export interface ImageSet {
  small: string;
  medium: string;
  large: string;
  srcSet: string;
  aspectRatio: number;
}
export interface MovieSummary {
  id: number;
  title: string;
  originalTitle: string | null;
  overview: string;
  releaseDate: string | null;
  releaseYear: number | null;
  poster: ImageSet | null;
  backdrop: ImageSet | null;
  rating: number | null;
  voteCount: number;
  popularity: number;
  genres: Genre[];
  originalLanguage: string | null;
  adult: boolean;
}
export interface CastMember {
  id: number;
  name: string;
  character: string | null;
  profileUrl: string | null;
}
export interface CrewMember {
  id: number;
  name: string;
  job: string;
  profileUrl: string | null;
}
export interface Video {
  key: string;
  site: 'YouTube' | 'Vimeo';
  name: string;
  type: string;
  url: string;
  thumbnailUrl: string | null;
}
export interface MovieDetail extends MovieSummary {
  tagline: string | null;
  status: string | null;
  runtimeMinutes: number | null;
  homepage: string | null;
  imdbId: string | null;
  budget: number | null;
  revenue: number | null;
  productionCompanies: string[];
  productionCountries: string[];
  spokenLanguages: string[];
  cast: CastMember[];
  directors: CrewMember[];
  writers: CrewMember[];
  trailer: Video | null;
  recommendations: MovieSummary[];
}
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
  nextPage: number | null;
}
export interface WishlistEntry {
  movie: MovieSummary;
  addedAt: string;
  snapshotUpdatedAt: string;
}
