function stripTimestamps(text) {
  if (!text) return null;
  return text
    .split('\n')
    .map(line => line.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]\s*/, '').trim())
    .filter(line => line.length > 0)
    .join('\n');
}

export async function getLyrics(trackName, artistName) {
  try {
    const res = await fetch(
      `https://lrclib.net/api/search?track_name=${encodeURIComponent(trackName)}&artist_name=${encodeURIComponent(artistName)}`
    );
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    const match = data[0];
    const raw = match.syncedLyrics ?? match.plainLyrics ?? null;
    return stripTimestamps(raw);
  } catch {
    return null;
  }
}
