import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, StatusBar, Pressable, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';
import Dialog from '@/components/Dialog';

export default function LoginScreen() {
  const { colors, isDark } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [dialog, setDialog] = useState({ visible: false, message: '' });

  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const slideAnim  = useRef(new Animated.Value(40)).current;
  const logoScale  = useRef(new Animated.Value(0.8)).current;
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
      const { user } = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!user.emailVerified) {
        await sendEmailVerification(user);
        await auth.signOut();
        setShowVerify(true);
        return;
      }
    } catch (e) {
      showError(friendlyAuthError(e.code));
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const trimmed = email.trim();
    if (!trimmed) return showError('Escribe tu correo para recuperar tu contraseña.');
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setResetSent(true);
    } catch (e) {
      if (e.code === 'auth/invalid-email') return showError('El correo no tiene un formato válido.');
      if (e.code === 'auth/user-not-found') return showError('No existe una cuenta con ese correo.');
      showError('Error enviando el correo. Intenta de nuevo.');
    }
  }

  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(155,109,214,0.20)';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Fondo base igual que la app */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />

      {/* Gradiente sutil igual al del perfil */}
      <LinearGradient
        colors={isDark
          ? ['rgba(180,141,224,0.28)', 'rgba(218,143,189,0.10)', 'rgba(0,0,0,0)']
          : ['rgba(155,109,214,0.32)', 'rgba(212,112,154,0.14)', 'rgba(0,0,0,0)']}
        style={[StyleSheet.absoluteFill]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.65 }}
      />

      {/* Orbes */}
      <View style={[styles.orb1, { backgroundColor: colors.primary }]} />
      <View style={[styles.orb2, { backgroundColor: colors.secondary }]} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          {/* Logo */}
          <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <LinearGradient colors={colors.gradientPrimary} style={styles.logoGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.logoIcon}>♪</Text>
            </LinearGradient>
            <Text style={[styles.logoText, { color: colors.textPrimary }]}>daylist</Text>
            <Text style={[styles.logoSub, { color: colors.textMuted }]}>tu diario musical</Text>
          </Animated.View>

          {/* Formulario */}
          <Animated.View style={[styles.form, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={[styles.card, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' }]}>
              <BlurView tint={isDark ? 'dark' : 'light'} intensity={isDark ? 40 : 60} style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]} />
              <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl, backgroundColor: isDark ? 'rgba(30,15,50,0.55)' : 'rgba(255,255,255,0.45)' }]} />

              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(80,50,120,0.8)' }]}>Correo</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: inputBg, color: isDark ? '#fff' : colors.textPrimary, borderColor: inputBorder }]}
                  placeholder="tu@correo.com"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(80,50,120,0.8)' }]}>Contraseña</Text>
                <View style={[styles.passwordRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: isDark ? '#fff' : colors.textPrimary }]}
                    placeholder="••••••••"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn} hitSlop={8}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} />
                  </Pressable>
                </View>
              </View>

              <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}>
                <Text style={[styles.forgotText, { color: isDark ? 'rgba(200,170,240,0.9)' : colors.primary }]}>¿Olvidaste tu contraseña?</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={handleLogin} disabled={loading} activeOpacity={0.85} style={{ marginTop: 4 }}>
                <LinearGradient colors={colors.gradientPrimary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Iniciar sesión</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Link href="/(auth)/register" asChild>
              <TouchableOpacity style={styles.linkBtn}>
                <Text style={[styles.linkText, { color: colors.textMuted }]}>
                  ¿No tienes cuenta?{'  '}
                  <Text style={[styles.linkAccent, { color: colors.primary }]}>Regístrate</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </Animated.View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <Dialog visible={dialog.visible} title="Aviso" message={dialog.message} onClose={() => setDialog({ visible: false, message: '' })} buttons={[{ text: 'Entendido', style: 'primary' }]} />
      <Dialog visible={resetSent} title="Correo enviado" message={`Se envió un enlace para restablecer tu contraseña a ${email.trim()}. Revisa tu bandeja de entrada.`} onClose={() => setResetSent(false)} buttons={[{ text: 'Entendido', style: 'primary' }]} />
      <Dialog visible={showVerify} title="Verifica tu correo" message={`Tu correo aún no ha sido verificado. Se envió un nuevo enlace a ${email.trim()}. Ábrelo y vuelve a iniciar sesión.`} onClose={() => setShowVerify(false)} buttons={[{ text: 'Entendido', style: 'primary' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orb1: { position: 'absolute', width: 340, height: 340, borderRadius: 170, opacity: 0.25, top: -120, right: -100 },
  orb2: { position: 'absolute', width: 280, height: 280, borderRadius: 140, opacity: 0.20, bottom: 60, left: -100 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  logoContainer: { alignItems: 'center', marginBottom: 44 },
  logoGradient: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    ...Shadow.lg,
  },
  logoIcon: { fontSize: 34, color: '#fff' },
  logoText: { fontSize: 42, fontWeight: '800', color: '#fff', letterSpacing: -1.5 },
  logoSub:  { color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 },

  form: { gap: 16 },
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    overflow: 'hidden',
    ...Shadow.lg,
    shadowColor: '#7B4FBE',
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  inputWrapper: { gap: 6 },
  inputLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4 },
  input: {
    borderRadius: Radius.md,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  passwordInput: { flex: 1, padding: 14, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 12 },
  btn: { borderRadius: Radius.pill, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
  forgotBtn: { alignSelf: 'flex-start' },
  forgotText: { fontSize: 13, fontWeight: '600' },
  linkBtn: { alignItems: 'center', padding: 10 },
  linkText: { fontSize: 14 },
  linkAccent: { fontWeight: '700' },
});
