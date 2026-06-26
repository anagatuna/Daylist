import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Radius } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function StreakBadge({ streak, size = 'md', showLabel = true }) {
  const { colors } = useTheme();
  if (!streak || streak <= 0) return null;

  const isSmall = size === 'sm';
  const iconSize = isSmall ? 14 : 20;
  const numSize = isSmall ? 14 : 22;

  return (
    <View style={[s.wrap, isSmall && s.wrapSm]}>
      <LinearGradient
        colors={['#FF9500', '#FF5722']}
        style={[s.badge, isSmall && s.badgeSm]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={{ fontSize: iconSize }}>🔥</Text>
        <Text style={[s.num, { fontSize: numSize }]}>{streak}</Text>
      </LinearGradient>
      {showLabel && !isSmall && (
        <Text style={[s.label, { color: colors.textMuted }]}>
          {streak === 1 ? 'día' : 'días'}
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center' },
  wrapSm: {},
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 2,
  },
  num: { color: '#fff', fontWeight: '800' },
  label: { fontSize: 11, marginTop: 2 },
});
