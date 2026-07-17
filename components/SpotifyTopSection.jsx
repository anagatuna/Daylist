import { View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function SpotifyTopSection({ tracks, artists, loading, error }) {
  const { colors } = useTheme();
  const router = useRouter();

  const hasData = tracks.length > 0 || artists.length > 0;

  return (
    <View style={[s.wrap, { marginBottom: 16, shadowColor: colors.primary, shadowOpacity: colors.cardGlass.shadowOpacitySm }]}>
      <View style={[s.card, { borderColor: colors.spotify + '33' }]}>
        <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, s.cardBg]} />
        <View style={[StyleSheet.absoluteFill, s.cardBg, { backgroundColor: colors.cardGlass.overlay }]} />
        <View style={[StyleSheet.absoluteFill, s.cardBg, { backgroundColor: colors.spotify + '0F' }]} />

        <View style={[s.header, { backgroundColor: colors.spotify + '1F' }]}>
          <MaterialCommunityIcons name="spotify" size={14} color={colors.spotify} />
          <Text style={[s.title, { color: colors.spotify }]}>TU SPOTIFY</Text>
        </View>

        {loading && !hasData ? (
          <ActivityIndicator color={colors.spotify} style={{ marginVertical: 8 }} />
        ) : error ? (
          <View style={s.messageRow}>
            <Text style={[s.message, { color: colors.textMuted }]}>Tu conexión con Spotify expiró.</Text>
            <TouchableOpacity onPress={() => router.push('/edit-profile')}>
              <Text style={[s.reconnect, { color: colors.spotify }]}>Reconectar</Text>
            </TouchableOpacity>
          </View>
        ) : !hasData ? (
          <Text style={[s.message, { color: colors.textMuted }]}>Aún no tenemos suficientes datos de tu Spotify.</Text>
        ) : (
          <>
            {artists.length > 0 && (
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

            {tracks.length > 0 && (
              <View style={s.trackList}>
                {tracks.map((t, i) => (
                  <View key={t.id} style={s.trackRow}>
                    <Text style={[s.trackRank, { color: colors.textMuted }]}>{i + 1}</Text>
                    {t.album?.images?.[0]?.url ? (
                      <Image source={{ uri: t.album.images[0].url }} style={s.trackImg} />
                    ) : (
                      <View style={[s.trackImg, { backgroundColor: colors.border }]} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[s.trackName, { color: colors.textPrimary }]} numberOfLines={1}>{t.name}</Text>
                      <Text style={[s.trackArtist, { color: colors.textMuted }]} numberOfLines={1}>{t.artists?.[0]?.name}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: Radius.md, ...Shadow.sm, shadowRadius: 10 },
  card: { borderRadius: Radius.md, padding: 16, borderWidth: 1, gap: 12, overflow: 'hidden' },
  cardBg: { borderRadius: Radius.md },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  message: { fontSize: 13 },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  reconnect: { fontSize: 13, fontWeight: '700' },

  artistRow: { gap: 12, paddingRight: 8 },
  artistItem: { alignItems: 'center', width: 56 },
  artistImg: { width: 48, height: 48, borderRadius: 24 },
  artistImgPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  artistName: { fontSize: 11, marginTop: 4, textAlign: 'center' },

  trackList: { gap: 10 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  trackRank: { fontSize: 12, fontWeight: '700', width: 14, textAlign: 'center' },
  trackImg: { width: 36, height: 36, borderRadius: 6 },
  trackName: { fontSize: 13, fontWeight: '600' },
  trackArtist: { fontSize: 11, marginTop: 1 },
});
