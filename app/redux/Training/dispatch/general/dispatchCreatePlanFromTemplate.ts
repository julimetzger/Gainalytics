import {useDispatch, useStore} from 'react-redux';
import {GlobalState} from '../../../rootReducer';
import {ProgramTemplate} from '../../../../models/ProgramTemplate';
import {TrainingsPlan} from '../../../../models/entities/TrainingsPlan';
import {buildTemplatePlanPayload} from '../../../../utils/program-templates';
import {selectAllTimeOneRepMax} from '../../../Workout/use/useAllTimeOneRepMax';

/**
 * GH-497: creates a normal plan from a program template. It goes through
 * `IMPORT_TRAININGS_PLAN`, which reuses same-named exercises and only creates
 * the missing ones. Returns the created plan.
 */
export const dispatchCreatePlanFromTemplate = () => {
  const dispatch = useDispatch();
  const store = useStore<GlobalState>();

  return (template: ProgramTemplate, planName?: string): TrainingsPlan | undefined => {
    const state = store.getState();
    const payload = buildTemplatePlanPayload(template, {
      existingExercises: state.exercises.allIds.map((id) => state.exercises.byId[id]).filter((e) => e !== undefined),
      oneRepMaxFor: (exerciseId) => selectAllTimeOneRepMax(state, exerciseId),
      planName,
    });
    dispatch({type: 'IMPORT_TRAININGS_PLAN', payload});
    const plans = store.getState().trainingsPlan;
    return plans.byId[plans.allIds[plans.allIds.length - 1]];
  };
};
