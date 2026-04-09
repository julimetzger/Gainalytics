import React from 'react';
import {View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';
import {hasRirDiscrepancy} from '../../utils/velocityLossRir';

export interface MicroVLDataPoint {
  micro: number;
  vlPercent: number;
}

interface Props {
  exerciseName: string;
  heaviestWeightKg: number;
  currentVlPercent: number;
  vlRirEstimate: string;
  reportedRir: number;
  microHistory: MicroVLDataPoint[];
  currentMicro: number;
}

const SPARKLINE_HEIGHT = 32;
const SPARKLINE_BAR_WIDTH = 8;
const SPARKLINE_BAR_GAP = 3;
const MAX_VL_FOR_SCALE = 60; // cap at 60% for visual scaling

const VlSparkline = ({data, currentMicro}: {data: MicroVLDataPoint[]; currentMicro: number}) => {
  const theme = useTheme();
  if (data.length === 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        height: SPARKLINE_HEIGHT,
        gap: SPARKLINE_BAR_GAP,
        marginTop: 6,
      }}
      accessibilityLabel="VL% history sparkline"
    >
      {data.map((point) => {
        const heightRatio = Math.min(point.vlPercent / MAX_VL_FOR_SCALE, 1);
        const barHeight = Math.max(2, Math.round(heightRatio * SPARKLINE_HEIGHT));
        const isCurrent = point.micro === currentMicro;
        return (
          <View key={point.micro} style={{alignItems: 'center', gap: 2}}>
            <View
              style={{
                width: SPARKLINE_BAR_WIDTH,
                height: barHeight,
                backgroundColor: isCurrent ? theme.colors.primary : theme.colors.secondary,
                borderRadius: 2,
                opacity: isCurrent ? 1 : 0.55,
              }}
            />
            <Text variant="labelSmall" style={{fontSize: 8, lineHeight: 10}}>
              {point.micro}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const VelocityLossInsightCard = ({exerciseName, heaviestWeightKg, currentVlPercent, vlRirEstimate, reportedRir, microHistory, currentMicro}: Props) => {
  const theme = useTheme();
  const discrepancy = hasRirDiscrepancy(reportedRir, currentVlPercent);

  return (
    <Card
      style={{marginHorizontal: 8, marginBottom: 8}}
      contentStyle={{paddingBottom: 12}}
      testID={`vl-insight-card-${exerciseName}`}
    >
      <Card.Content>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
          <View style={{flex: 1, marginRight: 8}}>
            <Text variant="titleSmall" numberOfLines={1} ellipsizeMode="tail">
              {exerciseName}
            </Text>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              {heaviestWeightKg} kg
            </Text>
          </View>
          <View style={{alignItems: 'flex-end'}}>
            <Text variant="titleMedium" style={{color: theme.colors.primary}} testID="vl-percent">
              {currentVlPercent}% VL
            </Text>
            <Text variant="bodySmall" testID="vl-rir-estimate">
              RIR {vlRirEstimate}
            </Text>
          </View>
        </View>

        {discrepancy && (
          <View
            style={{
              marginTop: 6,
              paddingHorizontal: 6,
              paddingVertical: 3,
              backgroundColor: theme.colors.errorContainer,
              borderRadius: 4,
              flexDirection: 'row',
              alignItems: 'center',
            }}
            testID="rir-discrepancy-flag"
          >
            <Text variant="labelSmall" style={{color: theme.colors.onErrorContainer}}>
              RIR mismatch: reported {reportedRir} vs VL estimate {vlRirEstimate}
            </Text>
          </View>
        )}

        <VlSparkline data={microHistory} currentMicro={currentMicro} />
      </Card.Content>
    </Card>
  );
};

export default VelocityLossInsightCard;
