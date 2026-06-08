import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, getDocs, doc, getDoc,
  updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { notifyFriendRequest } from '@/lib/notifications';
import { Colors, Radius } from '@/constants/Theme';

export default function FriendsScreen() {
  const { user } = useAuth();
  const uid = user?.uid;
  const router = useRouter();

  const [tab, setTab] = useState('friends');
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (uid) loadFriends();
  }, [uid]);

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
  }

  async function fetchUsers(ids) {
    if (!ids.length) return [];
    const results = await Promise.all(
      ids.map(id => getDoc(doc(db, 'users', id)).then(d => d.exists() ? { id: d.id, ...d.data() } : null))
    );
    return results.filter(Boolean);
  }

  async function searchUsers() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const term = searchQuery.trim().toLowerCase();
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(u => u.id !== uid && u.displayName?.toLowerCase().includes(term));
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
      Alert.alert('✨ Solicitud enviada');
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
    Alert.alert('Eliminar amigo', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          await Promise.all([
            updateDoc(doc(db, 'users', uid), { friends: arrayRemove(friendUid) }),
            updateDoc(doc(db, 'users', friendUid), { friends: arrayRemove(uid) }),
          ]);
          await loadFriends();
        },
      },
    ]);
  }

  function UserRow({ item, right }) {
    return (
      <TouchableOpacity style={styles.userRow} onPress={() => router.push(`/user/${item.id}`)} activeOpacity={0.7}>
        <LinearGradient colors={Colors.gradientPrimary} style={styles.avatar} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          <Text style={styles.avatarText}>{item.displayName?.[0]?.toUpperCase()}</Text>
        </LinearGradient>
        <Text style={[styles.userName, { flex: 1 }]}>{item.displayName}</Text>
        {right}
      </TouchableOpacity>
    );
  }

  const TABS = [
    { key: 'friends', label: 'Amigos' },
    { key: 'requests', label: `Solicitudes${requests.length ? ` (${requests.length})` : ''}` },
    { key: 'search', label: 'Buscar' },
  ];

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsRow}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            {tab === t.key && (
              <LinearGradient colors={Colors.gradientPrimary} style={styles.tabIndicator} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
      ) : tab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyEmoji}>🌸</Text><Text style={styles.emptyText}>Aún no tienes amigos. ¡Búscalos!</Text></View>}
          renderItem={({ item }) => (
            <UserRow item={item} right={
              <TouchableOpacity onPress={() => removeFriend(item.id)}>
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
          ListEmptyComponent={<View style={styles.empty}><Text style={styles.emptyEmoji}>💌</Text><Text style={styles.emptyText}>No hay solicitudes pendientes</Text></View>}
          renderItem={({ item }) => (
            <UserRow item={item} right={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => acceptRequest(item.id)}>
                  <LinearGradient colors={Colors.gradientPrimary} style={styles.acceptBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    <Text style={styles.acceptBtnText}>Aceptar</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectRequest(item.id)}>
                  <Ionicons name="close" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            } />
          )}
        />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchUsers}
              returnKeyType="search"
              autoCapitalize="none"
            />
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
            ListEmptyComponent={searchQuery.trim() ? <View style={styles.empty}><Text style={styles.emptyEmoji}>🔍</Text><Text style={styles.emptyText}>No se encontraron usuarios</Text></View> : null}
            renderItem={({ item }) => {
              const isFriend = friends.some(f => f.id === item.id);
              const requested = item.friendRequests?.includes(uid);
              return (
                <UserRow item={item} right={
                  isFriend ? (
                    <Text style={styles.alreadyFriend}>✓ Amigo</Text>
                  ) : requested ? (
                    <Text style={styles.alreadyFriend}>Enviada</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  tabsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', position: 'relative' },
  tabActive: {},
  tabText: { color: Colors.textMuted, fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: Colors.textPrimary, fontWeight: '600' },
  tabIndicator: { position: 'absolute', bottom: 0, left: 16, right: 16, height: 2, borderRadius: 1 },
  list: { padding: 16, gap: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  userName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '500' },
  acceptBtn: { borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 7 },
  acceptBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  rejectBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border },
  addBtn: {},
  addBtnGrad: { borderRadius: 18, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  alreadyFriend: { color: Colors.textMuted, fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 50, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { color: Colors.textMuted, textAlign: 'center', fontSize: 14 },
  searchRow: { flexDirection: 'row', gap: 10, padding: 16 },
  searchInput: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 13, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { borderRadius: Radius.md, padding: 13, justifyContent: 'center', alignItems: 'center', width: 48 },
});
