import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors } from '@/constants/Theme';

const THEME_KEY = '@daylist_theme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState('system'); // 'system' | 'light' | 'dark'
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(val => {
      if (val === 'light' || val === 'dark') setPreference(val);
      setLoaded(true);
    });
  }, []);

  const isDark = preference === 'system' ? systemScheme === 'dark' : preference === 'dark';
  const colors = isDark ? DarkColors : LightColors;

  const value = useMemo(() => ({
    colors,
    isDark,
    preference,
    setPreference: async (pref) => {
      setPreference(pref);
      await AsyncStorage.setItem(THEME_KEY, pref);
    },
  }), [isDark, preference]);

  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
