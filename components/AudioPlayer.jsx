import { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

export default function AudioPlayer({ previewUrl, startSec = 0, endSec = null }) {
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
        <Ionicons name="musical-note-outline" size={14} color="#444" />
        <Text style={styles.noPreviewText}>Preview no disponible</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle} style={styles.btn}>
        <Ionicons
          name={playing ? 'pause-circle' : 'play-circle'}
          size={36}
          color="#1DB954"
        />
      </TouchableOpacity>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${progress * 100}%` }]} />
      </View>
      <Text style={styles.time}>
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
  barBg: { flex: 1, height: 3, backgroundColor: 'rgba(192,132,252,0.15)', borderRadius: 2 },
  barFill: { height: 3, backgroundColor: '#C084FC', borderRadius: 2 },
  time: { color: '#9B8EC4', fontSize: 11, minWidth: 40 },
  noPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  noPreviewText: { color: '#4A3F6B', fontSize: 11, fontStyle: 'italic' },
});
