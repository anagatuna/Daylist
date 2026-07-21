import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Image, StatusBar, Platform, Modal, Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, startAfter, getDocs, getCountFromServer, doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import AvatarPreview from '@/components/AvatarPreview';
import SongCard from '@/components/SongCard';
import Dialog from '@/components/Dialog';
import ReminderModal, { REMINDER_KEY, formatReminderTime } from '@/components/ReminderModal';
import { localDateStr } from '@/lib/date';
import { syncStreakToProfile } from '@/lib/streak';
import StreakBadge from '@/components/StreakBadge';
import StreakFreezeBadge from '@/components/StreakFreezeBadge';
import SpotifyArtistBanner from '@/components/SpotifyArtistBanner';
import { useSpotifyAuth } from '@/hooks/useSpotifyAuth';
import { useSpotifyTopItems } from '@/hooks/useSpotifyTopItems';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

const SLOTS = ['morning', 'afternoon', 'night'];
const PAGE_SIZE = 20;

function formatPostDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00');
  const day  = d.toLocaleDateString('es-MX', { weekday: 'long' });
  const num  = d.getDate();
  const month = d.toLocaleDateString('es-MX', { month: 'long' });
  return `${day.charAt(0).toUpperCase() + day.slice(1)}, ${num} de ${month}`;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const { colors, isDark, preference, setPreference } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [posts, setPosts] = useState([]);
  const [totalPosts, setTotalPosts] = useState(0);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [friendCount, setFriendCount] = useState(0);
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [streakFreezes, setStreakFreezes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showLogout, setShowLogout] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState(null);

  const [filterDate, setFilterDate] = useState(null);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [filteredPost, setFilteredPost] = useState(null);
  const [filterLoading, setFilterLoading] = useState(false);

  const { connected: spotifyConnected } = useSpotifyAuth();
  const { artists: spotifyArtists, loading: spotifyLoading, error: spotifyError, reload: reloadSpotify } = useSpotifyTopItems(spotifyConnected);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
      if (spotifyConnected) reloadSpotify();
      AsyncStorage.getItem(REMINDER_KEY).then(stored => {
        if (stored) {
          const { enabled, hour, minute } = JSON.parse(stored);
          setReminderTime(enabled ? formatReminderTime(hour, minute) : null);
        }
      });
    }, [user, spotifyConnected])
  );

  async function load() {
    try {
      const [userDoc, postsSnap, countSnap, streakResult] = await Promise.all([
        getDoc(doc(db, 'users', user.uid)),
        getDocs(query(
          collection(db, 'posts'),
          where('uid', '==', user.uid),
          orderBy('createdAt', 'desc'),
          limit(PAGE_SIZE)
        )),
        getCountFromServer(query(collection(db, 'posts'), where('uid', '==', user.uid))),
        syncStreakToProfile(user.uid),
      ]);
      const data = userDoc.data() ?? {};
      setFriendCount((data.friends ?? []).length);
      setBio(data.bio ?? '');
      setAvatar(data.avatar ?? null);
      setStreak(streakResult.current);
      setLongestStreak(streakResult.longest);
      setStreakFreezes(streakResult.streakFreezes);
      if (streakResult.freezesUsed > 0) {
        Alert.alert(
          '¡Racha protegida! 🧊',
          streakResult.freezesUsed === 1
            ? 'Usamos un protector de racha para salvar tu racha del día que no publicaste.'
            : `Usamos ${streakResult.freezesUsed} protectores de racha para salvar tu racha.`
        );
      }
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLastDoc(postsSnap.docs[postsSnap.docs.length - 1] ?? null);
      setHasMore(postsSnap.docs.length === PAGE_SIZE);
      setTotalPosts(countSnap.data().count);
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
        where('uid', '==', user.uid),
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
        where('uid', '==', user.uid),
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

  function handleLogout() {
    setShowLogout(true);
  }

  async function doLogout() {
    try {
      await updateDoc(doc(db, 'users', user.uid), { expoPushToken: deleteField() });
      const allKeys = await AsyncStorage.getAllKeys();
      const keepKeys = ['@daylist_theme', 'reminder_config'];
      const toRemove = allKeys.filter(k => !keepKeys.includes(k));
      if (toRemove.length) await AsyncStorage.multiRemove(toRemove);
    } catch {}
    signOut(auth);
  }

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <FlatList
        data={filterDate ? (filteredPost ? [filteredPost] : []) : posts}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={[styles.hero, { backgroundColor: colors.bg, paddingTop: insets.top + 16 }]}>
              <LinearGradient
                colors={isDark
                  ? ['rgba(180,141,224,0.28)', 'rgba(218,143,189,0.10)', 'rgba(0,0,0,0)']
                  : ['rgba(155,109,214,0.42)', 'rgba(212,112,154,0.20)', 'rgba(0,0,0,0)']}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.topBtns}>
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.38)', borderColor: 'transparent' }]}
                  onPress={() => router.push('/edit-profile')}
                >
                  <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                  <Text style={[styles.editBtnText, { color: colors.primary }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.bellBtn, { backgroundColor: isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.38)', borderColor: 'transparent' }]}
                  onPress={() => setShowReminder(true)}
                >
                  <Ionicons name={reminderTime ? 'notifications' : 'notifications-outline'} size={18} color={reminderTime ? colors.primary : colors.textMuted} />
                </TouchableOpacity>
              </View>

              <AvatarPreview uri={avatar} size={72} initial={user.displayName?.[0]} style={styles.avatarImg} />

              <Text style={[styles.displayName, { color: colors.textPrimary }]}>{user.displayName}</Text>
              <Text style={[styles.email, { color: colors.textMuted }]}>{user.email}</Text>
              {bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text> : null}

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.textPrimary }]}>{totalPosts}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>días</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 16 }}>🔥</Text>
                    <Text style={[styles.statNum, { color: colors.streak }]}>{streak}</Text>
                  </View>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>racha</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)/friends')}>
                  <Text style={[styles.statNum, { color: colors.textPrimary }]}>{friendCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.primary }]}>amigos</Text>
                </TouchableOpacity>
              </View>

              {(longestStreak > 0 || streakFreezes > 0) && (
                <View style={styles.streakMetaRow}>
                  {longestStreak > 0 && (
                    <Text style={[styles.longestStreak, { color: colors.textMuted }]}>
                      Mejor racha: {longestStreak} {longestStreak === 1 ? 'día' : 'días'}
                    </Text>
                  )}
                  <StreakFreezeBadge count={streakFreezes} size="sm" />
                </View>
              )}

              {/* Theme selector */}
              <View style={[styles.themeRow, { borderTopColor: colors.border }]}>
                {[
                  { key: 'system', icon: 'phone-portrait-outline', label: 'Sistema' },
                  { key: 'light',  icon: 'sunny-outline',          label: 'Claro' },
                  { key: 'dark',   icon: 'moon-outline',           label: 'Oscuro' },
                ].map(opt => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.themeOption, preference === opt.key && { backgroundColor: colors.primary + '18' }]}
                    onPress={() => setPreference(opt.key)}
                  >
                    <Ionicons name={opt.icon} size={16} color={preference === opt.key ? colors.primary : colors.textMuted} />
                    <Text style={[styles.themeLabel, { color: preference === opt.key ? colors.primary : colors.textMuted }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={15} color={colors.textMuted} />
                <Text style={[styles.logoutText, { color: colors.textMuted }]}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>

            {spotifyConnected && (
              <View style={{ marginBottom: 16 }}>
                <SpotifyArtistBanner artists={spotifyArtists} loading={spotifyLoading} error={spotifyError} />
              </View>
            )}
            <View style={styles.historyHeader}>
              <Text style={[styles.sectionTitle, { color: colors.textMuted, paddingTop: 0, paddingBottom: 0 }]}>HISTORIAL</Text>
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
            {(loading || filterLoading) && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
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
                  postOwnerUid={user.uid}
                  reactions={item.reactions?.[slot] ?? {}}
                  commentCount={item.commentCounts?.[slot] ?? 0}
                />
              ) : null
            )}
          </View>
        )}
        ListEmptyComponent={
          !loading && !filterLoading ? (
            <View style={styles.empty}>
              <Ionicons name={filterDate ? 'calendar-outline' : 'musical-notes-outline'} size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {filterDate ? 'No publicaste nada ese día' : 'Aún no has publicado nada'}
              </Text>
            </View>
          ) : null
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.6}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 20 }} /> : null}
      />

      <Dialog
        visible={showLogout}
        title="Cerrar sesión"
        message="¿Seguro que quieres salir?"
        onClose={() => setShowLogout(false)}
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Salir', style: 'destructive', onPress: doLogout },
        ]}
      />
      <ReminderModal
        visible={showReminder}
        onClose={() => {
          setShowReminder(false);
          AsyncStorage.getItem(REMINDER_KEY).then(stored => {
            if (stored) {
              const { enabled, hour, minute } = JSON.parse(stored);
              setReminderTime(enabled ? formatReminderTime(hour, minute) : null);
            }
          });
        }}
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

  hero: {
    alignItems: 'center',
    marginHorizontal: -16,
    marginBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: Colors.bg,
  },
  topBtns: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end', marginBottom: 16 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(155,109,214,0.10)',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(155,109,214,0.25)',
  },
  editBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
  bellBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(155,109,214,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(155,109,214,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarImg:   { width: 72, height: 72, borderRadius: 36, marginBottom: 12, ...Shadow.md },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadow.md },
  avatarText:  { color: '#fff', fontWeight: '700', fontSize: 28 },

  displayName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  email:       { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  bio:         { color: Colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  stats:       { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 24 },
  stat:        { alignItems: 'center' },
  statNum:     { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  statLabel:   { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: Colors.border },
  streakMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  longestStreak: { fontSize: 12, fontWeight: '500' },

  themeRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    marginTop: 16, paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  themeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  themeLabel: { fontSize: 12, fontWeight: '500' },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 14, padding: 6 },
  logoutText: { color: Colors.textMuted, fontSize: 12 },

  sectionTitle: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    paddingTop: 28,
    paddingBottom: 16,
    paddingLeft: 4,
  },
  historyHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 28, paddingBottom: 16, paddingLeft: 4,
  },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6,
  },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  filterIconBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  list:      { paddingHorizontal: 16, paddingBottom: 110 },
  postBlock: { marginBottom: 24 },
  postDate:  { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 14, paddingLeft: 4 },
  empty:     { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },

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
