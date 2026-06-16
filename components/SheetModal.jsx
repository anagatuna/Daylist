import { Modal, View, StyleSheet, Platform, Pressable, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
    <AndroidSheet visible={visible} onClose={onClose} fullHeight={fullHeight}>
      {children}
    </AndroidSheet>
  );
}

function AndroidSheet({ visible, onClose, children, fullHeight }) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[
          styles.sheet,
          fullHeight && styles.sheetFull,
          fullHeight
            ? { paddingTop: 0, paddingBottom: insets.bottom || 16 }
            : { paddingTop: 8, paddingBottom: insets.bottom || 16 },
        ]}>
          {!fullHeight && <View style={styles.handle} />}
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
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: Colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    paddingTop: 8,
  },
  sheetFull: {
    height: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 8,
  },
});
