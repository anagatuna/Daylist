import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { registerPushToken } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    if (loading) return;
    SplashScreen.hideAsync();

    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, loading]);

  // Registrar token de notificaciones cuando el usuario inicia sesión
  useEffect(() => {
    if (!user) return;

    registerPushToken(user.uid).catch(() => {});

    // Escuchar notificaciones recibidas con la app abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    // Navegar según el tipo de notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'friend_request') {
        router.push('/(tabs)/friends');
      } else if (data?.uid) {
        router.push(`/user/${data.uid}`);
      }
    });

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [user]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="post/create" options={{ presentation: 'modal', headerShown: true, title: 'Nueva publicación' }} />
      <Stack.Screen name="user/[uid]" options={{ headerShown: true, title: '' }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Editar perfil', presentation: 'modal' }} />
    </Stack>
  );
}
