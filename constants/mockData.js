// constants/mockData.js

export const MOCK_TRACKS = [
  {
    id: 'track-001',
    title: 'Espresso',
    artist: 'Sabrina Carpenter',
    albumName: "Short n' Sweet",
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b2730b9d8cbd7cb7f12eba6e4fc6',
    previewUrl: 'https://p.scdn.co/mp3-preview/f1e2adde1c87e7e6f9e0de9b77de3e4e0f4b5e1a',
    durationMs: 175000,
    note: 'modo caffeinated total ☕✨',
    alternativeCovers: [],
  },
  {
    id: 'track-002',
    title: 'Not Like Us',
    artist: 'Kendrick Lamar',
    albumName: 'Not Like Us (Single)',
    coverUrl: 'https://i.scdn.co/image/ab67616d0000b273f3cd5d8a1f4a1e2d8b3e5f7c',
    previewUrl: 'https://p.scdn.co/mp3-preview/a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1',
    durationMs: 274000,
    note: 'Salió el código al primer intento 💻🔥',
    segment: { startMs: 45000, endMs: 90000 },
  },
];

export const TODAY_ENTRY = {
  date: new Date().toISOString().split('T')[0],
  slots: [
    {
      timeOfDay: 'morning',
      label: 'Mañana',
      emoji: '☀️',
      track: MOCK_TRACKS[0],
    },
    {
      timeOfDay: 'afternoon',
      label: 'Tarde',
      emoji: '🌅',
      track: MOCK_TRACKS[1],
    },
    {
      timeOfDay: 'night',
      label: 'Noche',
      emoji: '🌙',
      track: null,
    },
  ],
};