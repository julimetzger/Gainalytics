import React from 'react';
import {SegmentedButtons} from 'react-native-paper';
import {useInstantSelection} from '../../utils/useInstantSelection';

type SegmentedButtonsProps = React.ComponentProps<typeof SegmentedButtons>;

type InstantSegmentedButtonsProps = Omit<SegmentedButtonsProps, 'value' | 'onValueChange' | 'multiSelect'> & {
  value: string;
  onValueChange: (value: string) => void;
};

/**
 * Paper's SegmentedButtons whose tapped segment is marked selected immediately
 * (PERF-003, see {@link useInstantSelection}); the content the segment controls follows
 * in a transition. Single-select only.
 */
const InstantSegmentedButtons = ({value, onValueChange, ...rest}: InstantSegmentedButtonsProps) => {
  const [shown, select] = useInstantSelection(value, onValueChange);
  return <SegmentedButtons {...(rest as any)} value={shown} onValueChange={select} />;
};

export default InstantSegmentedButtons;
