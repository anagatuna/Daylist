import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { fetchTopArtists, fetchTopTracks } from '@/lib/spotifyAuth';
import { splitArtists } from '@/lib/musixmatch';
import { Radius } from '@/constants/Theme';

const SLOTS = ['morning', 'afternoon', 'night'];
const RANGES = [
  { key: 'short_term', label: '4 semanas' },
  { key: 'medium_term', label: '6 meses' },
  { key: 'long_term', label: 'Siempre' },
];

export default function StatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { connected: spotifyConnected, connecting, connect } = useSpotifyAuth();

  const [range, setRange] = useState('medium_term');
  const [artists, setArtists] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [daylistCounts, setDaylistCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user || !spotifyConnected) { setLoading(false); return; }
    load();
  }, [user, spotifyConnected, range]);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const [a, t] = await Promise.all([
        fetchTopArtists(user.uid, range, 15),
        fetchTopTracks(user.uid, range, 15),
      ]);
      setArtists(a);
      setTracks(t);
      await loadDaylistCounts(a);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadDaylistCounts(topArtists) {
    if (topArtists.length === 0) { setDaylistCounts({}); return; }
    const snap = await getDocs(query(collection(db, 'posts'), where('uid', '==', user.uid)));
    const counts = {};
    const targets = topArtists.map(a => ({ id: a.id, name: a.name.toLowerCase() }));
    targets.forEach(t => { counts[t.id] = 0; });

    snap.docs.forEach(d => {
      const post = d.data();
      SLOTS.forEach(slot => {
        const raw = post.songs?.[slot]?.artist;
        if (!raw) return;
        const names = splitArtists(raw).map(n => n.toLowerCase());
        targets.forEach(t => { if (names.includes(t.name)) counts[t.id]++; });
      });
    });
    setDaylistCounts(counts);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={[]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
        <LinearGradient
          colors={isDark
            ? ['rgba(30,215,96,0.22)', 'rgba(180,141,224,0.10)', 'rgba(0,0,0,0)']
            : ['rgba(30,215,96,0.28)', 'rgba(155,109,214,0.14)', 'rgba(0,0,0,0)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroRow}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.38)' }]}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>Estadísticas</Text>
          <View style={{ width: 36 }} />
        </View>

        <View style={styles.rangeRow}>
          {RANGES.map(r => (
            <TouchableOpacity key={r.key} onPress={() => setRange(r.key)} activeOpacity={0.75}>
              {range === r.key ? (
                <LinearGradient colors={colors.gradientPrimary} style={styles.rangePillActive} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.rangeTextActive}>{r.label}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.rangePill, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                  <Text style={[styles.rangeText, { color: colors.textMuted }]}>{r.label}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {!spotifyConnected ? (
        <View style={styles.connectGate}>
          <MaterialCommunityIcons name="spotify" size={48} color={colors.spotify} />
          <Text style={[styles.connectTitle, { color: colors.textPrimary }]}>Conecta tu Spotify</Text>
          <Text style={[styles.connectSubtitle, { color: colors.textMuted }]}>
            Conecta tu cuenta para ver tus artistas, canciones y álbumes más escuchados.
          </Text>
          <TouchableOpacity onPress={connect} disabled={connecting} activeOpacity={0.85} style={[styles.spotifyConnectBtn, { borderColor: colors.spotify }]}>
            {connecting ? (
              <ActivityIndicator color={colors.spotify} />
            ) : (
              <>
                <MaterialCommunityIcons name="spotify" size={18} color={colors.spotify} />
                <Text style={[styles.spotifyConnectText, { color: colors.spotify }]}>Conectar con Spotify</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} />
      ) : error ? (
        <View style={styles.connectGate}>
          <Ionicons name="alert-circle-outline" size={40} color={colors.textMuted} />
          <Text style={[styles.connectSubtitle, { color: colors.textMuted }]}>No se pudieron cargar tus estadísticas de Spotify.</Text>
          <TouchableOpacity onPress={load} activeOpacity={0.85} style={[styles.spotifyConnectBtn, { borderColor: colors.primary }]}>
            <Text style={[styles.spotifyConnectText, { color: colors.primary }]}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Artistas */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ARTISTAS MÁS ESCUCHADOS</Text>
          {artists.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aún no tenemos suficientes datos.</Text>
          ) : (
            <View style={styles.artistGrid}>
              {artists.map((a, i) => (
                <View key={a.id} style={styles.artistCol}>
                  <View style={styles.artistImgWrap}>
                    {a.images?.[0]?.url ? (
                      <Image source={{ uri: a.images[0].url }} style={styles.artistImg} />
                    ) : (
                      <View style={[styles.artistImg, { backgroundColor: colors.spotify }]} />
                    )}
                    <View style={[styles.rankBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                      <Text style={[styles.rankText, { color: colors.textPrimary }]}>{i + 1}</Text>
                    </View>
                  </View>
                  <Text style={[styles.artistName, { color: colors.textPrimary }]} numberOfLines={1}>{a.name}</Text>
                  {daylistCounts[a.id] > 0 && (
                    <View style={[styles.daylistBadge, { backgroundColor: colors.primary + '18' }]}>
                      <Text style={[styles.daylistBadgeText, { color: colors.primary }]}>
                        {daylistCounts[a.id]}× en tu Daylist
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Canciones */}
          <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: 28 }]}>CANCIONES MÁS ESCUCHADAS</Text>
          {tracks.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aún no tenemos suficientes datos.</Text>
          ) : (
            <View style={[styles.card, { borderColor: colors.cardGlass.border }]}>
              <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]} />
              <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg, backgroundColor: colors.cardGlass.overlay }]} />
              {tracks.map((t, i) => (
                <View key={t.id} style={[styles.trackRow, i > 0 && { borderTopColor: colors.borderLight, borderTopWidth: StyleSheet.hairlineWidth }]}>
                  <Text style={[styles.trackRank, { color: colors.textMuted }]}>{i + 1}</Text>
                  {t.album?.images?.[0]?.url ? (
                    <Image source={{ uri: t.album.images[0].url }} style={styles.trackImg} />
                  ) : (
                    <View style={[styles.trackImg, { backgroundColor: colors.border }]} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.trackName, { color: colors.textPrimary }]} numberOfLines={1}>{t.name}</Text>
                    <Text style={[styles.trackArtist, { color: colors.textMuted }]} numberOfLines={1}>{t.artists?.map(ar => ar.name).join(', ')}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 16, paddingBottom: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 18, fontWeight: '700' },
  rangeRow: { flexDirection: 'row', gap: 8, justifyContent: 'center' },
  rangePill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill },
  rangePillActive: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill },
  rangeText: { fontSize: 13, fontWeight: '600' },
  rangeTextActive: { color: '#fff', fontSize: 13, fontWeight: '700' },

  connectGate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  connectTitle: { fontSize: 18, fontWeight: '700', marginTop: 4 },
  connectSubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 19 },
  spotifyConnectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 20, paddingVertical: 12, marginTop: 10 },
  spotifyConnectText: { fontWeight: '700', fontSize: 14 },

  scroll: { paddingHorizontal: 16, paddingBottom: 60 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 12 },
  emptyText: { fontSize: 13, fontStyle: 'italic' },

  artistGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 20 },
  artistCol: { width: '30%', alignItems: 'center' },
  artistImgWrap: { position: 'relative' },
  artistImg: { width: 72, height: 72, borderRadius: 36 },
  rankBadge: { position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  rankText: { fontSize: 11, fontWeight: '800' },
  artistName: { fontSize: 12, fontWeight: '600', marginTop: 8, textAlign: 'center' },
  daylistBadge: { borderRadius: Radius.pill, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  daylistBadgeText: { fontSize: 10, fontWeight: '700' },

  card: { borderRadius: Radius.lg, padding: 14, borderWidth: 1, overflow: 'hidden', gap: 0 },
  trackRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  trackRank: { fontSize: 13, fontWeight: '700', width: 16, textAlign: 'center' },
  trackImg: { width: 42, height: 42, borderRadius: 6 },
  trackName: { fontSize: 14, fontWeight: '600' },
  trackArtist: { fontSize: 12, marginTop: 1 },
});
