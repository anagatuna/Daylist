import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useAuth } from '@/hooks/useAuth';
import { registerPushToken, scheduleStreakReminder } from '@/lib/notifications';
import { runStreakMigration } from '@/lib/migrateStreaks';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';

SplashScreen.preventAutoHideAsync();

function RootNav() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();

  const headerTheme = {
    headerStyle: { backgroundColor: colors.bg },
    headerTintColor: colors.textPrimary,
    headerShadowVisible: false,
    headerBackTitle: '',
    headerBackTitleVisible: false,
    headerBackButtonDisplayMode: 'minimal',
    headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
  };
  const router = useRouter();
  const segments = useSegments();
  const notificationListener = useRef(null);
  const responseListener = useRef(null);
  const splashHidden = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!splashHidden.current) {
      splashHidden.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }

    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(tabs)');
    }
  }, [user, loading]);

  useEffect(() => {
    if (!user) return;

    registerPushToken(user.uid).catch(() => {});
    runStreakMigration().catch(() => {});
    scheduleStreakReminder().catch(() => {});

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type === 'friend_request') {
        router.push('/(tabs)/friends');
      } else if (data?.type === 'reaction') {
        router.push('/(tabs)/profile');
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
      <Stack.Screen name="post/create" options={{ presentation: 'modal', headerShown: true, title: 'Nueva publicación', ...headerTheme }} />
      <Stack.Screen name="user/[uid]" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: true, title: 'Editar perfil', presentation: 'modal', ...headerTheme }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNav />
    </ThemeProvider>
  );
}
