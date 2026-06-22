import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image, StatusBar } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc, arrayUnion, arrayRemove, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import SongCard from '@/components/SongCard';
import Dialog from '@/components/Dialog';
import AvatarPreview from '@/components/AvatarPreview';
import StatsCard from '@/components/StatsCard';

import { Colors, Radius, Shadow } from '@/constants/Theme';

const SLOTS = ['morning', 'afternoon', 'night'];

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
  const router = useRouter();
  const me = user?.uid;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [commentCounts, setCommentCounts] = useState({});
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showRemove, setShowRemove] = useState(false);

  useEffect(() => {
    if (!me) return;
    load();
  }, [uid, me]);

  async function load() {
    try {
      const [userDoc, myDoc, postsSnap] = await Promise.all([
        getDoc(doc(db, 'users', uid)),
        getDoc(doc(db, 'users', me)),
        getDocs(query(
          collection(db, 'posts'),
          where('uid', '==', uid),
          orderBy('createdAt', 'desc')
        )),
      ]);
      setProfile({ id: uid, ...userDoc.data() });
      setIsFriend((myDoc.data()?.friends ?? []).includes(uid));
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
    } catch (e) {
      Alert.alert('Error cargando perfil', e.message);
    } finally {
      setLoading(false);
    }
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
      <View style={{ flex: 1, backgroundColor: Colors.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="dark-content" />
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <View style={styles.headerShadow}>
            <View style={styles.header}>
              <LinearGradient
                colors={['rgba(180,141,224,0.18)', 'rgba(218,143,189,0.08)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
                <Ionicons name="chevron-back" size={20} color={Colors.textPrimary} />
              </TouchableOpacity>
              <AvatarPreview uri={profile?.avatar} size={84} initial={profile?.displayName?.[0]} style={styles.avatarImg} />
              <Text style={styles.name}>{profile?.displayName}</Text>
              {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
              <Text style={styles.postCount}>{posts.length} días publicados</Text>

              {uid !== me && (
                isFriend ? (
                  <TouchableOpacity style={styles.friendBtnActive} onPress={() => setShowRemove(true)}>
                    <Ionicons name="person-remove-outline" size={16} color={Colors.textMuted} />
                    <Text style={styles.friendBtnTextActive}>Quitar amigo</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={toggleFriend} activeOpacity={0.85}>
                    <LinearGradient colors={Colors.gradientPrimary} style={styles.friendBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                      <Ionicons name="person-add-outline" size={16} color="#fff" />
                      <Text style={styles.friendBtnText}>Agregar amigo</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                )
              )}
            </View>
            </View>
            <StatsCard posts={posts} marginBottom={28} />
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.postBlock}>
            <Text style={styles.postDate}>{formatPostDate(item.date)}</Text>
            {SLOTS.map(slot =>
              item.songs?.[slot] ? (
                <SongCard
                  key={slot}
                  song={item.songs[slot]}
                  slot={slot}
                  postId={item.id}
                  postOwnerUid={uid}
                  reactions={item.reactions?.[slot] ?? {}}
                  commentCount={commentCounts[`${item.id}_${slot}`] ?? 0}
                />
              ) : null
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Este usuario no ha publicado nada</Text>}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  headerShadow: { marginHorizontal: -16, marginBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, backgroundColor: Colors.surface, ...Shadow.md },
  header: { alignItems: 'center', paddingTop: 16, paddingBottom: 32, paddingHorizontal: 24, backgroundColor: Colors.surface, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: 'hidden' },
  backBtn: { alignSelf: 'flex-start', width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', marginBottom: 12, ...Shadow.sm },
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
});
