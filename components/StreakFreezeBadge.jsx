import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Radius } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';
import { MAX_STREAK_FREEZES } from '@/lib/streak';

export default function StreakFreezeBadge({ count, size = 'md' }) {
  const { colors } = useTheme();
  if (!count) return null;

  const isSmall = size === 'sm';

  return (
    <View
      style={[s.wrap, isSmall && s.wrapSm, { backgroundColor: colors.freezeBg }]}
      accessibilityLabel={`${count} de ${MAX_STREAK_FREEZES} protectores de racha`}
    >
      <Ionicons name="snow" size={isSmall ? 12 : 15} color={colors.freeze} />
      <Text style={[s.num, isSmall && s.numSm, { color: colors.freeze }]}>{count}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  wrapSm: { paddingHorizontal: 6, paddingVertical: 3 },
  num: { fontWeight: '800', fontSize: 13 },
  numSm: { fontSize: 11 },
});
