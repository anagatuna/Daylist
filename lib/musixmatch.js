export async function getLyrics(trackName, artistName) {
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const match = data[0];
    // Prefiere letra sincronizada, si no la plana
    return match.syncedLyrics ?? match.plainLyrics ?? null;
  } catch {
    return null;
  }
}
