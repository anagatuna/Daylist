import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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

  useEffect(() => { setLocalReactions(reactions); }, [JSON.stringify(reactions)]);

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
    if (myEmoji) patch[`reactions.${slot}.${myEmoji}`] = arrayRemove(user.uid);
    if (isNewReaction) patch[`reactions.${slot}.${emoji}`] = arrayUnion(user.uid);
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
      uids.map(uid => getDoc(doc(db, 'users', uid)).then(s => s.data()?.displayName ?? 'Usuario'))
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
        {/* Reaction pills */}
        {summary.map(([emoji, uids]) => {
          const active = myEmoji === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              onPress={() => react(emoji)}
              onLongPress={() => openTooltip(emoji, uids)}
              delayLongPress={350}
              activeOpacity={0.7}
            >
              {active ? (
                <LinearGradient
                  colors={colors.gradientPrimary}
                  style={styles.pillActive}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.pillEmoji}>{emoji}</Text>
                  <Text style={styles.pillCountActive}>{uids.length}</Text>
                </LinearGradient>
              ) : (
                <View style={[styles.pill, { backgroundColor: colors.primary + '0E', borderColor: colors.primary + '28' }]}>
                  <Text style={styles.pillEmoji}>{emoji}</Text>
                  <Text style={[styles.pillCount, { color: colors.textMuted }]}>{uids.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Add emoji */}
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary + '0E', borderColor: colors.primary + '28' }]}
          onPress={() => setShowPicker(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={16} color={colors.primary} />
        </TouchableOpacity>

        {/* Comment */}
        {onComment && (
          <TouchableOpacity
            style={[styles.commentPill, { backgroundColor: colors.primary + '0E', borderColor: colors.primary + '28' }]}
            onPress={onComment}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
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
            <View style={[styles.tooltipBox, { borderColor: colors.cardGlass.border }]}>
              <BlurView tint={colors.cardGlass.tint} intensity={colors.cardGlass.intensity} style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]} />
              <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl, backgroundColor: colors.cardGlass.overlay }]} />
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
          <View style={[styles.picker, { borderColor: colors.navBar.border, shadowColor: colors.primary }]}>
            <BlurView tint={colors.navBar.tint} intensity={colors.navBar.intensity} style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl }]} />
            <View style={[StyleSheet.absoluteFill, { borderRadius: Radius.xl, backgroundColor: colors.glass.overlayStrong }]} />
            {QUICK_EMOJIS.map(emoji => (
              <TouchableOpacity
                key={emoji}
                style={[styles.emojiBtn, { backgroundColor: colors.primary + '0E' }, myEmoji === emoji && { backgroundColor: colors.primary + '22', borderWidth: 1, borderColor: colors.primary + '50' }]}
                onPress={() => react(emoji)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.emojiBtn, { backgroundColor: colors.primary + '0E' }]}
              onPress={() => { setShowPicker(false); setShowEmojiKeyboard(true); }}
            >
              <Ionicons name="grid-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <EmojiPicker
        onEmojiSelected={e => react(e.emoji)}
        open={showEmojiKeyboard}
        onClose={() => setShowEmojiKeyboard(false)}
        expandable={false}
        defaultHeight="55%"
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
          emoji: { selected: 'rgba(155,109,214,0.12)' },
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },

  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1,
  },
  pillActive: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  pillEmoji: { fontSize: 13 },
  pillCount: { fontSize: 12, fontWeight: '600' },
  pillCountActive: { fontSize: 12, fontWeight: '700', color: '#fff' },

  addBtn: {
    borderRadius: Radius.pill,
    width: 28, height: 28,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  commentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: Radius.pill,
    paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1,
  },
  commentPillCount: { fontSize: 12, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },

  tooltipBox: {
    borderRadius: Radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    minWidth: 140,
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadow.lg,
  },
  tooltipEmoji: { fontSize: 28, marginBottom: 4 },
  tooltipName: { fontSize: 14, fontWeight: '500' },

  picker: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: Radius.xl,
    padding: 14,
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadow.lg,
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  emojiText: { fontSize: 22 },
});
