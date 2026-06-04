// app/(tabs)/index.jsx

import { TrackBlock } from '@/components/TrackBlock';
import { TODAY_ENTRY } from '@/constants/mockData';
import React, { useCallback } from 'react';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function formatDate(isoDate) {
  // noon local para evitar offset de timezone
  const date = new Date(isoDate + 'T12:00:00');
  const dayName = date.toLocaleDateString('es-MX', { weekday: 'long' });
  const dayNum  = date.getDate();
  const month   = date.toLocaleDateString('es-MX', { month: 'long' });
  return {
    dayName: dayName.charAt(0).toUpperCase() + dayName.slice(1),
    dayNum,
    month,
  };
}

function countFilled(slots) {
  return slots.filter(s => s.track !== null).length;
}

export default function HomeScreen() {
  const { dayName, dayNum, month } = formatDate(TODAY_ENTRY.date);
  const filled    = countFilled(TODAY_ENTRY.slots);
  const remaining = 3 - filled;

  const handleAdd = useCallback((timeOfDay) => {
    console.log('[Daylist] Agregar canción →', timeOfDay);
    // TODO: abrir modal de búsqueda
  }, []);

  const handlePlay = useCallback((slot) => {
    console.log('[Daylist] Play →', slot.track.title, '·', slot.track.artist);
    console.log('[Daylist] URL →', slot.track.previewUrl);
    // TODO: expo-av
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Encabezado ── */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Tu soundtrack</Text>

          <View style={styles.titleRow}>
            <Text style={styles.title}>{dayName}</Text>
          </View>

          <Text style={styles.subtitle}>
            {dayNum} de {month}
          </Text>

          {/* Chip de estado */}
          <View style={styles.statusChip}>
            <View style={[
              styles.statusDot,
              { backgroundColor: remaining === 0 ? '#30D158' : '#636366' }
            ]} />
            <Text style={styles.statusText}>
              {remaining === 0
                ? 'Día completo'
                : `${remaining} momento${remaining !== 1 ? 's' : ''} por registrar`}
            </Text>
          </View>
        </View>

        {/* ── Separador iOS ── */}
        <View style={styles.separator} />

        {/* ── Bloques del día ── */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MOMENTOS DEL DÍA</Text>
          <View style={styles.blocksGroup}>
            {TODAY_ENTRY.slots.map((slot, index) => (
              <React.Fragment key={slot.timeOfDay}>
                <TrackBlock
                  slot={slot}
                  onAdd={handleAdd}
                  onPlay={handlePlay}
                />
                {/* Separador entre bloques, no después del último */}
                {index < TODAY_ENTRY.slots.length - 1 && (
                  <View style={styles.inlineSeparator} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* ── Footer hint ── */}
        {filled > 0 && (
          <Text style={styles.footerHint}>
            Mantén presionado un bloque para editar
          </Text>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000000',   // iOS true black (OLED)
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 48,
  },

  // Encabezado
  header: {
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '500',
    color: '#636366',              // iOS secondaryLabel dark
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  title: {
    fontSize: 34,                  // iOS Large Title
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: '#8E8E93',              // iOS secondaryLabel
    marginTop: 2,
    marginBottom: 14,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E8E93',
  },

  // Separador estilo iOS (hairline)
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#38383A',
    marginBottom: 24,
  },

  // Sección
  section: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636366',
    letterSpacing: 1,
    marginBottom: 12,
    paddingLeft: 4,
  },
  blocksGroup: {
    gap: 0,                        // los separadores inline manejan el espacio
  },
  inlineSeparator: {
    height: 10,
  },

  // Footer
  footerHint: {
    fontSize: 12,
    color: '#3A3A3C',
    textAlign: 'center',
    marginTop: 32,
    letterSpacing: 0.2,
  },
});