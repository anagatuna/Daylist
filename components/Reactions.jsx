import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { notifyReaction } from '@/lib/notifications';

const EMOJIS = ['🔥', '💜', '😭', '🎵', '✨', '💀'];

export default function Reactions({ postId, reactions = {}, postOwnerUid }) {
  const { user } = useAuth();
  const [localReactions, setLocalReactions] = useState(reactions);
  const [showPicker, setShowPicker] = useState(false);

  // Sincronizar cuando el prop cambia (al remontar el componente)
  useEffect(() => {
    setLocalReactions(reactions);
  }, [JSON.stringify(reactions)]);

  const myEmoji = Object.entries(localReactions).find(
    ([, users]) => users?.includes(user?.uid)
  )?.[0] ?? null;

  async function react(emoji) {
    if (!user) return;
    setShowPicker(false);

    const postRef = doc(db, 'posts', postId);
    const snap = await getDoc(postRef);
    const current = snap.data()?.reactions ?? {};

    const updated = {};
    for (const [e, users] of Object.entries(current)) {
      updated[e] = (users ?? []).filter(u => u !== user.uid);
    }

    const isNewReaction = emoji !== myEmoji;
    if (isNewReaction) {
      updated[emoji] = [...(updated[emoji] ?? []), user.uid];
    }

    for (const e of Object.keys(updated)) {
      if (updated[e].length === 0) delete updated[e];
    }

    setLocalReactions(updated);
    await updateDoc(postRef, { reactions: updated });

    // Notificar al dueño del post (solo si es reacción nueva y no es uno mismo)
    if (isNewReaction && postOwnerUid && postOwnerUid !== user.uid) {
      notifyReaction(postOwnerUid, user.displayName, emoji).catch(() => {});
    }
  }

  const summary = Object.entries(localReactions)
    .filter(([, users]) => users?.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <View style={styles.container}>
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

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.addBtnText}>{myEmoji ? '😊' : '+'}</Text>
        </TouchableOpacity>
      </View>

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
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.15)',
  },
  pillActive: { backgroundColor: 'rgba(192,132,252,0.15)', borderColor: 'rgba(192,132,252,0.5)' },
  pillEmoji: { fontSize: 14 },
  pillCount: { color: '#9B8EC4', fontSize: 12, fontWeight: '600' },
  pillCountActive: { color: '#C084FC' },
  addBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20,
    width: 30, height: 30, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(192,132,252,0.15)',
  },
  addBtnText: { color: '#9B8EC4', fontSize: 16, lineHeight: 20 },
  backdrop: { flex: 1, backgroundColor: 'rgba(13,10,26,0.8)', justifyContent: 'center', alignItems: 'center' },
  picker: { flexDirection: 'row', gap: 8, backgroundColor: '#1E1635', borderRadius: 24, padding: 14, borderWidth: 1, borderColor: 'rgba(192,132,252,0.2)' },
  emojiBtn: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' },
  emojiBtnActive: { backgroundColor: 'rgba(192,132,252,0.2)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.5)' },
  emojiText: { fontSize: 22 },
});
