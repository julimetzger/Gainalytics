import {Text, useTheme} from 'react-native-paper';
import React, {useEffect, useState} from 'react';
import {Platform, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TrainingsState} from '../../models/TrainingsState';
import {PlanMode} from './plan/planTypes';
import {formatTimeRange, formatTrainingDate} from '../../utils/overview-comparison';

interface headerProps {
  trainingsPlanName: string;
  mesoName?: string;
  trainingName: string;
  micro?: number;
  localMicro?: number;
  trainingState?: string;
  trainingStart?: string | number;
  trainingEnd?: string | number;
  drawerMenu: React.ReactNode;
  overflowButton: React.ReactNode;
  planMode?: PlanMode;
  /** GH-526: the span of the micro's trainings (`06/10 – 12/10/2026`), shown right of the Overview title. */
  dateRange?: string;
}

const formatElapsed = (startIso: string | number): string => {
  const elapsed = Math.floor((Date.now() - new Date(startIso as any).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const TrainingsPlanHeader = ({trainingsPlanName, mesoName, trainingName, micro, localMicro, trainingState, trainingStart, trainingEnd, drawerMenu, overflowButton, planMode = 'read', dateRange}: headerProps) => {
  let theme = useTheme();
  const safe = useSafeAreaInsets();
  const isActive = trainingState === TrainingsState.STARTED;
  const fullEditMode = planMode === 'fullEdit';
  const dateStyle = {fontSize: 12, color: theme.colors.onSurfaceVariant, fontVariant: ['tabular-nums' as const]};

  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  return (
    //TODO 56 dp does only work for android chatgpt says it should be 44 for ios
    <View
      style={{
        marginTop: safe.top,
        marginRight: safe.right,
        marginLeft: safe.left,
        height: Platform.OS === 'android' ? 56 : 44,
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: theme.colors.background,
      }}
    >
      {drawerMenu}
      <View style={{flex: 1, justifyContent: 'space-between', alignItems: 'center', flexDirection: 'row'}}>
        <View style={{flexDirection: 'column', flex: 1, flexShrink: 1, minWidth: 0, marginRight: 8}}>
          {fullEditMode && (
            <Text
              testID="header-plan-editing-kicker"
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: theme.colors.primary,
                marginBottom: 2,
              }}
            >
              EDITING PLAN
            </Text>
          )}
          <Text
            testID="header-plan-meso-name"
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              fontSize: theme.fonts.titleMedium.fontSize,
              fontWeight: 'bold',
              color: theme.colors.onSecondaryContainer,
            }}
          >
            {trainingsPlanName}{mesoName ? ` › ${mesoName}` : ''}
          </Text>
          <View style={{display: 'flex', flexDirection: 'row', alignItems: 'baseline'}}>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontSize: 20,
                color: theme.colors.onSecondaryContainer,
              }}
            >
              {localMicro !== undefined ? `Micro ${localMicro}` : ''}
            </Text>
            <Text
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{
                fontSize: 20,
                color: theme.colors.onSecondaryContainer,
                flexShrink: 1,
              }}
            >
              {localMicro !== undefined ? ' ' + trainingName : trainingName}
            </Text>
            {dateRange !== undefined && (
              <Text testID="header-date-range" numberOfLines={1} style={[dateStyle, {flex: 1, textAlign: 'right', marginLeft: 8}]}>
                {dateRange}
              </Text>
            )}
          </View>
        </View>
        {/* GH-526: the date sits right of the title — the day plus the time span of a
            finished training, the live timer of a running one, "Planned" before it starts. */}
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0}}>
          {trainingState === TrainingsState.PLANNED && !fullEditMode && (
            <View testID="header-date-timer-stack" style={{flexDirection: 'column', alignItems: 'flex-end'}}>
              {trainingStart !== undefined && (
                <Text testID="header-date" style={dateStyle}>
                  {formatTrainingDate(trainingStart)}
                </Text>
              )}
              {/* GH-418: in the edit mode only "EDITING PLAN" and Done — the read view's
                  "Planned" label next to Done made it look like a mix of both modes. */}
              <Text testID="header-plan-label" style={dateStyle}>
                Planned
              </Text>
            </View>
          )}
          {trainingState === TrainingsState.STARTED && trainingStart && (
            <View testID="header-date-timer-stack" style={{flexDirection: 'column', alignItems: 'flex-end'}}>
              <Text testID="header-date" style={dateStyle}>
                {formatTrainingDate(trainingStart)}
              </Text>
              <Text testID="header-session-timer" style={[dateStyle, {fontWeight: 'bold', color: theme.colors.onSecondaryContainer}]}>
                {formatElapsed(trainingStart)}
              </Text>
            </View>
          )}
          {trainingState === TrainingsState.FINISHED && trainingStart && (
            <View testID="header-date-timer-stack" style={{flexDirection: 'column', alignItems: 'flex-end'}}>
              <Text testID="header-date" style={dateStyle}>
                {formatTrainingDate(trainingStart)}
              </Text>
              {trainingEnd && (
                <Text testID="header-session-timer" style={dateStyle}>
                  {formatTimeRange(trainingStart, trainingEnd)}
                </Text>
              )}
            </View>
          )}
          <View testID="header-overflow-button">{overflowButton}</View>
        </View>
      </View>
    </View>
  );
};

export default TrainingsPlanHeader;
