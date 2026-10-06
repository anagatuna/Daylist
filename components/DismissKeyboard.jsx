import { Keyboard, Platform, TouchableWithoutFeedback } from 'react-native';

// Cierra el teclado al tocar fuera de un input. En web el navegador ya lo hace
// solo, y envolver un TextInput en un Touchable le roba el foco: no se puede escribir.
export default function DismissKeyboard({ children }) {
  if (Platform.OS === 'web') return children;
  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      {children}
    </TouchableWithoutFeedback>
  );
}
