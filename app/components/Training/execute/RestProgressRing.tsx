import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import {Text} from 'react-native-paper';
import Svg, {Circle} from 'react-native-svg';

export interface RestProgressRingProps {
  size?: number;
  strokeWidth?: number;
  targetSeconds: number;
  elapsedSeconds: number;
  isOverrun: boolean;
  trackColor: string;
  primaryColor: string;
  errorColor: string;
  display: string;
  textColor: string;
}

const mono = Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'});

const RestProgressRing = ({
  size = 66,
  strokeWidth = 4,
  targetSeconds,
  elapsedSeconds,
  isOverrun,
  trackColor,
  primaryColor,
  errorColor,
  display,
  textColor,
}: RestProgressRingProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // While counting: draw an arc whose length shrinks from circumference → 0.
  // While overrun: draw a full ring in error tint.
  const fraction =
    targetSeconds > 0 ? Math.max(0, Math.min(1, 1 - elapsedSeconds / targetSeconds)) : 0;
  const arcLength = isOverrun ? circumference : circumference * fraction;
  const dashOffset = isOverrun ? 0 : circumference - arcLength;
  const ringColor = isOverrun ? errorColor : primaryColor;

  return (
    <View
      testID="rest-progress-ring"
      style={[styles.wrapper, {width: size, height: size}]}>
      <Svg width={size} height={size}>
        {/* Track (full circle in muted tone) */}
        <Circle
          testID="rest-progress-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress arc (partial during counting, full during overrun) */}
        <Circle
          testID="rest-progress-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.textOverlay} pointerEvents="none">
        <Text style={[styles.timerText, {color: textColor, fontFamily: mono}]}>
          {display}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default RestProgressRing;
