import { Modal, View, StyleSheet, Platform, Pressable, KeyboardAvoidingView } from 'react-native';
import { Colors } from '@/constants/Theme';

/**
 * Cross-platform pageSheet modal.
 * On iOS uses the native presentationStyle="pageSheet".
 * On Android replicates the same look with a transparent modal + styled sheet.
 *
 * fullHeight — pass true for modals with scrollable/flex content (lyrics, lyric picker).
 *              Default false sizes the sheet to its content (phrase input, etc).
 */
export default function SheetModal({ visible, onClose, children, fullHeight = false }) {
  if (Platform.OS === 'ios') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}>
        {children}
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior="height">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.sheet, fullHeight && styles.sheetFull]}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    maxHeight: '92%',
    overflow: 'hidden',
    paddingTop: 8,
  },
  sheetFull: {
    height: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60,60,67,0.18)',
    alignSelf: 'center',
    marginBottom: 6,
  },
});
