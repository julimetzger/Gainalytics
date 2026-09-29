import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {TrainingsState} from '../../models/TrainingsState';
import TrainingModeTabs, {SubTab} from './TrainingModeTabs';

interface MicroPanePlaceholderProps {
  /** e.g. "Push squat" */
  trainingName: string;
  /** e.g. "Meso 1" — undefined when the plan has no meso for this micro. */
  mesoName?: string;
  localMicro?: number;
  trainingState?: string;
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
  showTabs: boolean;
  /**
   * Which side of the active pane this one waits on: the title hugs the edge that comes into view first, so it is
   * readable from the first pixels of a swipe. Centered when unknown.
   */
  side?: 'left' | 'right';
}

const STATE_LABEL: {[state: string]: string} = {
  [TrainingsState.PLANNED]: 'Planned',
  [TrainingsState.STARTED]: 'Running',
  [TrainingsState.FINISHED]: 'Finished',
};

/**
 * PERF-003: stand-in for the full micro content in a swiper pane the user is not on.
 * It names the micro that is coming (title, meso, state) and keeps the sub-tab bar in
 * place, so the swipe shows *which* micro arrives — the content itself is mounted only
 * once the pane has snapped in. That keeps one micro's worth of views in memory instead
 * of three and keeps the swipe itself free of layout work.
 */
const MicroPanePlaceholder = ({trainingName, mesoName, localMicro, trainingState, activeTab, onTabChange, showTabs, side}: MicroPanePlaceholderProps) => {
  const theme = useTheme();
  const stateLabel = trainingState !== undefined ? STATE_LABEL[trainingState] : undefined;
  return (
    <View style={styles.container} testID="micro-pane-placeholder">
      {showTabs && <TrainingModeTabs activeTab={activeTab} onTabChange={onTabChange} />}
      <View testID="micro-pane-placeholder-body" style={[styles.body, side === 'left' && styles.bodyLeft, side === 'right' && styles.bodyRight]}>
        {mesoName !== undefined && (
          <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant}}>
            {mesoName}
          </Text>
        )}
        {localMicro !== undefined && (
          <Text testID="micro-pane-placeholder-micro" variant="headlineMedium" style={{color: theme.colors.onSurface}}>
            {`Micro ${localMicro}`}
          </Text>
        )}
        <Text testID="micro-pane-placeholder-title" variant="headlineSmall" style={{color: theme.colors.onSurface}}>
          {trainingName}
        </Text>
        {stateLabel !== undefined && (
          <Text variant="bodyMedium" style={{color: theme.colors.onSurfaceVariant}}>
            {stateLabel}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  body: {padding: 24, gap: 4, alignItems: 'center'},
  // the pane on the left is entered from its right edge, the one on the right from its left edge
  bodyLeft: {alignItems: 'flex-end'},
  bodyRight: {alignItems: 'flex-start'},
});

export default MicroPanePlaceholder;
