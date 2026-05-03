import React from 'react';
import {render} from '@testing-library/react-native';
import RestProgressRing from '../../../../app/components/Training/execute/RestProgressRing';

jest.mock('react-native-paper', () => {
  const {Text} = require('react-native');
  return {
    Text: ({children, style, testID}: any) => <Text testID={testID} style={style}>{children}</Text>,
  };
});

let lastArcProps: any = null;
let lastTrackProps: any = null;
jest.mock('react-native-svg', () => {
  const {View} = require('react-native');
  return {
    __esModule: true,
    default: ({children, testID}: any) => <View testID={testID}>{children}</View>,
    Svg: ({children, testID}: any) => <View testID={testID}>{children}</View>,
    Circle: (props: any) => {
      if (props.testID === 'rest-progress-arc') lastArcProps = props;
      if (props.testID === 'rest-progress-track') lastTrackProps = props;
      const {View} = require('react-native');
      return <View testID={props.testID} />;
    },
  };
});

const defaultProps = {
  size: 44,
  strokeWidth: 3,
  primaryColor: '#0066ff',
  errorColor: '#ff0000',
  trackColor: '#666',
  textColor: '#000',
};

const radius = (44 - 3) / 2;
const circumference = 2 * Math.PI * radius;

describe('RestProgressRing', () => {
  beforeEach(() => {
    lastArcProps = null;
    lastTrackProps = null;
  });

  it('full primary arc when timer just started (elapsed = 0)', () => {
    render(
      <RestProgressRing
        {...defaultProps}
        targetSeconds={90}
        elapsedSeconds={0}
        isOverrun={false}
        display="01:30"
      />,
    );
    expect(lastArcProps).not.toBeNull();
    expect(lastArcProps.stroke).toBe('#0066ff');
    expect(lastArcProps.strokeDashoffset).toBeCloseTo(0, 5);
  });

  it('half arc remains when half of target time has elapsed', () => {
    render(
      <RestProgressRing
        {...defaultProps}
        targetSeconds={90}
        elapsedSeconds={45}
        isOverrun={false}
        display="00:45"
      />,
    );
    expect(lastArcProps.stroke).toBe('#0066ff');
    expect(lastArcProps.strokeDashoffset).toBeCloseTo(circumference / 2, 5);
  });

  it('full ring in error tint when overrun', () => {
    render(
      <RestProgressRing
        {...defaultProps}
        targetSeconds={90}
        elapsedSeconds={120}
        isOverrun={true}
        display="+00:30"
      />,
    );
    expect(lastArcProps.stroke).toBe('#ff0000');
    expect(lastArcProps.strokeDashoffset).toBe(0);
  });

  it('renders the timer display text on top of the ring', () => {
    const {getByText} = render(
      <RestProgressRing
        {...defaultProps}
        targetSeconds={90}
        elapsedSeconds={0}
        isOverrun={false}
        display="01:30"
      />,
    );
    expect(getByText('01:30')).toBeTruthy();
  });
});
