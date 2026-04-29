import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Chip, Icon, Text, TouchableRipple, useTheme} from 'react-native-paper';
import {Exercise} from '../../models/entities/Exercise';
import {RIR_PRESETS, VL_PRESETS} from '../../utils/video-analysis-filters';
import {VideoAnalysisRangePreset} from '../../utils/video-analysis-presentation';

interface Props {
  expanded: boolean;
  summary: string;
  selectedRangePreset: VideoAnalysisRangePreset;
  selectedExercises: Exercise[];
  exerciseOptions: Exercise[];
  selectedVlPresets: string[];
  selectedRirPresets: string[];
  onToggleExpanded: () => void;
  onSelectRangePreset: (preset: VideoAnalysisRangePreset) => void;
  onToggleExercise: (exercise: Exercise) => void;
  onToggleVlPreset: (preset: (typeof VL_PRESETS)[number]) => void;
  onToggleRirPreset: (preset: (typeof RIR_PRESETS)[number]) => void;
}

const RANGE_OPTIONS: Array<{label: string; value: VideoAnalysisRangePreset}> = [
  {label: '7d', value: '7d'},
  {label: '30d', value: '30d'},
  {label: '3m', value: '3m'},
  {label: 'All', value: 'all'},
];

const VideoAnalysisFiltersSection = ({
  expanded,
  summary,
  selectedRangePreset,
  selectedExercises,
  exerciseOptions,
  selectedVlPresets,
  selectedRirPresets,
  onToggleExpanded,
  onSelectRangePreset,
  onToggleExercise,
  onToggleVlPreset,
  onToggleRirPreset,
}: Props) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, {backgroundColor: theme.colors.elevation.level2}]} testID="video-analysis-filters-section">
      <TouchableRipple onPress={onToggleExpanded} borderless={false} testID="video-analysis-filters-toggle">
        <View style={styles.header}>
          <Icon source="tune-variant" size={18} color={theme.colors.onSurfaceVariant} />
          <View style={styles.headerText}>
            <Text variant="labelMedium" style={styles.headerLabel}>
              Filters
            </Text>
            <Text variant="bodySmall" numberOfLines={1} style={[styles.summary, {color: theme.colors.onSurfaceVariant}]} testID="video-analysis-filters-summary">
              {summary}
            </Text>
          </View>
          <Icon source={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
      {expanded && (
        <View style={styles.body}>
          <Text variant="labelSmall" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
            RANGE
          </Text>
          <View style={styles.chipsRow}>
            {RANGE_OPTIONS.map((option) => (
              <Chip key={option.value} compact selected={selectedRangePreset === option.value} onPress={() => onSelectRangePreset(option.value)} style={styles.chip} testID={`video-analysis-range-chip-${option.value}`}>
                {option.label}
              </Chip>
            ))}
          </View>

          <Text variant="labelSmall" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
            EXERCISE
          </Text>
          <View style={styles.chipsRow}>
            {exerciseOptions.map((exercise) => {
              const isSelected = selectedExercises.some((selectedExercise) => selectedExercise.id === exercise.id);
              return (
                <Chip key={exercise.id ?? exercise.name} compact selected={isSelected} onPress={() => onToggleExercise(exercise)} style={styles.chip} testID={`video-analysis-exercise-chip-${exercise.id ?? exercise.name}`}>
                  {exercise.name}
                </Chip>
              );
            })}
          </View>

          <Text variant="labelSmall" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
            VL%
          </Text>
          <View style={styles.chipsRow}>
            {VL_PRESETS.map((preset) => (
              <Chip key={preset} compact selected={selectedVlPresets.includes(preset)} onPress={() => onToggleVlPreset(preset)} style={styles.chip} testID={`video-analysis-vl-chip-${preset}`}>
                {preset}
              </Chip>
            ))}
          </View>

          <Text variant="labelSmall" style={[styles.sectionLabel, {color: theme.colors.onSurfaceVariant}]}>
            RIR
          </Text>
          <View style={styles.chipsRow}>
            {RIR_PRESETS.map((preset) => (
              <Chip key={preset} compact selected={selectedRirPresets.includes(preset)} onPress={() => onToggleRirPreset(preset)} style={styles.chip} testID={`video-analysis-rir-chip-${preset}`}>
                {preset}
              </Chip>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerLabel: {
    fontWeight: '700',
  },
  summary: {
    marginTop: 1,
  },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  sectionLabel: {
    marginTop: 4,
    marginBottom: 8,
    fontWeight: '700',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    marginBottom: 8,
  },
});

export default memo(VideoAnalysisFiltersSection);
