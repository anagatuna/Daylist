const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET;

let accessToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const credentials = btoa(`${CLIENT_ID}:${CLIENT_SECRET}`);

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();

  if (!data.access_token) {
    console.error('[Spotify] Token error:', JSON.stringify(data));
    throw new Error('No se pudo obtener token de Spotify');
  }

  accessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return accessToken;
}

export async function searchTracks(query) {
  const token = await getToken();
  const params = new URLSearchParams({ q: query, type: 'track', limit: '10' });
  const res = await fetch(
    `https://api.spotify.com/v1/search?${params.toString()}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (!data.tracks) {
    console.error('[Spotify] Search error:', JSON.stringify(data));
    return [];
  }
  return data.tracks.items ?? [];
}

export async function getArtist(artistId) {
  const token = await getToken();
  const res = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export function getAlbumImage(track) {
  return track?.album?.images?.[0]?.url ?? null;
}

export function serializeTrack(track) {
  return {
    id: track.id,
    name: track.name,
    artist: track.artists?.[0]?.name ?? '',
    artistId: track.artists?.[0]?.id ?? '',
    album: track.album?.name ?? '',
    albumImage: getAlbumImage(track),
    previewUrl: track.preview_url ?? null,
    durationMs: track.duration_ms,
  };
}
