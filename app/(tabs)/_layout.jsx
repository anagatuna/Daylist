import { useEffect, useState, useRef } from 'react';
import { View, Text, Image, StyleSheet, Animated, Platform, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';

const ICONS = {
  index:   { focused: 'home', outline: 'home-outline' },
  friends: { focused: 'people', outline: 'people-outline' },
  profile: { focused: 'person', outline: 'person-outline' },
};

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function TabButton({ name, focused, onPress, colors, count, avatar }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pillAnim = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const tint = focused ? colors.navBar.activeDot : colors.navBar.inactiveTint;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 300, friction: 10 }).start();
    if (focused) {
      scaleAnim.setValue(0.85);
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 260, friction: 7 }).start();
    }
    Animated.timing(pillAnim, { toValue: focused ? 1 : 0, duration: 180, useNativeDriver: true }).start();
  }, [focused]);

  const isProfile = name === 'profile';
  const activeBg = hexToRgba(colors.navBar.activeDot, colors.navBar.tint === 'dark' ? 0.24 : 0.18);

  return (
    <TouchableOpacity style={styles.tabBtn} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.pill,
            { backgroundColor: activeBg, opacity: pillAnim, transform: [{ scale: pillAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] },
          ]}
        />
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          {isProfile ? (
            focused ? (
              <LinearGradient colors={colors.gradientPrimary} style={styles.avatarRing} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.avatarRingInner}>
                  {avatar ? <Image source={{ uri: avatar }} style={styles.avatarImg} /> : <Ionicons name="person" size={15} color="#fff" />}
                </View>
              </LinearGradient>
            ) : avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImgPlain} />
            ) : (
              <Ionicons name="person-outline" size={24} color={tint} />
            )
          ) : (
            <Ionicons name={focused ? ICONS[name].focused : ICONS[name].outline} size={24} color={tint} />
          )}
          {count > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.navBar.overlay }]}>
              <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </TouchableOpacity>
  );
}

function CustomTabBar({ state, navigation, colors, pendingRequests, avatar }) {
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: insets.bottom + (Platform.OS === 'ios' ? 8 : 12) }]}>
      <View style={[styles.bar, { shadowColor: colors.primary, shadowOpacity: colors.navBar.shadowOpacity ?? 0.15 }]}>
        <BlurView
          tint={colors.navBar.tint}
          intensity={colors.navBar.intensity}
          experimentalBlurMethod="dimezisBlurView"
          blurReductionFactor={2}
          style={[StyleSheet.absoluteFill, styles.blurBg, { borderColor: colors.navBar.border }]}
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.navBar.overlay, borderRadius: 32 }]} />
          {colors.navBar.highlight && (
            <View style={[styles.glassHighlight, { backgroundColor: colors.navBar.highlight }]} />
          )}
        </BlurView>

        {state.routes
          .filter((r) => r.name !== 'two')
          .map((route) => {
            const focused = state.routes[state.index].key === route.key;
            return (
              <TabButton
                key={route.key}
                name={route.name}
                focused={focused}
                colors={colors}
                count={route.name === 'friends' ? pendingRequests : 0}
                avatar={route.name === 'profile' ? avatar : null}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
                }}
              />
            );
          })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState(0);
  const [avatar, setAvatar] = useState(null);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      const data = snap.data();
      setPendingRequests((data?.friendRequests ?? []).length);
      setAvatar(data?.avatar ?? null);
    });
    return unsub;
  }, [user]);

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} colors={colors} pendingRequests={pendingRequests} avatar={avatar} />}
      screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Feed' }} />
      <Tabs.Screen name="friends" options={{ title: 'Amigos' }} />
      <Tabs.Screen name="profile" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="two" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '58%',
    minWidth: 220,
    maxWidth: 260,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  blurBg: {
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  glassHighlight: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    borderRadius: 1,
    opacity: 0.6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    width: 40,
    height: 36,
    borderRadius: 18,
  },
  avatarRing: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRingInner: {
    width: 23,
    height: 23,
    borderRadius: 11.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  avatarImg: {
    width: 23,
    height: 23,
    borderRadius: 11.5,
  },
  avatarImgPlain: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  badge: {
    position: 'absolute', top: -3, right: -8,
    borderRadius: 8, minWidth: 15, height: 15,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1.5,
  },
  badgeText: { color: '#fff', fontSize: 8.5, fontWeight: '700' },
});
