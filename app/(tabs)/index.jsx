import React, { useEffect, useState, useCallback } from 'react';
import {
  Platform, ScrollView, StatusBar, StyleSheet, Text, View,
  TouchableOpacity, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, getDocs, doc, getDoc, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { localDateStr } from '@/lib/date';
import { useAuth } from '@/hooks/useAuth';
import { TrackBlock } from '@/components/TrackBlock';
import SongCard from '@/components/SongCard';
import { Colors, Radius, Shadow } from '@/constants/Theme';

const SLOTS_META = [
  { key: 'morning',   label: 'Mañana' },
  { key: 'afternoon', label: 'Tarde' },
  { key: 'night',     label: 'Noche' },
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
  const today = localDateStr();
  const { dayName, dayNum, month } = formatDate(today);

  const [myPost, setMyPost]       = useState(null);
  const [friendPosts, setFriendPosts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commentCounts, setCommentCounts] = useState({}); // postId_slot -> count

  async function loadData() {
    if (!user) return;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const friends = userDoc.data()?.friends ?? [];

    const myQ = query(
      collection(db, 'posts'),
      where('uid', '==', user.uid),
      where('date', '==', today)
    );
    const mySnap = await getDocs(myQ);
    setMyPost(mySnap.empty ? null : { id: mySnap.docs[0].id, ...mySnap.docs[0].data() });

    if (friends.length > 0) {
      const fQ = query(
        collection(db, 'posts'),
        where('uid', 'in', friends.slice(0, 10)),
        where('date', '==', today),
        orderBy('createdAt', 'desc')
      );
      const fSnap = await getDocs(fQ);
      const posts = fSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Enriquecer con avatar si el post no lo tiene guardado
      const enriched = await Promise.all(posts.map(async p => {
        if (p.avatar) return p;
        const uSnap = await getDoc(doc(db, 'users', p.uid));
        return { ...p, avatar: uSnap.data()?.avatar ?? null };
      }));
      setFriendPosts(enriched);

      // Cargar conteo de comentarios por slot
      const counts = {};
      const allPosts = [...enriched];
      if (mySnap.docs.length > 0) allPosts.push({ id: mySnap.docs[0].id, ...mySnap.docs[0].data() });
      const slots = ['morning', 'afternoon', 'night'];
      await Promise.all(allPosts.flatMap(p =>
        slots.map(async s => {
          try {
            const q2 = query(collection(db, 'posts', p.id, 'comments'), where('slot', '==', s));
            const snap = await getCountFromServer(q2);
            counts[`${p.id}_${s}`] = snap.data().count;
          } catch { counts[`${p.id}_${s}`] = 0; }
        })
      ));
      setCommentCounts(counts);
    } else {
      setFriendPosts([]);
    }
  }

  useEffect(() => {
    if (user) loadData().finally(() => setLoading(false));
  }, [user]);

  // Recargar al volver a la pantalla para tener reacciones y avatares actualizados
  useFocusEffect(
    useCallback(() => {
      if (user && !loading) loadData();
    }, [user])
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  function buildSlots(post) {
    return SLOTS_META.map(({ key, label }) => {
      const s = post?.songs?.[key];
      return {
        timeOfDay: key,
        label,
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
      <StatusBar barStyle="dark-content" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Colors.primary} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.logo}>daylist</Text>
            <TouchableOpacity onPress={() => router.push('/post/create')} style={styles.addBtn}>
              <Ionicons name="add" size={20} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <Text style={styles.dateTitle}>{dayName}, {dayNum} de {month}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: remaining === 0 ? '#34C759' : Colors.primary }]} />
            <Text style={styles.statusText}>
              {remaining === 0 ? 'Día completo' : `${remaining} ${remaining === 1 ? 'momento' : 'momentos'} por agregar`}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Mis canciones */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>HOY</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : myPost ? (
            SLOTS_META.map(({ key }) =>
              myPost.songs?.[key] ? (
                <SongCard
                  key={key}
                  song={myPost.songs[key]}
                  slot={key}
                  postId={myPost.id}
                  postOwnerUid={user.uid}
                  reactions={myPost.reactions?.[key] ?? {}}
                  commentCount={commentCounts[`${myPost.id}_${key}`] ?? 0}
                />
              ) : null
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

        {/* Feed amigos */}
        {friendPosts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.divider} />
            <Text style={styles.sectionHeader}>TU RED</Text>
            {friendPosts.map(post => (
              <View key={post.id} style={styles.friendPost}>
                <TouchableOpacity style={styles.friendHeader} onPress={() => router.push(`/user/${post.uid}`)}>
                  {post.avatar ? (
                    <Image source={{ uri: post.avatar }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarText}>{post.displayName?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.friendName}>{post.displayName}</Text>
                    <Text style={styles.friendSub}>Publicó hoy</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
                {SLOTS_META.map(({ key }) =>
                  post.songs?.[key] ? (
                    <SongCard
                      key={key}
                      song={post.songs[key]}
                      slot={key}
                      postId={post.id}
                      postOwnerUid={post.uid}
                      reactions={post.reactions?.[key] ?? {}}
                      commentCount={commentCounts[`${post.id}_${key}`] ?? 0}
                    />
                  ) : null
                )}
              </View>
            ))}
          </View>
        )}

        {!loading && friendPosts.length === 0 && filled > 0 && (
          <View style={styles.emptyFriends}>
            <Text style={styles.emptyFriendsText}>Agrega amigos para ver su soundtrack del día</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: Colors.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 48 },

  header:    { paddingTop: Platform.OS === 'ios' ? 8 : 16, paddingHorizontal: 4, marginBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logo:      { fontSize: 26, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -1 },
  addBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.sm,
  },
  dateTitle: { fontSize: 14, color: Colors.textMuted, fontWeight: '400' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 12, color: Colors.textMuted },

  divider:       { height: StyleSheet.hairlineWidth, backgroundColor: Colors.border, marginBottom: 20 },
  section:       { marginBottom: 8 },
  sectionHeader: { fontSize: 11, fontWeight: '700', color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 14, paddingHorizontal: 4 },
  blocksGroup:   {},

  friendPost:   { marginBottom: 24 },
  friendHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12, paddingHorizontal: 4 },
  avatarImg:    { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    ...Shadow.sm,
  },
  avatarText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  friendName: { color: Colors.textPrimary, fontWeight: '600', fontSize: 14 },
  friendSub:  { color: Colors.textMuted, fontSize: 11, marginTop: 1 },

  emptyFriends:     { alignItems: 'center', marginTop: 40, paddingHorizontal: 20 },
  emptyFriendsText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },

});
