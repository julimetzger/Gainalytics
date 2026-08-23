import React from 'react';
import {StyleSheet, TouchableOpacity} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
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
  const identityLabel = useVideoAnalysisSetIdentity(analysis);

  return (
    <TouchableOpacity
      testID={`compare-picker-item-${analysis.id}`}
      style={[styles.item, {borderBottomColor: theme.colors.outlineVariant}]}
      onPress={onPress}
    >
      <Text testID={`compare-picker-item-title-${analysis.id}`} style={styles.title}>
        {identityLabel}
      </Text>
      <Text style={styles.subtitle}>{new Date(analysis.createdAt).toLocaleString()}</Text>
      {analysis.setResult && (
        <Text style={styles.meta}>
          {`${analysis.setResult.repResults.length} reps${analysis.setResult.velocityLossPercent !== null ? ` | VL ${analysis.setResult.velocityLossPercent}%` : ''}`}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  item: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  meta: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
});

export default CompareAnalysisPickerItem;
