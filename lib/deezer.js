import { Platform } from 'react-native';

const SEARCH_URL = 'https://api.deezer.com/search/artist';
const ARTIST_LIMIT = 25;

// Deezer no manda headers de CORS, así que en web un fetch normal queda
// bloqueado; su API ofrece JSONP para ese caso.
function jsonp(url) {
  return new Promise((resolve, reject) => {
    const callback = `__deezer_${Date.now()}_${Math.round(Math.random() * 1e6)}`;
    const script = document.createElement('script');
    const cleanup = () => { delete window[callback]; script.remove(); };
    window[callback] = (data) => { cleanup(); resolve(data); };
    script.onerror = () => { cleanup(); reject(new Error('Deezer request failed')); };
    script.src = `${url}&output=jsonp&callback=${callback}`;
    document.head.appendChild(script);
  });
}

async function deezerGet(url) {
  if (Platform.OS === 'web') return jsonp(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Deezer API error: ${res.status}`);
  return res.json();
}

// Los artistas sin foto traen una URL con el hash vacío (".../artist//250x250...").
function artistImage(a) {
  const url = a.picture_medium ?? null;
  return url && !url.includes('/artist//') ? url : null;
}

// Deezer tiene perfiles duplicados o falsos con el mismo nombre que el artista
// real: se conserva el de más fans por nombre y se ordena por popularidad.
export async function searchDeezerArtists(query) {
  const params = new URLSearchParams({ q: query, limit: String(ARTIST_LIMIT) });
  const data = await deezerGet(`${SEARCH_URL}?${params}`);

  const byName = new Map();
  (data?.data ?? []).forEach(a => {
    if (!a.name) return;
    const key = a.name.toLowerCase();
    const fans = a.nb_fan ?? 0;
    if (!byName.has(key) || fans > byName.get(key).fans) {
      byName.set(key, { id: String(a.id), name: a.name, image: artistImage(a), fans });
    }
  });

  return [...byName.values()].sort((a, b) => b.fans - a.fans);
}
