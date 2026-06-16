import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Radius, Shadow } from '@/constants/Theme';

const SLOTS = ['morning', 'afternoon', 'night'];

function computeTopArtists(posts) {
  const artistCount = {};
  posts.forEach(p => {
    SLOTS.forEach(slot => {
      const raw = p.songs?.[slot]?.artist;
      if (!raw) return;
      const names = raw.split(/\s*[&,]\s*|\s+(?:feat\.?|ft\.?|x)\s+/i);
      names.forEach(name => {
        const n = name.trim();
        if (n) artistCount[n] = (artistCount[n] ?? 0) + 1;
      });
    });
  });
  return Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
}

export default function StatsCard({ posts, marginBottom = 0 }) {
  if (!posts?.length) return null;
  const topArtists = computeTopArtists(posts);
  if (!topArtists.length) return null;

  return (
    <View style={[s.wrap, { marginBottom }]}>
      <View style={s.card}>
        <Text style={s.title}>ARTISTAS MÁS ESCUCHADOS</Text>
        {topArtists.map(([artist, count], i) => (
          <View key={artist} style={s.row}>
            <LinearGradient colors={Colors.gradientPrimary} style={s.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.badgeText}>#{i + 1}</Text>
            </LinearGradient>
            <Text style={s.artist} numberOfLines={1}>{artist}</Text>
            <Text style={s.count}>{count}x</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 0 },
  card: { backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, gap: 12, ...Shadow.sm },
  title: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  artist: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },
  count: { color: Colors.textMuted, fontSize: 12 },
});
