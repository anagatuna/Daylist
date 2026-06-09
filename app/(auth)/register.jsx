import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, StatusBar,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import Dialog from '@/components/Dialog';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState({ visible: false, message: '' });

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  function showError(msg) { setDialog({ visible: true, message: msg }); }

  function friendlyAuthError(code) {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Ya existe una cuenta registrada con ese correo.';
      case 'auth/invalid-email':
        return 'El correo no tiene un formato válido.';
      case 'auth/weak-password':
        return 'La contraseña es muy débil. Usa al menos 6 caracteres.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
      case 'auth/network-request-failed':
        return 'Sin conexión a internet. Revisa tu red e intenta de nuevo.';
      default:
        return 'Ocurrió un error inesperado. Intenta de nuevo.';
    }
  }

  async function handleRegister() {
    if (!name || !email || !password) return showError('Completa todos los campos');
    if (password.length < 6) return showError('La contraseña debe tener al menos 6 caracteres');
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(user, { displayName: name.trim() });
      await setDoc(doc(db, 'users', user.uid), {
        displayName: name.trim(),
        email: email.trim(),
        avatar: null,
        bio: '',
        createdAt: serverTimestamp(),
        friends: [],
        friendRequests: [],
      });
    } catch (e) {
      showError(friendlyAuthError(e.code));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.header}>
            <Text style={styles.title}>Crea tu cuenta</Text>
            <Text style={styles.subtitle}>Únete y comparte tu soundtrack diario</Text>
          </View>

          <View style={styles.card}>
            {[
              { label: 'Nombre de usuario', value: name,     setter: setName,     placeholder: 'Tu nombre',       secure: false },
              { label: 'Correo',            value: email,    setter: setEmail,    placeholder: 'tu@correo.com',   secure: false, keyboard: 'email-address' },
              { label: 'Contraseña',        value: password, setter: setPassword, placeholder: '••••••••',        secure: true },
            ].map(({ label, value, setter, placeholder, secure, keyboard }) => (
              <View key={label} style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>{label}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={placeholder}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  keyboardType={keyboard ?? 'default'}
                  secureTextEntry={secure}
                  value={value}
                  onChangeText={setter}
                />
              </View>
            ))}

            <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85} style={{ marginTop: 4 }}>
              <LinearGradient colors={Colors.gradientPrimary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Crear cuenta</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.linkBtn}>
              <Text style={styles.linkText}>
                ¿Ya tienes cuenta?{'  '}
                <Text style={styles.linkAccent}>Inicia sesión</Text>
              </Text>
            </TouchableOpacity>
          </Link>
        </Animated.View>
      </KeyboardAvoidingView>

      <Dialog
        visible={dialog.visible}
        title="Aviso"
        message={dialog.message}
        onClose={() => setDialog({ visible: false, message: '' })}
        buttons={[{ text: 'Entendido', style: 'primary' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  orb1: {
    position: 'absolute', width: 280, height: 280, borderRadius: 140,
    backgroundColor: Colors.secondary, opacity: 0.07, top: -60, left: -80,
  },
  orb2: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: Colors.primary, opacity: 0.06, bottom: 80, right: -60,
  },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },

  header: { marginBottom: 28 },
  title:    { fontSize: 32, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  subtitle: { color: Colors.textMuted, fontSize: 14, marginTop: 6 },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 24,
    gap: 16,
    ...Shadow.lg,
  },
  inputWrapper: { gap: 6 },
  inputLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  input: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  btn: { borderRadius: Radius.pill, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },


  linkBtn:    { alignItems: 'center', padding: 10, marginTop: 8 },
  linkText:   { color: Colors.textMuted, fontSize: 14 },
  linkAccent: { color: Colors.primary, fontWeight: '700' },
});
