import React from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

interface SparklineProps {
  values: number[];
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
  testID?: string;
}

const Sparkline = ({values, width, height, color, strokeWidth = 1.5, testID}: SparklineProps) => {
  if (values.length < 2) {
    return <View style={{width, height}} testID={testID} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = height - ((v - min) / range) * height;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  const d = `M${points.join(' L')}`;
  // The plotted values double as the accessibility label, so screen readers
  // (and e2e flows) can read the trend the line draws.
  return (
    <View testID={testID} accessible accessibilityLabel={`Trend ${values.map((v) => v.toFixed(0)).join(', ')}`}>
      <Svg width={width} height={height}>
        <Path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
};

export default Sparkline;
