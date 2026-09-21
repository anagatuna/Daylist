const ARTIST_SPLIT_RE = /\s*[&,]\s*|\s+(?:feat\.?|ft\.?|x)\s+/i;
const DURATION_TOLERANCE_SEC = 3;
const GENIUS_TOKEN = process.env.EXPO_PUBLIC_GENIUS_TOKEN;

const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
};

// Las líneas destacadas se guardan como texto exacto de la letra en el
// momento de seleccionarlas. Si después cambia la fuente de la letra (ej. de
// lrclib a Genius), el mismo verso puede venir con distinta puntuación/acentos
// y ya no calza como texto exacto. Se compara normalizado para que las líneas
// ya destacadas se sigan reconociendo aunque cambie el formato de la fuente.
export function normalizeLyricLine(line) {
  if (!line) return '';
  return line
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[¿?¡!.,;:"'“”‘’()[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(str) {
  return str
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, name) => HTML_ENTITIES[name] ?? '');
}

// Genius no da la letra por su API oficial, solo un link a la página. Buscamos
// el bloque de divs con la letra y le sacamos el texto a mano (sin cheerio/DOM,
// que no existen en React Native) contando llaves de apertura/cierre de <div>.
function findMatchingDivEnd(html, openTagStart) {
  const re = /<div\b[^>]*>|<\/div>/gi;
  re.lastIndex = openTagStart;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0].startsWith('</')) {
      depth--;
      if (depth === 0) return m.index;
    } else {
      depth++;
    }
  }
  return -1;
}

function extractGeniusLyrics(html) {
  const marker = 'data-lyrics-container="true"';
  const fragments = [];
  let searchFrom = 0;

  while (true) {
    const markerIdx = html.indexOf(marker, searchFrom);
    if (markerIdx === -1) break;
    const divStart = html.lastIndexOf('<div', markerIdx);
    if (divStart === -1) break;
    const contentStart = html.indexOf('>', divStart) + 1;
    const end = findMatchingDivEnd(html, divStart);
    if (end === -1) break;
    fragments.push(html.slice(contentStart, end));
    searchFrom = end + 6;
  }

  if (fragments.length === 0) return null;

  let text = decodeHtmlEntities(
    fragments
      .join('\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
  ).trim();

  // Genius a veces mete antes de la letra un header "N Contributors...Lyrics"
  // o una descripción de la canción con "...Read More". Ambos casos terminan
  // justo antes de la primera etiqueta de sección ("[Verso 1]", "[Chorus]"...),
  // así que cortamos ahí si aparece cerca del inicio.
  const bracketIdx = text.indexOf('[');
  if (bracketIdx > 0 && bracketIdx < 600) text = text.slice(bracketIdx);

  // La primera etiqueta a veces es solo "[Letra de "Título"]", que no aporta
  // nada (ya se ve el título en la tarjeta), así que se descarta si aparece.
  text = text.replace(/^\[Letra de ["“][^\]]*["”]\]\s*\n*/i, '').trim();

  return text || null;
}

async function searchGenius(trackName, artistName) {
  if (!GENIUS_TOKEN) return null;
  try {
    const q = encodeURIComponent(`${artistName} ${trackName}`);
    const res = await fetch(`https://api.genius.com/search?q=${q}`, {
      headers: { Authorization: `Bearer ${GENIUS_TOKEN}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data?.response?.hits?.map(h => h.result) ?? [];

    const target = (artistName || '').toLowerCase();
    const hit = hits.find(h => {
      const a = (h.primary_artist?.name || '').toLowerCase();
      return a && (a.includes(target) || target.includes(a));
    });
    if (!hit?.url) return null;

    const pageRes = await fetch(hit.url);
    if (!pageRes.ok) return null;
    const html = await pageRes.text();
    return extractGeniusLyrics(html);
  } catch {
    return null;
  }
}

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

export function splitArtists(artistName) {
  if (!artistName) return [];
  return artistName.split(ARTIST_SPLIT_RE).map(n => n.trim()).filter(Boolean);
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

export function isSectionMarker(line) {
  return /^\[.+\]$/.test(line.trim());
}

export async function getLyrics(trackName, artistName, durationSec = null) {
  const first = primaryArtist(artistName);
  const cleanedTrack = cleanTrackName(trackName);

  const genius = await searchGenius(cleanedTrack || trackName, first || artistName);
  if (genius) return genius;

  const attempts = [
    { track_name: trackName, artist_name: artistName },
    first && first !== artistName ? { track_name: trackName, artist_name: first } : null,
    cleanedTrack !== trackName ? { track_name: cleanedTrack, artist_name: first || artistName } : null,
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
