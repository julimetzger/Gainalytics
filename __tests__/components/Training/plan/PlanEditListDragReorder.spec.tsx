import React from 'react';
import {act, fireEvent, render} from '@testing-library/react-native';
import PlanEditList from '../../../../app/components/Training/plan/PlanEditList';
import {autoScrollSpeed, dropOffset, shiftForItem, AUTO_SCROLL_EDGE, AUTO_SCROLL_MAX_SPEED} from '../../../../app/components/Training/plan/useDragReorder';
import {Exercise} from '../../../../app/models/entities/Exercise';
import {WorkoutSet} from '../../../../app/models/entities/WorkoutSet';

// GH-418: drag & drop in the plan editor — exercise sections and the set rows
// inside one exercise. The drag is driven through the recorded pan handlers of the
// drag handles (the global gesture-handler mock drops them), with item heights fed
// in through onLayout like on the device.

type PanHandlers = {
  onStart?: (event: any) => void;
  onUpdate?: (event: any) => void;
  onFinalize?: (event: any, success: boolean) => void;
};

jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const makePan = () => {
    const handlers: Record<string, unknown> = {};
    const builder: any = new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (prop === '__handlers') {
            return handlers;
          }
          return (callback: unknown) => {
            if (prop.startsWith('on')) {
              handlers[prop] = callback;
            }
            return builder;
          };
        },
      },
    );
    return builder;
  };
  return {
    GestureHandlerRootView: require('react-native').View,
    GestureDetector: ({gesture, children}: {gesture: any; children: React.ReactElement}) => React.cloneElement(children, {__panHandlers: gesture.__handlers}),
    Gesture: {Pan: makePan},
  };
});

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
    HelperText: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    Text: ({children, testID}: {children: React.ReactNode; testID?: string}) => <Text testID={testID}>{children}</Text>,
    TextInput: ({label, value, onChangeText, onBlur, testID, autoFocus, selectTextOnFocus}: {label?: string; value?: string; onChangeText?: (value: string) => void; onBlur?: () => void; testID?: string; autoFocus?: boolean; selectTextOnFocus?: boolean}) => (
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} onBlur={onBlur} testID={testID} autoFocus={autoFocus} selectTextOnFocus={selectTextOnFocus} />
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

const set = (index: number, reps: number): WorkoutSet => ({index, reps, rir: 1, weight: 100 + index, date: new Date(0)});

const SECTION_HEIGHT = 300;
const ROW_HEIGHT = 60;

const renderList = (extraProps: Partial<React.ComponentProps<typeof PlanEditList>> = {}) => {
  const onReorderExercises = jest.fn();
  const onReorderSets = jest.fn();
  const utils = render(
    <PlanEditList
      exercises={exercises}
      selectedExerciseId={1}
      plannedWorkoutsByExerciseId={{
        1: {id: 101, exerciseId: 1, sets: [set(1, 5), set(2, 6), set(3, 7)], notes: ''},
      }}
      pendingSetByExerciseId={{}}
      commitRowDraftsOnUnmountRef={{current: false}}
      onSelectExercise={jest.fn()}
      onAddSet={jest.fn()}
      onPendingSetChange={jest.fn()}
      onPendingSetDelete={jest.fn()}
      onDeleteSet={jest.fn()}
      onUpsertSet={jest.fn()}
      onReorderSets={onReorderSets}
      onReorderExercises={onReorderExercises}
      onRemoveExercise={jest.fn()}
      {...extraProps}
    />,
  );
  exercises.forEach((exercise, index) =>
    fireEvent(utils.getByTestId(`plan-edit-section-drag-item-${exercise.id}`), 'layout', {
      nativeEvent: {layout: {x: 0, y: index * SECTION_HEIGHT, width: 360, height: SECTION_HEIGHT}},
    }),
  );
  [0, 1, 2].forEach((rowIndex) =>
    fireEvent(utils.getByTestId(`plan-edit-set-drag-item-1-${rowIndex}`), 'layout', {
      nativeEvent: {layout: {x: 0, y: 60 + rowIndex * ROW_HEIGHT, width: 360, height: ROW_HEIGHT}},
    }),
  );
  return {...utils, onReorderExercises, onReorderSets};
};

const drag = (handle: any, translationY: number, success = true) => {
  const handlers: PanHandlers = handle.props.__panHandlers;
  act(() => {
    handlers.onStart?.({absoluteY: 300, translationY: 0});
  });
  act(() => {
    handlers.onUpdate?.({absoluteY: 300 + translationY, translationY});
  });
  act(() => {
    handlers.onFinalize?.({absoluteY: 300 + translationY, translationY}, success);
  });
  // Let the settle animation finish — the new order is committed at its end.
  act(() => {
    jest.advanceTimersByTime(1000);
  });
};

describe('PlanEditList — drag & drop (GH-418)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('moves an exercise section from the top to the bottom', () => {
    const {getByTestId, onReorderExercises} = renderList();

    drag(getByTestId('plan-exercise-drag-handle-1'), 2 * SECTION_HEIGHT);

    expect(onReorderExercises).toHaveBeenCalledTimes(1);
    expect(onReorderExercises.mock.calls[0][0].map((exercise: Exercise) => exercise.id)).toEqual([2, 3, 1]);
  });

  it('moves a section up by one slot once it passes half of its neighbour', () => {
    const {getByTestId, onReorderExercises} = renderList();

    drag(getByTestId('plan-exercise-drag-handle-3'), -(SECTION_HEIGHT / 2 + 10));

    expect(onReorderExercises.mock.calls[0][0].map((exercise: Exercise) => exercise.id)).toEqual([1, 3, 2]);
  });

  it('keeps the order when the drag is cancelled', () => {
    const {getByTestId, onReorderExercises} = renderList();

    drag(getByTestId('plan-exercise-drag-handle-1'), 2 * SECTION_HEIGHT, false);

    expect(onReorderExercises).not.toHaveBeenCalled();
  });

  it('reorders the sets inside their exercise and renumbers them in the new order', () => {
    const {getByTestId, onReorderSets} = renderList();

    // Set 3 (7 reps) dragged above set 1.
    drag(getByTestId('plan-set-3-drag'), -2 * ROW_HEIGHT);

    expect(onReorderSets).toHaveBeenCalledTimes(1);
    expect(onReorderSets.mock.calls[0][0]).toBe(1);
    expect(onReorderSets.mock.calls[0][1].map((workoutSet: WorkoutSet) => [workoutSet.index, workoutSet.reps])).toEqual([
      [1, 7],
      [2, 5],
      [3, 6],
    ]);
    // Only the order changed — every other value of the sets is untouched.
    expect(onReorderSets.mock.calls[0][1].map((workoutSet: WorkoutSet) => workoutSet.weight)).toEqual([103, 101, 102]);
  });

  it('does not touch the sets when a set is dropped where it started', () => {
    const {getByTestId, onReorderSets} = renderList();

    drag(getByTestId('plan-set-2-drag'), ROW_HEIGHT / 2 - 5);

    expect(onReorderSets).not.toHaveBeenCalled();
  });

  it('outlines the target slot while dragging and removes the outline after the drop', () => {
    const {getByTestId, queryByTestId} = renderList();
    const handlers: PanHandlers = getByTestId('plan-exercise-drag-handle-1').props.__panHandlers;

    act(() => {
      handlers.onStart?.({absoluteY: 300, translationY: 0});
    });
    expect(queryByTestId('plan-edit-section-drop-placeholder')).not.toBeNull();

    act(() => {
      handlers.onFinalize?.({absoluteY: 300, translationY: 0}, true);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(queryByTestId('plan-edit-section-drop-placeholder')).toBeNull();
  });
});

describe('PlanEditList — opened from a tapped value (GH-418)', () => {
  it('focuses exactly the tapped field and selects its value', () => {
    const {getByTestId} = renderList({focusTarget: {exerciseId: 1, setIndex: 2, field: 'weight'}});

    expect(getByTestId('plan-set-2-weight-input').props.autoFocus).toBe(true);
    expect(getByTestId('plan-set-2-weight-input').props.selectTextOnFocus).toBe(true);
    expect(getByTestId('plan-set-2-reps-input').props.autoFocus).toBe(false);
    expect(getByTestId('plan-set-1-weight-input').props.autoFocus).toBe(false);
  });

  it('explains a refused value right in the row', () => {
    const {getByTestId, queryByTestId} = renderList();
    expect(queryByTestId('plan-set-1-value-error')).toBeNull();

    fireEvent.changeText(getByTestId('plan-set-1-rir-input'), '10.5');

    expect(String(getByTestId('plan-set-1-value-error').props.children)).toMatch(/decimals like 1\.5 are allowed/);
  });

  it('focuses nothing when full edit was opened another way', () => {
    const {getAllByTestId} = renderList();
    const inputs = ['plan-set-1-reps-input', 'plan-set-2-weight-input', 'plan-set-3-rir-input'].flatMap((id) => getAllByTestId(id));
    expect(inputs.every((input) => input.props.autoFocus !== true)).toBe(true);
  });
});

describe('useDragReorder geometry (GH-418)', () => {
  it('opens a gap of the dragged height between the start and the target', () => {
    // Item 0 dragged onto slot 2: items 1 and 2 move up by its height.
    expect([0, 1, 2, 3].map((item) => shiftForItem(item, 0, 2, 100))).toEqual([0, -100, -100, 0]);
    // Item 3 dragged onto slot 1: items 1 and 2 move down.
    expect([0, 1, 2, 3].map((item) => shiftForItem(item, 3, 1, 100))).toEqual([0, 100, 100, 0]);
  });

  it('settles the dropped item exactly on its target slot', () => {
    const heights = {0: 100, 1: 200, 2: 50};
    expect(dropOffset(0, 2, heights)).toBe(250);
    expect(dropOffset(2, 0, heights)).toBe(-300);
    expect(dropOffset(1, 1, heights)).toBe(0);
  });

  it('auto-scrolls only near the edges, faster the deeper the finger is in the edge zone', () => {
    const visible = {top: 100, bottom: 900};
    expect(autoScrollSpeed(500, visible)).toBe(0);
    expect(autoScrollSpeed(visible.bottom - AUTO_SCROLL_EDGE / 2, visible)).toBeCloseTo(AUTO_SCROLL_MAX_SPEED / 2);
    expect(autoScrollSpeed(visible.bottom + 50, visible)).toBe(AUTO_SCROLL_MAX_SPEED);
    expect(autoScrollSpeed(visible.top + AUTO_SCROLL_EDGE / 4, visible)).toBeCloseTo((-AUTO_SCROLL_MAX_SPEED * 3) / 4);
  });

  it('keeps a middle zone when the keyboard leaves only a small visible area', () => {
    const visible = {top: 100, bottom: 220};
    expect(autoScrollSpeed(160, visible)).toBe(0);
  });
});
