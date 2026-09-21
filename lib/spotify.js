import { getValidAccessToken } from './spotifyAuth';

const PAGE_SIZE = 10;
const PAGE_OFFSETS = [0, PAGE_SIZE, PAGE_SIZE * 2];

async function fetchSearchPage(token, query, offset) {
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(PAGE_SIZE), offset: String(offset) });
  const res = await fetch(`https://api.spotify.com/v1/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn(`Spotify search failed: ${res.status} ${await res.text()}`);
    return [];
  }
  const data = await res.json();
  return data.tracks?.items ?? [];
}

// Trae varias páginas para tener más candidatos, y prioriza (sin descartar el resto)
// las canciones de artistas que el usuario ya escucha, manteniendo el orden de
// relevancia de Spotify dentro de cada grupo.
export async function searchSpotifyTracks(uid, query, topArtistIds = []) {
  const token = await getValidAccessToken(uid);
  if (!token) return [];

  const pages = await Promise.all(PAGE_OFFSETS.map(offset => fetchSearchPage(token, query, offset)));

  const seen = new Set();
  const tracks = pages.flat().filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  if (topArtistIds.length > 0) {
    const topSet = new Set(topArtistIds);
    const isTopArtist = (t) => t.artists?.some(a => topSet.has(a.id)) ?? false;
    tracks.sort((a, b) => Number(isTopArtist(b)) - Number(isTopArtist(a)));
  }

  return tracks.map(t => ({
    id: t.id,
    name: t.name,
    artist: t.artists?.map(a => a.name).join(', ') ?? '',
    album: t.album?.name ?? '',
    artworkUrl: t.album?.images?.[0]?.url ?? null,
    durationMs: t.duration_ms ?? 0,
    uri: t.uri,
  }));
}

export function serializeSpotifyTrack(track) {
  return {
    id: track.id,
    name: track.name,
    artist: track.artist,
    album: track.album,
    albumImage: track.artworkUrl,
    previewUrl: null,
    durationMs: track.durationMs,
    spotifyUri: track.uri,
  };
}
