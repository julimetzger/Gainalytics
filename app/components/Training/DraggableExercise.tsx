import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Dimensions, LayoutRectangle, Pressable, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import DraggableFlatList, {RenderItemParams, ScaleDecorator, useNestableScrollContainerContext} from 'react-native-draggable-flatlist';
import {Portal, Snackbar, useTheme} from 'react-native-paper';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {Exercise} from '../../models/entities/Exercise';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import SwipeDeleteTile, {SWIPE_DELETE_ACTIVE_OFFSET_Y, SWIPE_DELETE_FAIL_OFFSET_X, SWIPE_DELETE_OPEN_OFFSET} from './SwipeDeleteTile';
import {ConfirmDialog} from '../common/EditDialogScaffold';

type Item = {
  key: number;
  label: string;
};

interface Props {
  exercises: Exercise[];
  chosenExercise?: Exercise;
  chooseExercise: (exercise: Exercise) => void;
  onExerciseDoublePress?: (exercise: Exercise) => void;
  setExercises: (exercises: Exercise[]) => void;
  doneExerciseIds: number[];
  /** GH-483: logged sets per exercise — removing one that has any asks first. */
  loggedSetCounts?: Record<number, number>;
  setAbsolutePosition: (layout: LayoutRectangle) => void;
  /** GH-483: true while a tile hangs below the carousel — the parent must then draw the strip above what follows. */
  onRaisedChange?: (raised: boolean) => void;
  onTogglePicker?: () => void;
  pickerVisible?: boolean;
}

/** What the undo snackbar needs to put a removed exercise back where it was. */
type RemovedExercise = {
  exercise: Exercise;
  index: number;
  wasChosen: boolean;
};

const DOUBLE_PRESS_DELAY_MS = 700;
// Long enough to read a long exercise name and reach the action (Material allows 4–10 s).
const UNDO_DURATION_MS = 8000;

const DraggableExercise = ({
  exercises,
  setExercises,
  chosenExercise,
  chooseExercise,
  onExerciseDoublePress,
  doneExerciseIds,
  loggedSetCounts,
  setAbsolutePosition,
  onRaisedChange,
  onTogglePicker,
  pickerVisible,
}: Props) => {
  let theme = useTheme();
  let exerciseData = exercises.map((exercise) => {
    return {
      key: exercise.id,
      label: exercise.name,
    } as Item;
  });

  // Add a special item for the "Add Exercise" box
  const addExerciseItem = {
    key: -1, // Special key for add exercise box
    label: '+',
  } as Item;

  let edgeInsets = useSafeAreaInsets();
  const textRef = useRef<View>(null);
  const overlayRef = useRef<View>(null);
  const lastPressedExercise = useRef<{exerciseId: number; timestamp: number} | undefined>(undefined);
  const [positionInternal, setPositionInternal] = useState<LayoutRectangle>();
  const nestableScrollContext = useNestableScrollContainerContext();

  // GH-483: at most one tile is pulled open at a time.
  const [openKey, setOpenKey] = useState<number | null>(null);
  // A pulled or open tile reaches into the room below the carousel (see the list's negative
  // margin), so while any tile is out of place the strip has to draw above the next content.
  // At rest it must not: that room overlaps the content below and would swallow its touches.
  const [raised, setRaised] = useState(false);
  const openKeyRef = useRef(openKey);
  openKeyRef.current = openKey;
  const swipingRef = useRef(false);
  useEffect(() => {
    onRaisedChange?.(raised);
  }, [raised]);
  // Closing normally lowers the strip once the tile has sprung back (onRest). A removed tile
  // unmounts before it can report that, so lower it after the spring's time as well.
  useEffect(() => {
    if (openKey !== null) {
      return;
    }
    const timeout = setTimeout(() => {
      if (openKeyRef.current === null && !swipingRef.current) {
        setRaised(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [openKey]);
  // Where the carousel sits inside the tap-outside overlay — taps there go to the tiles.
  const [carouselHole, setCarouselHole] = useState<LayoutRectangle>();
  const [pendingRemoval, setPendingRemoval] = useState<{exercise: Exercise; setCount: number}>();
  const [lastRemoved, setLastRemoved] = useState<RemovedExercise>();
  const [undoVisible, setUndoVisible] = useState(false);
  // Undo runs after the store has already dropped the exercise — it must splice into the latest list.
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;

  // A removed or replaced exercise cannot stay "open".
  useEffect(() => {
    if (openKey !== null && !exercises.some((exercise) => exercise.id === openKey)) {
      setOpenKey(null);
    }
  }, [exercises, openKey]);

  const screenWidth = Dimensions.get('window').width;

  const spreadEvenly = (percentage: number) => {
    return percentage / 100 > 0.125 ? percentage / 100 : 0.125 * screenWidth;
  };

  const spreadMax = (numberOfExercises: number) => {
    return numberOfExercises <= 4 ? RPW((1 / numberOfExercises) * 100) : RPW(25);
  };

  const RPW = (percentage: number) => {
    return (percentage / 100) * screenWidth;
  };
  const styles = StyleSheet.create({
    rowItem: {
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    text: {
      margin: 4,
      minWidth: spreadEvenly(exercises.length),
      maxWidth: spreadMax(exercises.length),
      color: theme.colors.onSecondaryContainer,
      fontSize: theme.fonts.bodyMedium.fontSize,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    // Room below every tile for the pulled-down position — given back by the list's negative margin.
    tileCell: {
      paddingBottom: SWIPE_DELETE_OPEN_OFFSET,
    },
    addExerciseBox: {
      height: 60,
      width: 60,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.secondaryContainer,
      borderWidth: 2,
      borderStyle: 'dashed',
      borderColor: theme.colors.onSecondaryContainer,
    },
    addExerciseText: {
      color: theme.colors.onSecondaryContainer,
      fontSize: 24,
      fontWeight: 'bold',
    },
  });

  const closeOpenTile = () => setOpenKey(null);

  // The "+" tile has nothing to remove. A pull down on it is claimed by this inert pan so it
  // neither moves nor ends up as a tap that opens the picker.
  const inertVerticalPan = useMemo(() => Gesture.Pan().runOnJS(true).activeOffsetY(SWIPE_DELETE_ACTIVE_OFFSET_Y).failOffsetX([-SWIPE_DELETE_FAIL_OFFSET_X, SWIPE_DELETE_FAIL_OFFSET_X]), []);

  // The overlay lives in the Portal host, the carousel somewhere inside the screen — both
  // are measured in window coordinates so the hole lines up whatever sits above them.
  const measureCarouselHole = () => {
    textRef.current?.measureInWindow((x, y, width, height) => {
      overlayRef.current?.measureInWindow((overlayX, overlayY) => {
        setCarouselHole({x: x - overlayX, y: y - overlayY, width, height});
      });
    });
  };

  const onPress = (item: Item) => {
    closeOpenTile();
    if (item.key === -1) {
      // This is the add exercise box
      onTogglePicker?.();
    } else {
      const selectedExercise = exercises.find((exercise) => exercise.id === item.key);
      if (selectedExercise === undefined) {
        return;
      }

      const now = Date.now();
      const previousPress = lastPressedExercise.current;
      const isDoublePress = previousPress !== undefined && previousPress.exerciseId === selectedExercise.id && now - previousPress.timestamp <= DOUBLE_PRESS_DELAY_MS;

      lastPressedExercise.current = {
        exerciseId: selectedExercise.id!!,
        timestamp: now,
      };

      chooseExercise(selectedExercise);
      if (isDoublePress) {
        onExerciseDoublePress?.(selectedExercise);
      }
    }
  };

  const removeExercise = (exercise: Exercise) => {
    const index = exercises.findIndex((candidate) => candidate.id === exercise.id);
    if (index < 0) {
      return;
    }
    setOpenKey(null);
    setLastRemoved({exercise, index, wasChosen: chosenExercise?.id === exercise.id});
    setUndoVisible(true);
    setExercises(exercises.filter((candidate) => candidate.id !== exercise.id));
  };

  const requestRemoval = (key: number) => {
    const exercise = exercises.find((candidate) => candidate.id === key);
    if (exercise === undefined) {
      return;
    }
    const setCount = loggedSetCounts?.[key] ?? 0;
    if (setCount > 0) {
      setPendingRemoval({exercise, setCount});
      return;
    }
    removeExercise(exercise);
  };

  const undoRemoval = () => {
    setUndoVisible(false);
    if (lastRemoved === undefined) {
      return;
    }
    const current = exercisesRef.current;
    // Re-added through the picker in the meantime — nothing to restore.
    if (current.some((exercise) => exercise.id === lastRemoved.exercise.id)) {
      return;
    }
    const restored = [...current];
    restored.splice(Math.min(lastRemoved.index, restored.length), 0, lastRemoved.exercise);
    setExercises(restored);
    if (lastRemoved.wasChosen) {
      chooseExercise(lastRemoved.exercise);
    }
  };

  const renderItem = ({item, drag, isActive}: RenderItemParams<Item>) => {
    // Special rendering for the add exercise box — it has nothing to remove, so no swipe.
    if (item.key === -1) {
      return (
        <GestureDetector gesture={inertVerticalPan}>
          <TouchableOpacity onPress={() => onPress(item)} style={styles.addExerciseBox} testID="training-add-exercise-box">
            <Text style={styles.addExerciseText}>{pickerVisible ? '-' : '+'}</Text>
          </TouchableOpacity>
        </GestureDetector>
      );
    }

    return (
      <View style={styles.tileCell} pointerEvents="box-none">
        <ScaleDecorator>
          <SwipeDeleteTile
            isOpen={openKey === item.key}
            disabled={isActive}
            onSwipeStart={() => {
              swipingRef.current = true;
              setRaised(true);
              // Pulling another tile closes the open one.
              if (openKey !== item.key) {
                closeOpenTile();
              }
              nestableScrollContext?.setOuterScrollEnabled(false);
            }}
            onSwipeEnd={() => {
              swipingRef.current = false;
              nestableScrollContext?.setOuterScrollEnabled(true);
            }}
            onRest={(open) => {
              if (!open && openKeyRef.current === null && !swipingRef.current) {
                setRaised(false);
              }
            }}
            onOpen={() => setOpenKey(item.key)}
            onClose={() => {
              if (openKey === item.key) {
                closeOpenTile();
              }
            }}
            onDelete={() => requestRemoval(item.key)}
            deleteTestID={`training-exercise-delete-${item.key}`}
            deleteAccessibilityLabel={`Remove ${item.label}`}
          >
            <TouchableOpacity
              onLongPress={drag}
              disabled={isActive}
              onPress={() => onPress(item)}
              testID={`training-exercise-${item.key}`}
              style={[
                styles.rowItem,
                {
                  backgroundColor: isActive ? theme.colors.tertiaryContainer : doneExerciseIds.includes(item.key) ? theme.colors.primaryContainer : theme.colors.secondaryContainer,
                  borderColor: item.key === chosenExercise?.id ? theme.colors.onPrimaryContainer : 'transparent',
                  borderWidth: item.key === chosenExercise?.id ? 2 : 2,
                },
              ]}
            >
              <Text
                numberOfLines={3}
                style={[
                  styles.text,
                  {
                    color: isActive
                      ? theme.colors.onTertiaryContainer
                      : item.key === chosenExercise?.id
                      ? theme.colors.onPrimaryContainer
                      : doneExerciseIds.includes(item.key)
                      ? theme.colors.onPrimaryContainer
                      : theme.colors.onSecondaryContainer,
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          </SwipeDeleteTile>
        </ScaleDecorator>
      </View>
    );
  };

  function setPosition() {
    textRef.current?.measureInWindow((x, y, width, height) => {
      let layout = {x, y: y - edgeInsets.top, width, height};
      layout.height = 60;
      if (positionInternal === undefined || positionInternal.y !== layout.y) {
        setPositionInternal(layout);
        setAbsolutePosition(layout);
      }
    });
  }

  // Combine exercise data with the add exercise box
  const allData = [...exerciseData, addExerciseItem];

  return (
    // GH-483: an open tile hangs below the carousel — it has to draw over the content that follows.
    <View ref={textRef} collapsable={false} onLayout={() => setPosition()} style={{marginBottom: -SWIPE_DELETE_OPEN_OFFSET, zIndex: raised ? 1 : 0}}>
      {allData.length > 0 && (
        <DraggableFlatList
          keyboardShouldPersistTaps={'always'}
          horizontal
          data={allData}
          onScrollBeginDrag={closeOpenTile}
          onDragBegin={closeOpenTile}
          onDragEnd={(items) => {
            // Filter out the add exercise box and update exercises
            const exerciseItems = items.data.filter((item) => item.key !== -1);
            setExercises(exerciseItems.map((item) => exercises.find((exercise) => exercise.id === item.key)).filter((exercise) => exercise !== undefined) as Exercise[]);
          }}
          keyExtractor={(item) => item.key.toString()}
          renderItem={renderItem}
        />
      )}
      {/* Not while the removal is being confirmed: portals stack in mount order, so this
          later one would sit on top of the dialog and swallow its buttons. */}
      {openKey !== null && pendingRemoval === undefined && (
        <Portal>
          {/* Tap anywhere outside the carousel closes the open tile. The carousel itself
              stays reachable: the ✕, other tiles and the horizontal scroll keep working. */}
          <View ref={overlayRef} collapsable={false} pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={measureCarouselHole}>
            {carouselHole !== undefined && (
              <>
                <Pressable onPressIn={closeOpenTile} style={{position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(carouselHole.y, 0)}} />
                <Pressable onPressIn={closeOpenTile} style={{position: 'absolute', left: 0, right: 0, top: carouselHole.y + carouselHole.height - SWIPE_DELETE_OPEN_OFFSET, bottom: 0}} />
              </>
            )}
          </View>
        </Portal>
      )}
      <ConfirmDialog
        visible={pendingRemoval !== undefined}
        title={`Remove ${pendingRemoval?.exercise.name ?? 'exercise'}?`}
        message={`It already has ${pendingRemoval?.setCount ?? 0} logged ${
          pendingRemoval?.setCount === 1 ? 'set' : 'sets'
        }. They leave the training with the exercise — Undo right after brings both back.`}
        confirmLabel="Remove"
        onConfirm={() => {
          const exercise = pendingRemoval?.exercise;
          setPendingRemoval(undefined);
          if (exercise !== undefined) {
            removeExercise(exercise);
          }
        }}
        onCancel={() => {
          setPendingRemoval(undefined);
          closeOpenTile();
        }}
        testID="training-exercise-remove-dialog"
        confirmTestID="training-exercise-remove-confirm"
        cancelTestID="training-exercise-remove-cancel"
      />
      <Portal>
        <Snackbar
          visible={undoVisible}
          onDismiss={() => setUndoVisible(false)}
          duration={UNDO_DURATION_MS}
          action={{label: 'Undo', onPress: undoRemoval, testID: 'training-exercise-undo'}}
          testID="training-exercise-removed-snackbar"
        >
          {lastRemoved !== undefined ? `${lastRemoved.exercise.name} removed` : 'Exercise removed'}
        </Snackbar>
      </Portal>
    </View>
  );
};
export default DraggableExercise;
