import {Text, useTheme} from 'react-native-paper';
import React, {useEffect, useState} from 'react';
import {Platform, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TrainingsState} from '../../models/TrainingsState';
import {PlanMode} from './plan/planTypes';

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
}

const formatDate = (start: string | number): string => {
  return new Date(start as any).toLocaleDateString('en-GB', {weekday: 'short', day: 'numeric', month: 'short'});
};

const formatElapsed = (startIso: string | number): string => {
  const elapsed = Math.floor((Date.now() - new Date(startIso as any).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const formatDuration = (startIso: string | number, endIso: string | number): string => {
  const elapsed = Math.floor((new Date(endIso as any).getTime() - new Date(startIso as any).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const TrainingsPlanHeader = ({trainingsPlanName, mesoName, trainingName, micro, localMicro, trainingState, trainingStart, trainingEnd, drawerMenu, overflowButton, planMode = 'read'}: headerProps) => {
  let theme = useTheme();
  const safe = useSafeAreaInsets();
  const isActive = trainingState === TrainingsState.STARTED;
  const fullEditMode = planMode === 'fullEdit';

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
          <View style={{display: 'flex', flexDirection: 'row'}}>
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
          </View>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0}}>
          {trainingState === TrainingsState.PLANNED && (
            <Text
              testID="header-plan-label"
              style={{
                fontSize: theme.fonts.titleMedium.fontSize,
                color: theme.colors.onSecondaryContainer,
              }}
            >
              Plan
            </Text>
          )}
          {trainingState === TrainingsState.STARTED && trainingStart && (
            <View testID="header-date-timer-stack" style={{flexDirection: 'column', alignItems: 'flex-end'}}>
              <Text
                testID="header-date"
                style={{
                  fontSize: theme.fonts.titleMedium.fontSize,
                  color: theme.colors.onSecondaryContainer,
                }}
              >
                {formatDate(trainingStart)}
              </Text>
              <Text
                testID="header-session-timer"
                style={{
                  fontSize: theme.fonts.titleMedium.fontSize,
                  fontWeight: 'bold',
                  color: theme.colors.onSecondaryContainer,
                }}
              >
                {formatElapsed(trainingStart)}
              </Text>
            </View>
          )}
          {trainingState === TrainingsState.FINISHED && trainingStart && (
            <View testID="header-date-timer-stack" style={{flexDirection: 'column', alignItems: 'flex-end'}}>
              <Text
                testID="header-date"
                style={{
                  fontSize: theme.fonts.titleMedium.fontSize,
                  color: theme.colors.onSecondaryContainer,
                }}
              >
                {formatDate(trainingStart)}
              </Text>
              {trainingEnd && (
                <Text
                  testID="header-session-timer"
                  style={{
                    fontSize: theme.fonts.titleMedium.fontSize,
                    fontWeight: 'bold',
                    color: theme.colors.onSecondaryContainer,
                  }}
                >
                  {formatDuration(trainingStart, trainingEnd)}
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
