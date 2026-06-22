import { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function AudioPlayer({ previewUrl, startSec = 0, endSec = null }) {
  const { colors } = useTheme();
  const soundRef = useRef(null);
  const stoppingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(startSec);
  const [duration, setDuration] = useState(30);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [previewUrl]);

  async function toggle() {
    if (!previewUrl) return;

    if (!soundRef.current) {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUrl },
        { shouldPlay: true, positionMillis: startSec * 1000 },
        onStatus
      );
      soundRef.current = sound;
      setPlaying(true);
      return;
    }

    const status = await soundRef.current.getStatusAsync();
    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
    } else {
      await soundRef.current.playAsync();
      setPlaying(true);
    }
  }

  function onStatus(status) {
    if (!status.isLoaded) return;
    const pos = status.positionMillis / 1000;
    const dur = status.durationMillis / 1000;
    setPosition(pos);
    if (dur) setDuration(dur);

    const limit = endSec ?? dur;
    if (limit && pos >= limit && !stoppingRef.current) {
      stoppingRef.current = true;
      setPlaying(false);
      setPosition(startSec);
      soundRef.current?.pauseAsync()
        .then(() => soundRef.current?.setPositionAsync(startSec * 1000))
        .catch(() => {})
        .finally(() => { stoppingRef.current = false; });
    }
  }

  const effectiveEnd = endSec ?? duration;
  const segmentDuration = Math.max(1, effectiveEnd - startSec);
  const elapsed = Math.max(0, position - startSec);
  const progress = Math.min(elapsed / segmentDuration, 1);

  if (!previewUrl) {
    return (
      <View style={styles.noPreviewRow}>
        <Ionicons name="musical-note-outline" size={14} color={colors.textMuted} />
        <Text style={[styles.noPreviewText, { color: colors.textMuted }]}>Preview no disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} style={styles.btn}>
        <Ionicons
          name={playing ? 'pause-circle' : 'play-circle'}
          size={36}
          color={colors.primary}
        />
      </TouchableOpacity>
      <View style={[styles.barBg, { backgroundColor: colors.border }]}>
        <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
      </View>
      <Text style={[styles.time, { color: colors.textMuted }]}>
        {formatSec(elapsed)}/{formatSec(segmentDuration)}
      </Text>
    </View>
  );
}

function formatSec(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  btn: { padding: 2 },
  barBg: { flex: 1, height: 2, backgroundColor: Colors.border, borderRadius: 1 },
  barFill: { height: 2, backgroundColor: Colors.primary, borderRadius: 1 },
  time: { color: Colors.textMuted, fontSize: 10, minWidth: 36 },
  noPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  noPreviewText: { color: Colors.textMuted, fontSize: 11 },
});
