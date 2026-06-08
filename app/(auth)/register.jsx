import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { Link } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Colors, Radius } from '@/constants/Theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 55, friction: 8, useNativeDriver: true }),
    ]).start();
  }, []);

  async function handleRegister() {
    if (!name || !email || !password) return Alert.alert('Completa todos los campos');
    if (password.length < 6) return Alert.alert('La contraseña debe tener al menos 6 caracteres');
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
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={['#160920', '#0D0A1A', '#1A0F2E']} style={styles.container}>
      <View style={styles.orb1} />
      <View style={styles.orb2} />

      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
          <View style={styles.header}>
            <Text style={styles.title}>Crea tu cuenta ✨</Text>
            <Text style={styles.subtitle}>Únete y comparte tu soundtrack diario</Text>
          </View>

          <View style={styles.form}>
            {[
              { label: 'Nombre de usuario', value: name, setter: setName, placeholder: 'Tu nombre', secure: false },
              { label: 'Correo', value: email, setter: setEmail, placeholder: 'tu@correo.com', secure: false, keyboard: 'email-address' },
              { label: 'Contraseña', value: password, setter: setPassword, placeholder: '••••••••', secure: true },
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

            <TouchableOpacity onPress={handleRegister} disabled={loading} activeOpacity={0.85}>
              <LinearGradient colors={['#C084FC', '#F472B6']} style={styles.btn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Crear cuenta</Text>}
              </LinearGradient>
            </TouchableOpacity>

            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.linkBtn}>
                <Text style={styles.linkText}>
                  ¿Ya tienes cuenta?{'  '}
                  <Text style={styles.linkAccent}>Inicia sesión</Text>
                </Text>
              </TouchableOpacity>
            </Link>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  orb1: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: '#F472B6', opacity: 0.07, top: -40, left: -60 },
  orb2: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#C084FC', opacity: 0.07, bottom: 80, right: -40 },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  header: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -1 },
  subtitle: { color: Colors.textSecondary, fontSize: 14, marginTop: 6 },
  form: { gap: 16 },
  inputWrapper: { gap: 6 },
  inputLabel: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.5 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: Radius.md,
    padding: 16,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.2)',
  },
  btn: { borderRadius: Radius.pill, padding: 17, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },
  linkBtn: { alignItems: 'center', padding: 8 },
  linkText: { color: Colors.textSecondary, fontSize: 14 },
  linkAccent: { color: Colors.primary, fontWeight: '700' },
});
