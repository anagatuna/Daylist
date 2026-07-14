import { useState, useEffect } from 'react';
import { Modal, View, StyleSheet, Platform, Pressable, KeyboardAvoidingView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Colors } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

/**
 * Cross-platform pageSheet modal.
 * On iOS uses the native presentationStyle="pageSheet".
 * On Android replicates the same look with a transparent modal + styled sheet.
 *
 * fullHeight — pass true for modals with scrollable/flex content (lyrics, lyric picker).
 *              Default false sizes the sheet to its content (phrase input, etc).
 */
export default function SheetModal({ visible, onClose, children, fullHeight = false }) {
  const { colors } = useTheme();

  if (Platform.OS === 'ios') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: colors.glass.overlayStrong }}>
          <BlurView tint={colors.glass.tint} intensity={colors.glass.intensity} experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
          {children}
        </View>
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // Guards against the Android quirk where the tail of the same touch that
  // opens the modal lands on the backdrop of the newly-mounted window,
  // instantly closing it. The backdrop only becomes tappable once the
  // native modal has actually finished presenting.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!visible) setReady(false);
  }, [visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onShow={() => setReady(true)}
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => ready && onClose()} />
        <KeyboardAvoidingView behavior="padding">
          <View style={[
            styles.sheet,
            { borderColor: colors.glass.border, borderWidth: 1, borderBottomWidth: 0 },
            fullHeight && styles.sheetFull,
            fullHeight
              ? { paddingTop: 0, paddingBottom: insets.bottom || 16 }
              : { paddingTop: 8, paddingBottom: insets.bottom || 16 },
          ]}>
            <BlurView tint={colors.glass.tint} intensity={colors.glass.intensity} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, styles.sheetBg]} />
            <View style={[StyleSheet.absoluteFill, styles.sheetBg, { backgroundColor: colors.glass.overlayStrong }]} />
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '92%',
    paddingTop: 8,
  },
  sheetBg: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetFull: {
    height: '92%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(60,60,67,0.2)',
    alignSelf: 'center',
    marginBottom: 8,
  },
});
