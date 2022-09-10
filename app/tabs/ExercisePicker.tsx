import {useAlleExercises} from "../redux/Exercises/useAllExercises";
import React from 'react';
import {MultiselectDropdown} from "sharingan-rn-modal-dropdown";

const ExercisePicker = ({exercise, setExercise}: ExercisePickerProps) => {
    let exercises = useAlleExercises()
    let choosenExercises = exercise.map((exercise: Exercise) => exercise.id ? exercise.id : 0);
    let dropdownExerciseStructure = exercises.map((exercise: Exercise) => {
        return {
            label: exercise.name,
            value: exercise.id
        }
    });

    return (<>
        <MultiselectDropdown label="Choose Exercises" enableSearch value={choosenExercises} onChange={setExerciseDumb}
                             data={dropdownExerciseStructure}/>
    </>);

    function setExerciseDumb(value: number[]) {
        let find = exercises.filter((exerciseFilter: Exercise) => value.includes(exerciseFilter.id? exerciseFilter.id : 0));
        if (find !== undefined) {
            setExercise(find);
        }
    }
}

interface ExercisePickerProps {
    exercise: Exercise[],
    setExercise: (arg: Exercise[]) => void
}

export default ExercisePicker;
