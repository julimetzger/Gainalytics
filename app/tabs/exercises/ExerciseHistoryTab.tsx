import {NativeStackScreenProps} from "@react-navigation/native-stack";
import {RootStackParamList} from "../../routing/exerciseRouter";
import React from "react";
import ExerciseHistory from "../../components/exercise/show/ExerciseHistory";

const ExerciseHistoryTab = ({route}: Props) => {
    return (<ExerciseHistory exercise={route.params.exercise} editable={true}></ExerciseHistory>)
}

export type Props = NativeStackScreenProps<RootStackParamList, 'ExericseHistory'>;
export default ExerciseHistoryTab;
