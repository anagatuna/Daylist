import { useEffect, useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { auth } from '@/lib/firebase';
import {
  getSpotifyAuthConfig,
  exchangeCodeForTokens,
  disconnectSpotify,
  fetchSpotifyProfile,
  getCachedProfile,
  isSpotifyConnected,
} from '@/lib/spotifyAuth';

export function friendlySpotifyError(err) {
  const code = err?.code ?? err?.params?.error;
  if (code === 'access_denied') return 'Cancelaste la conexión con Spotify.';
  if (err?.message?.toLowerCase().includes('network')) return 'Sin conexión a internet. Intenta de nuevo.';
  return 'No se pudo conectar con Spotify. Intenta de nuevo.';
}

export function useSpotifyAuth() {
  const uid = auth.currentUser?.uid ?? null;
  const [connected, setConnected] = useState(false);
  const [profile, setProfile] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(null);

  const { clientId, scopes, redirectUri, discovery } = getSpotifyAuthConfig();
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    { clientId, scopes, redirectUri, usePKCE: true, responseType: AuthSession.ResponseType.Code },
    discovery
  );

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    WebBrowser.warmUpAsync().catch(() => {});
    return () => { WebBrowser.coolDownAsync().catch(() => {}); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!uid) { setChecking(false); return; }
      setChecking(true);
      const [cached, connectedNow] = await Promise.all([getCachedProfile(uid), isSpotifyConnected(uid)]);
      if (cancelled) return;
      setConnected(connectedNow);
      setProfile(cached);
      setChecking(false);
      if (connectedNow) {
        fetchSpotifyProfile(uid).then(p => { if (!cancelled && p) setProfile(p); }).catch(() => {});
      }
    }
    load();
    return () => { cancelled = true; };
  }, [uid]);

  useEffect(() => {
    if (!response || !uid) return;
    if (response.type === 'success') {
      exchangeCodeForTokens(uid, response.params.code, request.codeVerifier)
        .then(() => {
          setConnected(true);
          setConnecting(false);
          fetchSpotifyProfile(uid).then(p => { if (p) setProfile(p); }).catch(() => {});
        })
        .catch(err => { setError(err); setConnecting(false); });
    } else if (response.type === 'error') {
      setError(response.error);
      setConnecting(false);
    } else if (response.type === 'dismiss' || response.type === 'cancel') {
      setConnecting(false);
    }
  }, [response, uid]);

  const connect = useCallback(async () => {
    setError(null);
    setConnecting(true);
    await promptAsync();
  }, [promptAsync]);

  const disconnect = useCallback(async () => {
    if (!uid) return;
    await disconnectSpotify(uid);
    setConnected(false);
    setProfile(null);
  }, [uid]);

  return { connected, connecting, checking, profile, error, connect, disconnect };
}
