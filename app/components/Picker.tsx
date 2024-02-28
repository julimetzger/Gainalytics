import {useAlleExercises} from "../redux/Exercises/useAllExercises";
import React, {useEffect, useState} from 'react';
import {MultiselectDropdown} from "sharingan-rn-modal-dropdown";
import {IconButton, useTheme} from "react-native-paper";
import {StyleProp, View, ViewStyle} from "react-native";
import {useTrainingsPlan} from "../redux/Training/useTrainingsPlan";
import {useAllTrainingsPlans} from "../redux/Training/useAllTrainingsPlans";

const Picker = ({
                    exercise,
                    setExercise,
                    style,
                    metric,
                    setMetric,
                    setAccumulation,
                    accumulation,
                    disabled = true
                }: ExercisePickerProps) => {
    const [show, setShow] = useState(disabled)
    let allExercises = useAlleExercises()
    let trainingsPlan = useAllTrainingsPlans();
    let theme = useTheme();
    let selectedExercises = exercise.map((exercise: Exercise) => exercise.id ? exercise.id : 0).map((value: number) => value.toString());
    let dropdownExerciseStructure = allExercises.map((exercise: Exercise) => {
        return {
            label: exercise.name,
            value: exercise.id!!.toString(),
        }
    });
    let trainingAccumalations = trainingsPlan.map((trainingsPlan: TrainingsPlan) => Accumulation.fromTrainingsPlan(trainingsPlan));
    let nonTrainingAccumalations = Accumulation.forAllNonTrainingModes();
    let allAccumalations = [...trainingAccumalations, ...nonTrainingAccumalations];
    let selectedValues = [...selectedExercises]
    if (metric !== undefined) {
        selectedValues.push(metric)
    }
    if (accumulation !== undefined) {
        selectedValues.push(accumulation.getId())
    }
    Object.values(Metric).map((value: string) => {
        dropdownExerciseStructure.push({label: value, value: value})
    })
    allAccumalations.map((value: Accumulation) => {
        dropdownExerciseStructure.push({label: value.getName(), value: value.getId()})
    })

    useEffect(() => {
        if (accumulation?.accumulationMode === AccumaulationMode.TRAINING_MICROCYCLE && setAccumulation) {
            setAccumulation(Accumulation.fromTrainingsPlan(trainingsPlan.find((trainingsPlan: TrainingsPlan) => trainingsPlan.id === accumulation?.trainingsPlan?.id)!!));
        }
    }, [trainingsPlan.find((trainingsPlan: TrainingsPlan) => trainingsPlan.id === accumulation?.trainingsPlan?.id)]);

    return (
        <View style={style}>
            {show && <MultiselectDropdown label="Choose Exercises, Metric and Accumalation Mode"
                                          enableSearch value={selectedValues}
                                          onChange={setExerciseDumb}
                                          searchInputTheme={{colors: {primary: theme.colors.primaryContainer}}}
                                          data={dropdownExerciseStructure} paperTheme={theme} disableSort={false}
                                          selectedItemViewStyle={{display: 'none'}}
                                          primaryColor={theme.colors.primaryContainer}
            />}
            <IconButton mode='outlined'
                        style={show ? {position: 'absolute', right: 0} : {position: 'absolute', bottom: -5, right: 0}}
                        icon={!show ? 'chevron-down' : 'chevron-up'}
                        onPress={() => setShow(!show)}></IconButton>
        </View>);

    function setExerciseDumb(value: string[]) {
        let newMetric = value.filter((value: string) => Object.values(Metric).includes(value as Metric));
        if (newMetric.length > 1) {
            newMetric = newMetric.filter((value: string) => value !== metric)
        }
        let accumalationNames = value.filter((value: string) => allAccumalations.map((value: Accumulation) => value.getId()).includes(value));
        if (accumalationNames.length > 1) {
            accumalationNames = accumalationNames.filter((value: string) => value !== accumulation?.getId())
        }
        let allIds = allExercises.map((value: Exercise) => value.id?.toString());
        let exercises = value.filter((value: string) => allIds.includes(value));
        let find = exercises.map((value: string) => allExercises.find((exercise: Exercise) => exercise.id === parseInt(value)))
            .filter((value: Exercise | undefined) => value !== undefined) as Exercise[]
        setExercise(find);
        setMetric ? setMetric(newMetric[0] as Metric) : 0;
        setAccumulation ? setAccumulation(allAccumalations.find((accumulation) => accumulation?.getId() === accumalationNames[0])) : undefined;
    }
}

export enum Metric {
    VOLUME = 'Volume',
    ONE_RM = '1RM',
    MAX_INTENSITY = 'Max Intensity',
    AVERAGE_INTENSITY = 'Average Intensity',
    SETS = 'Sets',
    REPS = 'Reps',
}

export enum AccumaulationMode {
    SINGLE_DAY = 'Day',
    WEEK = 'Week',
    // DEFINED_MICRO_LENGTH = 'Micro Length',
    // MONTH = 'Month',
    TRAINING_MICROCYCLE = 'Training Microcycle',
}

export class Accumulation {
    accumulationMode: AccumaulationMode;
    trainingsPlan?: TrainingsPlan

    constructor(accumalationMode: AccumaulationMode, trainingsId?: TrainingsPlan) {
        this.accumulationMode = accumalationMode;
        this.trainingsPlan = trainingsId;
    }

    static fromTrainingsPlan(trainingsPlan: TrainingsPlan) {
        return new Accumulation(AccumaulationMode.TRAINING_MICROCYCLE, trainingsPlan);
    }

    static forAllNonTrainingModes() {
        return Object.values(AccumaulationMode).map((value: string) => new Accumulation(value as AccumaulationMode))
            .filter((value: Accumulation) => value.accumulationMode !== AccumaulationMode.TRAINING_MICROCYCLE);
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
    style?: StyleProp<ViewStyle>
    disabled?: boolean
    metric?: Metric,
    setMetric?: (arg: Metric) => void,
    accumulation?: Accumulation,
    setAccumulation?: (arg: Accumulation | undefined) => void
}

export default Picker;
