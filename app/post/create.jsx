import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, ActivityIndicator, Alert, ScrollView, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { searchTracks, serializeTrack } from '@/lib/itunes';
import { notifyFriends } from '@/lib/notifications';
import AudioPlayer from '@/components/AudioPlayer';

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
            placeholderTextColor="#555"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={search}
            returnKeyType="search"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={search}>
            {searching ? <ActivityIndicator color="#000" /> : <Ionicons name="search" size={20} color="#000" />}
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
        <TouchableOpacity style={styles.publishBtn} onPress={publish} disabled={saving}>
          {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.publishBtnText}>Publicar</Text>}
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
            placeholderTextColor="#555"
            value={phrase}
            onChangeText={setPhrase}
            multiline
            maxLength={200}
          />
          <Text style={styles.charCount}>{phrase.length}/200</Text>
          <TouchableOpacity style={styles.saveBtn} onPress={savePhrase}>
            <Text style={styles.saveBtnText}>Guardar</Text>
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
                placeholderTextColor="#555"
              />
            </View>
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={saveFragment}>
            <Text style={styles.saveBtnText}>Guardar fragmento</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { padding: 20, paddingBottom: 100 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 24 },
  slotSection: { marginBottom: 20 },
  slotLabel: { color: '#888', fontSize: 13, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#141414', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#222', borderStyle: 'dashed',
  },
  addBtnText: { color: '#1DB954', fontSize: 15 },
  selectedCard: { backgroundColor: '#141414', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#222' },
  selectedRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  selectedCover: { width: 60, height: 60, borderRadius: 8 },
  selectedName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  selectedArtist: { color: '#1DB954', fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { color: '#888', fontSize: 12 },
  phrasePreview: { color: '#aaa', fontStyle: 'italic', fontSize: 13, marginTop: 8 },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  publishBtn: { backgroundColor: '#1DB954', borderRadius: 12, padding: 16, alignItems: 'center' },
  publishBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingTop: 20 },
  searchTitle: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 8 },
  searchInput: { flex: 1, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#2a2a2a' },
  searchBtn: { backgroundColor: '#1DB954', borderRadius: 10, padding: 12, justifyContent: 'center', alignItems: 'center' },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#141414', borderRadius: 10, padding: 10 },
  resultCover: { width: 50, height: 50, borderRadius: 6 },
  resultName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  resultArtist: { color: '#1DB954', fontSize: 12 },
  resultAlbum: { color: '#555', fontSize: 11 },
  modal: { flex: 1, backgroundColor: '#0a0a0a', padding: 20, paddingTop: 50 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modalSub: { color: '#888', fontSize: 14, marginBottom: 20 },
  phraseInput: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 16, color: '#fff', fontSize: 15, minHeight: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: '#2a2a2a' },
  charCount: { color: '#555', fontSize: 12, textAlign: 'right', marginTop: 4 },
  saveBtn: { backgroundColor: '#1DB954', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  fragmentRow: { flexDirection: 'row', gap: 16, marginBottom: 8 },
  fragmentField: { flex: 1 },
  fragmentLabel: { color: '#888', fontSize: 13, marginBottom: 6 },
  fragmentInput: { backgroundColor: '#1a1a1a', borderRadius: 10, padding: 14, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#2a2a2a' },
  previewBadge: { color: '#1DB954', fontSize: 11, marginTop: 3, fontWeight: '600' },
  noPreviewBadge: { color: '#444', fontSize: 11, marginTop: 3 },
});
