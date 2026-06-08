import React, { useEffect, useState, useCallback } from 'react';
import {
  Platform, ScrollView, StatusBar, StyleSheet, Text, View,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { TrackBlock } from '@/components/TrackBlock';
import SongCard from '@/components/SongCard';
import Reactions from '@/components/Reactions';
import { Colors, Radius } from '@/constants/Theme';

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.eyebrow}>Tu soundtrack ✨</Text>
              <Text style={styles.logo}>daylist</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/post/create')} activeOpacity={0.85}>
              <LinearGradient colors={Colors.gradientPrimary} style={styles.addBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="add" size={22} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Text style={styles.dateTitle}>{dayName}</Text>
          <Text style={styles.dateSub}>{dayNum} de {month}</Text>

          <LinearGradient
            colors={remaining === 0 ? ['rgba(52,211,153,0.15)', 'rgba(52,211,153,0.05)'] : ['rgba(192,132,252,0.1)', 'rgba(244,114,182,0.05)']}
            style={styles.statusChip}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <View style={[styles.statusDot, { backgroundColor: remaining === 0 ? '#34D399' : Colors.primary }]} />
            <Text style={styles.statusText}>
              {remaining === 0 ? '✨ Día completo' : `${remaining} momento${remaining !== 1 ? 's' : ''} por registrar`}
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.divider} />

        {/* ── Mis canciones ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>✦ MIS MOMENTOS</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : myPost ? (
            SLOTS_META.map(({ key }) =>
              myPost.songs?.[key] ? <SongCard key={key} song={myPost.songs[key]} slot={key} /> : null
            )
          ) : (
            <View style={styles.blocksGroup}>
              {mySlots.map((slot, i) => (
                <React.Fragment key={slot.timeOfDay}>
                  <TrackBlock slot={slot} onAdd={() => router.push('/post/create')} onPlay={() => {}} />
                  {i < mySlots.length - 1 && <View style={{ height: 10 }} />}
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* ── Feed amigos ── */}
        {friendPosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.divider} />
            <Text style={styles.sectionHeader}>✦ HOY EN TU RED</Text>
            {friendPosts.map(post => (
              <View key={post.id} style={styles.friendPost}>
                <TouchableOpacity style={styles.friendHeader} onPress={() => router.push(`/user/${post.uid}`)}>
                  {post.avatar ? (
                    <Image source={{ uri: post.avatar }} style={styles.avatarImg} />
                  ) : (
                    <LinearGradient colors={Colors.gradientPrimary} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                      <Text style={styles.avatarText}>{post.displayName?.[0]?.toUpperCase()}</Text>
                    </LinearGradient>
                  )}
                  <Text style={styles.friendName}>{post.displayName}</Text>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
                {SLOTS_META.map(({ key }) =>
                  post.songs?.[key] ? <SongCard key={key} song={post.songs[key]} slot={key} /> : null
                )}
                <Reactions postId={post.id} reactions={post.reactions ?? {}} postOwnerUid={post.uid} />
              </View>
            ))}
          </View>
        )}

        {!loading && friendPosts.length === 0 && filled > 0 && (
          <View style={styles.emptyFriends}>
            <Text style={styles.emptyFriendsEmoji}>🌸</Text>
            <Text style={styles.emptyFriendsText}>Agrega amigos para ver sus canciones del día</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingBottom: 48 },
  header: { paddingTop: Platform.OS === 'ios' ? 12 : 20, marginBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  eyebrow: { fontSize: 12, color: Colors.textMuted, fontWeight: '500', marginBottom: 2 },
  logo: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1.5 },
  addBtn: { borderRadius: 14, padding: 10 },
  dateTitle: { fontSize: 34, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -0.5 },
  dateSub: { fontSize: 14, color: Colors.textSecondary, marginTop: 2, marginBottom: 16 },
  statusChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 7, gap: 7, borderWidth: 1, borderColor: 'rgba(192,132,252,0.15)' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: 24 },
  section: { marginBottom: 8 },
  sectionHeader: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 14 },
  blocksGroup: {},
  friendPost: { marginBottom: 28 },
  friendHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  avatarImg: { width: 36, height: 36, borderRadius: 18 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  friendName: { flex: 1, color: Colors.textPrimary, fontWeight: '600', fontSize: 15 },
  emptyFriends: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyFriendsEmoji: { fontSize: 36 },
  emptyFriendsText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center' },
});