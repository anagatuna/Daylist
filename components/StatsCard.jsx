import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { splitArtists } from '@/lib/musixmatch';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

const SLOTS = ['morning', 'afternoon', 'night'];

function computeTopArtists(posts) {
  const artistCount = {};
  posts.forEach(p => {
    SLOTS.forEach(slot => {
      const raw = p.songs?.[slot]?.artist;
      if (!raw) return;
      splitArtists(raw).forEach(n => {
        artistCount[n] = (artistCount[n] ?? 0) + 1;
      });
    });
  });
  return Object.entries(artistCount).sort((a, b) => b[1] - a[1]).slice(0, 3);
}

export default function StatsCard({ posts, marginBottom = 0 }) {
  const { colors } = useTheme();
  if (!posts?.length) return null;
  const topArtists = computeTopArtists(posts);
  if (!topArtists.length) return null;

  return (
    <View style={[s.wrap, { marginBottom, backgroundColor: colors.bg, shadowColor: colors.primary, shadowOpacity: colors.cardGlass.shadowOpacitySm }]}>
      <View style={[s.card, { borderColor: colors.cardGlass.border }]}>
        <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, s.cardBg]} />
        <View style={[StyleSheet.absoluteFill, s.cardBg, { backgroundColor: colors.cardGlass.overlay }]} />
        <Text style={[s.title, { color: colors.textMuted }]}>ARTISTAS MÁS ESCUCHADOS</Text>
        {topArtists.map(([artist, count], i) => (
          <View key={artist} style={s.row}>
            <LinearGradient colors={colors.gradientPrimary} style={s.badge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={s.badgeText}>#{i + 1}</Text>
            </LinearGradient>
            <Text style={[s.artist, { color: colors.textPrimary }]} numberOfLines={1}>{artist}</Text>
            <Text style={[s.count, { color: colors.textMuted }]}>{count}x</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: 0, borderRadius: Radius.md, ...Shadow.sm, shadowRadius: 10 },
  card: { borderRadius: Radius.md, padding: 16, borderWidth: 1, gap: 12, overflow: 'hidden' },
  cardBg: { borderRadius: Radius.md },
  title: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { borderRadius: Radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  artist: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', flex: 1 },
  count: { color: Colors.textMuted, fontSize: 12 },
});
