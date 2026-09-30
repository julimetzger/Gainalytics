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
}

const STATE_LABEL: {[state: string]: string} = {
  [TrainingsState.PLANNED]: 'Planned',
  [TrainingsState.STARTED]: 'Running',
  [TrainingsState.FINISHED]: 'Finished',
};

interface TitleBlockProps {
  trainingName: string;
  mesoName?: string;
  localMicro?: number;
  stateLabel?: string;
  align: 'flex-start' | 'flex-end';
  mirror?: boolean;
}

const TitleBlock = ({trainingName, mesoName, localMicro, stateLabel, align, mirror = false}: TitleBlockProps) => {
  const theme = useTheme();
  const suffix = mirror ? '-mirror' : '';
  const textAlign = align === 'flex-end' ? 'right' : 'left';
  return (
    <View style={[styles.block, mirror ? styles.fill : styles.half, {alignItems: align}]}>
      {mesoName !== undefined && (
        <Text variant="labelMedium" style={{color: theme.colors.onSurfaceVariant, textAlign}}>
          {mesoName}
        </Text>
      )}
      {localMicro !== undefined && (
        <Text testID={`micro-pane-placeholder-micro${suffix}`} variant="headlineMedium" style={{color: theme.colors.onSurface, textAlign}}>
          {`Micro ${localMicro}`}
        </Text>
      )}
      <Text testID={`micro-pane-placeholder-title${suffix}`} variant="headlineSmall" style={{color: theme.colors.onSurface, textAlign}}>
        {trainingName}
      </Text>
      {stateLabel !== undefined && (
        <Text variant="bodyMedium" style={{color: theme.colors.onSurfaceVariant, textAlign}}>
          {stateLabel}
        </Text>
      )}
    </View>
  );
};

const Bar = ({width, height = 14, testID}: {width: number | `${number}%`; height?: number; testID?: string}) => {
  const theme = useTheme();
  return <View testID={testID} style={{width, height, borderRadius: 6, backgroundColor: theme.colors.onSurfaceVariant, opacity: 0.12}} />;
};

const Block = ({height, testID}: {height: number; testID?: string}) => {
  const theme = useTheme();
  return <View testID={testID} style={[styles.skeletonBlock, {height, backgroundColor: theme.colors.onSurfaceVariant}]} />;
};

/**
 * GH-467: grey blocks in the layout of the tab the pane will open on — exercise cards for Plan, an exercise
 * strip with set rows for Train, a data toggle with metric cards for Analysis — so the content arriving
 * does not change the page structure. Static on purpose: no animation work during a swipe.
 */
const SkeletonBody = ({activeTab}: {activeTab: SubTab}) => (
  <View testID={`micro-pane-skeleton-${activeTab}`} style={styles.skeleton} pointerEvents="none">
    {activeTab === 'plan' && (
      <>
        <Block height={56} />
        <Block height={56} />
        <Block height={56} />
        <Block height={56} />
      </>
    )}
    {activeTab === 'train' && (
      <>
        <View style={styles.row}>
          <Bar width={84} height={32} />
          <Bar width={84} height={32} />
          <Bar width={84} height={32} />
        </View>
        <Block height={72} />
        <Block height={48} />
        <Block height={48} />
        <Block height={48} />
      </>
    )}
    {activeTab === 'analysis' && (
      <>
        <Bar width="100%" height={40} />
        <Block height={120} />
        <Block height={160} />
        <Block height={88} />
      </>
    )}
  </View>
);

/**
 * PERF-003: stand-in for the full micro content in a swiper pane the user is not on.
 * It names the micro that is coming (title, meso, state) and keeps the sub-tab bar in
 * place, so the swipe shows *which* micro arrives — the content itself is mounted only
 * once the pane has snapped in. That keeps one micro's worth of views in memory instead
 * of three and keeps the swipe itself free of layout work.
 */
const MicroPanePlaceholder = ({trainingName, mesoName, localMicro, trainingState, activeTab, onTabChange, showTabs}: MicroPanePlaceholderProps) => {
  const stateLabel = trainingState !== undefined ? STATE_LABEL[trainingState] : undefined;
  return (
    <View style={styles.container} testID="micro-pane-placeholder">
      {showTabs && <TrainingModeTabs activeTab={activeTab} onTabChange={onTabChange} />}
      {/* The title is there twice — hugging the left edge and the right edge of the pane. A neighbour pane enters
          from one side or the other, so one of the two is readable from the first pixels of a swipe. The copy is
          hidden from accessibility and from touches. */}
      <View testID="micro-pane-placeholder-body" style={styles.body}>
        <TitleBlock align="flex-start" {...{trainingName, mesoName, localMicro, stateLabel}} />
        <View style={styles.mirror} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <TitleBlock align="flex-end" mirror {...{trainingName, mesoName, localMicro, stateLabel}} />
        </View>
      </View>
      <SkeletonBody activeTab={activeTab} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1},
  skeleton: {paddingHorizontal: 16, gap: 12},
  skeletonBlock: {width: '100%', borderRadius: 12, opacity: 0.12},
  row: {flexDirection: 'row', gap: 8},
  body: {padding: 24, flexDirection: 'row', justifyContent: 'space-between'},
  // explicit widths: with only a maxWidth the two copies squeezed each other to a few characters per line
  block: {gap: 4},
  half: {width: '46%'},
  fill: {width: '100%'},
  mirror: {width: '46%'},
});

export default MicroPanePlaceholder;
