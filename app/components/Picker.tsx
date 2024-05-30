import {useAlleExercises} from "../redux/Exercises/useAllExercises";
import React, {useEffect, useState} from 'react';
import {IDropdownData, MultiselectDropdown} from "sharingan-rn-modal-dropdown";
import {Icon, IconButton, useTheme} from "react-native-paper";
import {StyleProp, View, ViewStyle} from "react-native";
import {useAllTrainingsPlans} from "../redux/Training/useAllTrainingsPlans";
import {Muscles} from "../models/Muscles";
import {Exercise} from "../models/Exercise";
import {TrainingsPlan} from "../models/TrainingsPlan";

const Picker = ({
                    exercise,
                    setExercise,
                    muscle,
                    setMuscle,
                    style,
                    metric,
                    setMetric,
                    setAccumulation,
                    accumulation,
                    visible = true,
                    hideChip = false,
                    dropdownLabel = "Select Exercises, Metrics, Accumulation Mode"
                }: ExercisePickerProps) => {
    const [show, setShow] = useState(visible)
    let allExercises = useAlleExercises()
    let trainingsPlan = useAllTrainingsPlans();
    let theme = useTheme();
    let selectedExercises = exercise.map((exercise: Exercise) => exercise.id ? exercise.id : 0).map((value: number) => value.toString());
    let dropdownExerciseStructure: IDropdownData[] = allExercises.map((exercise: Exercise) => {
        return {
            label: exercise.name,
            value: exercise.id!!.toString(),
            avatarComponent: <Icon source="weight-lifter" size={20}></Icon>
        }
    });
    //TODO is this good? sollen wirklich die exercises nicht angezeigt werden? Beim adden der exercises passiert dann gar nichts mehr
    // selectedExercises = selectedExercises.filter((value: string) => !exercisesByMuscles.map(value => value.id?.toString()).includes(value));
    let allAccumalations: Accumulation[] = [];
    if (setAccumulation) {
        let trainingAccumalations = trainingsPlan.map((trainingsPlan: TrainingsPlan) => Accumulation.fromTrainingsPlan(trainingsPlan));
        let nonTrainingAccumalations = Accumulation.forAllNonTrainingModes();
        allAccumalations = [...trainingAccumalations, ...nonTrainingAccumalations];
        allAccumalations.map((value: Accumulation,) => {
            dropdownExerciseStructure.push({
                label: value.getName(),
                value: value.getId(),
                avatarComponent: <Icon source="book-open-variant" size={20}></Icon>
            })
        })
    }
    let selectedValues = [...selectedExercises, ...(muscle ?? [])]
    if (metric !== undefined) {
        selectedValues.push(metric)
    }
    if (accumulation !== undefined) {
        selectedValues.push(accumulation.getId())
    }
    if (setMetric) {
        Object.values(Metric).map((value: string) => {
            dropdownExerciseStructure.push({
                label: value,
                value: value,
                avatarComponent: <Icon source="trending-up" size={20}></Icon>
            })
        })
    }
    if (muscle) {
        Object.values(Muscles).map((value: string) => {
            dropdownExerciseStructure.push({
                label: value,
                value: value,
                avatarComponent: <Icon source="arm-flex" size={20}></Icon>
            })
        })
    }
    useEffect(() => {
        if (accumulation?.accumulationMode === AccumulationMode.TRAINING_MICROCYCLE && setAccumulation) {
            setAccumulation(Accumulation.fromTrainingsPlan(trainingsPlan.find((trainingsPlan: TrainingsPlan) => trainingsPlan.id === accumulation?.trainingsPlan?.id)!!));
        }
    }, [trainingsPlan.find((trainingsPlan: TrainingsPlan) => trainingsPlan.id === accumulation?.trainingsPlan?.id)]);

    return (
        <View style={style}>
            {show && <MultiselectDropdown label={dropdownLabel}
                                          enableSearch
                                          value={selectedValues}
                                          onChange={setExerciseDumb}
                                          searchInputTheme={{colors: {primary: theme.colors.primaryContainer}}}
                                          data={dropdownExerciseStructure}
                                          paperTheme={theme}
                                          disableSort={false}
                                          selectedItemViewStyle={{backgroundColor: theme.colors.primary}}
                                          primaryColor={theme.colors.primaryContainer}
                                          enableAvatar
                                          multiline={true}
                                          hideChip={hideChip}
            />}
            <IconButton style={{position: 'absolute', right: 0, zIndex: 2}}
                        icon={!show ? 'chevron-down' : 'chevron-up'}
                        onPress={() => setShow(!show)}>
            </IconButton>
        </View>);

    function setExerciseDumb(value: string[]) {
        let newMetric = value.filter((value: string) => Object.values(Metric).includes(value as Metric));
        if (newMetric.length > 1) {
            newMetric = newMetric.filter((value: string) => value !== metric)
        }
        let accumulationNames = value.filter((value: string) => allAccumalations.map((value: Accumulation) => value.getId()).includes(value));
        if (accumulationNames.length > 1) {
            accumulationNames = accumulationNames.filter((value: string) => value !== accumulation?.getId())
        }
        let allIds = allExercises.map((value: Exercise) => value.id?.toString());
        let exercises = value.filter((value: string) => allIds.includes(value));
        let find = exercises.map((value: string) => allExercises.find((exercise: Exercise) => exercise.id === parseInt(value)))
            .filter((value: Exercise | undefined) => value !== undefined) as Exercise[]
        let muscles = value.filter((value: string) => Object.values(Muscles).includes(value as Muscles)).map((value: string) => value as Muscles);
        // let allExercisesByMuscle = allExercises.filter((ex: Exercise) => ex.muscles?.some(s => muscles.includes(s.muscle)))
        setMuscle ? setMuscle(muscles) : 0;
        setExercise([...find]);
        setMetric ? setMetric(newMetric[0] as Metric) : 0;
        setAccumulation ? setAccumulation(allAccumalations.find((accumulation) => accumulation?.getId() === accumulationNames[0])) : undefined;
    }
}

export enum Metric {
    VOLUME = 'Volume',
    ONE_RM = '1RM',
    SETS = 'Sets',
    REPS = 'Reps',
    MAX_INTENSITY = 'Max Intensity',
    AVERAGE_INTENSITY = 'Average Intensity',
}

export enum AccumulationMode {
    SINGLE_DAY = 'Day',
    WEEK = 'Week',
    //TWO_WORKOUTS = 'Two Workouts',
    //THREE_WORKOUTS = 'Three Workouts',
    //FOUR_WORKOUTS = 'Four Workouts',
    //FIVE_WORKOUTS = 'Five Workouts',
    //SIX_WORKOUTS = 'Six Workouts',
    // DEFINED_MICRO_LENGTH = 'Micro Length',
    MONTH = 'Month',
    TRAINING_MICROCYCLE = 'Training Microcycle',
}

export class Accumulation {
    accumulationMode: AccumulationMode;
    trainingsPlan?: TrainingsPlan

    constructor(accumulationMode: AccumulationMode, trainingsId?: TrainingsPlan) {
        this.accumulationMode = accumulationMode;
        this.trainingsPlan = trainingsId;
    }

    static fromTrainingsPlan(trainingsPlan: TrainingsPlan) {
        return new Accumulation(AccumulationMode.TRAINING_MICROCYCLE, trainingsPlan);
    }

    static forAllNonTrainingModes() {
        return Object.values(AccumulationMode).map((value: string) => new Accumulation(value as AccumulationMode))
            .filter((value: Accumulation) => value.accumulationMode !== AccumulationMode.TRAINING_MICROCYCLE);
    }

    getAccumulationMode() {
        return this.accumulationMode;
    }

    getName() {
        return this.trainingsPlan?.name ?? this.accumulationMode;
    }

    getId() {
        return "accumulation" + this.getName();
    }
}

interface ExercisePickerProps {
    exercise: Exercise[],
    setExercise: (arg: Exercise[]) => void,
    muscle?: Muscles[],
    setMuscle?: (arg: Muscles[]) => void,
    style?: StyleProp<ViewStyle>
    visible?: boolean
    metric?: Metric,
    setMetric?: (arg: Metric) => void,
    accumulation?: Accumulation,
    setAccumulation?: (arg: Accumulation | undefined) => void,
    hideChip?: boolean
    dropdownLabel?: string
}

export default Picker;
