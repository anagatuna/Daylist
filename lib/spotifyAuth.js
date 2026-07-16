import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

// expo-secure-store has no web implementation, so fall back to AsyncStorage there.
const secureStorage = Platform.OS === 'web'
  ? {
      getItemAsync: (key) => AsyncStorage.getItem(key),
      setItemAsync: (key, value) => AsyncStorage.setItem(key, value),
      deleteItemAsync: (key) => AsyncStorage.removeItem(key),
    }
  : SecureStore;

const CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
const SCOPES = ['user-read-private', 'user-top-read'];
const REDIRECT_URI = AuthSession.makeRedirectUri({ scheme: 'daylist', path: 'spotify-auth-callback' });
const DISCOVERY = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export function getSpotifyAuthConfig() {
  return { clientId: CLIENT_ID, scopes: SCOPES, redirectUri: REDIRECT_URI, discovery: DISCOVERY };
}

function tokensKey(uid) { return `spotify_tokens_${uid}`; }
function profileKey(uid) { return `spotify_profile_${uid}`; }

// Solo esta cuenta sincroniza sus tokens de Spotify entre dispositivos vía
// Firestore (ver firestore.rules): se conecta desde la tablet Android (APK)
// y se usa también desde el iPhone (Expo Go, donde no se puede autorizar
// Spotify). El resto de cuentas sigue conectando por dispositivo.
const SYNC_EMAIL = 'altc3456@gmail.com';

function syncEnabled() {
  return auth.currentUser?.email === SYNC_EMAIL;
}

function remoteTokensRef(uid) {
  return doc(db, 'spotifyTokens', uid);
}

async function getRemoteTokens(uid) {
  if (!syncEnabled()) return null;
  try {
    const snap = await getDoc(remoteTokensRef(uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

async function setRemoteTokens(uid, tokens) {
  if (!syncEnabled()) return;
  try {
    await setDoc(remoteTokensRef(uid), tokens);
  } catch {
    // sin conexión u otro error: el storage local sigue siendo la fuente de verdad
  }
}

async function deleteRemoteTokens(uid) {
  if (!syncEnabled()) return;
  try {
    await deleteDoc(remoteTokensRef(uid));
  } catch {}
}

async function getStoredTokens(uid) {
  const raw = await secureStorage.getItemAsync(tokensKey(uid));
  if (raw) return JSON.parse(raw);
  const remote = await getRemoteTokens(uid);
  if (remote) await secureStorage.setItemAsync(tokensKey(uid), JSON.stringify(remote));
  return remote;
}

async function saveTokens(uid, tokenResponse) {
  const prev = await getStoredTokens(uid);
  const tokens = {
    access_token: tokenResponse.accessToken,
    refresh_token: tokenResponse.refreshToken ?? prev?.refresh_token ?? null,
    expires_at: Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000,
    token_type: tokenResponse.tokenType,
    scope: tokenResponse.scope,
  };
  await secureStorage.setItemAsync(tokensKey(uid), JSON.stringify(tokens));
  await setRemoteTokens(uid, tokens);
  return tokens;
}

export async function exchangeCodeForTokens(uid, code, codeVerifier) {
  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code,
      redirectUri: REDIRECT_URI,
      extraParams: { code_verifier: codeVerifier },
    },
    DISCOVERY
  );
  return saveTokens(uid, tokenResponse);
}

export async function disconnectSpotify(uid) {
  await secureStorage.deleteItemAsync(tokensKey(uid));
  await secureStorage.deleteItemAsync(profileKey(uid));
  await deleteRemoteTokens(uid);
}

// Spotify rota el refresh_token en cada uso: si dos llamadas refrescan a la vez
// con el mismo refresh_token, la segunda recibe invalid_grant y desconecta la
// cuenta. Este mapa deduplica llamadas concurrentes por uid; el check-and-set
// debe ocurrir de forma síncrona (sin await antes) para que dos llamadas
// disparadas en el mismo tick (p. ej. un Promise.all) no pasen ambas el check
// antes de que la primera se registre.
const inFlightRequests = new Map();

export function getValidAccessToken(uid) {
  if (inFlightRequests.has(uid)) return inFlightRequests.get(uid);

  const request = (async () => {
    try {
      const tokens = await getStoredTokens(uid);
      if (!tokens) return null;
      if (tokens.expires_at - 60000 > Date.now()) return tokens.access_token;
      if (!tokens.refresh_token) {
        await disconnectSpotify(uid);
        return null;
      }

      return await refreshWithToken(uid, tokens.refresh_token);
    } finally {
      inFlightRequests.delete(uid);
    }
  })();

  inFlightRequests.set(uid, request);
  return request;
}

async function refreshWithToken(uid, refreshToken) {
  try {
    const refreshed = await AuthSession.refreshAsync(
      { clientId: CLIENT_ID, refreshToken },
      DISCOVERY
    );
    const saved = await saveTokens(uid, refreshed);
    return saved.access_token;
  } catch (e) {
    if (e?.code === 'invalid_grant') {
      // El refresh_token local puede estar obsoleto si otro dispositivo ya
      // lo rotó (Spotify invalida el anterior en cada uso). Antes de
      // desconectar, buscamos si hay una versión más nueva sincronizada.
      const remote = await getRemoteTokens(uid);
      if (remote?.refresh_token && remote.refresh_token !== refreshToken) {
        await secureStorage.setItemAsync(tokensKey(uid), JSON.stringify(remote));
        if (remote.expires_at - 60000 > Date.now()) return remote.access_token;
        return refreshWithToken(uid, remote.refresh_token);
      }
      await disconnectSpotify(uid);
      return null;
    }
    throw e;
  }
}

async function spotifyFetch(uid, url) {
  const token = await getValidAccessToken(uid);
  if (!token) return null;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    await disconnectSpotify(uid);
    return null;
  }
  if (!res.ok) throw new Error(`Spotify API error: ${res.status}`);
  return res.json();
}

export async function fetchSpotifyProfile(uid) {
  const data = await spotifyFetch(uid, 'https://api.spotify.com/v1/me');
  if (!data) return null;
  const profile = { id: data.id, display_name: data.display_name, images: data.images ?? [] };
  await secureStorage.setItemAsync(profileKey(uid), JSON.stringify(profile));
  return profile;
}

export async function getCachedProfile(uid) {
  const raw = await secureStorage.getItemAsync(profileKey(uid));
  return raw ? JSON.parse(raw) : null;
}

export async function fetchTopTracks(uid, timeRange = 'medium_term', limit = 5) {
  const params = new URLSearchParams({ time_range: timeRange, limit: String(limit) });
  const data = await spotifyFetch(uid, `https://api.spotify.com/v1/me/top/tracks?${params.toString()}`);
  return data?.items ?? [];
}

export async function fetchTopArtists(uid, timeRange = 'medium_term', limit = 5) {
  const params = new URLSearchParams({ time_range: timeRange, limit: String(limit) });
  const data = await spotifyFetch(uid, `https://api.spotify.com/v1/me/top/artists?${params.toString()}`);
  return data?.items ?? [];
}

export async function isSpotifyConnected(uid) {
  return (await getStoredTokens(uid)) !== null;
}
