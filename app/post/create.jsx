import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, ActivityIndicator, Alert, ScrollView,
  Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { searchTracks, serializeTrack } from '@/lib/itunes';
import { notifyFriends, cancelStreakReminder } from '@/lib/notifications';
import { localDateStr } from '@/lib/date';
import { getLyrics } from '@/lib/musixmatch';
import { BlurView } from 'expo-blur';
import AudioPlayer from '@/components/AudioPlayer';
import SheetModal from '@/components/SheetModal';
import StreakCelebration from '@/components/StreakCelebration';
import { syncStreakToProfile } from '@/lib/streak';
import { Colors, Radius } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useScrollBar } from '@/components/ScrollBar';

const SLOTS = [
  { key: 'morning',   label: 'Mañana' },
  { key: 'afternoon', label: 'Tarde' },
  { key: 'night',     label: 'Noche' },
];

export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { scrollProps: lyricScrollProps, indicator: lyricIndicator } = useScrollBar();
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
  const [alreadyPosted, setAlreadyPosted] = useState(false);
  const [showStreak, setShowStreak] = useState(false);
  const [streakCount, setStreakCount] = useState(0);
  // Cargar post de hoy si ya existe
  useEffect(() => {
    async function loadToday() {
      const user = auth.currentUser;
      if (!user) return;
      const today = localDateStr();
      const q = query(
        collection(db, 'posts'),
        where('uid', '==', user.uid),
        where('date', '==', today)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = snap.docs[0].data();
        const loaded = {
          morning: data.songs?.morning ?? null,
          afternoon: data.songs?.afternoon ?? null,
          night: data.songs?.night ?? null,
        };
        setSongs(loaded);
        if (loaded.morning && loaded.afternoon && loaded.night) {
          setAlreadyPosted(true);
        }
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
    const today = localDateStr();

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

      const justCompleted = songData.morning && songData.afternoon && songData.night;
      if (justCompleted) {
        setAlreadyPosted(true);
        cancelStreakReminder().catch(() => {});
        try {
          const { current } = await syncStreakToProfile(user.uid);
          setStreakCount(current);
          setShowStreak(true);
          return;
        } catch {}
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
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={styles.searchHeader}>
          <TouchableOpacity
            style={[styles.backBtnSearch, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]}
            onPress={() => { setActiveSlot(null); setResults([]); setSearchQuery(''); }}
          >
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.searchTitle, { color: colors.textPrimary }]}>Buscar canción</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={[styles.searchInputWrapper, { backgroundColor: colors.card, borderColor: colors.border, shadowColor: colors.primary }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginLeft: 14 }} />
            <TextInput
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Artista o canción..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searching && <ActivityIndicator color={colors.primary} size="small" style={{ marginRight: 12 }} />}
            {!searching && searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ marginRight: 12, zIndex: 1 }}>
                <Ionicons name="close-circle" size={17} color={colors.textMuted} />
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
            <View style={[styles.resultShadow, { shadowColor: colors.primary }]}>
              <TouchableOpacity style={[styles.resultItem, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => selectTrack(item)}>
                {item.artworkUrl100
                  ? <Image source={{ uri: item.artworkUrl100 }} style={styles.resultCover} />
                  : <View style={[styles.resultCover, { backgroundColor: colors.border }]} />
                }
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultName, { color: colors.textPrimary }]} numberOfLines={1}>{item.trackName}</Text>
                  <Text style={[styles.resultArtist, { color: colors.primary }]} numberOfLines={1}>{item.artistName}</Text>
                  <Text style={[styles.resultAlbum, { color: colors.textMuted }]} numberOfLines={1}>{item.collectionName}</Text>
                  {item.previewUrl
                    ? <Text style={[styles.previewBadge, { color: colors.primary }]}>▶ Preview disponible</Text>
                    : <Text style={[styles.noPreviewBadge, { color: colors.textMuted }]}>Sin preview</Text>
                  }
                </View>
              </TouchableOpacity>
            </View>
          )}
        />
      </View>
      </TouchableWithoutFeedback>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {alreadyPosted && (
          <View style={[styles.editBanner, { backgroundColor: isDark ? 'rgba(155,109,214,0.15)' : 'rgba(155,109,214,0.10)', borderColor: colors.primary + '40' }]}>
            <Ionicons name="create-outline" size={15} color={colors.primary} />
            <Text style={[styles.editBannerText, { color: colors.primary }]}>Editando tu Daylist de hoy</Text>
          </View>
        )}
        <Text style={[styles.title, { color: colors.textPrimary }]}>¿Qué canciones definen tu día?</Text>

        {SLOTS.map(({ key, label }) => (
          <View key={key} style={styles.slotSection}>
            <Text style={[styles.slotLabel, { color: colors.textMuted }]}>{label}</Text>

            {songs[key] ? (
              <View style={[styles.cardShadow, { shadowColor: colors.primary }]}>
                <View style={[styles.selectedCard, { borderColor: colors.cardGlass.border }]}>
                  <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]} />
                  <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg, backgroundColor: colors.cardGlass.overlay }]} />
                  <View style={styles.selectedRow}>
                    {songs[key].albumImage && (
                      <Image source={{ uri: songs[key].albumImage }} style={styles.selectedCover} />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.selectedName, { color: colors.textPrimary }]} numberOfLines={1}>{songs[key].name}</Text>
                      <Text style={[styles.selectedArtist, { color: colors.primary }]} numberOfLines={1}>{songs[key].artist}</Text>
                      <AudioPlayer
                        previewUrl={songs[key].previewUrl}
                        startSec={songs[key].startSec}
                        endSec={songs[key].endSec}
                      />
                    </View>
                    <TouchableOpacity onPress={() => setSongs(p => ({ ...p, [key]: null }))}>
                      <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.actionRow, { borderTopColor: colors.borderLight }]}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openPhraseModal(key)}>
                      <Ionicons name="chatbubble-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>
                        {songs[key].phrase ? 'Editar frase' : 'Agregar frase'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => openLyricModal(key)}>
                      <Ionicons name="text-outline" size={14} color={colors.textMuted} />
                      <Text style={[styles.actionBtnText, { color: colors.textMuted }]}>
                        {getSelectedLines(key).length > 0 ? 'Editar destacado' : 'Destacar letra'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {songs[key].phrase ? (
                    <Text style={[styles.phrasePreview, { color: colors.textSecondary, borderLeftColor: colors.secondary }]}>"{songs[key].phrase}"</Text>
                  ) : null}

                  {getSelectedLines(key).length > 0 ? (
                    <View style={[styles.lyricSnippetPreview, { backgroundColor: colors.primary + '14', borderLeftColor: colors.primary }]}>
                      <Ionicons name="musical-note" size={12} color={colors.primary} />
                      <Text style={[styles.lyricSnippetText, { color: colors.textSecondary }]}>{getSelectedLines(key).length} líneas destacadas en la letra</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={[styles.cardShadow, { shadowColor: colors.primary, shadowOpacity: 0.10 }]}>
                <TouchableOpacity style={[styles.addBtn, { borderColor: colors.cardGlass.border }]} onPress={() => setActiveSlot(key)}>
                  <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg }]} />
                  <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.lg, backgroundColor: colors.cardGlass.overlay }]} />
                  <LinearGradient colors={colors.gradientPrimary} style={styles.addIcon} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </LinearGradient>
                  <Text style={[styles.addBtnText, { color: colors.primary }]}>Agregar canción</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: colors.borderLight }]}>
        <BlurView tint={colors.cardGlass.tint} intensity={40} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.cardGlass.overlay }]} />
        <TouchableOpacity onPress={publish} disabled={saving} activeOpacity={0.85}>
          <LinearGradient colors={colors.gradientPrimary} style={styles.publishBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.publishBtnText}>{alreadyPosted ? 'Guardar cambios' : 'Publicar'}</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Phrase modal */}
      <SheetModal visible={!!phraseModal} onClose={() => { Keyboard.dismiss(); setPhraseModal(null); }}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View style={[styles.modal, { flex: 1, backgroundColor: colors.bg }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Agregar frase</Text>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setPhraseModal(null); }}>
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.phraseInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="¿Qué te transmite esta canción?"
              placeholderTextColor={colors.textMuted}
              value={phrase}
              onChangeText={setPhrase}
              multiline
              maxLength={200}
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{phrase.length}/200</Text>
            <TouchableOpacity onPress={savePhrase} activeOpacity={0.85}>
              <LinearGradient colors={colors.gradientPrimary} style={styles.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.saveBtnText}>Guardar</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </SheetModal>

      <StreakCelebration
        visible={showStreak}
        streak={streakCount}
        onClose={() => { setShowStreak(false); router.replace('/(tabs)'); }}
      />

      {/* Lyric picker modal */}
      <SheetModal visible={!!lyricModal} onClose={() => setLyricModal(null)} fullHeight>
        <View style={[styles.modal, styles.modalFull, { backgroundColor: colors.bg }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Elige una línea</Text>
              <Text style={[styles.modalSub, { color: colors.textMuted }]}>Toca la letra que quieres mostrar en tu post</Text>
            </View>
            <TouchableOpacity onPress={() => setLyricModal(null)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {lyricModal && getSelectedLines(lyricModal).length > 0 ? (
            <View style={styles.snippetBanner}>
              <LinearGradient colors={colors.gradientPrimary} style={styles.snippetBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Ionicons name="musical-note" size={12} color="#fff" />
                <Text style={styles.snippetBadgeText}>{getSelectedLines(lyricModal).length} seleccionadas</Text>
              </LinearGradient>
              <TouchableOpacity
                style={[styles.snippetClearBtn, { borderColor: colors.border }]}
                onPress={() => setSongs(p => ({ ...p, [lyricModal]: { ...p[lyricModal], lyricSnippet: [] } }))}
              >
                <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
                <Text style={[styles.snippetClearText, { color: colors.textMuted }]}>Limpiar</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!loadingLyrics && lyricLines.length > 0 && (
            <TouchableOpacity onPress={() => setLyricModal(null)} activeOpacity={0.85} style={{ paddingHorizontal: 20, marginBottom: 8 }}>
              <LinearGradient colors={colors.gradientPrimary} style={[styles.saveBtn, { marginTop: 0 }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.saveBtnText}>Listo</Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {loadingLyrics ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
          ) : lyricLines.length > 0 ? (
            <View style={{ flex: 1 }}>
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
                {...lyricScrollProps}
              />
              {lyricIndicator}
            </View>
          ) : (
            <View style={styles.noLyricsEmpty}>
              <Ionicons name="musical-note-outline" size={40} color={colors.border} />
              <Text style={[styles.noLyricsText, { color: colors.textMuted }]}>Letra no disponible para esta canción</Text>
            </View>
          )}
        </View>
      </SheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  editBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.md, padding: 10, marginBottom: 16, borderWidth: 1 },
  editBannerText: { fontSize: 13, fontWeight: '600' },
  scroll: { padding: 20, paddingBottom: 120 },
  title: { color: Colors.textPrimary, fontSize: 22, fontWeight: '700', marginBottom: 24, letterSpacing: -0.5 },
  slotSection: { marginBottom: 20 },
  slotLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },

  cardShadow: { borderRadius: Radius.lg, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.20, shadowRadius: 16, elevation: 6 },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: Radius.lg, padding: 16, borderWidth: 1, overflow: 'hidden' },
  addIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 15, fontWeight: '600' },

  selectedCard: { borderRadius: Radius.lg, padding: 14, borderWidth: 1, overflow: 'hidden' },
  selectedRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  selectedCover: { width: 60, height: 60, borderRadius: Radius.sm },
  selectedName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  selectedArtist: { color: Colors.primary, fontSize: 12, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 12, marginTop: 12, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { color: Colors.textSecondary, fontSize: 12 },
  phrasePreview: { fontStyle: 'italic', fontSize: 13, marginTop: 8, paddingLeft: 10, borderLeftWidth: 2 },

  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 32, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  publishBtn: { borderRadius: Radius.pill, paddingVertical: 15, alignItems: 'center', overflow: 'hidden' },
  publishBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  backBtnSearch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  searchTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '600', flex: 1 },
  searchRow: { paddingHorizontal: 16, marginBottom: 8 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, elevation: 2, shadowOpacity: 0.08 },
  searchInput: { flex: 1, paddingVertical: 13, paddingHorizontal: 8, color: Colors.textPrimary, fontSize: 15, zIndex: 1 },

  resultShadow: { borderRadius: Radius.lg, shadowOffset: { width: 0, height: 4 }, shadowRadius: 12, shadowOpacity: 0.15, elevation: 4 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  resultCover: { width: 50, height: 50, borderRadius: Radius.sm },
  resultName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  resultArtist: { color: Colors.primary, fontSize: 12 },
  resultAlbum: { color: Colors.textMuted, fontSize: 11 },
  modal: { padding: 20, paddingTop: 24, paddingBottom: 32 },
  modalFull: { flex: 1 },
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
  snippetBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 14, gap: 10 },
  snippetBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  snippetBadgeText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  snippetClearBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1 },
  snippetClearText: { fontSize: 13, fontWeight: '500' },
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
  const { colors } = useTheme();
  const isSelected = selected.includes(item);
  const disabled = maxReached && !isSelected;
  return (
    <TouchableOpacity
      style={[styles.lyricLine, isSelected && styles.lyricLineSelected, disabled && styles.lyricLineDisabled]}
      onPress={() => !disabled && onToggle(item)}
      activeOpacity={disabled ? 1 : 0.7}>
      <Text style={[styles.lyricLineText, { color: colors.textSecondary }, isSelected && { color: colors.textPrimary, fontWeight: '600' }, disabled && { color: colors.textMuted }]}>
        {item}
      </Text>
      {isSelected && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
    </TouchableOpacity>
  );
}
