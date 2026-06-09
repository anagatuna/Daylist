async function searchItunes(query) {
  try {
    const params = new URLSearchParams({
      term: query, media: 'music', entity: 'song',
      limit: '20', country: 'us', lang: 'en_us',
    });
    const res = await fetch(`https://itunes.apple.com/search?${params}`);
    const data = await res.json();
    return (data.results ?? []).map(t => ({
      _id: `itunes-${t.trackId}`,
      trackId: t.trackId,
      trackName: t.trackName,
      artistName: t.artistName,
      collectionName: t.collectionName,
      artworkUrl100: t.artworkUrl100,
      previewUrl: t.previewUrl ?? null,
      trackTimeMillis: t.trackTimeMillis ?? 0,
    }));
  } catch { return []; }
}

async function searchDeezer(query) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=20&order=RANKING`
    );
    const data = await res.json();
    return (data.data ?? []).map(t => ({
      _id: `deezer-${t.id}`,
      trackId: t.id,
      trackName: t.title,
      artistName: t.artist?.name ?? '',
      collectionName: t.album?.title ?? '',
      artworkUrl100: t.album?.cover_xl ?? t.album?.cover_big ?? null,
      previewUrl: t.preview ?? null,
      trackTimeMillis: (t.duration ?? 0) * 1000,
    }));
  } catch { return []; }
}

export async function searchTracks(query) {
  // Buscar en ambas fuentes en paralelo
  const [itunesResults, deezerResults] = await Promise.all([
    searchItunes(query),
    searchDeezer(query),
  ]);

  // Merge sin duplicados
  const seen = new Set(
    itunesResults.map(t => `${t.trackName?.toLowerCase()}|${t.artistName?.toLowerCase()}`)
  );
  const deezerOnly = deezerResults.filter(t => {
    const key = `${t.trackName?.toLowerCase()}|${t.artistName?.toLowerCase()}`;
    return !seen.has(key);
  });

  const all = [...itunesResults, ...deezerOnly];

  // Ordenar por relevancia respecto a la búsqueda
  const q = query.toLowerCase().trim();
  const score = (t) => {
    const name = t.trackName?.toLowerCase() ?? '';
    const artist = t.artistName?.toLowerCase() ?? '';
    const combined = `${name} ${artist}`;
    if (name === q)                     return 100; // coincidencia exacta del título
    if (combined === q)                 return 95;
    if (name.startsWith(q))            return 80;
    if (combined.startsWith(q))        return 70;
    if (name.includes(q))              return 60;
    if (combined.includes(q))          return 50;
    // cuántas palabras de la query están en el resultado
    const words = q.split(' ').filter(Boolean);
    const hits = words.filter(w => combined.includes(w)).length;
    return (hits / words.length) * 40;
  };

  return all.sort((a, b) => score(b) - score(a));
}

export function serializeTrack(track) {
  return {
    id: String(track.trackId),
    name: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    albumImage: track.artworkUrl100?.replace('100x100bb', '400x400bb')?.replace('100x100', '400x400') ?? null,
    previewUrl: track.previewUrl ?? null,
    durationMs: track.trackTimeMillis ?? 0,
    spotifyQuery: `${track.trackName} ${track.artistName}`,
  };
}
