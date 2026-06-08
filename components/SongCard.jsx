import { useState, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, Linking,
  Animated, ImageBackground,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';
import { getLyrics } from '@/lib/musixmatch';
import { Colors, Radius } from '@/constants/Theme';

const SLOT_CONFIG = {
  morning:   { label: 'Mañana',   emoji: '🌸', gradient: ['#FFB3C6', '#FF6B9D'] },
  afternoon: { label: 'Tarde',    emoji: '☀️', gradient: ['#FBBF24', '#F472B6'] },
  night:     { label: 'Noche',    emoji: '🌙', gradient: ['#818CF8', '#C084FC'] },
};

function parseLyrics(text) {
  if (!text) return [];
  return text.split('\n\n').map(b => b.trim()).filter(Boolean);
}

export default function SongCard({ song, slot }) {
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const config = SLOT_CONFIG[slot] ?? { label: slot, emoji: '🎵', gradient: ['#C084FC', '#F472B6'] };

  function onPressIn() {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, tension: 200, friction: 10 }).start();
  }
  function onPressOut() {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }).start();
  }

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

  const stanzas = parseLyrics(lyrics);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={styles.card}>

        {/* Slot badge */}
        <View style={styles.slotRow}>
          <LinearGradient colors={config.gradient} style={styles.slotBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={styles.slotEmoji}>{config.emoji}</Text>
            <Text style={styles.slotLabel}>{config.label}</Text>
          </LinearGradient>
        </View>

        <View style={styles.row}>
          {song.albumImage ? (
            <View style={styles.coverContainer}>
              <Image source={{ uri: song.albumImage }} style={styles.cover} />
              <LinearGradient colors={['transparent', 'rgba(30,22,53,0.6)']} style={styles.coverGradient} />
            </View>
          ) : (
            <View style={[styles.cover, styles.coverFallback]}>
              <Ionicons name="musical-note" size={24} color={Colors.textMuted} />
            </View>
          )}

          <View style={styles.info}>
            <Text style={styles.trackName} numberOfLines={2}>{song.name}</Text>
            <Text style={styles.artist} numberOfLines={1}>{song.artist}</Text>
            <Text style={styles.album} numberOfLines={1}>{song.album}</Text>
            {song.phrase ? (
              <View style={styles.phraseContainer}>
                <Text style={styles.phraseQuote}>"</Text>
                <Text style={styles.phrase}>{song.phrase}</Text>
                <Text style={styles.phraseQuote}>"</Text>
              </View>
            ) : null}
            <AudioPlayer
              previewUrl={song.previewUrl}
              startSec={song.startSec ?? 0}
              endSec={song.endSec ?? null}
            />
          </View>
        </View>

        {/* Acciones */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={openLyrics}>
            <Ionicons name="document-text-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.actionText}>
              {song.lyricSnippet && (Array.isArray(song.lyricSnippet) ? song.lyricSnippet.length > 0 : true)
                ? 'Ver letra destacada' : 'Ver letra'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.spotifyBtn} onPress={openSpotify}>
            <Ionicons name="musical-notes" size={13} color="#1DB954" />
            <Text style={styles.spotifyText}>Spotify</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Modal letra */}
      <Modal visible={showLyrics} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <ImageBackground source={song.albumImage ? { uri: song.albumImage } : undefined} style={styles.modalHero} blurRadius={30}>
            <LinearGradient colors={['rgba(13,10,26,0.4)', 'rgba(13,10,26,1)']} style={styles.heroGradient}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLyrics(false)}>
                <Ionicons name="chevron-down" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.heroContent}>
                {song.albumImage && <Image source={{ uri: song.albumImage }} style={styles.heroCover} />}
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroTitle} numberOfLines={2}>{song.name}</Text>
                  <Text style={styles.heroArtist}>{song.artist}</Text>
                </View>
              </View>
              <LinearGradient colors={config.gradient} style={styles.lyricsBadge} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <Text style={styles.lyricsBadgeText}>✦ LETRA</Text>
              </LinearGradient>
            </LinearGradient>
          </ImageBackground>

          <ScrollView style={styles.lyricsScroll} contentContainerStyle={styles.lyricsBody} showsVerticalScrollIndicator={false}>
            {loadingLyrics ? (
              <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 40 }} />
            ) : stanzas.length > 0 ? (
              stanzas.map((stanza, i) => (
                <View key={i} style={styles.stanza}>
                  {stanza.split('\n').map((line, j) => {
                    const snippetArr = Array.isArray(song.lyricSnippet) ? song.lyricSnippet : song.lyricSnippet ? [song.lyricSnippet] : [];
                    const isHighlighted = snippetArr.some(s => s.trim() === line.trim());
                    return (
                      <Text key={j} style={[styles.lyricsLine, isHighlighted && styles.lyricsLineHighlighted]}>
                        {line}
                      </Text>
                    );
                  })}
                </View>
              ))
            ) : (
              <View style={styles.noLyricsContainer}>
                <Text style={styles.noLyricsEmoji}>🎵</Text>
                <Text style={styles.noLyrics}>Letra no disponible</Text>
                <Text style={styles.noLyricsSub}>Búscala en Spotify o Genius</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  slotRow: { marginBottom: 12 },
  slotBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', borderRadius: Radius.pill,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  slotEmoji: { fontSize: 12 },
  slotLabel: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  row: { flexDirection: 'row', gap: 14 },
  coverContainer: { position: 'relative' },
  cover: { width: 86, height: 86, borderRadius: Radius.md },
  coverGradient: { position: 'absolute', inset: 0, borderRadius: Radius.md },
  coverFallback: { backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1 },
  trackName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  artist: { color: Colors.primary, fontSize: 13, marginTop: 3, fontWeight: '500' },
  album: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  phraseContainer: { flexDirection: 'row', marginTop: 8, gap: 2 },
  lyricSnippet: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 7, backgroundColor: 'rgba(192,132,252,0.08)', borderRadius: 8, padding: 7, borderLeftWidth: 2, borderLeftColor: Colors.primary },
  lyricSnippetText: { color: Colors.textSecondary, fontSize: 11, fontStyle: 'italic', flex: 1, lineHeight: 17 },
  phraseQuote: { color: Colors.secondary, fontSize: 14, fontWeight: '800', lineHeight: 18 },
  phrase: { color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', flex: 1, lineHeight: 18 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { color: Colors.textSecondary, fontSize: 12 },
  spotifyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(29,185,84,0.1)', borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(29,185,84,0.2)' },
  spotifyText: { color: '#1DB954', fontSize: 12, fontWeight: '600' },
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHero: { width: '100%' },
  heroGradient: { paddingTop: 56, paddingHorizontal: 20, paddingBottom: 24 },
  closeBtn: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: 8, marginBottom: 20 },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  heroCover: { width: 60, height: 60, borderRadius: Radius.md },
  heroTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  heroArtist: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 3 },
  lyricsBadge: { alignSelf: 'flex-start', borderRadius: Radius.pill, paddingHorizontal: 14, paddingVertical: 5 },
  lyricsBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  lyricsScroll: { flex: 1 },
  lyricsBody: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 60 },
  stanza: { marginBottom: 28 },
  lyricsLine: { color: Colors.textPrimary, fontSize: 17, lineHeight: 30, fontWeight: '400' },
  lyricsLineHighlighted: { color: Colors.primary, fontWeight: '700', backgroundColor: 'rgba(192,132,252,0.1)', borderRadius: 6, paddingHorizontal: 4 },
  noLyricsContainer: { alignItems: 'center', marginTop: 60, gap: 8 },
  noLyricsEmoji: { fontSize: 48 },
  noLyrics: { color: Colors.textSecondary, fontSize: 17, fontWeight: '600' },
  noLyricsSub: { color: Colors.textMuted, fontSize: 13 },
});
