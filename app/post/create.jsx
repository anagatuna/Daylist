import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { searchTracks, serializeTrack } from '@/lib/itunes';
import { notifyFriends } from '@/lib/notifications';
import { getLyrics } from '@/lib/musixmatch';
import AudioPlayer from '@/components/AudioPlayer';
import SheetModal from '@/components/SheetModal';
import { Colors, Radius } from '@/constants/Theme';

const SLOTS = [
  { key: 'morning',   label: 'Mañana' },
  { key: 'afternoon', label: 'Tarde' },
  { key: 'night',     label: 'Noche' },
];

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [songs, setSongs] = useState({ morning: null, afternoon: null, night: null });
  const [activeSlot, setActiveSlot] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [phraseModal, setPhraseModal] = useState(null);
  const [phrase, setPhrase] = useState('');
  const [lyricModal, setLyricModal] = useState(null); // slot key
  const [lyricLines, setLyricLines] = useState([]);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
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

  // Búsqueda automática con debounce al escribir
  useEffect(() => {
    if (!searchQuery.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const tracks = await searchTracks(searchQuery);
        setResults(tracks);
      } catch {
        // silencioso
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  function selectTrack(track) {
    const serialized = serializeTrack(track);
    setSongs((prev) => ({
      ...prev,
      [activeSlot]: { ...serialized, phrase: '', lyricSnippet: null },
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

  async function openLyricModal(slot) {
    setLyricModal(slot);
    setLyricLines([]);
    setLoadingLyrics(true);
    const song = songs[slot];
    const text = await getLyrics(song.name, song.artist);
    if (text) {
      const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('*') && !l.startsWith('('));
      setLyricLines(lines);
    }
    setLoadingLyrics(false);
  }

  function toggleLyricLine(line) {
    const current = songs[lyricModal]?.lyricSnippet ?? [];
    const arr = Array.isArray(current) ? current : current ? [current] : [];
    const exists = arr.includes(line);
    setSongs(p => ({
      ...p,
      [lyricModal]: {
        ...p[lyricModal],
        lyricSnippet: exists ? arr.filter(l => l !== line) : [...arr, line],
      },
    }));
  }

  function getSelectedLines(slot) {
    const s = songs[slot]?.lyricSnippet;
    if (!s) return [];
    return Array.isArray(s) ? s : [s];
  }

  async function publish() {
    const filled = SLOTS.filter((sl) => songs[sl.key]);
    if (filled.length === 0) return Alert.alert('Agrega al menos una canción');

    const user = auth.currentUser;
    if (!user) return;
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

      const userDoc2 = await getDoc(doc(db, 'users', user.uid));
      const avatar = userDoc2.data()?.avatar ?? null;
      const friends = userDoc2.data()?.friends ?? [];

      // Slots que ya fueron notificados hoy (persiste en AsyncStorage)
      const notifKey = `notified_${user.uid}_${today}`;
      const alreadyNotified = new Set(JSON.parse(await AsyncStorage.getItem(notifKey) ?? '[]'));
      const filledSlots = Object.keys(songData).filter(k => songData[k]);
      const newSlots = filledSlots.filter(k => !alreadyNotified.has(k));

      if (existingDoc) {
        await updateDoc(doc(db, 'posts', existingDoc.id), {
          songs: songData,
          avatar,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'posts'), {
          uid: user.uid,
          displayName: user.displayName,
          avatar,
          date: today,
          songs: songData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      // Notificar solo los slots nuevos y marcarlos como notificados
      if (friends.length > 0 && newSlots.length > 0) {
        await notifyFriends(user.uid, user.displayName, friends, newSlots);
        const updated = [...alreadyNotified, ...newSlots];
        await AsyncStorage.setItem(notifKey, JSON.stringify(updated));
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
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.searchTitle}>Buscar canción</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchInputWrapper}>
            <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginLeft: 12 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Artista o canción..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searching && <ActivityIndicator color={Colors.primary} size="small" style={{ marginRight: 12 }} />}
            {!searching && searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 12 }}>
                <Ionicons name="close-circle" size={17} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={results}
          keyExtractor={(t) => String(t.trackId)}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          keyboardShouldPersistTaps="handled"
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
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openLyricModal(key)}>
                    <Ionicons name="text-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.actionBtnText}>
                      {getSelectedLines(key).length > 0 ? 'Editar destacado' : 'Destacar letra'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {songs[key].phrase ? (
                  <Text style={styles.phrasePreview}>"{songs[key].phrase}"</Text>
                ) : null}

                {getSelectedLines(key).length > 0 ? (
                  <View style={styles.lyricSnippetPreview}>
                    <Ionicons name="musical-note" size={12} color={Colors.primary} />
                    <Text style={styles.lyricSnippetText}>{getSelectedLines(key).length} líneas destacadas en la letra</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => setActiveSlot(key)}>
                <Ionicons name="add-circle-outline" size={22} color={Colors.primary} />
                <Text style={styles.addBtnText}>Agregar canción</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity onPress={publish} disabled={saving} activeOpacity={0.85}>
          <LinearGradient colors={Colors.gradientPrimary} style={styles.publishBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>Publicar</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Phrase modal */}
      <SheetModal visible={!!phraseModal} onClose={() => setPhraseModal(null)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Agregar frase</Text>
            <TouchableOpacity onPress={() => setPhraseModal(null)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
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
      </SheetModal>

      {/* Lyric picker modal */}
      <SheetModal visible={!!lyricModal} onClose={() => setLyricModal(null)} fullHeight>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Elige una línea</Text>
              <Text style={styles.modalSub}>Toca la letra que quieres mostrar en tu post</Text>
            </View>
            <TouchableOpacity onPress={() => setLyricModal(null)}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {lyricModal && getSelectedLines(lyricModal).length > 0 ? (
            <View style={styles.currentSnippet}>
              <View style={styles.currentSnippetHeader}>
                <Text style={styles.currentSnippetLabel}>{getSelectedLines(lyricModal).length} líneas seleccionadas</Text>
                <TouchableOpacity onPress={() => setSongs(p => ({ ...p, [lyricModal]: { ...p[lyricModal], lyricSnippet: [] } }))}>
                  <Text style={styles.clearSnippet}>Limpiar todo</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {!loadingLyrics && lyricLines.length > 0 && (
            <TouchableOpacity onPress={() => setLyricModal(null)} activeOpacity={0.85} style={{ paddingHorizontal: 20, marginBottom: 8 }}>
              <LinearGradient colors={Colors.gradientPrimary} style={[styles.saveBtn, { marginTop: 0 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.saveBtnText}>Listo</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {loadingLyrics ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
          ) : lyricLines.length > 0 ? (
            <FlatList
              data={lyricLines}
              keyExtractor={(_, i) => String(i)}
              contentContainerStyle={styles.lyricsList}
              renderItem={({ item }) => (
                <LyricLineItem
                  item={item}
                  selected={lyricModal ? getSelectedLines(lyricModal) : []}
                  maxReached={false}
                  onToggle={toggleLyricLine}
                />
              )}
            />
          ) : (
            <View style={styles.noLyricsEmpty}>
              <Ionicons name="musical-note-outline" size={40} color={Colors.border} />
              <Text style={styles.noLyricsText}>Letra no disponible para esta canción</Text>
            </View>
          )}
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 20, paddingBottom: 110 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 24 },
  slotSection: { marginBottom: 20 },
  slotLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, borderWidth: 1, borderColor: 'rgba(192,132,252,0.4)' },
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
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 32, paddingTop: 12, backgroundColor: Colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border },
  publishBtn: { borderRadius: Radius.pill, paddingVertical: 15, alignItems: 'center', overflow: 'hidden' },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingTop: 20 },
  searchTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600', flex: 1 },
  searchRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 13, paddingHorizontal: 8, color: Colors.textPrimary, fontSize: 15 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 12, borderWidth: 1, borderColor: Colors.border },
  resultCover: { width: 50, height: 50, borderRadius: Radius.sm },
  resultName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  resultArtist: { color: Colors.primary, fontSize: 12 },
  resultAlbum: { color: Colors.textMuted, fontSize: 11 },
  modal: { flex: 1, backgroundColor: Colors.bg, padding: 20, paddingTop: 24, paddingBottom: 32 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700' },
  modalSub: { color: Colors.textSecondary, fontSize: 14, marginBottom: 20 },
  phraseInput: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 16, color: Colors.textPrimary, fontSize: 15, minHeight: 120, textAlignVertical: 'top', borderWidth: 1, borderColor: Colors.border },
  charCount: { color: Colors.textMuted, fontSize: 12, textAlign: 'right', marginTop: 4 },
  saveBtn: { borderRadius: Radius.pill, padding: 17, alignItems: 'center', marginTop: 24 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  previewBadge: { color: Colors.primary, fontSize: 11, marginTop: 3, fontWeight: '600' },
  noPreviewBadge: { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  lyricSnippetPreview: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8, backgroundColor: 'rgba(192,132,252,0.08)', borderRadius: Radius.sm, padding: 8, borderLeftWidth: 2, borderLeftColor: Colors.primary },
  lyricSnippetText: { color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', flex: 1, lineHeight: 18 },
  currentSnippet: { marginHorizontal: 20, marginBottom: 16, backgroundColor: Colors.card, borderRadius: Radius.md, padding: 14, borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)' },
  currentSnippetLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 4 },
  currentSnippetText: { color: Colors.primary, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  clearSnippet: { color: Colors.secondary, fontSize: 12, marginTop: 8, fontWeight: '600' },
  lyricsList: { paddingHorizontal: 20, paddingBottom: 40, gap: 4 },
  lyricLine: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: Radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lyricLineSelected: { backgroundColor: 'rgba(192,132,252,0.12)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.4)' },
  lyricLineText: { color: Colors.textSecondary, fontSize: 15, lineHeight: 22, flex: 1 },
  lyricLineTextSelected: { color: Colors.textPrimary, fontWeight: '600' },
  lyricLineDisabled: { opacity: 0.3 },
  lyricLineTextDisabled: { color: Colors.textMuted },
  currentSnippetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  noLyricsEmpty: { alignItems: 'center', marginTop: 50, gap: 10 },
  noLyricsText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center' },
});

function LyricLineItem({ item, selected, maxReached, onToggle }) {
  const isSelected = selected.includes(item);
  const disabled = maxReached && !isSelected;
  return (
    <TouchableOpacity
      style={[styles.lyricLine, isSelected && styles.lyricLineSelected, disabled && styles.lyricLineDisabled]}
      onPress={() => !disabled && onToggle(item)}
      activeOpacity={disabled ? 1 : 0.7}>
      <Text style={[styles.lyricLineText, isSelected && styles.lyricLineTextSelected, disabled && styles.lyricLineTextDisabled]}>
        {item}
      </Text>
      {isSelected && <Ionicons name="checkmark-circle" size={18} color={Colors.primary} />}
    </TouchableOpacity>
  );
}
