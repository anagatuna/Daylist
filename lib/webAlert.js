import { Alert, Platform } from 'react-native';

// En react-native-web Alert.alert no hace nada, así que los avisos y errores se
// perderían en silencio. Todos los usos de la app son título + mensaje, sin
// botones personalizados, y caben en el alert del navegador.
if (Platform.OS === 'web') {
  Alert.alert = (title, message) => {
    if (typeof window !== 'undefined') window.alert([title, message].filter(Boolean).join('\n\n'));
  };
}
