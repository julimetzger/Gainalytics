import React from 'react';
import {View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

interface SparklineProps {
  values: number[];
  width: number;
  height: number;
  color: string;
  strokeWidth?: number;
}

const Sparkline = ({values, width, height, color, strokeWidth = 1.5}: SparklineProps) => {
  if (values.length < 2) {
    return <View style={{width, height}} />;
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
  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={strokeWidth} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

export default Sparkline;
