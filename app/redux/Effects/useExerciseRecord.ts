import {useSelector} from "react-redux";
import {GlobalState} from "../rootReducer";

const useExerciseRecord = () => useSelector((state: GlobalState) => state.effects?.exerciseRecord)
export default useExerciseRecord;
