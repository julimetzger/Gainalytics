import React from 'react';
import {render} from '@testing-library/react-native';
import PlanEditList, {resolveSectionTargetIndex} from '../../../../app/components/Training/plan/PlanEditList';
import {Exercise} from '../../../../app/models/entities/Exercise';

// GH-324: exercise sections were rendered through a NestableDraggableFlatList
// nested inside the sections' own set lists — the library does not support
// nesting, and only the FIRST section ever mounted on device. Sections are now
// plain-mapped with a custom pan-gesture drag on the two-stripe handle. These
// tests pin the regression (every exercise renders a section) and the drop
// target math.

jest.mock('../../../../app/redux/Workout/use/useAllTimeOneRepMax', () => ({
  useAllTimeOneRepMax: () => 0,
}));

jest.mock('../../../../app/components/shared/DashedAddButton', () => {
  const React = require('react');
  const {Text, TouchableOpacity} = require('react-native');
  return ({onPress, testID, label}: {onPress?: () => void; testID?: string; label: string}) => (
    <TouchableOpacity testID={testID} onPress={onPress}>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput, TouchableOpacity, View} = require('react-native');
  return {
    Chip: ({children, testID}: {children: React.ReactNode; testID?: string}) => (
      <View testID={testID}>
        <Text>{children}</Text>
      </View>
    ),
    Icon: () => null,
    IconButton: ({onPress, testID}: {onPress?: () => void; testID?: string}) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>icon</Text>
      </TouchableOpacity>
    ),
    Menu: Object.assign(({children}: {children: React.ReactNode}) => <View>{children}</View>, {
      Item: ({title, onPress, testID}: {title?: string; onPress?: () => void; testID?: string}) => (
        <TouchableOpacity testID={testID} onPress={onPress}>
          <Text>{title}</Text>
        </TouchableOpacity>
      ),
    }),
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    TextInput: ({label, value, onChangeText, onBlur, testID}: {label?: string; value?: string; onChangeText?: (value: string) => void; onBlur?: () => void; testID?: string}) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} onBlur={onBlur} testID={testID} />
    ),
    ToggleButton: ({onPress, testID}: {onPress?: () => void; testID?: string}) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>toggle</Text>
      </TouchableOpacity>
    ),
    useTheme: () => ({
      colors: {
        elevation: {level3: '#222'},
        onSurfaceVariant: '#888',
        onSurfaceDisabled: '#555',
        primary: '#3f51b5',
        secondaryContainer: '#222',
        error: '#b00020',
        surfaceVariant: '#111',
        onSurface: '#fff',
      },
    }),
  };
});

jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const {View} = require('react-native');
  const ScaleDecorator = ({children}: {children: React.ReactNode}) => <>{children}</>;
  const Component = ({data, renderItem}: {data: Array<{key: string}>; renderItem: (params: any) => React.ReactNode}) => (
    <View>
      {data.map((item) => (
        <View key={item.key}>{renderItem({item, drag: () => undefined, isActive: false})}</View>
      ))}
    </View>
  );
  return {__esModule: true, default: Component, NestableDraggableFlatList: Component, ScaleDecorator, useNestableScrollContainerContext: () => undefined};
});

const exercises = [
  {id: 1, name: 'Bench press', alternativeIds: []},
  {id: 2, name: 'Bulgarian split squat', alternativeIds: []},
  {id: 3, name: 'Deadlift', alternativeIds: []},
] satisfies Exercise[];

const renderList = () =>
  render(
    <PlanEditList
      exercises={exercises}
      selectedExerciseId={1}
      plannedWorkoutsByExerciseId={{
        1: {id: 101, exerciseId: 1, sets: [{index: 1, reps: 5, rir: 0, weight: 100, date: new Date(0)}], notes: ''},
      }}
      pendingSetByExerciseId={{}}
      onSelectExercise={jest.fn()}
      onAddSet={jest.fn()}
      onPendingSetChange={jest.fn()}
      onPendingSetDelete={jest.fn()}
      onDeleteSet={jest.fn()}
      onUpsertSet={jest.fn()}
      onReorderSets={jest.fn()}
      onReorderExercises={jest.fn()}
      onRemoveExercise={jest.fn()}
    />,
  );

describe('PlanEditList — section rendering (GH-324 regression)', () => {
  it('renders one section per exercise, not just the first', () => {
    const {getByTestId} = renderList();
    expect(getByTestId('plan-edit-exercise-section-1')).toBeTruthy();
    expect(getByTestId('plan-edit-exercise-section-2')).toBeTruthy();
    expect(getByTestId('plan-edit-exercise-section-3')).toBeTruthy();
  });

  it('renders a two-stripe drag handle for every exercise section', () => {
    const {getByTestId} = renderList();
    expect(getByTestId('plan-exercise-drag-handle-1')).toBeTruthy();
    expect(getByTestId('plan-exercise-drag-handle-2')).toBeTruthy();
    expect(getByTestId('plan-exercise-drag-handle-3')).toBeTruthy();
  });
});

describe('resolveSectionTargetIndex — drop target math (GH-324)', () => {
  const heights = {0: 100, 1: 200, 2: 100};

  it('keeps the index for a small displacement', () => {
    expect(resolveSectionTargetIndex(0, 40, heights, 3)).toBe(0);
    expect(resolveSectionTargetIndex(2, -40, heights, 3)).toBe(2);
  });

  it('moves one slot down when dragged past half of the next section', () => {
    expect(resolveSectionTargetIndex(0, 110, heights, 3)).toBe(1);
  });

  it('moves one slot up when dragged past half of the previous section', () => {
    expect(resolveSectionTargetIndex(1, -60, heights, 3)).toBe(0);
  });

  it('moves multiple slots for a large displacement', () => {
    expect(resolveSectionTargetIndex(0, 260, heights, 3)).toBe(2);
    expect(resolveSectionTargetIndex(2, -260, heights, 3)).toBe(0);
  });

  it('clamps at the list boundaries', () => {
    expect(resolveSectionTargetIndex(0, 10_000, heights, 3)).toBe(2);
    expect(resolveSectionTargetIndex(2, -10_000, heights, 3)).toBe(0);
  });

  it('stays put when neighbour heights are unknown', () => {
    expect(resolveSectionTargetIndex(0, 500, {}, 3)).toBe(0);
  });
});
