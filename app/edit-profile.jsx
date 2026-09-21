import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';
import { useSpotifyAuth, friendlySpotifyError } from '@/hooks/useSpotifyAuth';
import Dialog from '@/components/Dialog';

export default function EditProfileScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [dialog, setDialog] = useState({ visible: false, title: '', message: '' });

  function showAlert(title, message) { setDialog({ visible: true, title, message: message ?? '' }); }

  const spotify = useSpotifyAuth();

  useEffect(() => {
    if (spotify.error) showAlert('Error de Spotify', friendlySpotifyError(spotify.error));
  }, [spotify.error]);

  const passwordChecks = [
    { key: 'length', label: 'Al menos 6 caracteres', test: (p) => p.length >= 6 },
    { key: 'upper',  label: 'Una letra mayúscula',   test: (p) => /[A-Z]/.test(p) },
    { key: 'number', label: 'Un número',              test: (p) => /[0-9]/.test(p) },
    { key: 'symbol', label: 'Un signo (!@#$...)',      test: (p) => /[^A-Za-z0-9]/.test(p) },
  ];
  const isNewPasswordSecure = passwordChecks.every(c => c.test(newPassword));

  function friendlyPasswordError(code) {
    switch (code) {
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'La contraseña actual es incorrecta.';
      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera un momento e intenta de nuevo.';
      case 'auth/weak-password':
      case 'auth/password-does-not-meet-requirements':
        return 'La nueva contraseña es muy débil. Debe tener al menos 6 caracteres, una mayúscula, un número y un signo.';
      case 'auth/requires-recent-login':
        return 'Por seguridad, cierra sesión e inicia de nuevo antes de cambiar tu contraseña.';
      case 'auth/network-request-failed':
        return 'Sin conexión a internet. Revisa tu red e intenta de nuevo.';
      default:
        return 'No se pudo actualizar la contraseña. Intenta de nuevo.';
    }
  }

  async function handleChangePassword() {
    if (!currentPassword) return showAlert('Aviso', 'Ingresa tu contraseña actual');
    if (!isNewPasswordSecure) return showAlert('Aviso', 'La nueva contraseña debe cumplir todos los requisitos de seguridad.');
    if (newPassword !== confirmPassword) return showAlert('Aviso', 'Las contraseñas nuevas no coinciden');
    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
      showAlert('Listo', 'Tu contraseña se actualizó correctamente.');
    } catch (e) {
      showAlert('Error', friendlyPasswordError(e.code));
    } finally {
      setChangingPassword(false);
    }
  }

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.data() ?? {};
      setBio(data.bio ?? '');
      setAvatar(data.avatar ?? null);
    }
    load();
  }, []);

  async function pickImage() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permiso necesario', 'Necesitamos acceso a tu galería');
      return;
    }
    setUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.4,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;
      setAvatar(`data:image/jpeg;base64,${result.assets[0].base64}`);
    } catch (e) {
      showAlert('Error procesando imagen', e.message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!displayName.trim()) return showAlert('Aviso', 'El nombre no puede estar vacío');
    setSaving(true);
    try {
      await Promise.all([
        updateProfile(user, { displayName: displayName.trim() }),
        updateDoc(doc(db, 'users', user.uid), {
          displayName: displayName.trim(),
          displayNameLower: displayName.trim().toLowerCase(),
          avatar: avatar ?? null,
          bio: bio.trim(),
        }),
      ]);
      router.back();
    } catch (e) {
      showAlert('Error guardando', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} disabled={uploading} activeOpacity={0.85}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImg} />
              ) : (
                <LinearGradient colors={Colors.gradientPrimary} style={styles.avatarPlaceholder} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.avatarInitial}>{displayName?.[0]?.toUpperCase() ?? '?'}</Text>
                </LinearGradient>
              )}
              <LinearGradient colors={Colors.gradientPrimary} style={[styles.cameraBtn, { borderColor: colors.bg }]}>
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={15} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.changePhotoText}>Cambiar foto de perfil</Text>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>NOMBRE DE USUARIO</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              value={displayName}
              onChangeText={setDisplayName}
              placeholderTextColor={colors.textMuted}
              maxLength={30}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textMuted }]}>DESCRIPCIÓN</Text>
            <TextInput
              style={[styles.input, styles.bioInput, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Cuéntale a tus amigos algo sobre ti..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={150}
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{bio.length}/150</Text>
          </View>

          <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Guardar cambios</Text>}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.securityToggle}
            onPress={() => setShowPasswordSection(s => !s)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, { color: colors.textMuted, marginBottom: 0 }]}>SEGURIDAD</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Cambiar contraseña</Text>
              <Ionicons name={showPasswordSection ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
            </View>
          </TouchableOpacity>

          {showPasswordSection && (
            <View style={styles.passwordSection}>
              {[
                { label: 'Contraseña actual', value: currentPassword, setter: setCurrentPassword, show: showCurrentPassword, setShow: setShowCurrentPassword },
                { label: 'Nueva contraseña',  value: newPassword,     setter: setNewPassword,     show: showNewPassword,     setShow: setShowNewPassword },
              ].map(({ label, value, setter, show, setShow }) => (
                <View key={label} style={styles.field}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
                  <View style={[styles.passwordRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <TextInput
                      style={[styles.passwordInput, { color: colors.textPrimary }]}
                      value={value}
                      onChangeText={setter}
                      secureTextEntry={!show}
                      autoCapitalize="none"
                      placeholderTextColor={colors.textMuted}
                    />
                    <TouchableOpacity onPress={() => setShow(s => !s)} style={styles.eyeBtn} hitSlop={8}>
                      <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}

              {newPassword.length > 0 && (
                <View style={styles.requirementsList}>
                  {passwordChecks.map(({ key, label, test }) => {
                    const met = test(newPassword);
                    return (
                      <View key={key} style={styles.requirementRow}>
                        <Ionicons
                          name={met ? 'checkmark-circle' : 'ellipse-outline'}
                          size={14}
                          color={met ? colors.primary : colors.textMuted}
                        />
                        <Text style={{ fontSize: 12, color: met ? colors.primary : colors.textMuted, fontWeight: met ? '700' : '400' }}>
                          {label}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.textMuted }]}>CONFIRMAR NUEVA CONTRASEÑA</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, color: colors.textPrimary, borderColor: colors.border }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  placeholderTextColor={colors.textMuted}
                />
              </View>

              <TouchableOpacity onPress={handleChangePassword} disabled={changingPassword} activeOpacity={0.85}>
                <LinearGradient colors={Colors.gradientPrimary} style={styles.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {changingPassword
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveBtnText}>Actualizar contraseña</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.spotifySection}>
            <Text style={[styles.label, { color: colors.textMuted }]}>CUENTA DE SPOTIFY</Text>
            {spotify.checking ? (
              <ActivityIndicator color={colors.spotify} style={{ marginTop: 4 }} />
            ) : spotify.connected ? (
              <View style={styles.spotifyConnectedRow}>
                {spotify.profile?.images?.[0]?.url ? (
                  <Image source={{ uri: spotify.profile.images[0].url }} style={styles.spotifyAvatar} />
                ) : (
                  <View style={[styles.spotifyAvatarPlaceholder, { backgroundColor: colors.spotify }]}>
                    <MaterialCommunityIcons name="spotify" size={18} color="#fff" />
                  </View>
                )}
                <Text style={[styles.spotifyConnectedText, { color: colors.textPrimary }]} numberOfLines={1}>
                  Conectado como {spotify.profile?.display_name ?? '...'}
                </Text>
                <TouchableOpacity onPress={spotify.disconnect} hitSlop={8}>
                  <Text style={[styles.spotifyDisconnect, { color: colors.textMuted }]}>Desconectar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                onPress={spotify.connect}
                disabled={spotify.connecting}
                activeOpacity={0.85}
                style={[styles.spotifyConnectBtn, { borderColor: colors.spotify }]}
              >
                {spotify.connecting ? (
                  <ActivityIndicator color={colors.spotify} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="spotify" size={18} color={colors.spotify} />
                    <Text style={[styles.spotifyConnectText, { color: colors.spotify }]}>Conectar con Spotify</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      <Dialog
        visible={dialog.visible}
        title={dialog.title}
        message={dialog.message}
        onClose={() => setDialog(d => ({ ...d, visible: false }))}
        buttons={[{ text: 'Entendido', style: 'primary' }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  scroll: { padding: 24, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', marginBottom: 32, marginTop: 8 },
  avatarImg: { width: 100, height: 100, borderRadius: 50, ...Shadow.md },
  avatarPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', ...Shadow.md },
  avatarInitial: { color: '#fff', fontSize: 40, fontWeight: '700' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, borderRadius: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.bg },
  changePhotoText: { color: Colors.primary, fontSize: 14, marginTop: 10, fontWeight: '500' },
  field: { marginBottom: 20 },
  label: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  input: { backgroundColor: Colors.card, borderRadius: Radius.md, padding: 15, color: Colors.textPrimary, fontSize: 15, borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border, ...Shadow.sm },
  bioInput: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },
  saveBtn: { borderRadius: Radius.pill, padding: 17, alignItems: 'center', marginTop: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  securityToggle: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 32, paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  passwordSection: { marginTop: 16 },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, ...Shadow.sm,
  },
  passwordInput: { flex: 1, padding: 15, fontSize: 15 },
  eyeBtn: { paddingHorizontal: 12 },
  requirementsList: { marginTop: -10, marginBottom: 16, gap: 5 },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  spotifySection: {
    marginTop: 32, paddingTop: 20,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  spotifyConnectBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: Radius.pill, paddingVertical: 14, marginTop: 12,
  },
  spotifyConnectText: { fontSize: 15, fontWeight: '700' },
  spotifyConnectedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  spotifyAvatar: { width: 36, height: 36, borderRadius: 18 },
  spotifyAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  spotifyConnectedText: { flex: 1, fontSize: 14, fontWeight: '600' },
  spotifyDisconnect: { fontSize: 12, fontWeight: '600' },
});
