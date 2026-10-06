import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/contexts/ThemeContext';

export default function SpotifyAuthCallback() {
  const router = useRouter();
  const { colors } = useTheme();

  useEffect(() => {
    // En web Spotify regresa a esta ruta dentro de la ventana emergente del
    // login: se le pasa el resultado a la ventana que la abrió, que la cierra.
    try {
      if (WebBrowser.maybeCompleteAuthSession().type === 'success') return;
    } catch {
      // sin referencia a la ventana original: se sigue como navegación normal
    }
    router.replace('/edit-profile');
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
