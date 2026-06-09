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
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import SongCard from '@/components/SongCard';
import Reactions from '@/components/Reactions';
import Dialog from '@/components/Dialog';
import { Colors, Radius, Shadow } from '@/constants/Theme';

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
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [friendCount, setFriendCount] = useState(0);
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showLogout, setShowLogout] = useState(false);

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

  function handleLogout() {
    setShowLogout(true);
  }

  if (!user) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* Hero */}
            <View style={styles.hero}>
              <LinearGradient
                colors={['rgba(180,141,224,0.18)', 'rgba(218,143,189,0.08)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />

              <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile')}>
                <Ionicons name="pencil-outline" size={15} color={Colors.primary} />
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
                <Ionicons name="log-out-outline" size={15} color={Colors.textMuted} />
                <Text style={styles.logoutText}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>HISTORIAL</Text>
            {loading && <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />}
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postBlock}>
            <Text style={styles.postDate}>{formatPostDate(item.date)}</Text>
            {SLOTS.map(slot =>
              item.songs?.[slot] ? <SongCard key={slot} song={item.songs[slot]} slot={slot} /> : null
            )}
            <Reactions postId={item.id} reactions={item.reactions ?? {}} postOwnerUid={user.uid} />
          </View>
        )}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Ionicons name="musical-notes-outline" size={40} color={Colors.border} />
              <Text style={styles.emptyText}>Aún no has publicado nada</Text>
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
          { text: 'Salir', style: 'destructive', onPress: () => signOut(auth) },
        ]}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  hero: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    marginHorizontal: -16,
    overflow: 'hidden',
    ...Shadow.md,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-end',
    marginBottom: 16,
    backgroundColor: 'rgba(155,109,214,0.10)',
    borderRadius: Radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(155,109,214,0.25)',
  },
  editBtnText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },

  avatarImg:   { width: 72, height: 72, borderRadius: 36, marginBottom: 12, ...Shadow.md },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadow.md },
  avatarText:  { color: '#fff', fontWeight: '800', fontSize: 28 },

  displayName: { color: Colors.textPrimary, fontSize: 18, fontWeight: '800' },
  email:       { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  bio:         { color: Colors.textSecondary, fontSize: 13, marginTop: 6, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },

  stats:       { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 24 },
  stat:        { alignItems: 'center' },
  statNum:     { color: Colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel:   { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: Colors.border },

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
