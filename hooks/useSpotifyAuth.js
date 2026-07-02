import { useEffect, useState, useCallback } from 'react';
import * as AuthSession from 'expo-auth-session';
import { auth } from '@/lib/firebase';
import {
  getSpotifyAuthConfig,
  exchangeCodeForTokens,
  disconnectSpotify,
  fetchSpotifyProfile,
  getCachedProfile,
  isSpotifyConnected,
} from '@/lib/spotifyAuth';

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
        .then(() => fetchSpotifyProfile(uid))
        .then(p => { setProfile(p); setConnected(true); })
        .catch(err => setError(err))
        .finally(() => setConnecting(false));
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
