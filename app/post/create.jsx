import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { searchTracks, serializeTrack } from '@/lib/itunes';
import { notifyFriends } from '@/lib/notifications';
import AudioPlayer from '@/components/AudioPlayer';
import { Colors, Radius } from '@/constants/Theme';

const SLOTS = [
  { key: 'morning', label: '🌅 Mañana' },
  { key: 'afternoon', label: '☀️ Tarde' },
  { key: 'night', label: '🌙 Noche' },
];

export default function CreatePostScreen() {
  const router = useRouter();
  const [songs, setSongs] = useState({ morning: null, afternoon: null, night: null });
  const [activeSlot, setActiveSlot] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [phraseModal, setPhraseModal] = useState(null); // slot key
  const [phrase, setPhrase] = useState('');
  const [fragmentModal, setFragmentModal] = useState(null); // slot key
  const [startSec, setStartSec] = useState('0');
  const [endSec, setEndSec] = useState('30');
  const [saving, setSaving] = useState(false);

  // Cargar post de hoy si ya existe
  useEffect(() => {
    async function loadToday() {
      const user = auth.currentUser;
      if (!user) return;
      const today = new Date().toISOString().slice(0, 10);
      const q = query(
        collection(db, 'posts'),
        where('uid', '==', user.uid),
        where('date', '==', today)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setSongs({
          morning: data.songs?.morning ?? null,
          afternoon: data.songs?.afternoon ?? null,
          night: data.songs?.night ?? null,
        });
      }
    }
    loadToday();
  }, []);

  const search = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const tracks = await searchTracks(searchQuery);
      setResults(tracks);
    } catch {
      Alert.alert('Error buscando canciones');
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  function selectTrack(track) {
    const serialized = serializeTrack(track);
    setSongs((prev) => ({
      ...prev,
      [activeSlot]: { ...serialized, phrase: '', startSec: 0, endSec: null },
    }));
    setActiveSlot(null);
    setResults([]);
    setSearchQuery('');
  }

  function openPhraseModal(slot) {
    setPhrase(songs[slot]?.phrase ?? '');
    setPhraseModal(slot);
  }

  function savePhrase() {
    setSongs((prev) => ({
      ...prev,
      [phraseModal]: { ...prev[phraseModal], phrase },
    }));
    setPhraseModal(null);
  }

  function openFragmentModal(slot) {
    const s = songs[slot];
    setStartSec(String(s?.startSec ?? 0));
    setEndSec(s?.endSec != null ? String(s.endSec) : '30');
    setFragmentModal(slot);
  }

  function saveFragment() {
    const s = parseFloat(startSec) || 0;
    const e = parseFloat(endSec) || null;
    setSongs((prev) => ({
      ...prev,
      [fragmentModal]: { ...prev[fragmentModal], startSec: s, endSec: e },
    }));
    setFragmentModal(null);
  }

  async function publish() {
    const filled = SLOTS.filter((sl) => songs[sl.key]);
    if (filled.length === 0) return Alert.alert('Agrega al menos una canción');

    const user = auth.currentUser;
    const today = new Date().toISOString().slice(0, 10);

    // Check if user already posted today
    const q = query(
      collection(db, 'posts'),
      where('uid', '==', user.uid),
      where('date', '==', today)
    );
    const snap = await getDocs(q);
    const existingDoc = snap.empty ? null : snap.docs[0];

    setSaving(true);
    try {
      const songData = {};
      SLOTS.forEach(({ key }) => {
        if (songs[key]) songData[key] = songs[key];
      });

      if (existingDoc) {
        await updateDoc(doc(db, 'posts', existingDoc.id), {
          songs: songData,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'posts'), {
          uid: user.uid,
          displayName: user.displayName,
          date: today,
          songs: songData,
          createdAt: serverTimestamp(),
        });

        // Notificar a los amigos solo en publicaciones nuevas
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const friends = userDoc.data()?.friends ?? [];
        if (friends.length > 0) {
          notifyFriends(user.uid, user.displayName, friends).catch(() => {});
        }
      }

      router.replace('/(tabs)');
    } catch (e) {
      Alert.alert('Error publicando', e.message);
    } finally {
      setSaving(false);
    }
  }

  if (activeSlot) {
    return (
      <View style={styles.container}>
        <View style={styles.searchHeader}>
          <TouchableOpacity onPress={() => { setActiveSlot(null); setResults([]); setSearchQuery(''); }}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.searchTitle}>Buscar canción — {SLOTS.find(s => s.key === activeSlot)?.label}</Text>
        </View>

        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Artista, canción..."
            placeholderTextColor={Colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={search} activeOpacity={0.85}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.searchBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="search" size={18} color="#fff" />}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <FlatList
          data={results}
          keyExtractor={(t) => String(t.trackId)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultItem} onPress={() => selectTrack(item)}>
              {item.artworkUrl100 ? (
                <Image source={{ uri: item.artworkUrl100 }} style={styles.resultCover} />
              ) : (
                <View style={[styles.resultCover, { backgroundColor: '#1a1a1a' }]} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName} numberOfLines={1}>{item.trackName}</Text>
                <Text style={styles.resultArtist} numberOfLines={1}>{item.artistName}</Text>
                <Text style={styles.resultAlbum} numberOfLines={1}>{item.collectionName}</Text>
                {item.previewUrl
                  ? <Text style={styles.previewBadge}>▶ Preview disponible</Text>
                  : <Text style={styles.noPreviewBadge}>Sin preview</Text>
                }
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>¿Qué canciones definen tu día?</Text>

        {SLOTS.map(({ key, label }) => (
          <View key={key} style={styles.slotSection}>
            <Text style={styles.slotLabel}>{label}</Text>

            {songs[key] ? (
              <View style={styles.selectedCard}>
                <View style={styles.selectedRow}>
                  {songs[key].albumImage && (
                    <Image source={{ uri: songs[key].albumImage }} style={styles.selectedCover} />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedName} numberOfLines={1}>{songs[key].name}</Text>
                    <Text style={styles.selectedArtist} numberOfLines={1}>{songs[key].artist}</Text>
                    <AudioPlayer
                      previewUrl={songs[key].previewUrl}
                      startSec={songs[key].startSec}
                      endSec={songs[key].endSec}
                    />
                  </View>
                  <TouchableOpacity onPress={() => setSongs(p => ({ ...p, [key]: null }))}>
                    <Ionicons name="close-circle" size={20} color="#555" />
                  </TouchableOpacity>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openPhraseModal(key)}>
                    <Ionicons name="chatbubble-outline" size={14} color="#888" />
                    <Text style={styles.actionBtnText}>
                      {songs[key].phrase ? 'Editar frase' : 'Agregar frase'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openFragmentModal(key)}>
                    <Ionicons name="cut-outline" size={14} color="#888" />
                    <Text style={styles.actionBtnText}>Fragmento</Text>
                  </TouchableOpacity>
                </View>

                {songs[key].phrase ? (
                  <Text style={styles.phrasePreview}>"{songs[key].phrase}"</Text>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setActiveSlot(key)}>
                <Ionicons name="add-circle-outline" size={22} color="#1DB954" />
                <Text style={styles.addBtnText}>Agregar canción</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity onPress={publish} disabled={saving} activeOpacity={0.85}>
          <LinearGradient colors={Colors.gradientPrimary} style={styles.publishBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>Publicar ✨</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Phrase modal */}
      <Modal visible={!!phraseModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar frase</Text>
            <TouchableOpacity onPress={() => setPhraseModal(null)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.phraseInput}
            placeholder="¿Qué te transmite esta canción?"
            placeholderTextColor={Colors.textMuted}
            value={phrase}
            onChangeText={setPhrase}
            multiline
            maxLength={200}
          />
          <Text style={styles.charCount}>{phrase.length}/200</Text>
          <TouchableOpacity onPress={savePhrase} activeOpacity={0.85}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.saveBtnText}>Guardar</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Fragment modal */}
      <Modal visible={!!fragmentModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Elegir fragmento</Text>
            <TouchableOpacity onPress={() => setFragmentModal(null)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSub}>Define el inicio y fin del fragmento (en segundos)</Text>

          {fragmentModal && songs[fragmentModal]?.previewUrl && (
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <AudioPlayer
                previewUrl={songs[fragmentModal].previewUrl}
                startSec={parseFloat(startSec) || 0}
                endSec={parseFloat(endSec) || null}
              />
            </View>
          )}

          <View style={styles.fragmentRow}>
            <View style={styles.fragmentField}>
              <Text style={styles.fragmentLabel}>Inicio (seg)</Text>
              <TextInput
                style={styles.fragmentInput}
                value={startSec}
                onChangeText={setStartSec}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.fragmentField}>
              <Text style={styles.fragmentLabel}>Fin (seg)</Text>
              <TextInput
                style={styles.fragmentInput}
                value={endSec}
                onChangeText={setEndSec}
                keyboardType="numeric"
                placeholder="30"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <TouchableOpacity onPress={saveFragment} activeOpacity={0.85}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Text style={styles.saveBtnText}>Guardar fragmento</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 100 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 24 },
  slotSection: { marginBottom: 20 },
  slotLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)', borderStyle: 'dashed' },
  addBtnText: { color: Colors.primary, fontSize: 15 },
  selectedCard: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: Colors.border },
  selectedRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  selectedCover: { width: 60, height: 60, borderRadius: Radius.sm },
  selectedName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  selectedArtist: { color: Colors.primary, fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { color: Colors.textSecondary, fontSize: 12 },
  phrasePreview: { color: Colors.textSecondary, fontStyle: 'italic', fontSize: 13, marginTop: 8 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: Colors.bg, borderTopWidth: 1, borderTopColor: Colors.border },
  publishBtn: { borderRadius: Radius.pill, padding: 17, alignItems: 'center', overflow: 'hidden' },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingTop: 20 },
  searchTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600', flex: 1 },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  searchInput: { flex: 1, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 13, color: Colors.textPrimary, fontSize: 15, borderWidth: 1, borderColor: Colors.border },
  searchBtn: { borderRadius: Radius.md, padding: 13, justifyContent: 'center', alignItems: 'center', width: 48 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border },
  resultCover: { width: 50, height: 50, borderRadius: Radius.sm },
  resultName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  resultArtist: { color: Colors.primary, fontSize: 12 },
  resultAlbum: { color: Colors.textMuted, fontSize: 11 },
  modal: { flex: 1, backgroundColor: Colors.bg, padding: 20, paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  modalSub: { color: Colors.textSecondary, fontSize: 14, marginBottom: 20 },
  phraseInput: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, color: Colors.textPrimary, fontSize: 15, minHeight: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
  charCount: { color: Colors.textMuted, fontSize: 12, textAlign: 'right', marginTop: 4 },
  saveBtn: { borderRadius: Radius.pill, padding: 17, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  fragmentRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  fragmentField: { flex: 1 },
  fragmentLabel: { color: Colors.textSecondary, fontSize: 13, marginBottom: 6 },
  fragmentInput: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, color: Colors.textPrimary, fontSize: 16, borderWidth: 1, borderColor: Colors.border },
  previewBadge: { color: Colors.primary, fontSize: 11, marginTop: 3, fontWeight: '600' },
  noPreviewBadge: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
});
