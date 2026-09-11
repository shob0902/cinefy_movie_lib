// Picks the artwork and gradient backdrop for a genre card.
export interface GenreArt {
  from: string;
  to: string;
  accent: string;
}
const BY_ID: Record<number, GenreArt> = {
  28: { from: '#3d1216', to: '#120a0c', accent: '#ff5a3c' }, // Action
  12: { from: '#0d2f2b', to: '#08161a', accent: '#25d0a8' }, // Adventure
  16: { from: '#2b1444', to: '#120c22', accent: '#b06cff' }, // Animation
  35: { from: '#43300b', to: '#1a1406', accent: '#ffc65c' }, // Comedy
  80: { from: '#14202f', to: '#0a1018', accent: '#5c8fd6' }, // Crime
  99: { from: '#26240f', to: '#131206', accent: '#c3bb6a' }, // Documentary
  18: { from: '#1d1840', to: '#0e0c1e', accent: '#7d76ff' }, // Drama
  10751: { from: '#40200f', to: '#1b0f08', accent: '#ff9159' }, // Family
  14: { from: '#33103a', to: '#16081a', accent: '#e263ff' }, // Fantasy
  36: { from: '#332107', to: '#170f04', accent: '#d59a45' }, // History
  27: { from: '#2a0708', to: '#0b0405', accent: '#e02b2b' }, // Horror
  10402: { from: '#3a0f33', to: '#180718', accent: '#ff5ecd' }, // Music
  9648: { from: '#0c2531', to: '#061219', accent: '#3fb6d8' }, // Mystery
  10749: { from: '#3d1226', to: '#1a0811', accent: '#ff6b9d' }, // Romance
  878: { from: '#0a2340', to: '#05111f', accent: '#3ba7ff' }, // Science Fiction
  10770: { from: '#1c2229', to: '#0d1114', accent: '#8fa3b5' }, // TV Movie
  53: { from: '#2c1015', to: '#12070a', accent: '#ff4d6a' }, // Thriller
  10752: { from: '#232a13', to: '#101408', accent: '#9bab52' }, // War
  37: { from: '#3a2410', to: '#181007', accent: '#e0a35c' }, // Western
};
function fallbackArt(genre: { id: number; name: string }): GenreArt {
  let hash = 0;
  for (let index = 0; index < genre.name.length; index += 1) {
    hash = (hash * 31 + genre.name.charCodeAt(index)) % 360;
  }
  const hue = (hash + genre.id) % 360;
  return {
    from: `hsl(${hue} 45% 14%)`,
    to: `hsl(${(hue + 20) % 360} 40% 6%)`,
    accent: `hsl(${hue} 80% 62%)`,
  };
}
export function genreArt(genre: { id: number; name: string }): GenreArt {
  return BY_ID[genre.id] ?? fallbackArt(genre);
}
export function genreBackground(genre: { id: number; name: string }): string {
  const art = genreArt(genre);
  return [
    `radial-gradient(115% 75% at 22% 12%, ${art.accent}40 0%, transparent 62%)`,
    `radial-gradient(90% 60% at 88% 96%, ${art.accent}1f 0%, transparent 70%)`,
    `linear-gradient(158deg, ${art.from} 0%, ${art.to} 100%)`,
  ].join(', ');
}
