import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { haptic } from '@/lib/haptics';
import { BORDER, colors, hardShadow, radius } from '@/theme/tokens';

interface SliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  color?: string;
  accessibilityLabel: string;
  formatValue?: (value: number) => string;
  testID?: string;
}

const THUMB = 34;

/**
 * Slider maison (iOS, Android, web) : grosse zone tactile, crans avec retour haptique,
 * accessible (adjustable + incrément/décrément).
 */
export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  color = colors.sunset,
  accessibilityLabel,
  formatValue,
  testID,
}: SliderProps) {
  const [width, setWidth] = useState(0);
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)));

  const commit = (next: number) => {
    const clamped = Math.min(max, Math.max(min, next));
    const rounded = Math.round(clamped / step) * step;
    const precise = Number(rounded.toFixed(4));
    if (precise !== value) {
      haptic.select();
      onChange(precise);
    }
  };

  const handleTouch = (e: GestureResponderEvent) => {
    if (width <= 0) return;
    const x = e.nativeEvent.locationX;
    commit(min + (Math.min(width, Math.max(0, x)) / width) * (max - min));
  };

  return (
    <View
      testID={testID}
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={handleTouch}
      onResponderMove={handleTouch}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min, max, now: value, text: formatValue?.(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'increment') commit(value + step);
        if (e.nativeEvent.actionName === 'decrement') commit(value - step);
      }}
    >
      <View style={[styles.track, styles.noTouch]}>
        <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>
      <View
        style={[
          styles.thumb,
          styles.noTouch,
          hardShadow(3),
          { left: `${ratio * 100}%`, marginLeft: -THUMB / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 56,
    justifyContent: 'center',
    marginHorizontal: THUMB / 2,
  },
  noTouch: { pointerEvents: 'none' },
  track: {
    height: 16,
    borderRadius: radius.pill,
    borderWidth: BORDER,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    overflow: 'hidden',
  },
  fill: { height: '100%' },
  thumb: {
    position: 'absolute',
    top: (56 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    borderWidth: BORDER,
    borderColor: colors.ink,
    backgroundColor: colors.sun,
  },
});
