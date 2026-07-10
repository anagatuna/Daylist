import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

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

async function getStoredTokens(uid) {
  const raw = await secureStorage.getItemAsync(tokensKey(uid));
  return raw ? JSON.parse(raw) : null;
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
}

export async function getValidAccessToken(uid) {
  const tokens = await getStoredTokens(uid);
  if (!tokens) return null;
  if (tokens.expires_at - 60000 > Date.now()) return tokens.access_token;
  if (!tokens.refresh_token) {
    await disconnectSpotify(uid);
    return null;
  }
  try {
    const refreshed = await AuthSession.refreshAsync(
      { clientId: CLIENT_ID, refreshToken: tokens.refresh_token },
      DISCOVERY
    );
    const saved = await saveTokens(uid, refreshed);
    return saved.access_token;
  } catch (e) {
    if (e?.code === 'invalid_grant') {
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
