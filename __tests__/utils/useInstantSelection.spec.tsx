import React, {useState} from 'react';
import {Pressable, Text, View} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import {useInstantSelection} from '../../app/utils/useInstantSelection';

/** A control that owns nothing; the value lives in the screen above it, like every bar in the training tab. */
const Bar = ({value, onChange}: {value: string; onChange: (next: string) => void}) => {
  const [shown, select] = useInstantSelection(value, onChange);
  return (
    <View>
      <Text testID="shown">{shown}</Text>
      {['a', 'b'].map((v) => (
        <Pressable key={v} testID={`pick-${v}`} onPress={() => select(v)} />
      ))}
    </View>
  );
};

describe('useInstantSelection', () => {
  it('shows the tapped value and reports it to the owner', () => {
    const Screen = () => {
      const [value, setValue] = useState('a');
      return <Bar value={value} onChange={setValue} />;
    };
    const {getByTestId} = render(<Screen />);
    expect(getByTestId('shown').props.children).toBe('a');
    fireEvent.press(getByTestId('pick-b'));
    expect(getByTestId('shown').props.children).toBe('b');
  });

  it('does not re-render the slow content when only the control is updated first', () => {
    let slowRenders = 0;
    const Slow = ({value}: {value: string}) => {
      slowRenders++;
      return <Text testID="slow">{value}</Text>;
    };
    const Screen = () => {
      const [value, setValue] = useState('a');
      return (
        <View>
          <Bar value={value} onChange={setValue} />
          <Slow value={value} />
        </View>
      );
    };
    const {getByTestId} = render(<Screen />);
    const before = slowRenders;
    fireEvent.press(getByTestId('pick-b'));
    // the content is updated once, for the new value — never for an intermediate one
    expect(getByTestId('slow').props.children).toBe('b');
    expect(slowRenders - before).toBe(1);
  });

  it('falls back to the owner value when the owner does not take the selection', () => {
    const {getByTestId} = render(<Bar value="a" onChange={jest.fn()} />);
    fireEvent.press(getByTestId('pick-b'));
    act(() => {});
    expect(getByTestId('shown').props.children).toBe('a');
  });

  it('follows a change of the owner value that did not come from a tap', () => {
    const {getByTestId, rerender} = render(<Bar value="a" onChange={jest.fn()} />);
    rerender(<Bar value="b" onChange={jest.fn()} />);
    expect(getByTestId('shown').props.children).toBe('b');
  });
});
