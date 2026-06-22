import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Pressable, Modal,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  Image, Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  collection, addDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, doc, deleteDoc, getDoc,
} from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { notifyComment, notifyReply } from '@/lib/notifications';
import { Colors, Radius, Shadow } from '@/constants/Theme';
import { useTheme } from '@/contexts/ThemeContext';

const SLOT_LABELS = { morning: 'Mañana', afternoon: 'Tarde', night: 'Noche' };

export default function CommentsSheet({ visible, onClose, postId, postOwnerUid, slot }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { id, displayName }
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      e => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { show.remove(); hide.remove(); };
  }, []);

  useEffect(() => {
    if (!visible || !postId || !slot) return;
    setLoading(true);
    const q = query(
      collection(db, 'posts', postId, 'comments'),
      where('slot', '==', slot),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [visible, postId, slot]);

  function cancelReply() {
    setReplyTo(null);
    setText('');
  }

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || !user || sending) return;
    setSending(true);
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const avatar = snap.data()?.avatar ?? null;

      await addDoc(collection(db, 'posts', postId, 'comments'), {
        uid: user.uid,
        displayName: user.displayName ?? 'Usuario',
        avatar,
        text: trimmed,
        slot,
        replyTo: replyTo?.id ?? null,
        replyToName: replyTo?.displayName ?? null,
        createdAt: serverTimestamp(),
      });

      // Notify post owner (if not self and not replying)
      if (!replyTo && postOwnerUid && postOwnerUid !== user.uid) {
        notifyComment(postOwnerUid, user.displayName ?? 'Usuario', trimmed).catch(() => {});
      }

      // Notify the person being replied to
      if (replyTo?.uid && replyTo.uid !== user.uid && replyTo.uid !== postOwnerUid) {
        notifyReply(replyTo.uid, user.displayName ?? 'Usuario', trimmed).catch(() => {});
      } else if (replyTo?.uid && replyTo.uid !== user.uid) {
        notifyReply(replyTo.uid, user.displayName ?? 'Usuario', trimmed).catch(() => {});
      }

      setText('');
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  }

  async function deleteComment(commentId) {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
  }

  // Group: top-level comments, then their replies indented
  const topLevel = comments.filter(c => !c.replyTo);
  const repliesMap = {};
  comments.filter(c => c.replyTo).forEach(c => {
    if (!repliesMap[c.replyTo]) repliesMap[c.replyTo] = [];
    repliesMap[c.replyTo].push(c);
  });

  const flatList = [];
  topLevel.forEach(c => {
    flatList.push({ ...c, _isReply: false });
    (repliesMap[c.id] ?? []).forEach(r => flatList.push({ ...r, _isReply: true }));
  });

  function renderComment({ item }) {
    const isOwn = item.uid === user?.uid;
    return (
      <View style={[styles.commentRow, item._isReply && styles.replyRow]}>
        {item._isReply && <View style={[styles.replyLine, { backgroundColor: colors.border }]} />}
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.avatarLetter, { color: colors.primary }]}>{item.displayName?.[0]?.toUpperCase()}</Text>
              </View>
            )}
            <Text style={[styles.commentName, { color: colors.textPrimary }]}>{item.displayName}</Text>
            <Text style={[styles.commentTime, { color: colors.textMuted }]}>{formatTime(item.createdAt)}</Text>
          </View>
          <Text style={[styles.commentText, { color: colors.textPrimary }]}>{item.text}</Text>
          <View style={styles.commentActions}>
            <TouchableOpacity
              onPress={() => {
                setReplyTo({ id: item.replyTo ? item.replyTo : item.id, displayName: item.displayName, uid: item.uid });
                inputRef.current?.focus();
              }}
            >
              <Text style={styles.replyBtn}>Responder</Text>
            </TouchableOpacity>
            {isOwn && (
              <TouchableOpacity onPress={() => deleteComment(item.id)}>
                <Text style={styles.deleteBtn}>Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  const content = (
    <View style={[
      styles.sheetIOS,
      { backgroundColor: colors.bg },
      Platform.OS === 'android' && { paddingTop: insets.top },
      { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 12 : (insets.bottom + 16 || 24) },
    ]}>
      {/* Header */}
      <View style={styles.sheetHeader}>
        <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Comentarios · {SLOT_LABELS[slot] ?? ''}</Text>
        <TouchableOpacity onPress={onClose} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Comments list */}
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : flatList.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sin comentarios aún. ¡Sé el primero!</Text>
        </View>
      ) : (
        <FlatList
          data={flatList}
          keyExtractor={i => i.id}
          renderItem={renderComment}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          style={{ flex: 1 }}
        />
      )}

      {/* Reply banner */}
      {replyTo && (
        <View style={[styles.replyBanner, { borderTopColor: colors.border }]}>
          <Text style={[styles.replyBannerText, { color: colors.textMuted }]}>Respondiendo a <Text style={{ color: colors.primary }}>{replyTo.displayName}</Text></Text>
          <TouchableOpacity onPress={cancelReply} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { backgroundColor: colors.surface, color: colors.textPrimary, borderColor: colors.border }]}
          placeholder="Escribe un comentario…"
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          multiline
          maxLength={250}
          returnKeyType="send"
          onSubmitEditing={send}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          style={[styles.sendBtn, { backgroundColor: colors.primary }, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!text.trim() || sending}
        >
          {sending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="arrow-up" size={18} color="#fff" />
          }
        </TouchableOpacity>
      </View>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        {content}
      </Modal>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.androidRoot}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.androidSheet, { backgroundColor: colors.bg }]}>
          {content}
        </View>
      </View>
    </Modal>
  );
}

function formatTime(ts) {
  if (!ts?.toDate) return '';
  const d = ts.toDate();
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const styles = StyleSheet.create({
  androidRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  androidSheet: {
    height: '92%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  sheetIOS: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: Colors.textPrimary },

  listContent: { paddingHorizontal: 16, paddingVertical: 12, gap: 4 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },

  commentRow: { paddingVertical: 8 },
  replyRow:   { flexDirection: 'row', paddingLeft: 20 },
  replyLine:  {
    width: 2, borderRadius: 1, backgroundColor: Colors.border,
    marginRight: 10, marginTop: 4, alignSelf: 'stretch',
  },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  avatar: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
  },
  avatarLetter: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  commentName: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
  commentTime: { fontSize: 11, color: Colors.textMuted, marginLeft: 'auto' },
  commentText: { fontSize: 14, color: Colors.textPrimary, lineHeight: 20, paddingLeft: 36 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 4, paddingLeft: 36 },
  replyBtn: { fontSize: 12, color: Colors.textMuted, fontWeight: '500' },
  deleteBtn: { fontSize: 12, color: '#FF3B30', fontWeight: '500' },

  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(155,109,214,0.08)',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  replyBannerText: { fontSize: 13, color: Colors.textMuted },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: Colors.textPrimary,
    borderWidth: StyleSheet.hairlineWidth, borderColor: Colors.border,
    maxHeight: 100,
    ...Shadow.sm,
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtnDisabled: { opacity: 0.4 },
});
