import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Platform, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {epley1RM} from '../../../utils/AnalyseUtils';

export interface Estimated1RmCardProps {
  reps: number;
  rir: number;
  weight: number;
  lastTrainingOneRm?: number;
  allTimePr?: number;
}

const monoFamily = Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'});

const formatKg = (value: number) => `${Math.round(value)} kg`;

const Estimated1RmCard = ({reps, rir, weight, lastTrainingOneRm, allTimePr}: Estimated1RmCardProps) => {
  const theme = useTheme();
  const live1Rm = useMemo(() => epley1RM(weight, reps, rir), [weight, reps, rir]);
  const hasLive = live1Rm > 0;
  const showReference = (lastTrainingOneRm ?? 0) > 0 || (allTimePr ?? 0) > 0;
  const isNewPr = hasLive && (allTimePr ?? 0) > 0 && live1Rm > (allTimePr ?? 0);

  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isNewPr) {
      Animated.sequence([
        Animated.timing(scale, {toValue: 1.05, duration: 120, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1, duration: 120, useNativeDriver: true}),
      ]).start();
    }
  }, [isNewPr, scale]);

  const delta = hasLive && lastTrainingOneRm ? Math.round(live1Rm - lastTrainingOneRm) : undefined;

  const deltaTone =
    delta === undefined ? theme.colors.onSurfaceVariant : delta > 0 ? theme.colors.primary : delta < 0 ? theme.colors.error : theme.colors.onSurfaceVariant;
  const deltaSymbol = delta === undefined ? '' : delta > 0 ? '▲ +' : delta < 0 ? '▼ ' : '= ';
  const deltaText =
    delta === undefined
      ? ''
      : delta === 0
      ? 'same as last'
      : `${deltaSymbol}${Math.abs(delta)} kg vs last`;

  const surfaceContainer = (theme.colors as any).surfaceVariant ?? theme.colors.surface;
  const onSurface = theme.colors.onSurface;
  const onSurfaceVariant = theme.colors.onSurfaceVariant;

  return (
    <View
      testID="estimated-1rm-card"
      accessibilityLabel="Estimated 1RM card"
      style={[styles.card, {backgroundColor: surfaceContainer}]}>
      <Text testID="estimated-1rm-header" style={[styles.header, {color: onSurfaceVariant}]}>
        ESTIMATED 1RM
      </Text>
      <View style={styles.row}>
        <Animated.View style={{transform: [{scale}]}}>
          <Text testID="estimated-1rm-value" style={[styles.bigNumber, {color: onSurface, fontFamily: monoFamily}]}>
            {hasLive ? formatKg(live1Rm) : '— kg'}
          </Text>
        </Animated.View>
        {showReference && (
          <Text testID="estimated-1rm-last" style={[styles.lastTraining, {color: onSurfaceVariant}]}>
            last training: {(lastTrainingOneRm ?? 0) > 0 ? formatKg(lastTrainingOneRm!) : '—'}
          </Text>
        )}
      </View>
      {showReference && (
        <View style={styles.subline}>
          {delta !== undefined && (
            <Text testID="estimated-1rm-delta" style={[styles.deltaText, {color: deltaTone}]}>
              {deltaText}
            </Text>
          )}
          {(allTimePr ?? 0) > 0 && (
            <Text testID="estimated-1rm-pr" style={[styles.prText, {color: isNewPr ? theme.colors.primary : onSurfaceVariant}]}>
              {delta !== undefined ? ' · ' : ''}
              {isNewPr ? '🏆 NEW PR' : `PR ${formatKg(allTimePr!)}`}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 8,
    padding: 12,
    borderRadius: 12,
  },
  header: {
    fontSize: 11,
    letterSpacing: 0.6,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 4,
  },
  bigNumber: {
    fontSize: 28,
    fontWeight: '600',
  },
  lastTraining: {
    fontSize: 13,
  },
  subline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  prText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default Estimated1RmCard;
