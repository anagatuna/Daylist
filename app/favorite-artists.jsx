import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  Image, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '@/lib/firebase';
import { searchDeezerArtists } from '@/lib/deezer';
import { getFavoriteArtists, saveFavoriteArtists, MAX_FAVORITE_ARTISTS } from '@/lib/artistTaste';
import { Radius } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

function ArtistAvatar({ artist, size }) {
  const { colors } = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };
  if (artist.image) return <Image source={{ uri: artist.image }} style={shape} />;
  return (
    <View style={[shape, styles.initial, { backgroundColor: colors.primary + '22' }]}>
      <Text style={[styles.initialText, { color: colors.primary, fontSize: size * 0.4 }]}>{artist.name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

export default function FavoriteArtistsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const [selected, setSelected] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  // Ya respondió antes (entra desde editar perfil): salir sin guardar no debe borrar su selección
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    getFavoriteArtists(uid)
      .then(artists => { if (artists) { setSelected(artists); setEditing(true); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) { setResults([]); return; }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const artists = await searchDeezerArtists(searchQuery);
        if (!cancelled) setResults(artists);
      } catch {
        // silencioso
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery]);

  const sameArtist = (a, b) => a.name.toLowerCase() === b.name.toLowerCase();
  const isSelected = (artist) => selected.some(s => sameArtist(s, artist));
  const full = selected.length >= MAX_FAVORITE_ARTISTS;
  const canSave = editing || selected.length > 0;

  function toggle(artist) {
    if (isSelected(artist)) {
      setSelected(prev => prev.filter(s => !sameArtist(s, artist)));
    } else if (!full) {
      setSelected(prev => [...prev, { name: artist.name, image: artist.image }]);
    }
  }

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }

  async function save(artists) {
    const uid = auth.currentUser?.uid;
    if (!uid || saving) return;
    setSaving(true);
    try {
      await saveFavoriteArtists(uid, artists);
      leave();
    } catch {
      Alert.alert('Error', 'No se pudieron guardar tus artistas. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top + 24 }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>¿Qué artistas te gustan?</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Elige hasta {MAX_FAVORITE_ARTISTS} para que tus búsquedas te muestren primero su música.
        </Text>
      </View>

      {selected.length > 0 && (
        <View style={styles.chips}>
          {selected.map(artist => (
            <TouchableOpacity
              key={artist.name}
              onPress={() => toggle(artist)}
              activeOpacity={0.8}
              style={[styles.chip, { backgroundColor: colors.primary + '22', borderColor: colors.primary + '55' }]}
            >
              <ArtistAvatar artist={artist} size={22} />
              <Text style={[styles.chipText, { color: colors.primary }]} numberOfLines={1}>{artist.name}</Text>
              <Ionicons name="close" size={14} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[styles.searchInputWrapper, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={16} color={colors.textMuted} style={{ marginLeft: 14 }} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Buscar artista..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {searching && <ActivityIndicator color={colors.primary} size="small" style={{ marginRight: 12 }} />}
      </View>

      <FlatList
        data={results}
        keyExtractor={(a) => a.id}
        style={{ flex: 1 }}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          const picked = isSelected(item);
          const disabled = full && !picked;
          return (
            <TouchableOpacity
              style={[styles.resultItem, { backgroundColor: colors.card, borderColor: picked ? colors.primary : colors.border }, disabled && { opacity: 0.4 }]}
              onPress={() => toggle(item)}
              activeOpacity={disabled ? 1 : 0.7}
            >
              <ArtistAvatar artist={item} size={44} />
              <Text style={[styles.resultName, { color: colors.textPrimary }]} numberOfLines={1}>{item.name}</Text>
              <Ionicons
                name={picked ? 'checkmark-circle' : 'add-circle-outline'}
                size={22}
                color={picked ? colors.primary : colors.textMuted}
              />
            </TouchableOpacity>
          );
        }}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => save(selected)} disabled={saving || !canSave} activeOpacity={0.85}>
          <LinearGradient
            colors={colors.gradientPrimary}
            style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Guardar ({selected.length}/{MAX_FAVORITE_ARTISTS})</Text>}
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity onPress={editing ? leave : () => save([])} disabled={saving} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.textMuted }]}>{editing ? 'Cancelar' : 'Omitir por ahora'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginBottom: 14 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: Radius.pill, borderWidth: 1, paddingLeft: 5, paddingRight: 10, paddingVertical: 5, maxWidth: '100%' },
  chipText: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  searchInputWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  searchInput: { flex: 1, paddingVertical: 13, paddingHorizontal: 8, fontSize: 15 },
  list: { padding: 16, gap: 10 },
  resultItem: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: Radius.lg, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  initial: { alignItems: 'center', justifyContent: 'center' },
  initialText: { fontWeight: '700' },
  resultName: { flex: 1, fontSize: 15, fontWeight: '600' },
  footer: { paddingHorizontal: 32, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  saveBtn: { borderRadius: Radius.pill, paddingVertical: 15, alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  skipBtn: { alignItems: 'center', paddingVertical: 12 },
  skipText: { fontSize: 13, fontWeight: '600' },
});
