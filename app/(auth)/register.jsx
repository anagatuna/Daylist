import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Animated, StatusBar, Pressable, Keyboard, TouchableWithoutFeedback,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Ionicons } from '@expo/vector-icons';
import { Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';
import Dialog from '@/components/Dialog';

export default function RegisterScreen() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [dialog, setDialog] = useState({ visible: false, message: '' });

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
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
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail || !password) return showError('Completa todos los campos');
    if (trimmedName.length < 3) return showError('El nombre debe tener al menos 3 caracteres.');
    if (trimmedName.length > 20) return showError('El nombre no puede tener más de 20 caracteres.');
    if (!/^[a-zA-Z0-9_.]+$/.test(trimmedName)) return showError('Solo letras, números, puntos y guiones bajos.');
    if (password.length < 6) return showError('La contraseña debe tener al menos 6 caracteres.');
    setLoading(true);
    try {
      const { user } = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
      await updateProfile(user, { displayName: trimmedName });
      await setDoc(doc(db, 'users', user.uid), {
        displayName: trimmedName, email: trimmedEmail,
        avatar: null, bio: '', createdAt: serverTimestamp(),
        friends: [], friendRequests: [],
      });
      await sendEmailVerification(user);
      await auth.signOut();
      setVerificationSent(true);
    } catch (e) {
      showError(friendlyAuthError(e.code));
    } finally {
      setLoading(false);
    }
  }

  const inputBg = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)';
  const inputBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(155,109,214,0.20)';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]} />
      <LinearGradient
        colors={isDark
          ? ['rgba(180,141,224,0.28)', 'rgba(218,143,189,0.10)', 'rgba(0,0,0,0)']
          : ['rgba(155,109,214,0.32)', 'rgba(212,112,154,0.14)', 'rgba(0,0,0,0)']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 0.65 }}
      />

      <View style={[styles.orb1, { backgroundColor: colors.secondary }]} />
      <View style={[styles.orb2, { backgroundColor: colors.primary }]} />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView style={styles.inner} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

          <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <LinearGradient colors={colors.gradientPrimary} style={styles.logoGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <Text style={styles.logoIcon}>♪</Text>
            </LinearGradient>
          </Animated.View>

          <Animated.View style={[{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Crea tu cuenta</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Únete y comparte tu soundtrack diario</Text>
            </View>

            <View style={[styles.card, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.6)' }]}>
              <BlurView tint={isDark ? 'dark' : 'light'} intensity={isDark ? 40 : 60} experimentalBlurMethod="dimezisBlurView" style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]} />
              <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl, backgroundColor: isDark ? 'rgba(30,15,50,0.55)' : 'rgba(255,255,255,0.45)' }]} />

              {[
                { label: 'Nombre de usuario', value: name,  setter: setName,  placeholder: 'tunombre' },
                { label: 'Correo',            value: email, setter: setEmail, placeholder: 'tu@correo.com', keyboard: 'email-address' },
              ].map(({ label, value, setter, placeholder, keyboard }) => (
                <View key={label} style={styles.inputWrapper}>
                  <Text style={[styles.inputLabel, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(80,50,120,0.8)' }]}>{label}</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: inputBg, color: isDark ? '#fff' : colors.textPrimary, borderColor: inputBorder }]}
                    placeholder={placeholder}
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'}
                    autoCapitalize="none"
                    keyboardType={keyboard ?? 'default'}
                    value={value}
                    onChangeText={setter}
                  />
                </View>
              ))}

              <View style={styles.inputWrapper}>
                <Text style={[styles.inputLabel, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(80,50,120,0.8)' }]}>Contraseña</Text>
                <View style={[styles.passwordRow, { backgroundColor: inputBg, borderColor: inputBorder }]}>
                  <TextInput
                    style={[styles.passwordInput, { color: isDark ? '#fff' : colors.textPrimary }]}
                    placeholder="••••••••"
                    placeholderTextColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <Pressable onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn} hitSlop={8}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'} />
                  </Pressable>
                </View>
              </View>

              <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85} style={{ marginTop: 4 }}>
                <LinearGradient colors={colors.gradientPrimary} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Crear cuenta</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.linkBtn}>
                <Text style={[styles.linkText, { color: colors.textMuted }]}>
                  ¿Ya tienes cuenta?{'  '}
                  <Text style={[styles.linkAccent, { color: colors.primary }]}>Inicia sesión</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </Animated.View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      <Dialog visible={dialog.visible} title="Aviso" message={dialog.message} onClose={() => setDialog({ visible: false, message: '' })} buttons={[{ text: 'Entendido', style: 'primary' }]} />
      <Dialog visible={verificationSent} title="Verifica tu correo" message={`Se envió un enlace de verificación a ${email.trim()}. Ábrelo y luego inicia sesión.`} onClose={() => { setVerificationSent(false); router.replace('/(auth)/login'); }} buttons={[{ text: 'Ir a iniciar sesión', style: 'primary' }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orb1: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.22, top: -80, left: -100 },
  orb2: { position: 'absolute', width: 240, height: 240, borderRadius: 120, opacity: 0.18, bottom: 80, right: -80 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },

  logoContainer: { alignItems: 'center', marginBottom: 20 },
  logoGradient: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
    ...Shadow.lg,
  },
  logoIcon: { fontSize: 30, color: '#fff' },

  headerText: { marginBottom: 20, alignItems: 'center' },
  title:    { fontSize: 30, fontWeight: '800', letterSpacing: -1, textAlign: 'center' },
  subtitle: { fontSize: 14, marginTop: 4, textAlign: 'center' },

  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: 24,
    gap: 14,
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
  linkBtn: { alignItems: 'center', padding: 10, marginTop: 8 },
  linkText: { fontSize: 14 },
  linkAccent: { fontWeight: '700' },
});
