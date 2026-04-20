import React from 'react';
import {fireEvent, render, act} from '@testing-library/react-native';
import MusclePicker from '../../../../app/components/exercise/add/MusclePicker';
import {Muscles} from '../../../../app/models/Muscles';
import {MusclePercentPair} from '../../../../app/models/entities/Exercise';

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput, TouchableOpacity, View} = require('react-native');

  const Accordion = ({
    title,
    description,
    expanded,
    onPress,
    children,
    testID,
  }: {
    title: string;
    description?: string;
    expanded?: boolean;
    onPress?: () => void;
    children?: React.ReactNode;
    testID?: string;
  }) => (
    <View>
      <TouchableOpacity testID={testID ?? `accordion-${title}`} onPress={onPress}>
        <Text>{title}</Text>
        {description ? <Text testID={`desc-${testID ?? title}`}>{description}</Text> : null}
      </TouchableOpacity>
      {expanded ? <View testID={`expanded-${testID ?? title}`}>{children}</View> : null}
    </View>
  );

  const Icon = () => null;

  return {
    List: {
      Accordion,
      Icon,
      Item: ({title, onPress, testID}: {title: string; onPress?: () => void; testID?: string}) => (
        <TouchableOpacity testID={testID ?? `item-${title}`} onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    },
    Text: ({children, testID}: {children?: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    TextInput: ({
      value,
      onChangeText,
      testID,
    }: {
      value?: string;
      onChangeText?: (v: string) => void;
      testID?: string;
      [k: string]: unknown;
    }) => <TextInput testID={testID} value={value} onChangeText={onChangeText} />,
    useTheme: () => ({colors: {primary: '#000'}}),
  };
});

describe('MusclePicker', () => {
  it('outer accordion starts closed when no muscles assigned', () => {
    const onChange = jest.fn();
    const {queryByTestId} = render(<MusclePicker muscles={[]} onChange={onChange} />);
    expect(queryByTestId('expanded-muscles-outer-accordion')).toBeNull();
  });

  it('outer accordion starts open when muscles with percent > 0 are present', () => {
    const onChange = jest.fn();
    const muscles: MusclePercentPair[] = [{muscle: Muscles.CHEST, percent: 60}];
    const {getByTestId} = render(<MusclePicker muscles={muscles} onChange={onChange} />);
    expect(getByTestId('expanded-muscles-outer-accordion')).toBeTruthy();
  });

  it('toggles outer accordion on press', () => {
    const onChange = jest.fn();
    const {getByTestId, queryByTestId} = render(<MusclePicker muscles={[]} onChange={onChange} />);
    expect(queryByTestId('expanded-muscles-outer-accordion')).toBeNull();

    fireEvent.press(getByTestId('muscles-outer-accordion'));
    expect(getByTestId('expanded-muscles-outer-accordion')).toBeTruthy();

    fireEvent.press(getByTestId('muscles-outer-accordion'));
    expect(queryByTestId('expanded-muscles-outer-accordion')).toBeNull();
  });

  it('shows collapsed summary with count and total percent', () => {
    const onChange = jest.fn();
    const muscles: MusclePercentPair[] = [
      {muscle: Muscles.CHEST, percent: 60},
      {muscle: Muscles.BACK, percent: 40},
    ];
    const {getByTestId} = render(<MusclePicker muscles={muscles} onChange={onChange} />);
    // outer accordion starts open (muscles have percent > 0), close it to see summary
    fireEvent.press(getByTestId('muscles-outer-accordion'));
    const desc = getByTestId('desc-muscles-outer-accordion');
    expect(desc.props.children).toBe('2 muscles assigned · 100%');
  });

  it('muscles with percent > 0 are auto-expanded when outer opens', () => {
    const onChange = jest.fn();
    const muscles: MusclePercentPair[] = [{muscle: Muscles.CHEST, percent: 70}];
    const {getByTestId} = render(<MusclePicker muscles={muscles} onChange={onChange} />);
    // outer is already open, CHEST row should be expanded
    expect(getByTestId(`expanded-muscle-row-${Muscles.CHEST}`)).toBeTruthy();
  });

  it('tap on muscle row expands and collapses it', () => {
    const onChange = jest.fn();
    const {getByTestId, queryByTestId} = render(<MusclePicker muscles={[]} onChange={onChange} />);
    fireEvent.press(getByTestId('muscles-outer-accordion'));

    const backRow = getByTestId(`muscle-row-${Muscles.BACK}`);
    expect(queryByTestId(`expanded-muscle-row-${Muscles.BACK}`)).toBeNull();

    fireEvent.press(backRow);
    expect(getByTestId(`expanded-muscle-row-${Muscles.BACK}`)).toBeTruthy();

    fireEvent.press(backRow);
    expect(queryByTestId(`expanded-muscle-row-${Muscles.BACK}`)).toBeNull();
  });

  it('entering a percent > 0 adds the muscle to the array', () => {
    const onChange = jest.fn();
    const {getByTestId} = render(<MusclePicker muscles={[]} onChange={onChange} />);
    fireEvent.press(getByTestId('muscles-outer-accordion'));
    fireEvent.press(getByTestId(`muscle-row-${Muscles.CHEST}`));

    act(() => {
      fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), '80');
    });

    expect(onChange).toHaveBeenCalledWith([{muscle: Muscles.CHEST, percent: 80}]);
  });

  it('entering 0 or empty removes the muscle from the array', () => {
    const onChange = jest.fn();
    const muscles: MusclePercentPair[] = [{muscle: Muscles.CHEST, percent: 60}];
    const {getByTestId} = render(<MusclePicker muscles={muscles} onChange={onChange} />);

    act(() => {
      fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), '');
    });
    expect(onChange).toHaveBeenCalledWith([]);

    onChange.mockClear();
    act(() => {
      fireEvent.changeText(getByTestId(`muscle-input-${Muscles.CHEST}`), '0');
    });
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('save with mixed muscles only keeps those with percent > 0', () => {
    const onChange = jest.fn();
    const muscles: MusclePercentPair[] = [
      {muscle: Muscles.CHEST, percent: 60},
      {muscle: Muscles.BACK, percent: 40},
    ];
    const {getByTestId} = render(<MusclePicker muscles={muscles} onChange={onChange} />);

    act(() => {
      fireEvent.changeText(getByTestId(`muscle-input-${Muscles.BACK}`), '');
    });

    const result: MusclePercentPair[] = onChange.mock.calls[0][0];
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({muscle: Muscles.CHEST, percent: 60});
  });

  it('shows total percent display', () => {
    const onChange = jest.fn();
    const muscles: MusclePercentPair[] = [
      {muscle: Muscles.CHEST, percent: 60},
      {muscle: Muscles.BACK, percent: 50},
    ];
    // outer accordion starts open because muscles have percent > 0
    const {getByTestId} = render(<MusclePicker muscles={muscles} onChange={onChange} />);
    const total = getByTestId('muscles-total');
    expect(total.props.children).toEqual(['Total: ', 110, '%']);
  });

  it('shows all muscles from enum in the list', () => {
    const {getByTestId, queryByTestId} = render(<MusclePicker muscles={[]} onChange={jest.fn()} />);
    fireEvent.press(getByTestId('muscles-outer-accordion'));
    const allMuscles = Object.values(Muscles);
    for (const muscle of allMuscles) {
      expect(queryByTestId(`muscle-row-${muscle}`)).not.toBeNull();
    }
  });
});
