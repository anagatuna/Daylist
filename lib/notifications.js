import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// Configurar cómo se muestran las notificaciones cuando la app está abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Obtener y guardar el token de push del usuario
export async function registerPushToken(uid) {
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
  });

  const token = tokenData.data;

  // Guardar en Firestore
  await updateDoc(doc(db, 'users', uid), { expoPushToken: token });

  return token;
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

// Enviar notificación a los amigos cuando alguien publica
export async function notifyFriends(uid, displayName, friendIds) {
  if (!friendIds.length) return;

  // Obtener los tokens de los amigos
  const tokens = [];
  await Promise.all(
    friendIds.map(async (friendId) => {
      const snap = await getDoc(doc(db, 'users', friendId));
      const token = snap.data()?.expoPushToken;
      if (token) tokens.push(token);
    })
  );

  if (!tokens.length) return;

  // Enviar via Expo Push API
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(
      tokens.map((token) => ({
        to: token,
        title: '🎵 Nueva publicación',
        body: `${displayName} compartió sus canciones del día`,
        sound: 'default',
        data: { uid },
      }))
    ),
  });
}
