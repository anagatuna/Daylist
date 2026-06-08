import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, getDocs, doc, getDoc,
  updateDoc, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'expo-router';
import { notifyFriendRequest } from '@/lib/notifications';

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
    const friendIds = data.friends ?? [];
    const requestIds = data.friendRequests ?? [];

    const [friendDocs, requestDocs] = await Promise.all([
      fetchUsers(friendIds),
      fetchUsers(requestIds),
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
      await updateDoc(doc(db, 'users', targetUid), {
        friendRequests: arrayUnion(uid),
      });
      notifyFriendRequest(targetUid, user.displayName).catch(() => {});
      Alert.alert('Solicitud enviada');
    } catch {
      Alert.alert('Error enviando solicitud');
    }
  }

  async function acceptRequest(fromUid) {
    try {
      await Promise.all([
        updateDoc(doc(db, 'users', uid), {
          friends: arrayUnion(fromUid),
          friendRequests: arrayRemove(fromUid),
        }),
        updateDoc(doc(db, 'users', fromUid), {
          friends: arrayUnion(uid),
        }),
      ]);
      await loadFriends();
    } catch {
      Alert.alert('Error aceptando solicitud');
    }
  }

  async function rejectRequest(fromUid) {
    await updateDoc(doc(db, 'users', uid), {
      friendRequests: arrayRemove(fromUid),
    });
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

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {[
          { key: 'friends', label: 'Amigos' },
          { key: 'requests', label: `Solicitudes${requests.length ? ` (${requests.length})` : ''}` },
          { key: 'search', label: 'Buscar' },
        ].map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && styles.tabActive]}
            onPress={() => setTab(t.key)}>
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color="#1DB954" style={{ marginTop: 40 }} />
      ) : tab === 'friends' ? (
        <FlatList
          data={friends}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Aún no tienes amigos. ¡Búscalos!</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.userRow}
              onPress={() => router.push(`/user/${item.id}`)}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.displayName?.[0]?.toUpperCase()}</Text>
              </View>
              <Text style={[styles.userName, { flex: 1 }]}>{item.displayName}</Text>
              <TouchableOpacity onPress={() => removeFriend(item.id)}>
                <Ionicons name="person-remove-outline" size={20} color="#555" />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      ) : tab === 'requests' ? (
        <FlatList
          data={requests}
          keyExtractor={u => u.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>No hay solicitudes pendientes</Text>}
          renderItem={({ item }) => (
            <View style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.displayName?.[0]?.toUpperCase()}</Text>
              </View>
              <Text style={[styles.userName, { flex: 1 }]}>{item.displayName}</Text>
              <TouchableOpacity style={styles.acceptBtn} onPress={() => acceptRequest(item.id)}>
                <Text style={styles.acceptBtnText}>Aceptar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => rejectRequest(item.id)}>
                <Ionicons name="close" size={20} color="#555" />
              </TouchableOpacity>
            </View>
          )}
        />
      ) : (
        <View style={styles.searchContainer}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar por nombre..."
              placeholderTextColor="#555"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={searchUsers}
              returnKeyType="search"
              autoCapitalize="none"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={searchUsers}>
              {searching
                ? <ActivityIndicator color="#000" size="small" />
                : <Ionicons name="search" size={20} color="#000" />}
            </TouchableOpacity>
          </View>

          <FlatList
            data={searchResults}
            keyExtractor={u => u.id}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              searchResults.length === 0 && searchQuery.trim()
                ? <Text style={styles.empty}>No se encontraron usuarios</Text>
                : null
            }
            renderItem={({ item }) => {
              const isFriend = friends.some(f => f.id === item.id);
              const requested = item.friendRequests?.includes(uid);
              return (
                <View style={styles.userRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item.displayName?.[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.userName, { flex: 1 }]}>{item.displayName}</Text>
                  {isFriend ? (
                    <Text style={styles.alreadyFriend}>✓ Amigo</Text>
                  ) : requested ? (
                    <Text style={styles.alreadyFriend}>Enviada</Text>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => sendRequest(item.id)}>
                      <Ionicons name="person-add-outline" size={18} color="#1DB954" />
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#1DB954' },
  tabText: { color: '#555', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#1DB954' },
  list: { padding: 16, gap: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#141414', borderRadius: 12, padding: 14 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#000', fontWeight: '700', fontSize: 16 },
  userName: { color: '#fff', fontSize: 15, fontWeight: '500' },
  acceptBtn: { backgroundColor: '#1DB954', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { color: '#000', fontWeight: '600', fontSize: 13 },
  addBtn: { padding: 4 },
  alreadyFriend: { color: '#555', fontSize: 13 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
  searchContainer: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: 10, padding: 16 },
  searchInput: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a' },
  searchBtn: { backgroundColor: '#1DB954', borderRadius: 10, padding: 12, justifyContent: 'center', alignItems: 'center' },
});
