import { artistKeys } from './artistTaste';

const SEARCH_URL = 'https://itunes.apple.com/search';
// Tienda cuyo catálogo se consulta (define disponibilidad y nombres de género).
const COUNTRY = 'MX';
const TRACK_LIMIT = 50;

async function itunesSearch(params) {
  const qs = new URLSearchParams({ media: 'music', country: COUNTRY, ...params });
  const res = await fetch(`${SEARCH_URL}?${qs}`);
  if (!res.ok) {
    console.warn(`iTunes search failed: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.results ?? [];
}

// Búsqueda sin cuenta de Spotify. Devuelve la misma forma que searchSpotifyTracks
// y prioriza (sin descartar el resto) las canciones de los artistas con más
// puntaje en artistScores, manteniendo el orden de relevancia de iTunes entre
// canciones con el mismo puntaje.
export async function searchItunesTracks(query, artistScores = new Map()) {
  const results = await itunesSearch({ term: query, entity: 'song', limit: String(TRACK_LIMIT) });

  const tracks = results
    .filter(t => t.trackId && t.trackName)
    .map(t => ({
      id: `itunes:${t.trackId}`,
      name: t.trackName,
      artist: t.artistName ?? '',
      album: t.collectionName ?? '',
      artworkUrl: t.artworkUrl100?.replace('100x100bb', '600x600bb') ?? null,
      durationMs: t.trackTimeMillis ?? 0,
      uri: null,
    }));

  if (artistScores.size > 0) {
    const score = (t) => Math.max(0, ...artistKeys(t.artist).map(k => artistScores.get(k) ?? 0));
    tracks.sort((a, b) => score(b) - score(a));
  }

  return tracks;
}
