import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, StatusBar,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';
import Dialog from '@/components/Dialog';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState({ visible: false, message: '' });

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(32)).current;
  const logoScale  = useRef(new Animated.Value(0.85)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale,   { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 8, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  function showError(msg) { setDialog({ visible: true, message: msg }); }

  function friendlyAuthError(code) {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'El correo o la contraseña son incorrectos.';
      case 'auth/invalid-email':
        return 'El correo no tiene un formato válido.';
      case 'auth/user-disabled':
        return 'Esta cuenta ha sido desactivada.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos fallidos. Espera un momento e intenta de nuevo.';
      case 'auth/network-request-failed':
        return 'Sin conexión a internet. Revisa tu red e intenta de nuevo.';
      default:
        return 'Ocurrió un error inesperado. Intenta de nuevo.';
    }
  }

  async function handleLogin() {
    if (!email || !password) return showError('Completa todos los campos');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      const msg = friendlyAuthError(e.code);
      showError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Orbes de fondo — muy sutiles */}
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Logo */}
        <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
          <LinearGradient colors={Colors.gradientPrimary} style={styles.logoGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={styles.logoIcon}>♪</Text>
          </LinearGradient>
          <Text style={[styles.logoText, { color: colors.textPrimary }]}>daylist</Text>
          <Text style={[styles.logoSub, { color: colors.textMuted }]}>tu diario musical</Text>
        </Animated.View>

        {/* Formulario */}
        <Animated.View style={[styles.form, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Correo</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="tu@correo.com"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Contraseña</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={{ marginTop: 4 }}>
              <LinearGradient colors={Colors.gradientPrimary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Iniciar sesión</Text>}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <Link href="/(auth)/register" asChild>
            <TouchableOpacity style={styles.linkBtn}>
              <Text style={[styles.linkText, { color: colors.textMuted }]}>
                ¿No tienes cuenta?{'  '}
                <Text style={styles.linkAccent}>Regístrate</Text>
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
    position: 'absolute', width: 320, height: 320, borderRadius: 160,
    backgroundColor: Colors.primary, opacity: 0.07, top: -100, right: -100,
  },
  orb2: {
    position: 'absolute', width: 260, height: 260, borderRadius: 130,
    backgroundColor: Colors.secondary, opacity: 0.06, bottom: 80, left: -80,
  },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },

  logoContainer: { alignItems: 'center', marginBottom: 40 },
  logoGradient: {
    width: 68, height: 68, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    ...Shadow.md,
  },
  logoIcon: { fontSize: 32, color: '#fff' },
  logoText: { fontSize: 40, fontWeight: '700', color: Colors.textPrimary, letterSpacing: -1.5 },
  logoSub:  { color: Colors.textMuted, fontSize: 14, marginTop: 4 },

  form: { gap: 16 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 24,
    gap: 16,
    ...Shadow.lg,
  },
  inputWrapper: { gap: 6 },
  inputLabel:   { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  input: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.md,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  btn: {
    borderRadius: Radius.pill,
    padding: 16,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },

  linkBtn:    { alignItems: 'center', padding: 10 },
  linkText:   { color: Colors.textMuted, fontSize: 14 },
  linkAccent: { color: Colors.primary, fontWeight: '700' },
});
