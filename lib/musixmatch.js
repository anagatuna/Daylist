const ARTIST_SPLIT_RE = /\s*[&,]\s*|\s+(?:feat\.?|ft\.?|x)\s+/i;
const DURATION_TOLERANCE_SEC = 3;

function stripTimestamps(text) {
  if (!text) return null;
  return text
    .split('\n')
    .map(line => line.replace(/^\[\d{2}:\d{2}\.\d{2,3}\]\s*/, '').trim())
    .filter(line => line.length > 0)
    .join('\n');
}

function primaryArtist(artistName) {
  if (!artistName) return '';
  return artistName.split(ARTIST_SPLIT_RE)[0].trim();
}

function cleanTrackName(trackName) {
  if (!trackName) return '';
  return trackName
    .replace(/\s*[\(\[][^)\]]*[\)\]]/g, '')
    .replace(/\s*-\s*(remaster(ed)?(\s*\d{4})?|live|radio edit|acoustic( version)?|single version|mono|stereo|deluxe|bonus track).*$/i, '')
    .trim();
}

async function searchLrclib(params) {
  try {
    const qs = new URLSearchParams(params);
    const res = await fetch(`https://lrclib.net/api/search?${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchLyricsOvh(artistName, trackName) {
  try {
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistName)}/${encodeURIComponent(trackName)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data.lyrics ? data.lyrics.trim() : null;
  } catch {
    return null;
  }
}

function pickBestMatch(results, durationSec) {
  const withLyrics = results.filter(r => r.syncedLyrics || r.plainLyrics);
  if (withLyrics.length === 0) return null;

  const candidates = durationSec
    ? withLyrics.filter(r => !r.duration || Math.abs(r.duration - durationSec) <= DURATION_TOLERANCE_SEC)
    : withLyrics;

  const pool = candidates.length > 0 ? candidates : withLyrics;
  return pool[0];
}

export async function getLyrics(trackName, artistName, durationSec = null) {
  const first = primaryArtist(artistName);
  const cleanedTrack = cleanTrackName(trackName);

  const attempts = [
    { track_name: trackName, artist_name: artistName },
    first && first !== artistName ? { track_name: trackName, artist_name: first } : null,
    cleanedTrack !== trackName ? { track_name: cleanedTrack, artist_name: first || artistName } : null,
    { track_name: cleanedTrack || trackName },
  ].filter(Boolean);

  for (const attempt of attempts) {
    const results = await searchLrclib(attempt);
    const match = pickBestMatch(results, durationSec);
    if (match) return stripTimestamps(match.syncedLyrics ?? match.plainLyrics);
  }

  const ovh = await fetchLyricsOvh(first || artistName, cleanedTrack || trackName);
  if (ovh) return ovh;

  return null;
}
