import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { Colors, Radius, Shadow } from '@/constants/Theme';

export default function EditProfileScreen() {
  const router = useRouter();
  const user = auth.currentUser;

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tu galería');
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
      Alert.alert('Error procesando imagen', e.message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!displayName.trim()) return Alert.alert('El nombre no puede estar vacío');
    setSaving(true);
    try {
      await Promise.all([
        updateProfile(user, { displayName: displayName.trim() }),
        updateDoc(doc(db, 'users', user.uid), {
          displayName: displayName.trim(),
          avatar: avatar ?? null,
          bio: bio.trim(),
        }),
      ]);
      router.back();
    } catch (e) {
      Alert.alert('Error guardando', e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
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
              <LinearGradient colors={Colors.gradientPrimary} style={styles.cameraBtn}>
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={15} color="#fff" />}
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.changePhotoText}>Cambiar foto de perfil</Text>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>NOMBRE DE USUARIO</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholderTextColor={Colors.textMuted}
              maxLength={30}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>DESCRIPCIÓN</Text>
            <TextInput
              style={[styles.input, styles.bioInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Cuéntale a tus amigos algo sobre ti..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={150}
            />
            <Text style={styles.charCount}>{bio.length}/150</Text>
          </View>

          <TouchableOpacity onPress={save} disabled={saving} activeOpacity={0.85}>
            <LinearGradient colors={Colors.gradientPrimary} style={styles.saveBtn} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>Guardar cambios</Text>}
            </LinearGradient>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
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
});
