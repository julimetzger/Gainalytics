import {Text, useTheme} from 'react-native-paper';
import React, {useEffect, useState} from 'react';
import {Platform, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {TrainingsState} from '../../models/TrainingsState';

interface headerProps {
  trainingsPlanName: string;
  mesoName?: string;
  trainingName: string;
  micro?: number;
  localMicro?: number;
  trainingState?: string;
  trainingStart?: string;
  drawerMenu: React.ReactNode;
  overflowButton: React.ReactNode;
}

const formatElapsed = (startIso: string): string => {
  const elapsed = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
};

const TrainingsPlanHeader = ({trainingsPlanName, mesoName, trainingName, micro, localMicro, trainingState, trainingStart, drawerMenu, overflowButton}: headerProps) => {
  let theme = useTheme();
  const safe = useSafeAreaInsets();
  const isActive = trainingState === TrainingsState.STARTED;

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
        <View style={{flexDirection: 'column'}}>
          <Text
            testID="header-plan-meso-name"
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
              style={{
                fontSize: 20,
                color: theme.colors.onSecondaryContainer,
              }}
            >
              {localMicro !== undefined ? `Micro ${localMicro}` : ''}
            </Text>
            <Text
              style={{
                fontSize: 20,
                color: theme.colors.onSecondaryContainer,
              }}
            >
              {localMicro !== undefined ? ' ' + trainingName : trainingName}
            </Text>
          </View>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 2}}>
          {isActive && trainingStart && (
            <>
              <View
                testID="header-live-dot"
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.colors.primary,
                  marginRight: 4,
                }}
              />
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
            </>
          )}
          <View testID="header-overflow-button">{overflowButton}</View>
        </View>
      </View>
    </View>
  );
};

export default TrainingsPlanHeader;
