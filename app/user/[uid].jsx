import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, collection, query, where, orderBy, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { LinearGradient } from 'expo-linear-gradient';
import SongCard from '@/components/SongCard';
import Reactions from '@/components/Reactions';
import { Colors, Radius } from '@/constants/Theme';

const SLOTS = ['morning', 'afternoon', 'night'];

export default function UserProfileScreen() {
  const { uid } = useLocalSearchParams();
  const { user } = useAuth();
  const me = user?.uid;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [isFriend, setIsFriend] = useState(false);
  const [loading, setLoading] = useState(true);

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
      setPosts(postsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
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
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'center' }}>
        <ActivityIndicator color="#1DB954" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        keyExtractor={p => p.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            {profile?.avatar ? (
              <Image source={{ uri: profile.avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{profile?.displayName?.[0]?.toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.name}>{profile?.displayName}</Text>
            {profile?.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
            <Text style={styles.postCount}>{posts.length} días publicados</Text>

            {uid !== me && (
              isFriend ? (
                <TouchableOpacity style={styles.friendBtnActive} onPress={toggleFriend}>
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
        }
        renderItem={({ item }) => (
          <View style={styles.postBlock}>
            <Text style={styles.postDate}>{item.date}</Text>
            {SLOTS.map(slot =>
              item.songs?.[slot] ? <SongCard key={slot} song={item.songs[slot]} slot={slot} /> : null
            )}
            <Reactions postId={item.id} reactions={item.reactions ?? {}} />
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Este usuario no ha publicado nada</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: { alignItems: 'center', padding: 24, borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: 8 },
  avatarImg: { width: 84, height: 84, borderRadius: 42, marginBottom: 12 },
  avatar: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 32 },
  bio: { color: Colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 20, lineHeight: 18 },
  name: { color: Colors.textPrimary, fontSize: 21, fontWeight: '800' },
  postCount: { color: Colors.textMuted, fontSize: 13, marginTop: 4 },
  friendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 11, marginTop: 16 },
  friendBtnActive: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, borderRadius: Radius.pill, paddingHorizontal: 18, paddingVertical: 11, marginTop: 16, borderWidth: 1, borderColor: Colors.border },
  friendBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  friendBtnTextActive: { color: Colors.textMuted, fontWeight: '600', fontSize: 14 },
  list: { padding: 16 },
  postBlock: { marginBottom: 24 },
  postDate: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600', marginBottom: 10 },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: 40 },
});
