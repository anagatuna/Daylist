import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Pressable, Modal,
  StyleSheet, ActivityIndicator, Image, Keyboard, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
  collection, addDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, doc, deleteDoc, getDoc, updateDoc, increment,
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
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [backdropReady, setBackdropReady] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!visible) setBackdropReady(false);
  }, [visible]);

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

  function cancelReply() { setReplyTo(null); setText(''); }

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
      await updateDoc(doc(db, 'posts', postId), { [`commentCounts.${slot}`]: increment(1) });
      if (!replyTo && postOwnerUid && postOwnerUid !== user.uid)
        notifyComment(postOwnerUid, user.displayName ?? 'Usuario', trimmed).catch(() => {});
      if (replyTo?.uid && replyTo.uid !== user.uid)
        notifyReply(replyTo.uid, user.displayName ?? 'Usuario', trimmed).catch(() => {});
      setText('');
      setReplyTo(null);
    } finally {
      setSending(false);
    }
  }

  async function deleteComment(commentId) {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
    await updateDoc(doc(db, 'posts', postId), { [`commentCounts.${slot}`]: increment(-1) });
  }

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

  function Avatar({ item, size = 30 }) {
    if (item.avatar) return <Image source={{ uri: item.avatar }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
    return (
      <LinearGradient colors={colors.gradientPrimary} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={{ color: '#fff', fontSize: size * 0.38, fontWeight: '700' }}>{item.displayName?.[0]?.toUpperCase()}</Text>
      </LinearGradient>
    );
  }

  function renderComment({ item }) {
    const isOwn = item.uid === user?.uid;
    return (
      <View style={[styles.commentRow, item._isReply && styles.replyRow]}>
        {item._isReply && <View style={[styles.replyLine, { backgroundColor: colors.primary + '40' }]} />}
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            <Avatar item={item} size={28} />
            <Text style={[styles.commentName, { color: colors.textPrimary }]}>{item.displayName}</Text>
            <Text style={[styles.commentTime, { color: colors.textMuted }]}>{formatTime(item.createdAt)}</Text>
          </View>
          <View style={styles.bubble}>
            <Text style={[styles.commentText, { color: colors.textPrimary }]}>{item.text}</Text>
          </View>
          <View style={styles.commentActions}>
            <TouchableOpacity onPress={() => {
              setReplyTo({ id: item.replyTo ? item.replyTo : item.id, displayName: item.displayName, uid: item.uid });
              inputRef.current?.focus();
            }}>
              <Text style={[styles.replyBtn, { color: colors.textMuted }]}>Responder</Text>
            </TouchableOpacity>
            {isOwn && (
              <TouchableOpacity onPress={() => deleteComment(item.id)}>
                <Text style={[styles.deleteBtn, { color: colors.danger }]}>Eliminar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  }

  const content = (
    <View style={[
      styles.sheet,
      { backgroundColor: colors.bg },
      { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 12 : (insets.bottom + 16 || 24) },
    ]}>
      {/* Header */}
      <View style={styles.sheetHeader}>
        <View>
          <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>Comentarios</Text>
          <Text style={[styles.sheetSlot, { color: colors.primary }]}>{SLOT_LABELS[slot] ?? ''}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={8}
          style={[styles.closeBtn, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '28' }]}
        >
          <Ionicons name="close" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={[styles.divider, { backgroundColor: colors.primary + '20' }]} />

      {/* Comments list */}
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : flatList.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={40} color={colors.primary + '50'} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sin comentarios aún</Text>
          <Text style={[styles.emptySubText, { color: colors.textMuted }]}>¡Sé el primero en comentar!</Text>
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
        <View style={[styles.replyBanner, { backgroundColor: colors.primary + '0E', borderColor: colors.primary + '25' }]}>
          <Ionicons name="return-down-forward" size={14} color={colors.primary} />
          <Text style={[styles.replyBannerText, { color: colors.textMuted }]}>
            Respondiendo a <Text style={{ color: colors.primary, fontWeight: '700' }}>{replyTo.displayName}</Text>
          </Text>
          <TouchableOpacity onPress={cancelReply} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      <View style={[styles.inputRow, { borderTopColor: colors.border }]}>
        <View style={[styles.inputWrap, { backgroundColor: colors.primary + '0A', borderColor: colors.primary + '25' }]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: colors.textPrimary }]}
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
            style={[styles.sendBtn, { opacity: (!text.trim() || sending) ? 0.4 : 1 }]}
            onPress={send}
            disabled={!text.trim() || sending}
          >
            <LinearGradient colors={colors.gradientPrimary} style={styles.sendBtnGrad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              {sending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Ionicons name="arrow-up" size={16} color="#fff" />
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (Platform.OS === 'ios') {
    return (
      <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
      onShow={() => setBackdropReady(true)}
      onRequestClose={onClose}>
      <View style={styles.androidRoot}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => backdropReady && onClose()} />
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
  const diff = Math.floor((new Date() - d) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

const styles = StyleSheet.create({
  androidRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  androidSheet: { height: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },

  sheet: { flex: 1 },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  sheetSlot: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, marginTop: 2,
  },
  divider: { height: 1, marginHorizontal: 20, marginBottom: 8 },

  listContent: { paddingHorizontal: 16, paddingVertical: 8, gap: 2 },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '600' },
  emptySubText: { fontSize: 13 },

  commentRow: { paddingVertical: 8 },
  replyRow: { flexDirection: 'row', paddingLeft: 16 },
  replyLine: { width: 2, borderRadius: 1, marginRight: 10, marginTop: 4, alignSelf: 'stretch' },
  commentBody: { flex: 1 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  commentName: { fontSize: 13, fontWeight: '700' },
  commentTime: { fontSize: 11, marginLeft: 'auto' },
  bubble: {
    paddingVertical: 2,
    marginLeft: 36,
  },
  commentText: { fontSize: 14, lineHeight: 20, textShadowColor: 'rgba(0,0,0,0.08)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 },
  commentActions: { flexDirection: 'row', gap: 16, marginTop: 5, paddingLeft: 36 },
  replyBtn: { fontSize: 12, fontWeight: '500' },
  deleteBtn: { fontSize: 12, fontWeight: '500' },

  replyBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopWidth: 1, borderBottomWidth: 1,
  },
  replyBannerText: { fontSize: 13, flex: 1 },

  inputRow: {
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingLeft: 14, paddingRight: 6, paddingVertical: 6,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    maxHeight: 100,
    paddingTop: 4,
    paddingBottom: 4,
  },
  sendBtn: {},
  sendBtnGrad: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
});
