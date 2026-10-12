import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '../../../rootReducer';
import {ProgramTemplate} from '../../../../models/ProgramTemplate';
import {buildTemplatePlanPayload} from '../../../../utils/program-templates';
import {determineNewId} from '../../../normalizedState';
import {selectAllExercises} from '../../../Exercises/use/useAllExercises';
import {selectAllTimeOneRepMaxLookup} from '../../../Workout/use/useAllTimeOneRepMax';

/**
 * GH-497: creates a normal plan from a program template. It goes through
 * `IMPORT_TRAININGS_PLAN`, which reuses same-named exercises and only creates
 * the missing ones. The plan id is reserved up front and returned, so callers
 * never have to read the store back.
 */
export const dispatchCreatePlanFromTemplate = () => {
  const dispatch = useDispatch();
  const existingExercises = useSelector(selectAllExercises);
  const oneRepMaxFor = useSelector(selectAllTimeOneRepMaxLookup);
  const nextPlanId = useSelector((state: GlobalState) => determineNewId(state.trainingsPlan));

  return (template: ProgramTemplate, planName?: string): number => {
    const payload = buildTemplatePlanPayload(template, {
      existingExercises: existingExercises.filter((e) => e !== undefined),
      oneRepMaxFor,
      planName,
    });
    dispatch({type: 'IMPORT_TRAININGS_PLAN', payload, planId: nextPlanId});
    return nextPlanId;
  };
};
