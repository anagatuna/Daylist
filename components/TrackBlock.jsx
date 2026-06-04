// components/TrackBlock.jsx

import { LinearGradient } from 'expo-linear-gradient';
import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const ACCENT_COLORS = {
  morning:   ['#BF8B3E', '#7A5520'],
  afternoon: ['#B84888', '#732050'],
  night:     ['#4A6AA3', '#263D6B'],
};

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

// --- Bloque con canción ---

function FilledBlock({ slot, onPlay }) {
  const { track } = slot;
  const accent = ACCENT_COLORS[slot.timeOfDay];

  return (
    <View style={styles.filledContainer}>
      <LinearGradient
        colors={accent}
        style={styles.accentBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <Image
        source={{ uri: track.coverUrl }}
        style={styles.coverImage}
      />

      <View style={styles.trackInfo}>
        <Text style={styles.timeLabel}>
          {slot.emoji}  {slot.label.toUpperCase()}
        </Text>
        <Text style={styles.trackTitle} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={styles.trackArtist} numberOfLines={1}>
          {track.artist}
        </Text>

        {track.note ? (
          <Text style={styles.trackNote} numberOfLines={2}>
            {track.note}
          </Text>
        ) : null}

        {track.segment ? (
          <View style={styles.segmentRow}>
            <View style={styles.segmentDot} />
            <Text style={styles.segmentText}>
              {formatMs(track.segment.startMs)} – {formatMs(track.segment.endMs)}
            </Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.playButton}
        onPress={() => onPlay(slot)}
        activeOpacity={0.65}
      >
        <View style={styles.playTriangle} />
      </TouchableOpacity>
    </View>
  );
}

// --- Bloque vacío ---

function EmptyBlock({ slot, onAdd }) {
  const accent = ACCENT_COLORS[slot.timeOfDay];

  return (
    <TouchableOpacity
      style={styles.emptyContainer}
      onPress={() => onAdd(slot.timeOfDay)}
      activeOpacity={0.5}
    >
      <LinearGradient
        colors={[accent[0] + '40', accent[1] + '10']}
        style={styles.accentBar}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      <View style={styles.emptyLeft}>
        <Text style={styles.emptyLabel}>
          {slot.emoji}  {slot.label.toUpperCase()}
        </Text>
        <Text style={styles.emptyPrompt}>
          ¿Qué definió tu {slot.label.toLowerCase()}?
        </Text>
      </View>

      <View style={styles.addButton}>
        <Text style={styles.addButtonIcon}>+</Text>
      </View>
    </TouchableOpacity>
  );
}

// --- Componente principal ---

export function TrackBlock({ slot, onAdd, onPlay }) {
  if (slot.track) {
    return <FilledBlock slot={slot} onPlay={onPlay} />;
  }
  return <EmptyBlock slot={slot} onAdd={onAdd} />;
}

// --- Estilos iOS ---

const styles = StyleSheet.create({
  // Filled
  filledContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',   // iOS systemGray6 dark
    borderRadius: 16,
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
    width: 58,
    height: 58,
    borderRadius: 10,            // iOS typical album art corners
    backgroundColor: '#2C2C2E',
    flexShrink: 0,
  },
  trackInfo: {
    flex: 1,
    minWidth: 0,
  },
  timeLabel: {
    fontSize: 10,
    color: '#636366',            // iOS secondaryLabel dark
    letterSpacing: 1.2,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackTitle: {
    fontSize: 15,
    fontWeight: '600',           // SF Pro semibold
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  trackArtist: {
    fontSize: 13,
    fontWeight: '400',
    color: '#8E8E93',            // iOS secondaryLabel
    marginTop: 1,
  },
  trackNote: {
    fontSize: 12,
    color: '#636366',
    marginTop: 6,
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
    backgroundColor: '#3A3A3C',
  },
  segmentText: {
    fontSize: 10,
    color: '#48484A',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.3,
  },

  // Play button — estilo iOS circular
  playButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playTriangle: {
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#EBEBF5',  // iOS label dark
    marginLeft: 2,
  },

  // Empty
  emptyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    borderStyle: 'dashed',
    paddingVertical: 20,
    paddingRight: 14,
    paddingLeft: 20,
    overflow: 'hidden',
  },
  emptyLeft: {
    flex: 1,
    gap: 4,
  },
  emptyLabel: {
    fontSize: 10,
    color: '#3A3A3C',
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  emptyPrompt: {
    fontSize: 13,
    color: '#3A3A3C',
    fontStyle: 'italic',
  },
  addButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2C2C2E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonIcon: {
    fontSize: 20,
    color: '#636366',
    lineHeight: 22,
    marginTop: -1,
  },
});