import { useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Linking,
  ImageBackground, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';
import SheetModal from './SheetModal';
import Reactions from './Reactions';
import CommentsSheet from './CommentsSheet';
import { getLyrics, isSectionMarker } from '@/lib/musixmatch';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

const SLOT_CONFIG = {
  morning:   { label: 'Mañana' },
  afternoon: { label: 'Tarde' },
  night:     { label: 'Noche' },
};

function parseLyrics(text) {
  if (!text) return [];
  return text.split('\n\n').map(b => b.trim()).filter(Boolean);
}

export default function SongCard({ song, slot, postId, postOwnerUid, reactions, commentCount }) {
  const { colors } = useTheme();
  const [showLyrics, setShowLyrics] = useState(false);
  const [lyrics, setLyrics] = useState(null);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [showComments, setShowComments] = useState(false);

  const config = SLOT_CONFIG[slot] ?? { label: slot };
  const hasSnippet = song.lyricSnippet && (Array.isArray(song.lyricSnippet) ? song.lyricSnippet.length > 0 : true);

  async function openLyrics() {
    setShowLyrics(true);
    if (lyrics !== null) return;
    setLoadingLyrics(true);
    const durationSec = song.durationMs ? song.durationMs / 1000 : null;
    const text = await getLyrics(song.name, song.artist, durationSec);
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
    <View style={[styles.cardShadowWrap, { backgroundColor: colors.bg, shadowColor: colors.primary, shadowOpacity: colors.cardGlass.shadowOpacity }]}>
    <View style={[styles.card, { borderColor: colors.cardGlass.border }]}>
      <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, styles.cardBg]} />
      <View style={[StyleSheet.absoluteFill, styles.cardBg, { backgroundColor: colors.cardGlass.overlay }]} />
      {/* Slot label */}
      <Text style={[styles.slotLabel, { color: colors.primary }]}>{config.label.toUpperCase()}</Text>

      {/* Main content */}
      <View style={styles.main}>
        {song.albumImage ? (
          <Image source={{ uri: song.albumImage }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverFallback, { backgroundColor: colors.bg }]}>
            <Ionicons name="musical-note" size={22} color={colors.textMuted} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={[styles.trackName, { color: colors.textPrimary }]} numberOfLines={2}>{song.name}</Text>
          <Text style={[styles.artist, { color: colors.primary }]} numberOfLines={1}>{song.artist}</Text>
          {song.album ? <Text style={[styles.album, { color: colors.textSecondary }]} numberOfLines={1}>{song.album}</Text> : null}
        </View>
      </View>

      {/* Phrase */}
      {song.phrase ? (
        <Text style={[styles.phrase, { color: colors.textSecondary, borderLeftColor: colors.secondary }]}>"{song.phrase}"</Text>
      ) : null}

      {/* Player */}
      <AudioPlayer
        previewUrl={song.previewUrl}
        startSec={song.startSec ?? 0}
        endSec={song.endSec ?? null}
      />

      {/* Actions */}
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <TouchableOpacity
          onPress={openLyrics}
          activeOpacity={0.7}
          style={{ flex: 1, marginRight: 8, flexDirection: 'row', alignItems: 'center', gap: 5 }}
        >
          <Ionicons name="document-text-outline" size={13} color={colors.primary} />
          <Text style={[styles.lyricBtnText, { color: colors.primary }]} numberOfLines={1}>
            {hasSnippet ? 'Ver letra destacada' : 'Ver letra'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={openSpotify} activeOpacity={0.7} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
          <MaterialCommunityIcons name="spotify" size={13} color={colors.spotify} />
          <Text style={[styles.spotifyText, { color: colors.spotify }]}>Escuchar en Spotify</Text>
        </TouchableOpacity>
      </View>

      {/* Reactions & Comments — alineadas a la izquierda */}
      {postId && (
        <View style={{ alignSelf: 'flex-start' }}>
          <Reactions
            postId={postId}
            slot={slot}
            reactions={reactions ?? {}}
            postOwnerUid={postOwnerUid}
            commentCount={commentCount ?? 0}
            onComment={() => setShowComments(true)}
          />
        </View>
      )}

      <CommentsSheet
        visible={showComments}
        onClose={() => setShowComments(false)}
        postId={postId}
        postOwnerUid={postOwnerUid}
        slot={slot}
      />

      {/* Lyrics modal */}
      <SheetModal visible={showLyrics} onClose={() => setShowLyrics(false)} fullHeight>
        <View style={[styles.modal, { backgroundColor: colors.bg }]}>
          <ImageBackground
            source={song.albumImage ? { uri: song.albumImage } : undefined}
            style={styles.modalHero}
            blurRadius={Platform.OS === 'ios' ? 40 : 8}>
            <LinearGradient
              colors={[colors.bg + '1A', colors.bg]}
              style={styles.heroGradient}>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowLyrics(false)}>
                <Ionicons name="chevron-down" size={16} color="#fff" />
              </TouchableOpacity>
              <View style={styles.heroRow}>
                {song.albumImage && <Image source={{ uri: song.albumImage }} style={styles.heroCover} />}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroTitle, { color: colors.textPrimary }]} numberOfLines={1}>{song.name}</Text>
                  <Text style={[styles.heroArtist, { color: colors.textSecondary }]}>{song.artist}</Text>
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
              <ActivityIndicator color={colors.primary} style={{ marginTop: 48 }} />
            ) : stanzas.length > 0 ? (
              stanzas.map((stanza, i) => (
                <View key={i} style={styles.stanza}>
                  {stanza.split('\n').map((line, j) => {
                    if (isSectionMarker(line)) {
                      return (
                        <Text key={j} style={[styles.lyricLineMarker, { color: colors.textMuted }]}>
                          {line}
                        </Text>
                      );
                    }
                    const isHighlighted = snippetArr.some(s => s.trim() === line.trim());
                    return (
                      <Text key={j} style={[styles.lyricLine, { color: colors.textMuted }, isHighlighted && { color: colors.primary, fontWeight: '700' }]}>
                        {line}
                      </Text>
                    );
                  })}
                </View>
              ))
            ) : (
              <View style={styles.noLyrics}>
                <Ionicons name="musical-note-outline" size={40} color={colors.border} />
                <Text style={[styles.noLyricsText, { color: colors.textMuted }]}>Letra no disponible</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </SheetModal>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardShadowWrap: {
    marginBottom: 14,
    borderRadius: Radius.xl,
    ...Shadow.md,
    shadowRadius: 16,
  },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 18,
    overflow: 'hidden',
  },
  cardBg: {
    borderRadius: Radius.xl,
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
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  lyricBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
    borderRadius: Radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  lyricBtnText: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  spotifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderRadius: Radius.pill,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  spotifyText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },

  // Modal
  modal: { flex: 1, backgroundColor: Colors.bg },
  modalHero: { width: '100%' },
  heroGradient: { paddingTop: Platform.OS === 'android' ? 44 : 20, paddingHorizontal: 20, paddingBottom: 28 },
  closeBtn: {
    alignSelf: 'flex-start',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  heroCover: { width: 52, height: 52, borderRadius: Radius.sm },
  heroTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700' },
  heroArtist: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  heroSub: { color: Colors.primary, fontSize: 12, fontWeight: '500' },
  lyricsScroll: { flex: 1 },
  lyricsBody: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 60 },
  stanza: { marginBottom: 24 },
  lyricLine: { color: Colors.textSecondary, fontSize: 17, lineHeight: 30 },
  lyricLineMarker: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: 26 },
  lyricLineHL: {
    color: Colors.primary,
    fontWeight: '700',
  },
  noLyrics: { alignItems: 'center', marginTop: 60, gap: 12 },
  noLyricsText: { color: Colors.textMuted, fontSize: 15 },
});
