import { useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { fetchTopTracks, fetchTopArtists } from '@/lib/spotifyAuth';

export function useSpotifyTopItems(connected, timeRange = 'medium_term') {
  const [tracks, setTracks] = useState([]);
  const [artists, setArtists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!connected || !uid) return;
    setLoading(true);
    setError(null);
    try {
      const [t, a] = await Promise.all([
        fetchTopTracks(uid, timeRange, 5),
        fetchTopArtists(uid, timeRange, 5),
      ]);
      setTracks(t);
      setArtists(a);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [connected, timeRange]);

  return { tracks, artists, loading, error, reload };
}
