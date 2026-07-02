import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

const ACCENT = {
  morning:   { bar: ['#E8B86D', '#D4956A'], dot: '#E8B86D' },
  afternoon: { bar: ['#C97BAB', '#B5607A'], dot: '#C97BAB' },
  night:     { bar: ['#7B98CC', '#5B76AA'], dot: '#7B98CC' },
};

const SLOT_LABEL = {
  morning:   'Mañana',
  afternoon: 'Tarde',
  night:     'Noche',
};

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function FilledBlock({ slot, onPlay }) {
  const { colors } = useTheme();
  const { track } = slot;
  const accent = ACCENT[slot.timeOfDay] ?? ACCENT.morning;

  return (
    <View style={[styles.shadowWrap, { backgroundColor: colors.bg, shadowColor: colors.primary, shadowOpacity: colors.cardGlass.shadowOpacity }]}>
    <View style={[styles.filledContainer, { borderColor: colors.cardGlass.border }]}>
      <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, styles.blockBg]} />
      <View style={[StyleSheet.absoluteFill, styles.blockBg, { backgroundColor: colors.cardGlass.overlay }]} />
      <LinearGradient
        colors={accent.bar}
        style={styles.accentBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <Image source={{ uri: track.coverUrl }} style={styles.coverImage} />

      <View style={styles.trackInfo}>
        <Text style={[styles.timeLabel, { color: colors.textMuted }]}>{SLOT_LABEL[slot.timeOfDay]?.toUpperCase()}</Text>
        <Text style={[styles.trackTitle, { color: colors.textPrimary }]} numberOfLines={1}>{track.title}</Text>
        <Text style={[styles.trackArtist, { color: colors.textMuted }]} numberOfLines={1}>{track.artist}</Text>

        {track.note ? (
          <Text style={[styles.trackNote, { color: colors.textMuted }]} numberOfLines={2}>{track.note}</Text>
        ) : null}

        {track.segment ? (
          <View style={styles.segmentRow}>
            <View style={[styles.segmentDot, { backgroundColor: accent.dot }]} />
            <Text style={styles.segmentText}>
              {formatMs(track.segment.startMs)} – {formatMs(track.segment.endMs)}
            </Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity style={[styles.playButton, { backgroundColor: colors.bg }]} onPress={() => onPlay(slot)} activeOpacity={0.65}>
        <View style={styles.playTriangle} />
      </TouchableOpacity>
    </View>
    </View>
  );
}

function EmptyBlock({ slot, onAdd }) {
  const { colors } = useTheme();
  const accent = ACCENT[slot.timeOfDay] ?? ACCENT.morning;

  return (
    <View style={[styles.shadowWrapSm, { backgroundColor: colors.bg, shadowColor: colors.primary, shadowOpacity: colors.cardGlass.shadowOpacitySm }]}>
    <TouchableOpacity
      style={[styles.emptyContainer, { borderColor: colors.cardGlass.border }]}
      onPress={() => onAdd(slot.timeOfDay)}
      activeOpacity={0.6}
    >
      <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, styles.blockBg]} />
      <View style={[StyleSheet.absoluteFill, styles.blockBg, { backgroundColor: colors.cardGlass.overlay }]} />
      <LinearGradient
        colors={[accent.bar[0] + '30', accent.bar[1] + '08']}
        style={styles.accentBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <View style={styles.emptyLeft}>
        <Text style={[styles.emptyLabel, { color: colors.textMuted }]}>{SLOT_LABEL[slot.timeOfDay]?.toUpperCase()}</Text>
        <Text style={[styles.emptyPrompt, { color: colors.textMuted }]}>¿Qué definió tu {SLOT_LABEL[slot.timeOfDay]?.toLowerCase()}?</Text>
      </View>

      <View style={[styles.addButton, { backgroundColor: colors.bg, borderColor: colors.border }]}>
        <Text style={[styles.addButtonIcon, { color: colors.primary }]}>+</Text>
      </View>
    </TouchableOpacity>
    </View>
  );
}

export function TrackBlock({ slot, onAdd, onPlay }) {
  if (slot.track) return <FilledBlock slot={slot} onPlay={onPlay} />;
  return <EmptyBlock slot={slot} onAdd={onAdd} />;
}

const styles = StyleSheet.create({
  shadowWrap: {
    borderRadius: Radius.lg,
    ...Shadow.md,
    shadowRadius: 14,
  },
  shadowWrapSm: {
    borderRadius: Radius.lg,
    ...Shadow.sm,
    shadowRadius: 10,
  },
  blockBg: {
    borderRadius: Radius.lg,
  },
  filledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingVertical: 14,
    paddingRight: 14,
    paddingLeft: 20,
    gap: 12,
    overflow: 'hidden',
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  coverImage: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bg,
    flexShrink: 0,
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
  },
  timeLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  trackArtist: {
    fontSize: 13,
    fontWeight: '400',
    color: Colors.textMuted,
    marginTop: 1,
  },
  trackNote: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 5,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 5,
  },
  segmentDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  segmentText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    ...Shadow.sm,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: Colors.primary,
    marginLeft: 2,
  },
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    paddingVertical: 20,
    paddingRight: 14,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  emptyLeft: { flex: 1, gap: 4 },
  emptyLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  emptyPrompt: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  addButtonIcon: {
    fontSize: 20,
    color: Colors.primary,
    lineHeight: 22,
    marginTop: -1,
  },
});
