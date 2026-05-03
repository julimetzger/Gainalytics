import React, {useEffect, useRef} from 'react';
import {Animated, Platform, StyleSheet, View} from 'react-native';
import {Icon, Text, useTheme} from 'react-native-paper';

export interface Estimated1RmCardProps {
  sessionOneRm: number;
  lastTrainingOneRm?: number;
  allTimePr?: number;
}

const mono = Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'});
const fmt = (v: number) => `${v.toFixed(1)} kg`;
const fmtInt = (v: number) => `${Math.round(v)} kg`;

const Estimated1RmCard = ({sessionOneRm, lastTrainingOneRm, allTimePr}: Estimated1RmCardProps) => {
  const theme = useTheme();
  const colors = theme.colors as any;

  const hasSession = sessionOneRm > 0;
  const hasPr = (allTimePr ?? 0) > 0;
  const hasLast = (lastTrainingOneRm ?? 0) > 0;
  const isNewPr = hasSession && hasPr && sessionOneRm > (allTimePr ?? 0);

  const deltaRaw = hasSession && hasLast ? sessionOneRm - (lastTrainingOneRm ?? 0) : undefined;
  const delta = deltaRaw !== undefined ? Math.round(deltaRaw * 10) / 10 : undefined;

  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (isNewPr) {
      Animated.sequence([
        Animated.timing(scale, {toValue: 1.05, duration: 120, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1, duration: 120, useNativeDriver: true}),
      ]).start();
    }
  }, [isNewPr, scale]);

  const primaryContainer = colors.primaryContainer ?? colors.primary;
  const onPrimaryContainer = colors.onPrimaryContainer ?? colors.onPrimary ?? '#fff';
  const tertiary = colors.tertiary ?? colors.primary;
  const surfaceLow = colors.surfaceContainerLow ?? colors.surfaceVariant ?? colors.surface;
  const success = colors.success ?? colors.tertiary ?? theme.colors.primary;
  const {onSurface, onSurfaceVariant, primary, error} = theme.colors;

  const deltaTint =
    delta === undefined ? onSurfaceVariant
    : delta > 0 ? success
    : delta < 0 ? error
    : onSurfaceVariant;

  const deltaStr =
    delta === undefined ? null
    : delta === 0 ? '= 0.0 kg'
    : delta > 0 ? `+${delta.toFixed(1)} kg`
    : `${delta.toFixed(1)} kg`;

  return (
    <View
      testID="estimated-1rm-card"
      accessibilityLabel="Estimated 1RM card"
      style={[styles.card, {backgroundColor: surfaceLow}]}>
      <View style={styles.row}>
        <View style={[styles.avatar, {backgroundColor: primaryContainer}]}>
          <Icon source="trophy" size={22} color={onPrimaryContainer} />
        </View>
        <View style={styles.middle}>
          <Text testID="estimated-1rm-header" style={[styles.caption, {color: onSurfaceVariant}]}>
            ESTIMATED 1RM
          </Text>
          <Text testID="estimated-1rm-value" style={[styles.heroValue, {color: onSurface, fontFamily: mono}]}>
            {hasSession ? fmtInt(sessionOneRm) : '—'}
          </Text>
        </View>
        <View style={styles.right}>
          {hasPr ? (
            <Animated.View style={{transform: [{scale}]}}>
              <Text
                testID="estimated-1rm-pr"
                style={[styles.prLine, {color: isNewPr ? primary : tertiary}]}>
                {isNewPr ? '🏆 NEW PR' : `PR ${fmt(allTimePr!)}`}
              </Text>
            </Animated.View>
          ) : null}
          {hasLast ? (
            <Text testID="estimated-1rm-last" style={[styles.lastLine, {color: onSurfaceVariant, fontFamily: mono}]}>
              {`last ${fmt(lastTrainingOneRm!)}`}
            </Text>
          ) : null}
          {deltaStr !== null ? (
            <Text testID="estimated-1rm-delta" style={[styles.deltaLine, {color: deltaTint, fontFamily: mono}]}>
              {deltaStr}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    marginHorizontal: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    minHeight: 70,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: {
    flex: 1,
  },
  caption: {
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroValue: {
    fontSize: 20,
    fontWeight: '500',
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
  },
  prLine: {
    fontSize: 11,
    fontWeight: '600',
  },
  lastLine: {
    fontSize: 11,
    marginTop: 1,
  },
  deltaLine: {
    fontSize: 12,
    marginTop: 1,
  },
});

export default Estimated1RmCard;
