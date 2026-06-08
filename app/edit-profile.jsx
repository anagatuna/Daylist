import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Image, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} disabled={uploading}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {displayName?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              {uploading
                ? <ActivityIndicator size="small" color="#000" />
                : <Ionicons name="camera" size={16} color="#000" />}
            </View>
          </TouchableOpacity>
          <Text style={styles.changePhotoText}>Cambiar foto</Text>
        </View>

        {/* Nombre */}
        <View style={styles.field}>
          <Text style={styles.label}>Nombre de usuario</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholderTextColor="#555"
            maxLength={30}
          />
        </View>

        {/* Bio */}
        <View style={styles.field}>
          <Text style={styles.label}>Descripción</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="Cuéntale a tus amigos algo sobre ti..."
            placeholderTextColor="#555"
            multiline
            maxLength={150}
          />
          <Text style={styles.charCount}>{bio.length}/150</Text>
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.saveBtnText}>Guardar cambios</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { padding: 24, paddingBottom: 48 },
  avatarSection: { alignItems: 'center', marginBottom: 32, marginTop: 8 },
  avatarImg: { width: 100, height: 100, borderRadius: 50 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#1DB954', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { color: '#000', fontSize: 40, fontWeight: '800' },
  cameraBtn: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: '#1DB954', borderRadius: 14,
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#0a0a0a',
  },
  changePhotoText: { color: '#1DB954', fontSize: 14, marginTop: 10, fontWeight: '500' },
  field: { marginBottom: 20 },
  label: { color: '#888', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 },
  input: {
    backgroundColor: '#141414', borderRadius: 12,
    padding: 14, color: '#fff', fontSize: 15,
    borderWidth: 1, borderColor: '#222',
  },
  bioInput: { minHeight: 100, textAlignVertical: 'top' },
  charCount: { color: '#555', fontSize: 11, textAlign: 'right', marginTop: 4 },
  saveBtn: {
    backgroundColor: '#1DB954', borderRadius: 12,
    padding: 16, alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
