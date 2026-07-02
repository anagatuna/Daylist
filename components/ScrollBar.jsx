import { useRef, useCallback } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

const BAR_WIDTH = 3;
const MIN_THUMB = 40;

/**
 * Wrap a FlatList/ScrollView with this to get a custom lila scroll indicator.
 * Usage:
 *   const { scrollProps, indicator } = useScrollBar();
 *   <View style={{ flex: 1 }}>
 *     <FlatList {...scrollProps} showsVerticalScrollIndicator={false} ... />
 *     {indicator}
 *   </View>
 */
export function useScrollBar() {
  const { colors } = useTheme();
  const scrollY = useRef(new Animated.Value(0)).current;
  const contentH = useRef(0);
  const viewH = useRef(0);
  const thumbOpacity = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef(null);

  const showThumb = useCallback(() => {
    Animated.timing(thumbOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(thumbOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start();
    }, 800);
  }, []);

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: showThumb,
    }
  );

  const onContentSizeChange = useCallback((_, h) => { contentH.current = h; }, []);
  const onLayout = useCallback((e) => { viewH.current = e.nativeEvent.layout.height; }, []);

  const thumbH = scrollY.interpolate({
    inputRange: [0, 1],
    outputRange: [MIN_THUMB, MIN_THUMB],
  });

  const thumbTop = scrollY.interpolate({
    inputRange: [0, 99999],
    outputRange: [0, 99999],
    extrapolate: 'clamp',
  });

  // We compute in JS: thumbH = viewH² / contentH, thumbTop = scrollY * (viewH - thumbH) / (contentH - viewH)
  // Since Animated interpolation can't do division dynamically, we use a workaround with a listener.
  const thumbStyle = useRef(new Animated.Value(0)).current;
  const thumbSizeStyle = useRef(new Animated.Value(MIN_THUMB)).current;

  scrollY.addListener(({ value }) => {
    const cH = contentH.current;
    const vH = viewH.current;
    if (!cH || !vH || cH <= vH) return;
    const ratio = vH / cH;
    const tH = Math.max(MIN_THUMB, vH * ratio);
    const maxScroll = cH - vH;
    const maxThumbTop = vH - tH;
    const top = (value / maxScroll) * maxThumbTop;
    thumbStyle.setValue(top);
    thumbSizeStyle.setValue(tH);
  });

  const indicator = (
    <Animated.View
      pointerEvents="none"
      style={[s.track, { opacity: thumbOpacity }]}
      onLayout={onLayout}
    >
      <Animated.View
        style={[
          s.thumb,
          {
            backgroundColor: colors.primary,
            height: thumbSizeStyle,
            transform: [{ translateY: thumbStyle }],
          },
        ]}
      />
    </Animated.View>
  );

  const scrollProps = {
    onScroll,
    onContentSizeChange,
    scrollEventThrottle: 16,
    showsVerticalScrollIndicator: false,
  };

  return { scrollProps, indicator };
}

const s = StyleSheet.create({
  track: {
    position: 'absolute',
    right: 3,
    top: 0,
    bottom: 0,
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    overflow: 'visible',
  },
  thumb: {
    position: 'absolute',
    width: BAR_WIDTH,
    borderRadius: BAR_WIDTH / 2,
    right: 0,
  },
});
