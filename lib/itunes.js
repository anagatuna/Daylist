export async function searchTracks(query) {
  const params = new URLSearchParams({
    term: query,
    media: 'music',
    entity: 'song',
    limit: '20',
  });

  const res = await fetch(`https://itunes.apple.com/search?${params}`);
  const data = await res.json();
  return data.results ?? [];
}

export function serializeTrack(track) {
  return {
    id: String(track.trackId),
    name: track.trackName,
    artist: track.artistName,
    album: track.collectionName,
    albumImage: track.artworkUrl100?.replace('100x100', '400x400') ?? null,
    previewUrl: track.previewUrl ?? null,
    durationMs: track.trackTimeMillis ?? 0,
    spotifyQuery: `${track.trackName} ${track.artistName}`,
  };
}
