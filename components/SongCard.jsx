import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Linking,
  ImageBackground, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';
import { getLyrics } from '@/lib/musixmatch';
import { Colors, Radius, Shadow } from '@/constants/Theme';

const SLOT_CONFIG = {
  morning:   { label: 'Mañana' },
  afternoon: { label: 'Tarde' },
  night:     { label: 'Noche' },
};

function parseLyrics(text) {
  if (!text) return [];
  return text.split('\n\n').map(b => b.trim()).filter(Boolean);
}

export default function SongCard({ song, slot }) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  const config = SLOT_CONFIG[slot] ?? { label: slot };
  const hasSnippet = song.lyricSnippet && (Array.isArray(song.lyricSnippet) ? song.lyricSnippet.length > 0 : true);

  async function openLyrics() {
    setShowLyrics(true);
    if (lyrics !== null) return;
    setLoadingLyrics(true);
    const text = await getLyrics(song.name, song.artist);
    setLyrics(text);
    setLoadingLyrics(false);
  }

  async function openSpotify() {
    const q = encodeURIComponent(`${song.name} ${song.artist}`);
    const deep = `spotify:search:${q}`;
    const web = `https://open.spotify.com/search/${q}`;
    const can = await Linking.canOpenURL(deep);
    Linking.openURL(can ? deep : web);
  }

  const snippetArr = Array.isArray(song.lyricSnippet)
    ? song.lyricSnippet
    : song.lyricSnippet ? [song.lyricSnippet] : [];

  const stanzas = parseLyrics(lyrics);

  return (
    <View style={styles.card}>
      {/* Slot label */}
      <Text style={styles.slotLabel}>{config.label.toUpperCase()}</Text>

      {/* Main content */}
      <View style={styles.main}>
        {song.albumImage ? (
          <Image source={{ uri: song.albumImage }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Ionicons name="musical-note" size={22} color={Colors.textMuted} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.trackName} numberOfLines={2}>{song.name}</Text>
          <Text style={styles.artist} numberOfLines={1}>{song.artist}</Text>
          {song.album ? <Text style={styles.album} numberOfLines={1}>{song.album}</Text> : null}
        </View>
      </View>

      {/* Phrase */}
      {song.phrase ? (
        <Text style={styles.phrase}>"{song.phrase}"</Text>
      ) : null}

      {/* Player */}
      <AudioPlayer
        previewUrl={song.previewUrl}
        startSec={song.startSec ?? 0}
        endSec={song.endSec ?? null}
      />

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={openLyrics}>
          <Ionicons name="document-text-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.actionText}>{hasSnippet ? 'Ver letra destacada' : 'Ver letra'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.spotifyBtn} onPress={openSpotify}>
          <MaterialCommunityIcons name="spotify" size={15} color="#1DB954" />
          <Text style={styles.spotifyText}>Abrir en Spotify</Text>
        </TouchableOpacity>
      </View>

      {/* Lyrics modal */}
      <Modal visible={showLyrics} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <ImageBackground
            source={song.albumImage ? { uri: song.albumImage } : undefined}
            style={styles.modalHero}
            blurRadius={Platform.OS === 'ios' ? 40 : 8}>
            <LinearGradient
              colors={['rgba(242,242,247,0.1)', 'rgba(242,242,247,1)']}
              style={styles.heroGradient}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLyrics(false)}>
                <Ionicons name="chevron-down" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
              <View style={styles.heroRow}>
                {song.albumImage && <Image source={{ uri: song.albumImage }} style={styles.heroCover} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle} numberOfLines={1}>{song.name}</Text>
                  <Text style={styles.heroArtist}>{song.artist}</Text>
                </View>
              </View>
              {hasSnippet && (
                <Text style={styles.heroSub}>
                  {snippetArr.length} {snippetArr.length === 1 ? 'línea destacada' : 'líneas destacadas'}
                </Text>
              )}
            </LinearGradient>
          </ImageBackground>

          <ScrollView
            style={styles.lyricsScroll}
            contentContainerStyle={styles.lyricsBody}
            showsVerticalScrollIndicator={false}>
            {loadingLyrics ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 48 }} />
            ) : stanzas.length > 0 ? (
              stanzas.map((stanza, i) => (
                <View key={i} style={styles.stanza}>
                  {stanza.split('\n').map((line, j) => {
                    const isHighlighted = snippetArr.some(s => s.trim() === line.trim());
                    return (
                      <Text key={j} style={[styles.lyricLine, isHighlighted && styles.lyricLineHL]}>
                        {line}
                      </Text>
                    );
                  })}
                </View>
              ))
            ) : (
              <View style={styles.noLyrics}>
                <Ionicons name="musical-note-outline" size={40} color={Colors.border} />
                <Text style={styles.noLyricsText}>Letra no disponible</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 12,
    ...Shadow.md,
  },
  slotLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  main: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  cover: { width: 72, height: 72, borderRadius: Radius.md },
  coverFallback: { backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3 },
  trackName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600', lineHeight: 20 },
  artist: { color: Colors.primary, fontSize: 13 },
  album: { color: Colors.textMuted, fontSize: 12 },
  phrase: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 12,
    lineHeight: 19,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: Colors.secondary,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: Colors.textMuted, fontSize: 12 },
  spotifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  spotifyText: { color: '#1DB954', fontSize: 12 },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHero: { width: '100%' },
  heroGradient: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 20 },
  closeBtn: { alignSelf: 'flex-start', padding: 8, marginBottom: 16 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  heroCover: { width: 52, height: 52, borderRadius: Radius.sm },
  heroTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  heroArtist: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  heroSub: { color: Colors.primary, fontSize: 12, fontWeight: '500' },
  lyricsScroll: { flex: 1 },
  lyricsBody: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },
  stanza: { marginBottom: 24 },
  lyricLine: { color: Colors.textSecondary, fontSize: 17, lineHeight: 30 },
  lyricLineHL: {
    color: Colors.primary,
    fontWeight: '700',
  },
  noLyrics: { alignItems: 'center', marginTop: 60, gap: 12 },
  noLyricsText: { color: Colors.textMuted, fontSize: 15 },
});
