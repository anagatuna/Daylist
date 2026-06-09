import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { notifyReaction } from '@/lib/notifications';
import { Colors, Radius, Shadow } from '@/constants/Theme';

const EMOJIS = ['🔥', '💜', '😭', '🎵', '✨', '💀'];

export default function Reactions({ postId, reactions = {}, postOwnerUid }) {
  const { user } = useAuth();
  const [localReactions, setLocalReactions] = useState(reactions);
  const [showPicker, setShowPicker] = useState(false);
  const [tooltip, setTooltip] = useState(null); // { emoji, names[] }
  const [loadingTooltip, setLoadingTooltip] = useState(false);

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

    if (isNewReaction && postOwnerUid && postOwnerUid !== user.uid) {
      notifyReaction(postOwnerUid, user.displayName, emoji).catch(() => {});
    }
  }

  async function openTooltip(emoji, uids) {
    setLoadingTooltip(true);
    setTooltip({ emoji, names: [] });
    const names = await Promise.all(
      uids.map(uid =>
        getDoc(doc(db, 'users', uid)).then(s => s.data()?.displayName ?? 'Usuario')
      )
    );
    setTooltip({ emoji, names });
    setLoadingTooltip(false);
  }

  const summary = Object.entries(localReactions)
    .filter(([, users]) => users?.length > 0)
    .sort((a, b) => b[1].length - a[1].length);

  return (
    <View style={styles.container}>
      <View style={styles.pills}>
        {summary.map(([emoji, uids]) => (
          <TouchableOpacity
            key={emoji}
            style={[styles.pill, myEmoji === emoji && styles.pillActive]}
            onPress={() => react(emoji)}
            onLongPress={() => openTooltip(emoji, uids)}
            delayLongPress={350}
          >
            <Text style={styles.pillEmoji}>{emoji}</Text>
            <Text style={[styles.pillCount, myEmoji === emoji && styles.pillCountActive]}>
              {uids.length}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.addBtnText}>{myEmoji ? '•••' : '+'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tooltip */}
      {tooltip && (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.backdrop} onPress={() => setTooltip(null)}>
            <View style={styles.tooltipBox}>
              <Text style={styles.tooltipEmoji}>{tooltip.emoji}</Text>
              {loadingTooltip ? (
                <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 4 }} />
              ) : (
                tooltip.names.map((name, i) => (
                  <Text key={i} style={styles.tooltipName}>{name}</Text>
                ))
              )}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Picker */}
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
  pills:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.bg,
    borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: 'rgba(155,109,214,0.10)',
    borderColor: 'rgba(155,109,214,0.35)',
  },
  pillEmoji:       { fontSize: 14 },
  pillCount:       { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  pillCountActive: { color: Colors.primary },
  addBtn: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.pill,
    width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  addBtnText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(28,28,30,0.4)', justifyContent: 'center', alignItems: 'center' },

  tooltipBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    minWidth: 140,
    ...Shadow.lg,
  },
  tooltipEmoji: { fontSize: 28, marginBottom: 4 },
  tooltipName:  { color: Colors.textPrimary, fontSize: 14, fontWeight: '500' },

  picker: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: 14,
    ...Shadow.lg,
  },
  emojiBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.bg,
  },
  emojiBtnActive: {
    backgroundColor: 'rgba(155,109,214,0.12)',
    borderWidth: 1, borderColor: 'rgba(155,109,214,0.4)',
  },
  emojiText: { fontSize: 22 },
});
