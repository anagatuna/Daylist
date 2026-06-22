import { useState } from 'react';
import { Modal, View, Image, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

export default function AvatarPreview({ uri, size = 72, initial, style }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(false);

  const avatarStyle = [{ width: size, height: size, borderRadius: size / 2 }, style];

  return (
    <>
      <TouchableOpacity onPress={() => uri && setVisible(true)} activeOpacity={uri ? 0.8 : 1}>
        {uri ? (
          <Image source={{ uri }} style={avatarStyle} />
        ) : (
          <LinearGradient colors={colors.gradientPrimary} style={avatarStyle} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <View style={styles.initialWrapper}>
              <Ionicons name="person" size={size * 0.4} color="#fff" />
            </View>
          </LinearGradient>
        )}
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
        statusBarTranslucent>
        <TouchableWithoutFeedback onPress={() => setVisible(false)}>
          <View style={styles.backdrop}>
            <TouchableWithoutFeedback>
              <Image source={{ uri }} style={styles.fullImage} resizeMode="contain" />
            </TouchableWithoutFeedback>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  initialWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '90%',
    height: '70%',
    borderRadius: 16,
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 48 : 56,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
