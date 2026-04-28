import React, {useEffect, useMemo, useRef} from 'react';
import {Dimensions, LayoutRectangle, Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import DraggableFlatList, {RenderItemParams, ScaleDecorator} from 'react-native-draggable-flatlist';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Exercise} from '../../../models/entities/Exercise';
import {useTheme} from 'react-native-paper';
import {withAlpha} from '../../../utils/colorUtils';
import {PlanMode} from './planTypes';

type ExerciseItem = {
  key: number;
  label: string;
  isAdd?: boolean;
};

interface PlanExerciseStripProps {
  exercises: Exercise[];
  chosenExercise?: Exercise;
  chooseExercise: (exercise: Exercise) => void;
  doneExerciseIds: number[];
  mode: PlanMode;
  setExercises: (exercises: Exercise[]) => void;
  setAbsolutePosition: (layout: LayoutRectangle) => void;
  onExerciseDoublePress?: (exercise: Exercise) => void;
  onAddExercise?: () => void;
  pickerVisible?: boolean;
}

const DOUBLE_PRESS_DELAY_MS = 700;

const PlanExerciseStrip = ({
  exercises,
  chosenExercise,
  chooseExercise,
  doneExerciseIds,
  mode,
  setExercises,
  setAbsolutePosition,
  onExerciseDoublePress,
  onAddExercise,
  pickerVisible = false,
}: PlanExerciseStripProps) => {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  const containerRef = useRef<View>(null);
  const lastPressedExerciseRef = useRef<{exerciseId: number; timestamp: number} | null>(null);
  const editable = mode === 'fullEdit';
  const screenWidth = Dimensions.get('window').width;

  const items = useMemo<ExerciseItem[]>(() => {
    const baseItems = exercises.map((exercise) => ({
      key: exercise.id ?? 0,
      label: exercise.name,
    }));

    if (!editable) {
      return baseItems;
    }

    return [
      ...baseItems,
      {
        key: -1,
        label: pickerVisible ? 'Done' : '+ Add exercise',
        isAdd: true,
      },
    ];
  }, [editable, exercises, pickerVisible]);

  useEffect(() => {
    measureContainer();
  }, [items.length]);

  const handlePressExercise = (item: ExerciseItem) => {
    if (item.isAdd) {
      onAddExercise?.();
      return;
    }

    const selectedExercise = exercises.find((exercise) => exercise.id === item.key);
    if (selectedExercise === undefined) {
      return;
    }

    const now = Date.now();
    const previousPress = lastPressedExerciseRef.current;
    const isDoublePress = previousPress !== null && previousPress.exerciseId === selectedExercise.id && now - previousPress.timestamp <= DOUBLE_PRESS_DELAY_MS;

    lastPressedExerciseRef.current = {
      exerciseId: selectedExercise.id ?? 0,
      timestamp: now,
    };

    chooseExercise(selectedExercise);

    if (isDoublePress) {
      onExerciseDoublePress?.(selectedExercise);
    }
  };

  const renderExerciseItem = ({item, drag, isActive}: RenderItemParams<ExerciseItem>) => {
    if (item.isAdd) {
      return (
        <Pressable
          testID="plan-add-exercise-tile"
          onPress={() => handlePressExercise(item)}
          style={[
            styles.tile,
            styles.addTile,
            {
              backgroundColor: withAlpha(theme.colors.primary, 0.08),
              borderColor: withAlpha(theme.colors.primary, 0.6),
            },
          ]}
        >
          <Text style={[styles.addTileLabel, {color: theme.colors.primary}]}>{item.label}</Text>
        </Pressable>
      );
    }

    const selected = item.key === chosenExercise?.id;
    const done = doneExerciseIds.includes(item.key);

    return (
      <ScaleDecorator>
        <Pressable
          testID={`plan-exercise-${item.key}`}
          onPress={() => handlePressExercise(item)}
          onLongPress={editable ? drag : undefined}
          disabled={isActive}
          style={[
            styles.tile,
            {
              backgroundColor: isActive
                ? theme.colors.tertiaryContainer
                : selected
                ? theme.colors.surfaceVariant
                : done
                ? theme.colors.primaryContainer
                : theme.colors.secondaryContainer,
              borderColor: selected ? theme.colors.primary : 'transparent',
              borderLeftWidth: selected ? 2 : 0,
            },
          ]}
        >
          <Text
            numberOfLines={2}
            style={[
              styles.tileLabel,
              {
                color: selected ? theme.colors.primary : done ? theme.colors.onPrimaryContainer : theme.colors.onSecondaryContainer,
              },
            ]}
          >
            {item.label}
          </Text>
        </Pressable>
      </ScaleDecorator>
    );
  };

  const maxItemWidth = exercises.length <= 4 ? screenWidth / Math.max(exercises.length, 1) : screenWidth * 0.25;

  return (
    <View ref={containerRef} collapsable={false} onLayout={measureContainer} style={styles.container}>
      {editable ? (
        <DraggableFlatList
          horizontal
          keyboardShouldPersistTaps="always"
          data={items}
          keyExtractor={(item) => item.key.toString()}
          renderItem={(params) => (
            <View style={{maxWidth: Math.max(maxItemWidth, 112), minWidth: 112}}>
              {renderExerciseItem(params)}
            </View>
          )}
          onDragEnd={({data}) => {
            const exerciseOrder = data
              .filter((item) => !item.isAdd)
              .map((item) => exercises.find((exercise) => exercise.id === item.key))
              .filter((exercise) => exercise !== undefined) as Exercise[];
            setExercises(exerciseOrder);
          }}
        />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {items.map((item) => (
            <View key={item.key} style={{maxWidth: Math.max(maxItemWidth, 112), minWidth: 112}}>
              <Pressable
                testID={`plan-exercise-${item.key}`}
                onPress={() => handlePressExercise(item)}
                style={[
                  styles.tile,
                  {
                    backgroundColor: item.key === chosenExercise?.id ? theme.colors.surfaceVariant : theme.colors.secondaryContainer,
                    borderColor: item.key === chosenExercise?.id ? theme.colors.primary : 'transparent',
                    borderLeftWidth: item.key === chosenExercise?.id ? 2 : 0,
                  },
                ]}
              >
                <Text
                  numberOfLines={2}
                  style={[
                    styles.tileLabel,
                    {
                      color: item.key === chosenExercise?.id ? theme.colors.primary : theme.colors.onSecondaryContainer,
                    },
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  function measureContainer() {
    containerRef.current?.measureInWindow((x, y, width, height) => {
      setAbsolutePosition({
        x,
        y: y - safeAreaInsets.top,
        width,
        height: Math.max(height, 60),
      });
    });
  }
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 4,
  },
  tile: {
    minHeight: 56,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 16,
    borderWidth: 1,
  },
  tileLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  addTile: {
    borderStyle: 'dashed',
  },
  addTileLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default PlanExerciseStrip;
