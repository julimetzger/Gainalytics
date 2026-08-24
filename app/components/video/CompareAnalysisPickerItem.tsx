import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {MD3Theme, Text, TouchableRipple, useTheme} from 'react-native-paper';
import {VideoAnalysis} from '../../models/entities/VideoAnalysis';
import {useVideoAnalysisSetIdentity} from '../../redux/VideoAnalysis/use/useVideoAnalysisSetIdentity';

interface Props {
  analysis: VideoAnalysis;
  onPress: () => void;
}

/**
 * One row of the "Select analysis to compare" list. The row identifies the
 * analysis by exercise, set number, load and RIR — date, time and the set
 * metrics stay as supporting lines.
 */
const CompareAnalysisPickerItem = ({analysis, onPress}: Props) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const identityLabel = useVideoAnalysisSetIdentity(analysis);

  return (
    <TouchableRipple testID={`compare-picker-item-${analysis.id}`} onPress={onPress} style={styles.touchable}>
      <View style={styles.item}>
        <Text variant="titleSmall" testID={`compare-picker-item-title-${analysis.id}`} style={styles.title}>
          {identityLabel}
        </Text>
        <Text variant="bodySmall" style={styles.subtitle}>
          {new Date(analysis.createdAt).toLocaleString()}
        </Text>
        {analysis.setResult && (
          <Text variant="bodySmall" style={styles.meta}>
            {`${analysis.setResult.repResults.length} reps${analysis.setResult.velocityLossPercent !== null ? ` | VL ${analysis.setResult.velocityLossPercent}%` : ''}`}
          </Text>
        )}
      </View>
    </TouchableRipple>
  );
};

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    touchable: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.outlineVariant,
    },
    item: {
      paddingVertical: 12,
    },
    title: {
      fontWeight: '700',
    },
    subtitle: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    meta: {
      color: theme.colors.onSurfaceVariant,
      marginTop: 2,
    },
  });

export default CompareAnalysisPickerItem;
