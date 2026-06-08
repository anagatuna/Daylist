import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import SongCard from '@/components/SongCard';

const SLOTS = ['morning', 'afternoon', 'night'];

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      if (user) load();
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
    setAvatar(data.avatar ?? user?.photoURL ?? null);
    setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => signOut(auth) },
    ]);
  }

  if (!user) return null;

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            {/* Header */}
            <View style={styles.header}>
              {/* Botón editar */}
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push('/edit-profile')}>
                <Ionicons name="pencil-outline" size={18} color="#888" />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>

              {/* Avatar */}
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarText}>{user.displayName?.[0]?.toUpperCase()}</Text>
                </View>
              )}

              <Text style={styles.displayName}>{user.displayName}</Text>
              <Text style={styles.email}>{user.email}</Text>

              {bio ? <Text style={styles.bio}>{bio}</Text> : null}

              {/* Stats */}
              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{posts.length}</Text>
                  <Text style={styles.statLabel}>días</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{friendCount}</Text>
                  <Text style={styles.statLabel}>amigos</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={18} color="#555" />
                <Text style={styles.logoutText}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>HISTORIAL</Text>
            {loading && <ActivityIndicator color="#1DB954" style={{ marginTop: 20 }} />}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postBlock}>
            <Text style={styles.postDate}>{item.date}</Text>
            {SLOTS.map(slot =>
              item.songs?.[slot] ? (
                <SongCard key={slot} song={item.songs[slot]} slot={slot} />
              ) : null
            )}
          </View>
        )}
        ListEmptyComponent={
          !loading ? <Text style={styles.empty}>Aún no has publicado nada</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { alignItems: 'center', padding: 24, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginBottom: 12, padding: 6 },
  editBtnText: { color: '#888', fontSize: 14 },
  avatarImg: { width: 90, height: 90, borderRadius: 45, marginBottom: 12 },
  avatarLarge: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#000', fontWeight: '800', fontSize: 36 },
  displayName: { color: '#fff', fontSize: 22, fontWeight: '700' },
  email: { color: '#555', fontSize: 13, marginTop: 2 },
  bio: { color: '#aaa', fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 20, gap: 24 },
  stat: { alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 24, fontWeight: '700' },
  statLabel: { color: '#555', fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 30, backgroundColor: '#2a2a2a' },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 20, padding: 8 },
  logoutText: { color: '#555', fontSize: 14 },
  sectionTitle: { color: '#636366', fontSize: 12, fontWeight: '600', letterSpacing: 1, paddingHorizontal: 20, paddingVertical: 14 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  postBlock: { marginBottom: 24 },
  postDate: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 8 },
  empty: { color: '#555', textAlign: 'center', marginTop: 40, fontSize: 15 },
});
