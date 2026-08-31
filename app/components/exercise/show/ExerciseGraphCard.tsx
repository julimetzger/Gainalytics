import React from 'react';
import {processColor, StyleSheet} from 'react-native';
import {LineChart, LineValue} from 'react-native-charts-wrapper';
import {Card, Text, useTheme} from 'react-native-paper';
import {generateTrend} from '../../../utils/generateTrend';

interface Props {
  title: string;
  subtitle?: string;
  points: LineValue[];
  caption?: string;
  cardTestID: string;
  captionTestID?: string;
  /** Frequency is a count — keep the y axis on whole numbers starting at zero. */
  integerYAxis?: boolean;
}

const ExerciseGraphCard = ({title, subtitle, points, caption, cardTestID, captionTestID, integerYAxis}: Props) => {
  const theme = useTheme();
  const yAxisConfig = {
    textColor: processColor(theme.colors.onBackground),
    ...(integerYAxis ? {granularity: 1, granularityEnabled: true, axisMinimum: 0} : {}),
  };

  return (
    <Card style={styles.chartCard}>
      <Card.Title title={title} subtitle={subtitle} testID={cardTestID} />
      <Card.Content>
        {points.length === 0 ? (
          <Text style={styles.emptyText}>No data in this range.</Text>
        ) : (
          <>
            <LineChart
              style={[styles.chart, {backgroundColor: theme.colors.background}]}
              marker={{
                enabled: true,
                markerColor: processColor(theme.colors.backdrop),
                textSize: 13,
                textColor: processColor(theme.colors.secondary),
              }}
              data={{
                dataSets: [
                  {
                    config: {
                      color: processColor(theme.colors.primary),
                      circleColor: processColor(theme.colors.primary),
                      highlightEnabled: true,
                      lineWidth: 2,
                      drawCircleHole: false,
                      highlightColor: processColor(theme.colors.secondary),
                      circleRadius: 3,
                      mode: 'HORIZONTAL_BEZIER',
                      drawValues: false,
                    },
                    values: points,
                  },
                  {
                    config: {
                      color: processColor(theme.colors.tertiary),
                      drawCircles: false,
                      lineWidth: 1,
                      dashedLine: {lineLength: 12, spaceLength: 8},
                      mode: 'LINEAR',
                      drawValues: false,
                    },
                    values: generateTrend(points),
                  },
                ],
              }}
              legend={{enabled: false}}
              xAxis={{
                valueFormatter: 'date',
                valueFormatterPattern: 'dd MMM',
                position: 'BOTTOM',
                textColor: processColor(theme.colors.onBackground),
              }}
              yAxis={{
                left: yAxisConfig,
                right: yAxisConfig,
              }}
              chartDescription={{text: ''}}
            />
            {caption !== undefined && (
              <Text style={[styles.caption, {color: theme.colors.onSurfaceVariant}]} testID={captionTestID}>
                {caption}
              </Text>
            )}
          </>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  chartCard: {
    marginHorizontal: 8,
    marginBottom: 12,
  },
  chart: {
    height: 220,
  },
  emptyText: {
    fontStyle: 'italic',
    paddingVertical: 12,
    textAlign: 'center',
  },
  caption: {
    paddingTop: 8,
    textAlign: 'center',
  },
});

export default ExerciseGraphCard;
