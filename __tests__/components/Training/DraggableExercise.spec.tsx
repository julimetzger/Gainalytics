import React from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react-native';
import {MD3LightTheme, Provider as PaperProvider} from 'react-native-paper';
import DraggableExercise from '../../../app/components/Training/DraggableExercise';
import {Exercise} from '../../../app/models/entities/Exercise';
import {SWIPE_DELETE_OPEN_OFFSET} from '../../../app/components/Training/SwipeDeleteTile';

// GH-483: the global gesture-handler mock swallows every callback. This one records
// each Pan's handlers and config so a test can drive a pull on a specific tile.
type RecordedPan = {config: Record<string, unknown[]>; handlers: Record<string, (...args: any[]) => void>};
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const {View} = require('react-native');
  const makePan = (): any => {
    const recorded: RecordedPan = {config: {}, handlers: {}};
    const builder: any = new Proxy(
      {},
      {
        get: (_target, prop: string) => {
          if (prop === '__recorded') {
            return recorded;
          }
          return (...args: unknown[]) => {
            if (prop.startsWith('on') && typeof args[0] === 'function') {
              recorded.handlers[prop] = args[0] as (...a: any[]) => void;
            } else {
              recorded.config[prop] = args;
            }
            return builder;
          };
        },
      },
    );
    return builder;
  };
  return {
    GestureHandlerRootView: View,
    GestureDetector: ({gesture, children}: any) => React.createElement(View, {testID: 'gesture-detector', gesture}, children),
    Gesture: {Pan: makePan},
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

const exercise = (id: number, name: string) => ({id, name} as Exercise);
const PULL_UP = exercise(29, 'Pull up');
const PULLDOWN = exercise(84, 'Lat pulldown');
const ROW = exercise(47, 'Chest supported row');

type Overrides = Partial<React.ComponentProps<typeof DraggableExercise>>;

/** Keeps the exercise list in state like the store would, so undo sees the post-removal list. */
const Harness = ({initial, setExercisesSpy, ...props}: Overrides & {initial: Exercise[]; setExercisesSpy: jest.Mock}) => {
  const [exercises, setExercises] = React.useState(initial);
  return (
    <DraggableExercise
      exercises={exercises}
      chooseExercise={jest.fn()}
      doneExerciseIds={[]}
      setAbsolutePosition={jest.fn()}
      {...props}
      setExercises={(next) => {
        setExercisesSpy(next);
        setExercises(next);
      }}
    />
  );
};

const renderCarousel = (props: Overrides = {}, initial: Exercise[] = [PULL_UP, PULLDOWN, ROW]) => {
  const setExercisesSpy = jest.fn();
  const utils = render(
    <PaperProvider theme={MD3LightTheme}>
      <Harness initial={initial} setExercisesSpy={setExercisesSpy} {...props} />
    </PaperProvider>,
  );
  return {...utils, setExercisesSpy};
};

/** The Pan wrapped around the tile whose touchable carries `tileTestID`. */
const panFor = (tileTestID: string): RecordedPan => {
  const detector = screen.getAllByTestId('gesture-detector').find((node) => {
    try {
      return node.findAll((child: any) => child.props.testID === tileTestID).length > 0;
    } catch {
      return false;
    }
  });
  if (detector === undefined) {
    throw new Error(`no gesture around ${tileTestID}`);
  }
  return detector.props.gesture.__recorded;
};

const pull = (exerciseId: number, translationY: number, velocityY = 0) => {
  act(() => {
    const {handlers} = panFor(`training-exercise-${exerciseId}`);
    handlers.onStart?.({});
    handlers.onUpdate?.({translationY});
    handlers.onEnd?.({translationY, velocityY});
    handlers.onFinalize?.({}, true);
  });
};

const isOpen = (exerciseId: number) => {
  // The ✕ only takes touches while its tile is open.
  let node: any = screen.getByTestId(`training-exercise-delete-${exerciseId}`);
  while (node !== null && node.props.pointerEvents === undefined) {
    node = node.parent;
  }
  return node?.props.pointerEvents === 'box-none';
};

const labelsInOrder = () =>
  screen
    .getAllByTestId(/^training-exercise-\d+$/)
    .map((node) => node.props.testID)
    .filter((id: string, index: number, all: string[]) => all.indexOf(id) === index);

describe('DraggableExercise swipe-to-remove (GH-483)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens a tile pulled past half the way and lets a short pull spring back', () => {
    renderCarousel();

    pull(84, SWIPE_DELETE_OPEN_OFFSET / 2 - 4);
    expect(isOpen(84)).toBe(false);

    pull(84, SWIPE_DELETE_OPEN_OFFSET);
    expect(isOpen(84)).toBe(true);
  });

  it('opens on a quick fling even when the distance is short, and closes when pushed back up', () => {
    renderCarousel();

    pull(84, 10, 900);
    expect(isOpen(84)).toBe(true);

    pull(84, -30, -900);
    expect(isOpen(84)).toBe(false);
  });

  it('keeps at most one tile open', () => {
    renderCarousel();

    pull(84, SWIPE_DELETE_OPEN_OFFSET);
    expect(isOpen(84)).toBe(true);

    pull(47, SWIPE_DELETE_OPEN_OFFSET);
    expect(isOpen(47)).toBe(true);
    expect(isOpen(84)).toBe(false);
  });

  it('only reacts to a clearly vertical pull down', () => {
    renderCarousel();
    const {config} = panFor('training-exercise-84');

    // closed: a single positive offset = down only; sideways fails early
    expect(config.activeOffsetY).toEqual([7]);
    expect(config.failOffsetX).toEqual([[-6, 6]]);
    expect(config.enabled).toEqual([true]);
  });

  it('removes an exercise without logged sets at once and undo puts it back at the same index', () => {
    const chooseExercise = jest.fn();
    const {setExercisesSpy} = renderCarousel({chooseExercise, chosenExercise: PULLDOWN});

    pull(84, SWIPE_DELETE_OPEN_OFFSET);
    fireEvent.press(screen.getByTestId('training-exercise-delete-84'));

    expect(screen.queryByTestId('training-exercise-remove-dialog')).toBeNull();
    expect(setExercisesSpy).toHaveBeenLastCalledWith([PULL_UP, ROW]);
    expect(screen.getByText('Lat pulldown removed')).toBeTruthy();
    expect(labelsInOrder()).toEqual(['training-exercise-29', 'training-exercise-47']);

    fireEvent.press(screen.getByTestId('training-exercise-undo'));

    expect(setExercisesSpy).toHaveBeenLastCalledWith([PULL_UP, PULLDOWN, ROW]);
    expect(labelsInOrder()).toEqual(['training-exercise-29', 'training-exercise-84', 'training-exercise-47']);
    // it was the selected exercise — undo selects it again
    expect(chooseExercise).toHaveBeenCalledWith(PULLDOWN);
  });

  it('asks before removing an exercise with logged sets; cancel changes nothing', () => {
    const {setExercisesSpy} = renderCarousel({loggedSetCounts: {84: 2}});

    pull(84, SWIPE_DELETE_OPEN_OFFSET);
    fireEvent.press(screen.getByTestId('training-exercise-delete-84'));

    expect(screen.getByText('Remove Lat pulldown?')).toBeTruthy();
    expect(screen.getByText(/It already has 2 logged sets\./)).toBeTruthy();

    fireEvent.press(screen.getByTestId('training-exercise-remove-cancel'));
    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(setExercisesSpy).not.toHaveBeenCalled();
    expect(labelsInOrder()).toEqual(['training-exercise-29', 'training-exercise-84', 'training-exercise-47']);
    expect(isOpen(84)).toBe(false);
  });

  it('removes an exercise with logged sets once confirmed', () => {
    const {setExercisesSpy} = renderCarousel({loggedSetCounts: {84: 1}});

    pull(84, SWIPE_DELETE_OPEN_OFFSET);
    fireEvent.press(screen.getByTestId('training-exercise-delete-84'));
    expect(screen.getByText(/It already has 1 logged set\./)).toBeTruthy();

    fireEvent.press(screen.getByTestId('training-exercise-remove-confirm'));

    expect(setExercisesSpy).toHaveBeenLastCalledWith([PULL_UP, ROW]);
    expect(screen.getByText('Lat pulldown removed')).toBeTruthy();
  });

  it('survives repeated remove/undo rounds on different exercises without losing or duplicating any', () => {
    const {setExercisesSpy} = renderCarousel();

    pull(84, SWIPE_DELETE_OPEN_OFFSET);
    fireEvent.press(screen.getByTestId('training-exercise-delete-84'));
    pull(47, SWIPE_DELETE_OPEN_OFFSET);
    fireEvent.press(screen.getByTestId('training-exercise-delete-47'));
    expect(labelsInOrder()).toEqual(['training-exercise-29']);

    // only the latest removal is offered for undo
    expect(screen.getByText('Chest supported row removed')).toBeTruthy();
    fireEvent.press(screen.getByTestId('training-exercise-undo'));
    expect(labelsInOrder()).toEqual(['training-exercise-29', 'training-exercise-47']);

    // remove, remove, undo — the snackbar timing out afterwards writes nothing
    act(() => {
      jest.runOnlyPendingTimers();
    });
    expect(setExercisesSpy).toHaveBeenCalledTimes(3);
    expect(labelsInOrder()).toEqual(['training-exercise-29', 'training-exercise-47']);
  });

  it('closes an open tile when a tile is tapped', () => {
    const chooseExercise = jest.fn();
    renderCarousel({chooseExercise});

    pull(84, SWIPE_DELETE_OPEN_OFFSET);
    fireEvent.press(screen.getByTestId('training-exercise-47'));

    expect(isOpen(84)).toBe(false);
    expect(chooseExercise).toHaveBeenCalledWith(ROW);
  });

  it('gives the "+" tile no remove action', () => {
    renderCarousel();

    expect(screen.getByTestId('training-add-exercise-box')).toBeTruthy();
    expect(screen.queryByTestId('training-exercise-delete--1')).toBeNull();
    // its own pan only swallows the pull: no handlers that could move or remove anything
    expect(Object.keys(panFor('training-add-exercise-box').handlers)).toEqual([]);
  });

  it('reports the raised state so the parent can draw the strip above what follows', () => {
    const onRaisedChange = jest.fn();
    renderCarousel({onRaisedChange});

    pull(84, SWIPE_DELETE_OPEN_OFFSET);
    expect(onRaisedChange).toHaveBeenLastCalledWith(true);

    fireEvent.press(screen.getByTestId('training-exercise-delete-84'));
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(onRaisedChange).toHaveBeenLastCalledWith(false);
  });
});
