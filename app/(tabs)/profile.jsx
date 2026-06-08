import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import SongCard from '@/components/SongCard';
import { Colors, Radius } from '@/constants/Theme';

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
    setAvatar(data.avatar ?? null);
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
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Hero header */}
            <LinearGradient colors={['#1A0F2E', Colors.bg]} style={styles.hero}>
              <View style={styles.orb} />

              <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
                <Ionicons name="pencil-outline" size={16} color={Colors.textSecondary} />
                <Text style={styles.editBtnText}>Editar</Text>
              </TouchableOpacity>

              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImg} />
              ) : (
                <LinearGradient colors={Colors.gradientPrimary} style={styles.avatarLarge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.avatarText}>{user.displayName?.[0]?.toUpperCase()}</Text>
                </LinearGradient>
              )}

              <Text style={styles.displayName}>{user.displayName}</Text>
              <Text style={styles.email}>{user.email}</Text>
              {bio ? <Text style={styles.bio}>{bio}</Text> : null}

              <View style={styles.stats}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{posts.length}</Text>
                  <Text style={styles.statLabel}>días</Text>
                </View>
                <View style={styles.statDivider} />
                <TouchableOpacity style={styles.stat} onPress={() => router.push('/(tabs)/friends')}>
                  <Text style={styles.statNum}>{friendCount}</Text>
                  <Text style={[styles.statLabel, { color: Colors.primary }]}>amigos</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={16} color={Colors.textMuted} />
                <Text style={styles.logoutText}>Cerrar sesión</Text>
              </TouchableOpacity>
            </LinearGradient>

            <Text style={styles.sectionTitle}>✦ HISTORIAL</Text>
            {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postBlock}>
            <Text style={styles.postDate}>{item.date}</Text>
            {SLOTS.map(slot =>
              item.songs?.[slot] ? <SongCard key={slot} song={item.songs[slot]} slot={slot} /> : null
            )}
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>🎵</Text>
              <Text style={styles.emptyText}>Aún no has publicado nada</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  hero: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 18, overflow: 'hidden' },
  orb: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: Colors.primary, opacity: 0.06, top: -60, right: -50 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end', marginBottom: 10, backgroundColor: Colors.card, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: Colors.border },
  editBtnText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '500' },
  avatarImg: { width: 70, height: 70, borderRadius: 35, marginBottom: 10 },
  avatarLarge: { width: 70, height: 70, borderRadius: 35, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 28 },
  displayName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  email: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  bio: { color: Colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
  stats: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 20 },
  stat: { alignItems: 'center' },
  statNum: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  statDivider: { width: 1, height: 24, backgroundColor: Colors.border },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, padding: 6 },
  logoutText: { color: Colors.textMuted, fontSize: 12 },
  sectionTitle: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5, paddingHorizontal: 20, paddingVertical: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 40 },
  postBlock: { marginBottom: 24 },
  postDate: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  empty: { alignItems: 'center', marginTop: 40, gap: 8 },
  emptyEmoji: { fontSize: 40 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
});
