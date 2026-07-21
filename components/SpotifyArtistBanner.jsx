import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function SpotifyArtistBanner({ artists, loading, error }) {
  const { colors } = useTheme();
  const router = useRouter();
  const hasData = artists.length > 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push('/stats')}
      style={[s.wrap, { shadowColor: colors.primary, shadowOpacity: colors.cardGlass.shadowOpacitySm }]}
    >
      <View style={[s.card, { borderColor: colors.spotify + '33' }]}>
        <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, s.cardBg]} />
        <View style={[StyleSheet.absoluteFill, s.cardBg, { backgroundColor: colors.cardGlass.overlay }]} />
        <View style={[StyleSheet.absoluteFill, s.cardBg, { backgroundColor: colors.spotify + '0F' }]} />

        <View style={s.headerRow}>
          <View style={[s.badge, { backgroundColor: colors.spotify + '1F' }]}>
            <MaterialCommunityIcons name="spotify" size={14} color={colors.spotify} />
            <Text style={[s.badgeText, { color: colors.spotify }]}>TU SPOTIFY</Text>
          </View>
          <View style={s.statsLink}>
            <Text style={[s.statsLinkText, { color: colors.textMuted }]}>Ver estadísticas</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
          </View>
        </View>

        {loading && !hasData ? (
          <ActivityIndicator color={colors.spotify} style={{ marginVertical: 8 }} />
        ) : error ? (
          <Text style={[s.message, { color: colors.textMuted }]}>Tu conexión con Spotify expiró.</Text>
        ) : !hasData ? (
          <Text style={[s.message, { color: colors.textMuted }]}>Aún no tenemos suficientes datos de tu Spotify.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.artistRow}>
            {artists.map(a => (
              <View key={a.id} style={s.artistItem}>
                {a.images?.[0]?.url ? (
                  <Image source={{ uri: a.images[0].url }} style={s.artistImg} />
                ) : (
                  <View style={[s.artistImg, s.artistImgPlaceholder, { backgroundColor: colors.spotify }]} />
                )}
                <Text style={[s.artistName, { color: colors.textSecondary }]} numberOfLines={1}>{a.name}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: Radius.md, ...Shadow.sm, shadowRadius: 10 },
  card: { borderRadius: Radius.md, padding: 16, borderWidth: 1, gap: 12, overflow: 'hidden' },
  cardBg: { borderRadius: Radius.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  statsLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  statsLinkText: { fontSize: 12, fontWeight: '600' },
  message: { fontSize: 13 },

  artistRow: { gap: 12, paddingRight: 8 },
  artistItem: { alignItems: 'center', width: 56 },
  artistImg: { width: 48, height: 48, borderRadius: 24 },
  artistImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  artistName: { fontSize: 11, marginTop: 4, textAlign: 'center' },
});
