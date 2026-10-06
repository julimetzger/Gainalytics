import {useAlleExercises} from '../../../redux/Exercises/use/useAllExercises';
import React, {useEffect, useMemo, useState} from 'react';
import {IDropdownData, MultiselectDropdown} from 'sharingan-rn-modal-dropdown';
import {Icon, IconButton, useTheme} from 'react-native-paper';
import {StyleProp, View, ViewStyle} from 'react-native';
import {useAllTrainingsPlans} from '../../../redux/Training/use/useAllTrainingsPlans';
import {Muscles} from '../../../models/Muscles';
import {Exercise} from '../../../models/entities/Exercise';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Metric} from '../../../models/Metric';
import {AccumulationMode} from '../../../models/AccumulationMode';

const TrainingElementPicker = ({
  exercise,
  setExercise,
  muscle,
  setMuscle,
  style,
  metrics,
  setMetrics,
  setAccumulation,
  accumulation,
  visible = true,
  hideChip = false,
  dropdownLabel = 'Select Exercises, Metrics, Accumulation Mode',
  onToggle,
  hideIconButton = false,
  openListOnShow = false,
}: ExercisePickerProps) => {
  const [show, setShow] = useState(visible);
  let allExercises = useAlleExercises();
  let trainingsPlan = useAllTrainingsPlans();
  let theme = useTheme();

  // Sync internal show state with external visible prop
  useEffect(() => {
    setShow(visible);
  }, [visible]);

  //TODO is this good? should exercises really not be shown? When adding exercises nothing happens anymore
  // selectedExercises = selectedExercises.filter((value: string) => !exercisesByMuscles.map(value => value.id?.toString()).includes(value));

  // Memoize the dropdown structure so its reference stays stable between renders.
  // Without this, sharingan-rn-modal-dropdown's internal useEffect re-fires on every
  // render (data reference changes), causing a "Maximum update depth exceeded" loop.
  //
  // IMPORTANT: Use `muscle !== undefined` (boolean) as the dep, NOT the `muscle` array.
  // The array content doesn't affect which items appear in the dropdown (all Muscles enum
  // values are always added when the prop is provided). Using the array reference caused
  // useMemo to recompute whenever setMuscle([]) was called with a new [] reference,
  // which re-triggered the library's useEffect loop and crashed the component tree.
  const hasMuscle = muscle !== undefined;

  // Serialize selection to stable string keys so useMemo below only recomputes when
  // the *content* changes, not whenever the parent creates new array references.
  const exerciseIdsKey = exercise.map((ex: Exercise) => ex.id ?? 0).join(',');
  const muscleKey = (muscle ?? []).join(',');
  const metricKey = (metrics ?? []).join(',');
  const accKey = accumulation?.getId() ?? '';

  const allAccumalations = useMemo<Accumulation[]>(() => {
    if (!setAccumulation) {
      return [];
    }
    const trainingAccumalations = trainingsPlan.map((tp: TrainingsPlan) => Accumulation.fromTrainingsPlan(tp));
    const nonTrainingAccumalations = Accumulation.forAllNonTrainingModes();
    return [...trainingAccumalations, ...nonTrainingAccumalations];
  }, [setAccumulation, trainingsPlan]);

  const dropdownExerciseStructure = useMemo<IDropdownData[]>(() => {
    const structure: IDropdownData[] = allExercises.map((ex: Exercise) => ({
      label: ex.name,
      value: ex.id!!.toString(),
      avatarComponent: <Icon source="weight-lifter" size={20} />,
    }));
    allAccumalations.forEach((acc: Accumulation) => {
      structure.push({
        label: acc.getName(),
        value: acc.getId(),
        avatarComponent: <Icon source="book-open-variant" size={20} />,
      });
    });
    if (setMetrics) {
      Object.values(Metric).forEach((value: string) => {
        structure.push({
          label: value,
          value: value,
          avatarComponent: <Icon source="trending-up" size={20} />,
        });
      });
    }
    if (hasMuscle) {
      Object.values(Muscles).forEach((value: string) => {
        structure.push({
          label: value,
          value: value,
          avatarComponent: <Icon source="arm-flex" size={20} />,
        });
      });
    }
    return structure;
  }, [allExercises, allAccumalations, setMetrics, hasMuscle]);

  // Memoize selectedValues so its reference is stable when content hasn't changed.
  // The library's internal useEffect depends on the `value` prop reference — a new
  // array on every render (even with identical content) triggers a setSelectedItems
  // call, which triggers another render, causing "Maximum update depth exceeded".
  const selectedValues = useMemo<string[]>(() => {
    const values = exerciseIdsKey ? exerciseIdsKey.split(',') : [];
    if (muscleKey) {
      values.push(...muscleKey.split(','));
    }
    if (metricKey) {
      values.push(...metricKey.split(','));
    }
    if (accKey) {
      values.push(accKey);
    }
    return values;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIdsKey, muscleKey, metricKey, accKey]);
  // Re-sync the accumulation object when its backing training plan changes in the store.
  // IMPORTANT: never call .find() directly in the dep array — it creates a new object
  // on every render even when nothing changed, causing an infinite update loop (GH-127).
  const syncedPlan = trainingsPlan.find((tp: TrainingsPlan) => tp.id === accumulation?.trainingsPlan?.id);
  useEffect(() => {
    if (accumulation?.accumulationMode === AccumulationMode.TRAINING_MICROCYCLE && setAccumulation && syncedPlan) {
      setAccumulation(Accumulation.fromTrainingsPlan(syncedPlan));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncedPlan]);

  return (
    <View style={style}>
      {/* Keep MultiselectDropdown always mounted to prevent crashing when react-native-modal
          unmounts while its internal modal is still open. Use display:none to hide instead.
          GH-324: `open` (patched-in prop) force-closes the internal modal when the picker is
          hidden — without it the modal stayed stuck open over the screen with no way to
          dismiss it after the anchor went display:none. */}
      <View style={show ? null : {display: 'none'}}>
        <MultiselectDropdown
          open={show}
          {...(openListOnShow ? {autoOpen: show, selectionHeader: true, onBlur: closeList} : {})}
          label={dropdownLabel}
          enableSearch
          value={selectedValues}
          onChange={setExerciseDumb}
          searchInputTheme={{colors: {primary: theme.colors.primary}}}
          data={dropdownExerciseStructure}
          paperTheme={theme}
          disableSort={false}
          selectedItemViewStyle={{backgroundColor: theme.colors.primaryContainer, color: theme.colors.onPrimaryContainer}}
          primaryColor={theme.colors.primaryContainer}
          enableAvatar
          multiline={true}
          hideChip={hideChip}
        />
      </View>
      {!hideIconButton && (
        <IconButton
          style={{position: 'absolute', right: 0, zIndex: 2}}
          icon={!show ? 'chevron-down' : 'chevron-up'}
          onPress={() => {
            if (onToggle) {
              onToggle();
            } else {
              setShow(!show);
            }
          }}
        ></IconButton>
      )}
    </View>
  );

  // GH-403: with `openListOnShow` the list IS the picker — dismissing the list
  // (backdrop or hardware back) has to retract the picker as well, otherwise the
  // anchor row would stay behind as the very "tap me to continue" step this
  // ticket removes.
  function closeList() {
    if (!show) {
      return;
    }
    if (onToggle) {
      onToggle();
    } else {
      setShow(false);
    }
  }

  function setExerciseDumb(value: string[]) {
    // GH-468: metrics are a multi-select filter, like exercises and muscles.
    let newMetrics = value.filter((value: string) => Object.values(Metric).includes(value as Metric)).map((value: string) => value as Metric);
    let accumulationNames = value.filter((value: string) => allAccumalations.map((value: Accumulation) => value.getId()).includes(value));
    if (accumulationNames.length > 1) {
      accumulationNames = accumulationNames.filter((value: string) => value !== accumulation?.getId());
    }
    let allIds = allExercises.map((value: Exercise) => value.id?.toString());
    let exercises = value.filter((value: string) => allIds.includes(value));
    let find = exercises.map((value: string) => allExercises.find((exercise: Exercise) => exercise.id === parseInt(value))).filter((value: Exercise | undefined) => value !== undefined) as Exercise[];
    let muscles = value.filter((value: string) => Object.values(Muscles).includes(value as Muscles)).map((value: string) => value as Muscles);
    // let allExercisesByMuscle = allExercises.filter((ex: Exercise) => ex.muscles?.some(s => muscles.includes(s.muscle)))
    setMuscle ? setMuscle(muscles) : 0;
    setExercise([...find]);
    setMetrics ? setMetrics(newMetrics) : 0;
    setAccumulation ? setAccumulation(allAccumalations.find((accumulation) => accumulation?.getId() === accumulationNames[0])) : undefined;
  }
};

export class Accumulation {
  accumulationMode: AccumulationMode;
  trainingsPlan?: TrainingsPlan;

  constructor(accumulationMode: AccumulationMode, trainingsId?: TrainingsPlan) {
    this.accumulationMode = accumulationMode;
    this.trainingsPlan = trainingsId;
  }

  static fromTrainingsPlan(trainingsPlan: TrainingsPlan) {
    return new Accumulation(AccumulationMode.TRAINING_MICROCYCLE, trainingsPlan);
  }

  static forAllNonTrainingModes() {
    return Object.values(AccumulationMode)
      .map((value: string) => new Accumulation(value as AccumulationMode))
      .filter((value: Accumulation) => value.accumulationMode !== AccumulationMode.TRAINING_MICROCYCLE);
  }

  getAccumulationMode() {
    return this.accumulationMode;
  }

  getName() {
    return this.trainingsPlan?.name ?? this.accumulationMode;
  }

  getId() {
    return 'accumulation' + this.getName();
  }
}

interface ExercisePickerProps {
  exercise: Exercise[];
  setExercise: (arg: Exercise[]) => void;
  muscle?: Muscles[];
  setMuscle?: (arg: Muscles[]) => void;
  style?: StyleProp<ViewStyle>;
  visible?: boolean;
  metrics?: Metric[];
  setMetrics?: (arg: Metric[]) => void;
  accumulation?: Accumulation;
  setAccumulation?: (arg: Accumulation | undefined) => void;
  hideChip?: boolean;
  dropdownLabel?: string;
  onToggle?: () => void;
  hideIconButton?: boolean;
  /**
   * GH-403: open the exercise list as soon as the picker becomes visible, and
   * show the "x selected" counter as the list's header row. Used where the
   * picker is toggled by an explicit "+" tile, so a single tap gets the user
   * all the way to the list. Off by default — the Analyse screens mount their
   * picker visible and must keep the tap-to-open anchor.
   */
  openListOnShow?: boolean;
}

export default TrainingElementPicker;
