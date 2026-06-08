import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Linking, ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AudioPlayer from './AudioPlayer';
import { getLyrics } from '@/lib/musixmatch';

const SLOT_LABELS = { morning: '🌅 Mañana', afternoon: '☀️ Tarde', night: '🌙 Noche' };

// Convierte la letra en array de estrofas separando líneas vacías
function parseLyrics(text) {
  if (!text) return [];
  return text
    .split('\n\n')
    .map(block => block.trim())
    .filter(Boolean);
}

export default function SongCard({ song, slot }) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);

  async function openLyrics() {
    setShowLyrics(true);
    if (lyrics !== null) return;
    setLoadingLyrics(true);
    const text = await getLyrics(song.name, song.artist);
    setLyrics(text);
    setLoadingLyrics(false);
  }

  async function openSpotify() {
    const query = encodeURIComponent(`${song.name} ${song.artist}`);
    const deepLink = `spotify:search:${query}`;
    const webUrl = `https://open.spotify.com/search/${query}`;
    const canOpen = await Linking.canOpenURL(deepLink);
    Linking.openURL(canOpen ? deepLink : webUrl);
  }

  const stanzas = parseLyrics(lyrics);

  return (
    <View style={styles.card}>
      <Text style={styles.slotLabel}>{SLOT_LABELS[slot] ?? slot}</Text>

      <View style={styles.row}>
        {song.albumImage ? (
          <Image source={{ uri: song.albumImage }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback]}>
            <Ionicons name="musical-note" size={24} color="#444" />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.trackName} numberOfLines={2}>{song.name}</Text>
          <Text style={styles.artist} numberOfLines={1}>{song.artist}</Text>
          <Text style={styles.album} numberOfLines={1}>{song.album}</Text>

          {song.phrase ? (
            <Text style={styles.phrase}>"{song.phrase}"</Text>
          ) : null}

          <AudioPlayer
            previewUrl={song.previewUrl}
            startSec={song.startSec ?? 0}
            endSec={song.endSec ?? null}
          />
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionBtn} onPress={openLyrics}>
          <Ionicons name="document-text-outline" size={14} color="#888" />
          <Text style={styles.actionBtnText}>Ver letra</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.spotifyBtn} onPress={openSpotify}>
          <Ionicons name="musical-notes" size={14} color="#1DB954" />
          <Text style={styles.spotifyBtnText}>Abrir en Spotify</Text>
        </TouchableOpacity>
      </View>

      {/* ── Modal de letra ── */}
      <Modal visible={showLyrics} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>

          {/* Header con imagen de fondo difuminada */}
          <ImageBackground
            source={song.albumImage ? { uri: song.albumImage } : undefined}
            style={styles.modalHero}
            blurRadius={25}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.3)', 'rgba(10,10,10,1)']}
              style={styles.heroGradient}
            >
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setShowLyrics(false)}>
                <Ionicons name="chevron-down" size={26} color="#fff" />
              </TouchableOpacity>

              <View style={styles.heroContent}>
                {song.albumImage && (
                  <Image source={{ uri: song.albumImage }} style={styles.heroCover} />
                )}
                <View style={styles.heroText}>
                  <Text style={styles.heroTitle} numberOfLines={2}>{song.name}</Text>
                  <Text style={styles.heroArtist}>{song.artist}</Text>
                </View>
              </View>

              <Text style={styles.lyricsLabel}>LETRA</Text>
            </LinearGradient>
          </ImageBackground>

          {/* Cuerpo de la letra */}
          <ScrollView
            style={styles.lyricsScroll}
            contentContainerStyle={styles.lyricsBody}
            showsVerticalScrollIndicator={false}
          >
            {loadingLyrics ? (
              <ActivityIndicator color="#1DB954" size="large" style={{ marginTop: 40 }} />
            ) : stanzas.length > 0 ? (
              stanzas.map((stanza, i) => (
                <View key={i} style={styles.stanza}>
                  {stanza.split('\n').map((line, j) => (
                    <Text key={j} style={styles.lyricsLine}>{line}</Text>
                  ))}
                </View>
              ))
            ) : (
              <View style={styles.noLyricsContainer}>
                <Ionicons name="musical-note-outline" size={48} color="#333" />
                <Text style={styles.noLyrics}>Letra no disponible</Text>
                <Text style={styles.noLyricsSub}>Búscala en Spotify o Genius</Text>
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
    backgroundColor: '#141414',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  slotLabel: { color: '#888', fontSize: 12, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 12 },
  cover: { width: 80, height: 80, borderRadius: 10 },
  coverFallback: { backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  trackName: { color: '#fff', fontSize: 15, fontWeight: '700', lineHeight: 20 },
  artist: { color: '#1DB954', fontSize: 13, marginTop: 2 },
  album: { color: '#555', fontSize: 12, marginTop: 1 },
  phrase: { color: '#aaa', fontSize: 13, fontStyle: 'italic', marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionBtnText: { color: '#888', fontSize: 12 },
  spotifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#0d2b1a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  spotifyBtnText: { color: '#1DB954', fontSize: 12, fontWeight: '600' },

  // Modal
  modal: { flex: 1, backgroundColor: '#0a0a0a' },

  // Hero
  modalHero: { width: '100%' },
  heroGradient: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 },
  closeBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    padding: 6,
    marginBottom: 20,
  },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  heroCover: { width: 64, height: 64, borderRadius: 10 },
  heroText: { flex: 1 },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 24 },
  heroArtist: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4 },
  lyricsLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  // Letra
  lyricsScroll: { flex: 1 },
  lyricsBody: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },
  stanza: { marginBottom: 28 },
  lyricsLine: {
    color: '#e0e0e0',
    fontSize: 17,
    lineHeight: 30,
    fontWeight: '400',
  },

  // Sin letra
  noLyricsContainer: { alignItems: 'center', marginTop: 60, gap: 10 },
  noLyrics: { color: '#555', fontSize: 17, fontWeight: '600' },
  noLyricsSub: { color: '#333', fontSize: 13 },
});
