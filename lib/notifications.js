import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Obtener y guardar el token de push del usuario
export async function registerPushToken(uid) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#9B6DD6',
      sound: 'default',
    });
  }
  if (!Device.isDevice) return null;

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: 'adfaca39-4d08-4df4-b1b2-230ca8d370d7',
    ...(Platform.OS === 'android' && { channelId: 'default' }),
  });

  const token = tokenData.data;

  // Guardar en Firestore
  await updateDoc(doc(db, 'users', uid), { expoPushToken: token });

  return token;
}

// Notificar reacción en un post
export async function notifyReaction(targetUid, fromDisplayName, emoji) {
  try {
    const snap = await getDoc(doc(db, 'users', targetUid));
    const token = snap.data()?.expoPushToken;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: `${emoji} Nueva reacción`,
        body: `${fromDisplayName} reaccionó a tu publicación`,
        sound: 'default',
        data: { type: 'reaction' },
      }),
    });
  } catch {}
}

// Enviar notificación de solicitud de amistad
export async function notifyFriendRequest(targetUid, fromDisplayName) {
  try {
    const snap = await getDoc(doc(db, 'users', targetUid));
    const token = snap.data()?.expoPushToken;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: '👋 Nueva solicitud de amistad',
        body: `${fromDisplayName} quiere ser tu amigo`,
        sound: 'default',
        data: { type: 'friend_request' },
      }),
    });
  } catch {}
}

// Notificar nuevo comentario en un post
export async function notifyComment(targetUid, fromDisplayName, text) {
  try {
    const snap = await getDoc(doc(db, 'users', targetUid));
    const token = snap.data()?.expoPushToken;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: `💬 ${fromDisplayName} comentó tu publicación`,
        body: text.length > 80 ? text.slice(0, 77) + '…' : text,
        sound: 'default',
        data: { type: 'comment' },
      }),
    });
  } catch {}
}

// Notificar respuesta a un comentario
export async function notifyReply(targetUid, fromDisplayName, text) {
  try {
    const snap = await getDoc(doc(db, 'users', targetUid));
    const token = snap.data()?.expoPushToken;
    if (!token) return;

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        to: token,
        title: `↩️ ${fromDisplayName} respondió tu comentario`,
        body: text.length > 80 ? text.slice(0, 77) + '…' : text,
        sound: 'default',
        data: { type: 'reply' },
      }),
    });
  } catch {}
}

const REMINDER_ID = 'daily-reminder';

export async function scheduleDailyReminder(hour, minute) {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: '🎵 ¿Ya elegiste tus canciones de hoy?',
      body: 'Comparte tu Daylist con tus amigos.',
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

export async function cancelDailyReminder() {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}

const SLOT_NAMES = { morning: 'mañana', afternoon: 'tarde', night: 'noche' };

function buildSlotBody(displayName, slots) {
  const names = slots.map(s => SLOT_NAMES[s] ?? s);
  if (names.length === 1) return `${displayName} añadió su canción de la ${names[0]}`;
  const last = names.pop();
  return `${displayName} añadió sus canciones de la ${names.join(', la ')} y la ${last}`;
}

// Enviar notificación a los amigos cuando alguien publica
export async function notifyFriends(uid, displayName, friendIds, slots = []) {
  if (!friendIds.length) return;

  const tokens = [];
  await Promise.all(
    friendIds.map(async (friendId) => {
      const snap = await getDoc(doc(db, 'users', friendId));
      const token = snap.data()?.expoPushToken;
      if (token) tokens.push(token);
    })
  );

  if (!tokens.length) return;

  const body = slots.length
    ? buildSlotBody(displayName, slots)
    : `${displayName} compartió sus canciones del día`;

  const messages = tokens.map((token) => ({
    to: token,
    title: 'Nueva publicación',
    body,
    sound: 'default',
    data: { uid },
  }));

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expo Push API error ${res.status}: ${text}`);
  }
}
