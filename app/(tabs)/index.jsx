import React, { useEffect, useState, useCallback } from 'react';
import {
  Platform, ScrollView, StatusBar, StyleSheet, Text, View,
  TouchableOpacity, ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { TrackBlock } from '@/components/TrackBlock';
import SongCard from '@/components/SongCard';
import Reactions from '@/components/Reactions';

const SLOTS_META = [
  { key: 'morning',   label: 'Mañana',   emoji: '☀️' },
  { key: 'afternoon', label: 'Tarde',     emoji: '🌅' },
  { key: 'night',     label: 'Noche',     emoji: '🌙' },
];

function formatDate(isoDate) {
  const date = new Date(isoDate + 'T12:00:00');
  const dayName = date.toLocaleDateString('es-MX', { weekday: 'long' });
  const dayNum  = date.getDate();
  const month   = date.toLocaleDateString('es-MX', { month: 'long' });
  return {
    dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
    dayNum,
    month,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);
  const { dayName, dayNum, month } = formatDate(today);

  const [myPost, setMyPost]       = useState(null);
  const [friendPosts, setFriendPosts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function loadData() {
    if (!user) return;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const friends = userDoc.data()?.friends ?? [];

    // Post propio de hoy
    const myQ = query(
      collection(db, 'posts'),
      where('uid', '==', user.uid),
      where('date', '==', today)
    );
    const mySnap = await getDocs(myQ);
    setMyPost(mySnap.empty ? null : { id: mySnap.docs[0].id, ...mySnap.docs[0].data() });

    // Posts de amigos
    if (friends.length > 0) {
      const fQ = query(
        collection(db, 'posts'),
        where('uid', 'in', friends.slice(0, 10)),
        where('date', '==', today),
        orderBy('createdAt', 'desc')
      );
      const fSnap = await getDocs(fQ);
      setFriendPosts(fSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } else {
      setFriendPosts([]);
    }
  }

  useEffect(() => {
    if (user) loadData().finally(() => setLoading(false));
  }, [user]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // Construir slots para TrackBlock con datos reales
  function buildSlots(post) {
    return SLOTS_META.map(({ key, label, emoji }) => {
      const s = post?.songs?.[key];
      return {
        timeOfDay: key,
        label,
        emoji,
        track: s ? {
          title: s.name,
          artist: s.artist,
          coverUrl: s.albumImage,
          previewUrl: s.previewUrl,
          note: s.phrase || null,
          segment: s.startSec != null ? { startMs: s.startSec * 1000, endMs: (s.endSec ?? 30) * 1000 } : null,
        } : null,
      };
    });
  }

  const mySlots = buildSlots(myPost);
  const filled = mySlots.filter(s => s.track).length;
  const remaining = 3 - filled;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#1DB954" />}
      >
        {/* ── Encabezado ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.logo}>daylist</Text>
            <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/post/create')}>
              <Ionicons name="add" size={22} color="#000" />
            </TouchableOpacity>
          </View>
          <Text style={styles.eyebrow}>Tu soundtrack</Text>
          <Text style={styles.title}>{dayName}</Text>
          <Text style={styles.subtitle}>{dayNum} de {month}</Text>

          <View style={styles.statusChip}>
            <View style={[styles.statusDot, { backgroundColor: remaining === 0 ? '#30D158' : '#636366' }]} />
            <Text style={styles.statusText}>
              {remaining === 0 ? 'Día completo' : `${remaining} momento${remaining !== 1 ? 's' : ''} por registrar`}
            </Text>
          </View>
        </View>

        <View style={styles.separator} />

        {/* ── Mis canciones del día ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MIS MOMENTOS DEL DÍA</Text>
          {loading ? (
            <ActivityIndicator color="#1DB954" />
          ) : myPost ? (
            // Si ya publiqué hoy, mostrar con SongCard (tiene player, letra, Spotify)
            SLOTS_META.map(({ key }) =>
              myPost.songs?.[key] ? (
                <SongCard key={key} song={myPost.songs[key]} slot={key} />
              ) : null
            )
          ) : (
            // Si no he publicado, mostrar los slots vacíos con TrackBlock
            <View style={styles.blocksGroup}>
              {mySlots.map((slot, i) => (
                <React.Fragment key={slot.timeOfDay}>
                  <TrackBlock
                    slot={slot}
                    onAdd={() => router.push('/post/create')}
                    onPlay={() => {}}
                  />
                  {i < mySlots.length - 1 && <View style={styles.inlineSeparator} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* ── Feed de amigos ── */}
        {friendPosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.separator} />
            <Text style={styles.sectionHeader}>HOY EN TU RED</Text>
            {friendPosts.map(post => (
              <View key={post.id} style={styles.friendPost}>
                <TouchableOpacity
                  style={styles.friendHeader}
                  onPress={() => router.push(`/user/${post.uid}`)}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{post.displayName?.[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={styles.friendName}>{post.displayName}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#555" />
                </TouchableOpacity>
                {SLOTS_META.map(({ key }) =>
                  post.songs?.[key] ? (
                    <SongCard key={key} song={post.songs[key]} slot={key} />
                  ) : null
                )}
                <Reactions postId={post.id} reactions={post.reactions ?? {}} />
              </View>
            ))}
          </View>
        )}

        {!loading && friendPosts.length === 0 && filled > 0 && (
          <Text style={styles.footerHint}>
            Agrega amigos para ver sus canciones del día
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  header: { paddingTop: Platform.OS === 'ios' ? 12 : 20, marginBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logo: { fontSize: 28, fontWeight: '800', color: '#1DB954', letterSpacing: -1 },
  addBtn: { backgroundColor: '#1DB954', borderRadius: 10, padding: 6 },
  eyebrow: { fontSize: 13, fontWeight: '500', color: '#636366', letterSpacing: 0.2, marginBottom: 6 },
  title: { fontSize: 34, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontWeight: '400', color: '#8E8E93', marginTop: 2, marginBottom: 14 },
  statusChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#1C1C1E', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '500', color: '#8E8E93' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#38383A', marginBottom: 24 },
  section: { marginBottom: 8 },
  sectionHeader: { fontSize: 12, fontWeight: '600', color: '#636366', letterSpacing: 1, marginBottom: 12, paddingLeft: 4 },
  blocksGroup: { gap: 0 },
  inlineSeparator: { height: 10 },
  friendPost: { marginBottom: 24 },
  friendHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 14 },
  friendName: { flex: 1, color: '#fff', fontWeight: '600', fontSize: 15 },
  footerHint: { fontSize: 12, color: '#3A3A3C', textAlign: 'center', marginTop: 32, letterSpacing: 0.2 },
});