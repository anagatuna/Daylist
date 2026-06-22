import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, getDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { notifyReaction } from '@/lib/notifications';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';
import EmojiPicker from 'rn-emoji-keyboard';

const QUICK_EMOJIS = ['🔥', '💜', '😭', '🎵', '✨', '💀'];

export default function Reactions({ postId, slot, reactions = {}, postOwnerUid, commentCount = 0, onComment }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [localReactions, setLocalReactions] = useState(reactions);
  const [showPicker, setShowPicker] = useState(false);
  const [showEmojiKeyboard, setShowEmojiKeyboard] = useState(false);
  const [tooltip, setTooltip] = useState(null);
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
    setShowEmojiKeyboard(false);

    const isNewReaction = emoji !== myEmoji;
    const postRef = doc(db, 'posts', postId);
    const patch = {};

    if (myEmoji) {
      patch[`reactions.${slot}.${myEmoji}`] = arrayRemove(user.uid);
    }
    if (isNewReaction) {
      patch[`reactions.${slot}.${emoji}`] = arrayUnion(user.uid);
    }

    setLocalReactions(prev => {
      const next = { ...prev };
      if (myEmoji) next[myEmoji] = (next[myEmoji] ?? []).filter(u => u !== user.uid);
      if (isNewReaction) next[emoji] = [...(next[emoji] ?? []), user.uid];
      return next;
    });

    await updateDoc(postRef, patch);

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
            style={[styles.pill, { backgroundColor: colors.bg, borderColor: colors.border }, myEmoji === emoji && styles.pillActive]}
            onPress={() => react(emoji)}
            onLongPress={() => openTooltip(emoji, uids)}
            delayLongPress={350}
          >
            <Text style={styles.pillEmoji}>{emoji}</Text>
            <Text style={[styles.pillCount, { color: colors.textMuted }, myEmoji === emoji && { color: colors.primary }]}>
              {uids.length}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={() => setShowPicker(true)}>
          <Ionicons name="add" size={18} color={colors.primary} />
        </TouchableOpacity>

        {onComment && (
          <TouchableOpacity style={styles.commentPill} onPress={onComment}>
            <Ionicons name="chatbubble-outline" size={15} color={colors.primary} />
            {commentCount > 0 && (
              <Text style={[styles.commentPillCount, { color: colors.primary }]}>{commentCount}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Tooltip */}
      {tooltip && (
        <Modal visible transparent animationType="fade">
          <Pressable style={styles.backdrop} onPress={() => setTooltip(null)}>
            <View style={[styles.tooltipBox, { backgroundColor: colors.surface }]}>
              <Text style={styles.tooltipEmoji}>{tooltip.emoji}</Text>
              {loadingTooltip ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4 }} />
              ) : (
                tooltip.names.map((name, i) => (
                  <Text key={i} style={[styles.tooltipName, { color: colors.textPrimary }]}>{name}</Text>
                ))
              )}
            </View>
          </Pressable>
        </Modal>
      )}

      {/* Quick Picker */}
      <Modal visible={showPicker} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setShowPicker(false)}>
          <View style={[styles.picker, { backgroundColor: colors.surface }]}>
            {QUICK_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiBtn, { backgroundColor: colors.bg }, myEmoji === emoji && styles.emojiBtnActive]}
                onPress={() => react(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.emojiBtn, { backgroundColor: colors.bg }]}
              onPress={() => { setShowPicker(false); setShowEmojiKeyboard(true); }}
            >
              <Ionicons name="add" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Full Emoji Keyboard */}
      <EmojiPicker
        onEmojiSelected={e => react(e.emoji)}
        open={showEmojiKeyboard}
        onClose={() => setShowEmojiKeyboard(false)}
        expandable={false}
        defaultHeight="40%"
        enableSearchBar
        enableRecentlyUsed
        categoryPosition="bottom"
        theme={{
          backdrop: 'rgba(0,0,0,0.25)',
          knob: colors.border,
          container: colors.bg,
          header: colors.textSecondary,
          skinTonesContainer: colors.bg,
          category: {
            icon: colors.textMuted,
            iconActive: colors.primary,
            container: colors.bg,
            containerActive: 'rgba(155,109,214,0.12)',
          },
          search: {
            text: colors.textPrimary,
            placeholder: colors.textMuted,
            icon: colors.textMuted,
            background: colors.surface,
          },
          emoji: {
            selected: 'rgba(155,109,214,0.12)',
          },
        }}
        styles={{
          container: {
            borderBottomLeftRadius: 0,
            borderBottomRightRadius: 0,
            paddingBottom: 0,
          },
        }}
      />
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
    backgroundColor: 'rgba(155,109,214,0.08)',
    borderRadius: Radius.pill,
    width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(155,109,214,0.25)',
  },

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

  commentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(155,109,214,0.08)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(155,109,214,0.25)',
  },
  commentPillCount: { color: Colors.primary, fontSize: 12, fontWeight: '600' },
});
