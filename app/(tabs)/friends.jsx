import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Image, StatusBar, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, getDocs, doc, getDoc, query, where, orderBy, limit,
  updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { localDateStr } from '@/lib/date';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { notifyFriendRequest } from '@/lib/notifications';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import Dialog from '@/components/Dialog';
import { useTheme } from '@/contexts/ThemeContext';

const SLOT_LABELS = { morning: 'mañana', afternoon: 'tarde', night: 'noche' };

export default function FriendsScreen() {
  const { user } = useAuth();
  const uid = user?.uid;
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [activity, setActivity] = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [hasUnreadRequests, setHasUnreadRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [searching, setSearching] = useState(false);
  const [removingFriend, setRemovingFriend] = useState(null);

  useEffect(() => {
    if (uid) loadFriends().then(({ friendDocs }) => loadActivity(friendDocs));
  }, [uid]);

  useFocusEffect(useCallback(() => {
    if (uid && tab === 'activity') loadActivity();
  }, [uid, tab]));

  async function loadFriends() {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const data = userDoc.data() ?? {};
    const [friendDocs, requestDocs] = await Promise.all([
      fetchUsers(data.friends ?? []),
      fetchUsers(data.friendRequests ?? []),
    ]);
    setFriends(friendDocs);
    setRequests(requestDocs);
    setLoading(false);

    // Punto de solicitudes no vistas
    const seenCount = parseInt(await AsyncStorage.getItem(`requests_seen_${uid}`) ?? '0', 10);
    setHasUnreadRequests(requestDocs.length > seenCount);

    return { friendDocs };
  }

  async function fetchUsers(ids) {
    if (!ids.length) return [];
    const results = await Promise.all(
      ids.map(id => getDoc(doc(db, 'users', id)).then(d => d.exists() ? { id: d.id, ...d.data() } : null))
    );
    return results.filter(Boolean);
  }

  async function loadActivity(friendDocs) {
    if (!uid) return;
    // Usar friendDocs pasado directamente o caer al estado (si se llama desde la tab)
    const activeFriends = friendDocs ?? friends;
    setLoadingActivity(true);
    try {
      const lastSeen = parseInt(await AsyncStorage.getItem(`activity_seen_${uid}`) ?? '0', 10);
      const items = [];

      // Reacciones en mis posts (solo las publicaciones recientes, para no
      // arrastrar reacciones de todo el historial en cada carga)
      const myPostsSnap = await getDocs(query(
        collection(db, 'posts'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(30)
      ));
      const myPosts = myPostsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Obtener display names de los que reaccionaron
      const reactorIds = new Set();
      myPosts.forEach(post => {
        const slotReactions = post.reactions ?? {};
        Object.values(slotReactions).forEach(emojiMap => {
          if (emojiMap && typeof emojiMap === 'object') {
            Object.values(emojiMap).forEach(uids => {
              if (Array.isArray(uids)) uids.forEach(u => { if (u !== uid) reactorIds.add(u); });
            });
          }
        });
      });
      const reactorDocs = {};
      await Promise.all([...reactorIds].map(async rid => {
        const s = await getDoc(doc(db, 'users', rid));
        reactorDocs[rid] = s.data() ?? {};
      }));

      myPosts.forEach(post => {
        const slotReactions = post.reactions ?? {};
        Object.entries(slotReactions).forEach(([slot, emojiMap]) => {
          if (!emojiMap || typeof emojiMap !== 'object') return;
          Object.entries(emojiMap).forEach(([emoji, uids]) => {
            if (!Array.isArray(uids)) return;
            uids.filter(u => u !== uid).forEach(reactorUid => {
              const rd = reactorDocs[reactorUid] ?? {};
              items.push({
                key: `reaction-${post.id}-${slot}-${emoji}-${reactorUid}`,
                type: 'reaction',
                emoji,
                slot,
                displayName: rd.displayName ?? 'Alguien',
                avatar: rd.avatar ?? null,
                uid: reactorUid,
                postDate: post.date,
                postId: post.id,
                sortKey: post.createdAt?.seconds ?? 0,
              });
            });
          });
        });
      });

      // Posts recientes de amigos (últimos 7 días)
      const friendIds = activeFriends.map(f => f.id);
      if (friendIds.length > 0) {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = localDateStr(sevenDaysAgo);
        const fPostsSnap = await getDocs(query(
          collection(db, 'posts'),
          where('uid', 'in', friendIds.slice(0, 10)),
          orderBy('createdAt', 'desc'),
          limit(100)
        ));
        fPostsSnap.docs.filter(d => d.data().date >= sevenDaysAgoStr).forEach(d => {
          const p = { id: d.id, ...d.data() };
          const slots = Object.keys(p.songs ?? {}).filter(k => p.songs[k]);
          items.push({
            key: `post-${p.id}`,
            type: 'post',
            displayName: p.displayName,
            avatar: p.avatar ?? null,
            uid: p.uid,
            postId: p.id,
            postDate: p.date,
            slots,
            // updatedAt cambia cuando agregan tarde/noche, createdAt solo es la primera vez
            sortKey: p.updatedAt?.seconds ?? p.createdAt?.seconds ?? 0,
          });
        });
      }

      // Ordenar más reciente primero
      items.sort((a, b) => b.sortKey - a.sortKey);
      setActivity(items);

      // Hay items más nuevos que la última vez que se vio
      const newest = items[0]?.sortKey ?? 0;
      setHasUnread(newest > lastSeen);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoadingActivity(false);
    }
  }

  async function searchUsers() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const term = searchQuery.trim().toLowerCase();
      const snap = await getDocs(query(
        collection(db, 'users'),
        where('displayNameLower', '>=', term),
        where('displayNameLower', '<=', term + ''),
        limit(20)
      ));
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== uid);
      setSearchResults(results);
    } catch {
      Alert.alert('Error buscando usuarios');
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(targetUid) {
    try {
      await updateDoc(doc(db, 'users', targetUid), { friendRequests: arrayUnion(uid) });
      notifyFriendRequest(targetUid, user.displayName).catch(() => {});
      Alert.alert('Solicitud enviada');
    } catch {
      Alert.alert('Error enviando solicitud');
    }
  }

  async function acceptRequest(fromUid) {
    try {
      await Promise.all([
        updateDoc(doc(db, 'users', uid), { friends: arrayUnion(fromUid), friendRequests: arrayRemove(fromUid) }),
        updateDoc(doc(db, 'users', fromUid), { friends: arrayUnion(uid) }),
      ]);
      await loadFriends();
    } catch { Alert.alert('Error aceptando solicitud'); }
  }

  async function rejectRequest(fromUid) {
    await updateDoc(doc(db, 'users', uid), { friendRequests: arrayRemove(fromUid) });
    await loadFriends();
  }

  async function removeFriend(friendUid) {
    await Promise.all([
      updateDoc(doc(db, 'users', uid), { friends: arrayRemove(friendUid) }),
      updateDoc(doc(db, 'users', friendUid), { friends: arrayRemove(uid) }),
    ]);
    await loadFriends();
  }

  function Avatar({ item, size = 42 }) {
    if (item.avatar) return (
      <Image source={{ uri: item.avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} />
    );
    return (
      <LinearGradient colors={colors.gradientPrimary} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.4 }}>{item.displayName?.[0]?.toUpperCase()}</Text>
      </LinearGradient>
    );
  }

  function UserRow({ item, right }) {
    return (
      <View style={[styles.cardShadow, { shadowColor: colors.primary }]}>
        <TouchableOpacity style={[styles.userRow, { borderColor: colors.cardGlass.border }]} onPress={() => router.push(`/user/${item.id}`)} activeOpacity={0.7}>
          <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]} />
          <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg, backgroundColor: colors.cardGlass.overlay }]} />
          <Avatar item={item} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.textPrimary }]}>{item.displayName}</Text>
            {(item.streak ?? 0) > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 }}>
                <Text style={{ fontSize: 11 }}>🔥</Text>
                <Text style={{ fontSize: 12, color: colors.streak, fontWeight: '700' }}>{item.streak}</Text>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>{item.streak === 1 ? 'día' : 'días'}</Text>
              </View>
            )}
          </View>
          {right}
        </TouchableOpacity>
      </View>
    );
  }

  function ActivityItem({ item }) {
    const content = item.type === 'reaction' ? (
      <>
        <View style={styles.activityAvatarWrap}>
          <Avatar item={item} size={40} />
          <View style={[styles.activityEmoji, { backgroundColor: colors.cardGlass.overlay, borderColor: colors.border }]}>
            <Text style={{ fontSize: 13 }}>{item.emoji}</Text>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.activityText, { color: colors.textPrimary }]}>
            <Text style={[styles.activityName, { color: colors.primary }]}>{item.displayName}</Text>
            {` reaccionó a tu ${SLOT_LABELS[item.slot] ?? 'publicación'}`}
          </Text>
          <Text style={[styles.activityDate, { color: colors.textMuted }]}>{formatDate(item.postDate)}</Text>
        </View>
      </>
    ) : (
      <>
        <Avatar item={item} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.activityText, { color: colors.textPrimary }]}>
            <Text style={[styles.activityName, { color: colors.primary }]}>{item.displayName}</Text>
            {` publicó su canción de la ${item.slots.map(s => SLOT_LABELS[s] ?? s).join(', ')}`}
          </Text>
          <Text style={[styles.activityDate, { color: colors.textMuted }]}>{formatDate(item.postDate)}</Text>
        </View>
      </>
    );
    return (
      <View style={[styles.cardShadow, { shadowColor: colors.primary }]}>
        <TouchableOpacity style={[styles.activityRow, { borderColor: colors.cardGlass.border }]} onPress={() => router.push(`/user/${item.uid}`)} activeOpacity={0.7}>
          <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]} />
          <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg, backgroundColor: colors.cardGlass.overlay }]} />
          {content}
        </TouchableOpacity>
      </View>
    );
  }

  function formatDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T12:00:00');
    const today = localDateStr();
    const yesterday = localDateStr(new Date(Date.now() - 86400000));
    if (isoDate === today) return 'Hoy';
    if (isoDate === yesterday) return 'Ayer';
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' });
  }

  const TABS = [
    { key: 'friends',  label: 'Amigos' },
    { key: 'requests', label: 'Solicitudes', dot: hasUnreadRequests && requests.length > 0 },
    { key: 'activity', label: 'Actividad', dot: hasUnread },
    { key: 'search',   label: 'Buscar' },
  ];

  function handleTabPress(key) {
    setTab(key);
    if (key === 'activity') {
      loadActivity();
      AsyncStorage.setItem(`activity_seen_${uid}`, String(Math.floor(Date.now() / 1000)));
      setHasUnread(false);
    }
    if (key === 'requests') {
      AsyncStorage.setItem(`requests_seen_${uid}`, String(requests.length));
      setHasUnreadRequests(false);
    }
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={[]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Tabs */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map(t => (
            <TouchableOpacity key={t.key} onPress={() => handleTabPress(t.key)} activeOpacity={0.7}>
              {tab === t.key ? (
                <LinearGradient colors={colors.gradientPrimary} style={styles.tabActive} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  <Text style={styles.tabTextActive}>{t.label}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.tab, { backgroundColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <Text style={[styles.tabText, { color: colors.textMuted }]}>{t.label}</Text>
                    {t.dot && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : tab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={Colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Aún no tienes amigos. ¡Búscalos!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <UserRow item={item} right={
              <TouchableOpacity onPress={() => setRemovingFriend(item)}>
                <Ionicons name="person-remove-outline" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            } />
          )}
        />
      ) : tab === 'requests' ? (
        <FlatList
          data={requests}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mail-outline" size={40} color={Colors.border} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No hay solicitudes pendientes</Text>
            </View>
          }
          renderItem={({ item }) => (
            <UserRow item={item} right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => acceptRequest(item.id)}>
                  <LinearGradient colors={Colors.gradientPrimary} style={styles.acceptBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.acceptBtnText}>Aceptar</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.rejectBtn, { backgroundColor: colors.bg, borderColor: colors.border }]} onPress={() => rejectRequest(item.id)}>
                  <Ionicons name="close" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            } />
          )}
        />
      ) : tab === 'activity' ? (
        loadingActivity ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={activity}
            keyExtractor={i => i.key}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Ionicons name="notifications-outline" size={40} color={Colors.border} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sin actividad reciente</Text>
              </View>
            }
            renderItem={({ item }) => <ActivityItem item={item} />}
          />
        )
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.searchRow}>
            <View style={[styles.searchInputWrapper, { borderColor: colors.cardGlass.border, shadowColor: colors.primary }]}>
              <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, { borderRadius: Radius.md }]} />
              <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.md, backgroundColor: colors.cardGlass.overlay }]} />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Buscar por nombre..."
                placeholderTextColor={colors.textMuted}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchUsers}
                returnKeyType="search"
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={() => { setSearchQuery(''); setSearchResults([]); }}
                >
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={searchUsers} activeOpacity={0.85}>
              <LinearGradient colors={Colors.gradientPrimary} style={styles.searchBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {searching ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="search" size={18} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={u => u.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              searchQuery.trim() ? (
                <View style={styles.empty}>
                  <Ionicons name="search-outline" size={40} color={Colors.border} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No se encontraron usuarios</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => {
              const isFriend = friends.some(f => f.id === item.id);
              const requested = item.friendRequests?.includes(uid);
              return (
                <UserRow item={item} right={
                  isFriend ? (
                    <Text style={[styles.alreadyFriend, { color: colors.textMuted }]}>Amigo</Text>
                  ) : requested ? (
                    <Text style={[styles.alreadyFriend, { color: colors.textMuted }]}>Enviada</Text>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(item.id)}>
                      <LinearGradient colors={Colors.gradientPrimary} style={styles.addBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                        <Ionicons name="person-add-outline" size={16} color="#fff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  )
                } />
              );
            }}
          />
        </View>
      )}

      <Dialog
        visible={!!removingFriend}
        title="Eliminar amigo"
        message={`¿Quieres eliminar a ${removingFriend?.displayName} de tus amigos?`}
        onClose={() => setRemovingFriend(null)}
        buttons={[
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: () => removeFriend(removingFriend.id) },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    paddingBottom: 8,
    marginHorizontal: -0,
  },
  tabsRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  tab:       { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill },
  tabActive: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.pill },
  tabText:      { fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontSize: 13, fontWeight: '700' },
  unreadDot: { width: 6, height: 6, borderRadius: 3 },

  list: { padding: 16, paddingBottom: 110, gap: 10 },

  cardShadow: {
    borderRadius: Radius.lg,
    ...Shadow.sm,
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
  },
  userName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },

  acceptBtn:     { borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  acceptBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  rejectBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  addBtn:    {},
  addBtnGrad: { borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  alreadyFriend: { color: Colors.textMuted, fontSize: 13 },

  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: 14,
    overflow: 'hidden',
  },
  activityAvatarWrap: { position: 'relative' },
  activityEmoji: {
    position: 'absolute', bottom: -2, right: -4,
    borderRadius: 10, padding: 2,
    borderWidth: 1,
  },
  activityText: { color: Colors.textPrimary, fontSize: 13, lineHeight: 18 },
  activityName: { fontWeight: '700' },
  activityDate: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  empty:     { alignItems: 'center', marginTop: 50, gap: 10 },
  emptyText: { color: Colors.textMuted, textAlign: 'center', fontSize: 14 },

  searchRow: { flexDirection: 'row', gap: 10, padding: 16, paddingTop: 8 },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadow.sm,
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },
  searchInput: {
    flex: 1,
    padding: 13,
    color: Colors.textPrimary,
    fontSize: 15,
    zIndex: 1,
  },
  clearBtn: { paddingRight: 12, zIndex: 1 },
  searchBtn: { borderRadius: Radius.md, padding: 13, justifyContent: 'center', alignItems: 'center', width: 48 },
});
