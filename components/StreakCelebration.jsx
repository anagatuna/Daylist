import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Radius } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function StreakCelebration({ visible, streak, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const fireScale = useRef(new Animated.Value(0.3)).current;
  const numSlide = useRef(new Animated.Value(40)).current;
  const numOpacity = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.parallel([
          Animated.spring(fireScale, { toValue: 1, friction: 4, tension: 50, useNativeDriver: true }),
          Animated.timing(numOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.spring(numSlide, { toValue: 0, friction: 6, tension: 60, useNativeDriver: true }),
        ]),
        Animated.timing(contentOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
          ])
        ).start();
      });
    } else {
      opacity.setValue(0);
      fireScale.setValue(0.3);
      numSlide.setValue(40);
      numOpacity.setValue(0);
      contentOpacity.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [visible]);

  if (!visible) return null;

  const getMessage = () => {
    if (streak >= 30) return '¡Leyenda musical!';
    if (streak >= 14) return '¡Imparable!';
    if (streak >= 7) return '¡Una semana seguida!';
    if (streak >= 3) return '¡Vas con todo!';
    if (streak === 1) return '¡Empezaste tu racha!';
    return '¡Sigue así!';
  };

  return (
    <Animated.View style={[s.screen, { backgroundColor: colors.bg, opacity }]}>
      <View style={[s.content, { paddingTop: insets.top + 60 }]}>
        <Animated.Text style={[s.fireEmoji, { transform: [{ scale: Animated.multiply(fireScale, pulseAnim) }] }]}>
          🔥
        </Animated.Text>

        <Animated.View style={{ alignItems: 'center', opacity: numOpacity, transform: [{ translateY: numSlide }] }}>
          <Text style={[s.streakNum, { color: colors.textPrimary }]}>{streak}</Text>
          <Text style={[s.streakLabel, { color: colors.textMuted }]}>
            {streak === 1 ? 'día de racha' : 'días de racha'}
          </Text>
        </Animated.View>

        <Animated.View style={{ alignItems: 'center', opacity: contentOpacity, width: '100%' }}>
          <Text style={[s.message, { color: colors.textSecondary }]}>{getMessage()}</Text>

          <View style={s.progressRow}>
            {(() => {
              const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
              const todayIdx = (new Date().getDay() + 6) % 7;
              return dayLabels.map((label, i) => {
                const daysAgo = todayIdx - i;
                const achieved = daysAgo >= 0 && daysAgo < streak;
                const isToday = i === todayIdx;
                return (
                  <View key={i} style={s.dotCol}>
                    <Text style={[s.dayLabel, { color: isToday ? '#FF9500' : colors.textMuted }]}>{label}</Text>
                    <View style={[s.dot, achieved ? s.dotActive : { backgroundColor: colors.border }, isToday && achieved && s.dotToday]}>
                      {achieved && <Text style={s.dotCheck}>✓</Text>}
                    </View>
                  </View>
                );
              });
            })()}
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[s.footer, { paddingBottom: insets.bottom + 20, opacity: contentOpacity }]}>
        <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={{ width: '100%' }}>
          <LinearGradient colors={['#FF9500', '#FF5722']} style={s.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
            <Text style={s.btnText}>¡Genial!</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 32,
    gap: 16,
  },
  fireEmoji: { fontSize: 80, marginBottom: 4 },
  streakNum: { fontSize: 72, fontWeight: '900', letterSpacing: -3 },
  streakLabel: { fontSize: 18, fontWeight: '600', marginTop: -6 },
  message: { fontSize: 22, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  progressRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 48,
  },
  dotCol: {
    alignItems: 'center',
    gap: 6,
  },
  dayLabel: { fontSize: 12, fontWeight: '700' },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: { backgroundColor: '#FF9500' },
  dotToday: { borderWidth: 2, borderColor: '#FF5722' },
  dotCheck: { color: '#fff', fontSize: 15, fontWeight: '700' },
  footer: {
    paddingHorizontal: 32,
  },
  btn: {
    borderRadius: Radius.pill,
    paddingVertical: 17,
    alignItems: 'center',
    width: '100%',
  },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 18 },
});
