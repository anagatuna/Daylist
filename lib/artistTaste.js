import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore';
import { db } from './firebase';
import { isSpotifyConnected } from './spotifyAuth';

export const MAX_FAVORITE_ARTISTS = 5;

// Posts recientes que se revisan para armar el historial de artistas.
const HISTORY_POSTS = 60;
// Un artista elegido en el onboarding pesa como varios posts, para que siga
// contando mientras el historial todavía es corto.
const FAVORITE_WEIGHT = 5;

function normalizeArtist(name) {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// Claves para comparar artistas por nombre entre catálogos: el crédito completo
// más cada colaborador por separado.
// "Bad Bunny & Bomba Estéreo" → ['bad bunny & bomba estereo', 'bad bunny', 'bomba estereo']
export function artistKeys(artist) {
  const full = normalizeArtist(artist ?? '');
  if (!full) return [];
  const parts = full.split(/\s*(?:,|&|\bfeat\.?\s|\bft\.?\s)\s*/).filter(Boolean);
  return [...new Set([full, ...parts])];
}

// Devuelve [{ name, image }], o null si el usuario todavía no responde el onboarding.
export async function getFavoriteArtists(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  const stored = snap.data()?.favoriteArtists;
  if (!stored) return null;
  return stored.map(a => (typeof a === 'string' ? { name: a, image: null } : a));
}

export async function saveFavoriteArtists(uid, artists) {
  const favoriteArtists = artists
    .slice(0, MAX_FAVORITE_ARTISTS)
    .map(a => ({ name: a.name, image: a.image ?? null }));
  await setDoc(doc(db, 'users', uid), { favoriteArtists }, { merge: true });
}

// Quien tiene Spotify conectado ya recibe búsquedas personalizadas con sus
// artistas más escuchados, así que solo se pregunta al resto, y una sola vez.
export async function needsArtistOnboarding(uid) {
  const [favorites, connected] = await Promise.all([getFavoriteArtists(uid), isSpotifyConnected(uid)]);
  return favorites === null && !connected;
}

async function fetchPostedArtistCounts(uid) {
  const snap = await getDocs(query(
    collection(db, 'posts'),
    where('uid', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(HISTORY_POSTS)
  ));
  const counts = new Map();
  snap.docs.forEach(d => {
    Object.values(d.data().songs ?? {}).forEach(song => {
      artistKeys(song?.artist).forEach(k => counts.set(k, (counts.get(k) ?? 0) + 1));
    });
  });
  return counts;
}

// Puntaje por artista (clave normalizada → peso) para ordenar las búsquedas:
// artistas favoritos del onboarding + cuántas veces se ha posteado cada uno.
export async function fetchArtistScores(uid) {
  const [favorites, counts] = await Promise.all([
    getFavoriteArtists(uid).catch(() => null),
    fetchPostedArtistCounts(uid).catch(() => new Map()),
  ]);
  const scores = new Map(counts);
  (favorites ?? []).forEach(({ name }) => {
    const key = normalizeArtist(name);
    scores.set(key, (scores.get(key) ?? 0) + FAVORITE_WEIGHT);
  });
  return scores;
}
