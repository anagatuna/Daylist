import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image, StatusBar, Platform, Modal, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, getDoc, collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import SongCard from '@/components/SongCard';
import Dialog from '@/components/Dialog';
import AvatarPreview from '@/components/AvatarPreview';
import StatsCard from '@/components/StatsCard';
import { localDateStr } from '@/lib/date';

import { Colors, Radius, Shadow } from '@/constants/Theme';

const SLOTS = ['morning', 'afternoon', 'night'];
const PAGE_SIZE = 20;

function formatPostDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  const day   = d.toLocaleDateString('es-MX', { weekday: 'long' });
  const num   = d.getDate();
  const month = d.toLocaleDateString('es-MX', { month: 'long' });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${num} de ${month}`;
}

export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const me = user?.uid;
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRemove, setShowRemove] = useState(false);

  const [filterDate, setFilterDate] = useState(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [filteredPost, setFilteredPost] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);

  useEffect(() => {
    if (!me) return;
    load();
  }, [uid, me]);

  async function load() {
    try {
      const [userDoc, myDoc, postsSnap, countSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDoc(doc(db, 'users', me)),
        getDocs(query(
          collection(db, 'posts'),
          where('uid', '==', uid),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        )),
        getCountFromServer(query(collection(db, 'posts'), where('uid', '==', uid))),
      ]);
      setProfile({ id: uid, ...userDoc.data() });
      setIsFriend((myDoc.data()?.friends ?? []).includes(uid));
      const loadedPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(loadedPosts);
      setLastDoc(postsSnap.docs[postsSnap.docs.length - 1] ?? null);
      setHasMore(postsSnap.docs.length === PAGE_SIZE);
      setTotalPosts(countSnap.data().count);
    } catch (e) {
      Alert.alert('Error cargando perfil', e.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (filterDate || !hasMore || loadingMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'posts'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      ));
      const newPosts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPosts(p => [...p, ...newPosts]);
      setLastDoc(snap.docs[snap.docs.length - 1] ?? lastDoc);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  function openDatePicker() {
    setPickerDate(filterDate ?? new Date());
    setShowPicker(true);
  }

  function onChangeDate(event, selected) {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selected) applyDateFilter(selected);
      return;
    }
    if (selected) setPickerDate(selected);
  }

  async function applyDateFilter(date) {
    setShowPicker(false);
    setFilterDate(date);
    setFilterLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'posts'),
        where('uid', '==', uid),
        where('date', '==', localDateStr(date))
      ));
      setFilteredPost(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    } finally {
      setFilterLoading(false);
    }
  }

  function clearFilter() {
    setFilterDate(null);
    setFilteredPost(null);
  }

  async function toggleFriend() {
    if (isFriend) {
      await Promise.all([
        updateDoc(doc(db, 'users', me), { friends: arrayRemove(uid) }),
        updateDoc(doc(db, 'users', uid), { friends: arrayRemove(me) }),
      ]);
      setIsFriend(false);
    } else {
      await updateDoc(doc(db, 'users', uid), { friendRequests: arrayUnion(me) });
      Alert.alert('Solicitud enviada');
    }
  }

  if (!me || loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={[]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <FlatList
        data={filterDate ? (filteredPost ? [filteredPost] : []) : posts}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { backgroundColor: colors.bg, paddingTop: insets.top + 12 }]}>
              <LinearGradient
                colors={isDark
                  ? ['rgba(180,141,224,0.28)', 'rgba(218,143,189,0.10)', 'rgba(0,0,0,0)']
                  : ['rgba(155,109,214,0.42)', 'rgba(212,112,154,0.20)', 'rgba(0,0,0,0)']}
                style={StyleSheet.absoluteFill}
              />

              {/* Botón volver */}
              <TouchableOpacity
                style={[styles.backBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.38)', borderColor: 'transparent' }]}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
              </TouchableOpacity>

              <AvatarPreview uri={profile?.avatar} size={84} initial={profile?.displayName?.[0]} style={styles.avatarImg} />
              <Text style={[styles.name, { color: colors.textPrimary }]}>{profile?.displayName}</Text>
              {profile?.bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text> : null}
              <Text style={[styles.postCount, { color: colors.textMuted }]}>{totalPosts} días publicados</Text>

              {(profile?.streak ?? 0) > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  <Text style={{ fontSize: 16 }}>🔥</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: colors.streak }}>{profile.streak}</Text>
                  <Text style={{ fontSize: 13, color: colors.textMuted }}>{profile.streak === 1 ? 'día de racha' : 'días de racha'}</Text>
                </View>
              )}
              {(profile?.longestStreak ?? 0) > 0 && (
                <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 4, fontWeight: '500' }}>
                  Mejor racha: {profile.longestStreak} {profile.longestStreak === 1 ? 'día' : 'días'}
                </Text>
              )}

              {uid !== me && (
                isFriend ? (
                  <TouchableOpacity
                    style={[styles.friendBtnActive, { backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.38)', borderColor: 'transparent' }]}
                    onPress={() => setShowRemove(true)}
                  >
                    <Ionicons name="person-remove-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.friendBtnTextActive, { color: colors.textMuted }]}>Quitar amigo</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={toggleFriend} activeOpacity={0.85}>
                    <LinearGradient colors={colors.gradientPrimary} style={styles.friendBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="person-add-outline" size={16} color="#fff" />
                      <Text style={styles.friendBtnText}>Agregar amigo</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )
              )}
            </View>
            <StatsCard posts={posts} marginBottom={0} />
            <View style={styles.historyHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>PUBLICACIONES</Text>
              {filterDate ? (
                <TouchableOpacity
                  style={[styles.filterChip, { backgroundColor: colors.primary + '18' }]}
                  onPress={clearFilter}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.filterChipText, { color: colors.primary }]}>{formatPostDate(localDateStr(filterDate))}</Text>
                  <Ionicons name="close-circle" size={15} color={colors.primary} />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.filterIconBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}
                  onPress={openDatePicker}
                  activeOpacity={0.75}
                >
                  <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
            {filterLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: 8 }} />}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postBlock}>
            <Text style={[styles.postDate, { color: colors.textSecondary }]}>{formatPostDate(item.date)}</Text>
            {SLOTS.map(slot =>
              item.songs?.[slot] ? (
                <SongCard
                  key={slot}
                  song={item.songs[slot]}
                  slot={slot}
                  postId={item.id}
                  postOwnerUid={uid}
                  reactions={item.reactions?.[slot] ?? {}}
                  commentCount={item.commentCounts?.[slot] ?? 0}
                />
              ) : null
            )}
          </View>
        )}
        ListEmptyComponent={
          !filterLoading ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {filterDate ? 'No publicó nada ese día' : 'Este usuario no ha publicado nada'}
            </Text>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : null}
      />

      <Dialog
        visible={showRemove}
        title="Quitar amigo"
        message={`¿Quieres quitar a ${profile?.displayName} de tus amigos?`}
        onClose={() => setShowRemove(false)}
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Quitar', style: 'destructive', onPress: toggleFriend },
        ]}
      />

      {Platform.OS === 'android' && showPicker && (
        <DateTimePicker value={pickerDate} mode="date" maximumDate={new Date()} onChange={onChangeDate} />
      )}
      {Platform.OS === 'ios' && (
        <Modal visible={showPicker} transparent animationType="fade">
          <Pressable style={styles.datePickerBackdrop} onPress={() => setShowPicker(false)}>
            <Pressable style={[styles.datePickerCard, { borderColor: colors.glass.border }]}>
              <BlurView tint={colors.glass.tint} intensity={colors.glass.intensity} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.glass.overlayStrong }]} />
              <Text style={[styles.datePickerTitle, { color: colors.textPrimary }]}>Buscar por fecha</Text>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                onChange={onChangeDate}
                textColor={colors.textPrimary}
              />
              <View style={[styles.datePickerActions, { borderTopColor: colors.border }]}>
                <TouchableOpacity style={styles.datePickerCancelBtn} onPress={() => setShowPicker(false)}>
                  <Text style={[styles.datePickerCancelText, { color: colors.textMuted }]}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => applyDateFilter(pickerDate)} activeOpacity={0.85}>
                  <LinearGradient colors={colors.gradientPrimary} style={styles.datePickerSearchBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.datePickerSearchText}>Buscar</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  hero: { alignItems: 'center', marginHorizontal: -16, marginBottom: 16, paddingHorizontal: 24, paddingBottom: 32 },
  backBtn: { alignSelf: 'flex-start', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 1 },
  avatarImg: { width: 84, height: 84, borderRadius: 42, marginBottom: 12, ...Shadow.md },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 12, backgroundColor: Colors.border },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 32 },
  bio: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 18 },
  name: { color: Colors.textPrimary, fontSize: 21, fontWeight: '700' },
  postCount: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  friendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 11, marginTop: 16 },
  friendBtnActive: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 11, marginTop: 16, borderWidth: 1, borderColor: Colors.border },
  friendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  friendBtnTextActive: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  postBlock: { marginBottom: 24 },
  postDate: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },

  historyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 28, paddingBottom: 16,
  },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  filterIconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  datePickerBackdrop: {
    flex: 1, backgroundColor: 'rgba(28,28,30,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 40,
  },
  datePickerCard: {
    borderRadius: Radius.xl, borderWidth: 1, width: '100%', overflow: 'hidden',
    alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
    ...Shadow.lg,
  },
  datePickerTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  datePickerActions: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16,
    marginTop: 8, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, width: '100%',
  },
  datePickerCancelBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  datePickerCancelText: { fontSize: 14, fontWeight: '600' },
  datePickerSearchBtn: { borderRadius: Radius.pill, paddingHorizontal: 24, paddingVertical: 12 },
  datePickerSearchText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
