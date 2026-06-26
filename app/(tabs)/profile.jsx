import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Image, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, doc, getDoc, getCountFromServer, updateDoc, deleteField } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import AvatarPreview from '@/components/AvatarPreview';
import SongCard from '@/components/SongCard';
import Dialog from '@/components/Dialog';
import ReminderModal, { REMINDER_KEY, formatReminderTime } from '@/components/ReminderModal';
import StatsCard from '@/components/StatsCard';
import StreakBadge from '@/components/StreakBadge';
import { cancelDailyReminder, cancelStreakReminder } from '@/lib/notifications';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

const SLOTS = ['morning', 'afternoon', 'night'];

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
  const [posts, setPosts] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [friendCount, setFriendCount] = useState(0);
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [streak, setStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showLogout, setShowLogout] = useState(false);
  const [showReminder, setShowReminder] = useState(false);
  const [reminderTime, setReminderTime] = useState(null);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
      AsyncStorage.getItem(REMINDER_KEY).then(stored => {
        if (stored) {
          const { enabled, hour, minute } = JSON.parse(stored);
          setReminderTime(enabled ? formatReminderTime(hour, minute) : null);
        }
      });
    }, [user])
  );

  async function load() {
    const [userDoc, postsSnap] = await Promise.all([
      getDoc(doc(db, 'users', user.uid)),
      getDocs(query(
        collection(db, 'posts'),
        where('uid', '==', user.uid),
        orderBy('createdAt', 'desc')
      )),
    ]);
    const data = userDoc.data() ?? {};
    setFriendCount((data.friends ?? []).length);
    setBio(data.bio ?? '');
    setAvatar(data.avatar ?? null);
    setStreak(data.streak ?? 0);
    setLongestStreak(data.longestStreak ?? 0);
    const loadedPosts = postsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    setPosts(loadedPosts);
    const counts = {};
    await Promise.all(loadedPosts.flatMap(p =>
      SLOTS.map(async s => {
        try {
          const q2 = query(collection(db, 'posts', p.id, 'comments'), where('slot', '==', s));
          const snap = await getCountFromServer(q2);
          counts[`${p.id}_${s}`] = snap.data().count;
        } catch { counts[`${p.id}_${s}`] = 0; }
      })
    ));
    setCommentCounts(counts);
    setLoading(false);
  }

  function handleLogout() {
    setShowLogout(true);
  }

  async function doLogout() {
    try {
      await updateDoc(doc(db, 'users', user.uid), { expoPushToken: deleteField() });
      await cancelDailyReminder();
      await cancelStreakReminder();
      await AsyncStorage.clear();
    } catch {}
    signOut(auth);
  }

  if (!user) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={[styles.heroShadow, { backgroundColor: colors.surface }]}>
            <View style={[styles.hero, { backgroundColor: colors.surface }]}>
              <LinearGradient
                colors={['rgba(180,141,224,0.18)', 'rgba(218,143,189,0.08)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.topBtns}>
                <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
                  <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                  <Text style={[styles.editBtnText, { color: colors.primary }]}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.bellBtn} onPress={() => setShowReminder(true)}>
                  <Ionicons name={reminderTime ? 'notifications' : 'notifications-outline'} size={18} color={reminderTime ? colors.primary : colors.textMuted} />
                </TouchableOpacity>
              </View>

              <AvatarPreview uri={avatar} size={72} initial={user.displayName?.[0]} style={styles.avatarImg} />

              <Text style={[styles.displayName, { color: colors.textPrimary }]}>{user.displayName}</Text>
              <Text style={[styles.email, { color: colors.textMuted }]}>{user.email}</Text>
              {bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{bio}</Text> : null}

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.textPrimary }]}>{posts.length}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>días</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.stat}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                    <Text style={{ fontSize: 16 }}>🔥</Text>
                    <Text style={[styles.statNum, { color: '#FF9500' }]}>{streak}</Text>
                  </View>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>racha</Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)/friends')}>
                  <Text style={[styles.statNum, { color: colors.textPrimary }]}>{friendCount}</Text>
                  <Text style={[styles.statLabel, { color: colors.primary }]}>amigos</Text>
                </TouchableOpacity>
              </View>

              {longestStreak > 0 && (
                <Text style={[styles.longestStreak, { color: colors.textMuted }]}>
                  Mejor racha: {longestStreak} {longestStreak === 1 ? 'día' : 'días'}
                </Text>
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
            </View>

            {!loading && posts.length > 0 && <StatsCard posts={posts} />}
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>HISTORIAL</Text>
            {loading && <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />}
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
                  commentCount={commentCounts[`${item.id}_${slot}`] ?? 0}
                />
              ) : null
            )}
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={40} color={colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aún no has publicado nada</Text>
            </View>
          ) : null
        }
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  heroShadow: {
    marginHorizontal: -16,
    marginBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    backgroundColor: Colors.surface,
    ...Shadow.md,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
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
  longestStreak: { fontSize: 12, marginTop: 10, fontWeight: '500' },

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
  list:      { paddingHorizontal: 16, paddingBottom: 40 },
  postBlock: { marginBottom: 24 },
  postDate:  { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 14, paddingLeft: 4 },
  empty:     { alignItems: 'center', marginTop: 40, gap: 10 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
});
