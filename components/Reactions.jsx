import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';

const EMOJIS = ['🔥', '💚', '😭', '🎵', '✨', '💀'];

export default function Reactions({ postId, reactions = {} }) {
  const { user } = useAuth();
  const [localReactions, setLocalReactions] = useState(reactions);
  const [showPicker, setShowPicker] = useState(false);

  // Buscar si el usuario ya reaccionó y con qué emoji
  const myEmoji = Object.entries(localReactions).find(
    ([, users]) => users?.includes(user?.uid)
  )?.[0] ?? null;

  async function react(emoji) {
    if (!user) return;
    setShowPicker(false);

    const postRef = doc(db, 'posts', postId);
    const snap = await getDoc(postRef);
    const current = snap.data()?.reactions ?? {};

    // Quitar reacción anterior si existe
    const updated = {};
    for (const [e, users] of Object.entries(current)) {
      updated[e] = (users ?? []).filter(u => u !== user.uid);
    }

    // Si el emoji nuevo es diferente al anterior, agregar
    if (emoji !== myEmoji) {
      updated[emoji] = [...(updated[emoji] ?? []), user.uid];
    }

    // Limpiar emojis vacíos
    for (const e of Object.keys(updated)) {
      if (updated[e].length === 0) delete updated[e];
    }

    setLocalReactions(updated);
    await updateDoc(postRef, { reactions: updated });
  }

  // Agrupar reacciones con conteo
  const summary = Object.entries(localReactions)
    .filter(([, users]) => users?.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <View style={styles.container}>
      {/* Reacciones existentes */}
      <View style={styles.pills}>
        {summary.map(([emoji, users]) => (
          <TouchableOpacity
            key={emoji}
            style={[styles.pill, myEmoji === emoji && styles.pillActive]}
            onPress={() => react(emoji)}
          >
            <Text style={styles.pillEmoji}>{emoji}</Text>
            <Text style={[styles.pillCount, myEmoji === emoji && styles.pillCountActive]}>
              {users.length}
            </Text>
          </TouchableOpacity>
        ))}

        {/* Botón para abrir picker */}
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.addBtnText}>{myEmoji ? '😊' : '+'}</Text>
        </TouchableOpacity>
      </View>

      {/* Picker de emojis */}
      <Modal visible={showPicker} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setShowPicker(false)}>
          <View style={styles.picker}>
            {EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiBtn, myEmoji === emoji && styles.emojiBtnActive]}
                onPress={() => react(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 10 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#1a1a1a', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  pillActive: { backgroundColor: '#0d2b1a', borderColor: '#1DB954' },
  pillEmoji: { fontSize: 14 },
  pillCount: { color: '#888', fontSize: 12, fontWeight: '600' },
  pillCountActive: { color: '#1DB954' },
  addBtn: {
    backgroundColor: '#1a1a1a', borderRadius: 20,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2a2a2a',
  },
  addBtnText: { color: '#888', fontSize: 16, lineHeight: 20 },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center', alignItems: 'center',
  },
  picker: {
    flexDirection: 'row', gap: 8,
    backgroundColor: '#1a1a1a', borderRadius: 20,
    padding: 12, borderWidth: 1, borderColor: '#2a2a2a',
  },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#222',
  },
  emojiBtnActive: { backgroundColor: '#0d2b1a', borderWidth: 1, borderColor: '#1DB954' },
  emojiText: { fontSize: 22 },
});
