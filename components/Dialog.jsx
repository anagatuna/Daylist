import { Modal, View, Text, TouchableOpacity, StyleSheet, Pressable } from 'react-native';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function Dialog({ visible, title, message, buttons = [], onClose }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          {message ? <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text> : null}

          <View style={[styles.btnRow, { borderTopColor: colors.border }]}>
            {buttons.map((btn, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  styles.btn,
                  i < buttons.length - 1 && [styles.btnBorder, { borderRightColor: colors.border }],
                  btn.style === 'destructive' && styles.btnDestructive,
                  btn.style === 'primary' && styles.btnPrimary,
                ]}
                onPress={() => { btn.onPress?.(); onClose?.(); }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.btnText,
                  btn.style === 'cancel' && [styles.btnTextCancel, { color: colors.textMuted }],
                  btn.style === 'destructive' && styles.btnTextDestructive,
                  btn.style === 'primary' && styles.btnTextPrimary,
                ]}>
                  {btn.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(28,28,30,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    width: '100%',
    overflow: 'hidden',
    ...Shadow.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 6,
  },
  message: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
    paddingBottom: 20,
    lineHeight: 20,
  },
  btnRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBorder: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: Colors.border,
  },
  btnDestructive: {},
  btnPrimary: {},
  btnText:            { fontSize: 15, fontWeight: '500', color: Colors.primary },
  btnTextCancel:      { color: Colors.textMuted, fontWeight: '400' },
  btnTextDestructive: { color: '#FF3B30', fontWeight: '600' },
  btnTextPrimary:     { color: Colors.primary, fontWeight: '700' },
});
