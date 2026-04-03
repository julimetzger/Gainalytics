import {NormalizedState} from '../normalizedState';
import {AnyAction} from '@reduxjs/toolkit';
import {Meso, TrainingsPlan} from '../../models/entities/TrainingsPlan';

const initialState = {
  byId: {},
  allIds: [],
} as NormalizedState<TrainingsPlan>;

export function trainingInMicroIndex(micro: number, trainingInMicro: number) {
  return micro + ',' + trainingInMicro;
}

export function getTrainingFromTrainingInMicroIndex(trainingInMicroIndex: string) {
  return parseInt(trainingInMicroIndex.split(',')[1]);
}

export function getMicroFromTrainingInMicroIndex(trainingInMicroIndex: string) {
  return parseInt(trainingInMicroIndex.split(',')[0]);
}

export function getAllTrainingsForTraining(
  trainings: {
    [microComaTrainingInMicro: string]: number;
  },
  trainingsNumber: number,
) {
  let numbers = Object.entries(trainings)
    .filter(([key, value]) => key.endsWith(',' + trainingsNumber))
    .map(([key, value]) => [parseInt(key.split(',')[0]), value] as [number, number])
    .sort((a, b) => a[0] - b[0]);
  return numbers.map(([key, value]) => value);
}

export function getAllTrainingsForMicro(
  trainings: {
    [microComaTrainingInMicro: string]: number;
  },
  microNumber: number,
) {
  return Object.entries(trainings)
    .filter(([key, value]) => key.startsWith(microNumber.toString()))
    .map(([key, value]) => [parseInt(key.split(',')[0]), value] as [number, number])
    .sort((a, b) => a[0] - b[0])
    .map(([key, value]) => value);
}

/** Returns the Meso that contains the given global micro number. */
export function getMesoForMicro(mesos: Meso[] | undefined, globalMicro: number): Meso | undefined {
  if (!mesos || mesos.length === 0) return undefined;
  const sorted = [...mesos].sort((a, b) => a.order - b.order);
  let result: Meso | undefined;
  for (const meso of sorted) {
    if (meso.startMicro <= globalMicro) result = meso;
    else break;
  }
  return result;
}

/** Returns the local micro number within a Meso (starts at 1). */
export function getLocalMicro(mesos: Meso[] | undefined, globalMicro: number): number {
  const meso = getMesoForMicro(mesos, globalMicro);
  if (!meso) return globalMicro;
  return globalMicro - meso.startMicro + 1;
}

/** Returns the last global micro that belongs to the given Meso, or undefined if it is the last Meso (unbounded). */
export function getMesoEndMicro(mesos: Meso[] | undefined, meso: Meso | undefined): number | undefined {
  if (!meso || !mesos || mesos.length === 0) return undefined;
  const sorted = [...mesos].sort((a, b) => a.order - b.order);
  const currentIdx = sorted.findIndex((m) => m.id === meso.id);
  if (currentIdx === -1 || currentIdx === sorted.length - 1) return undefined;
  return sorted[currentIdx + 1].startMicro - 1;
}

/** Computes the startMicro for a new Meso to be appended after all existing mesos/micros. */
export function computeNextMesoStartMicro(trainingsPlan: TrainingsPlan): number {
  const existingGlobalMicros = Object.keys(trainingsPlan.trainings).map((key) => parseInt(key.split(',')[0]));
  const maxGlobalMicro = existingGlobalMicros.length > 0 ? Math.max(...existingGlobalMicros) : 0;
  const existingMesos = trainingsPlan.mesos ?? [];
  const maxStartMicro = existingMesos.length > 0 ? Math.max(...existingMesos.map((m) => m.startMicro)) : 0;
  return Math.max(maxGlobalMicro, maxStartMicro) + 1;
}

function determineNewId(trainingsPlanState: NormalizedState<TrainingsPlan>) {
  if (trainingsPlanState.allIds.length > 0) return Math.max(...trainingsPlanState.allIds) + 1;
  else return 1;
}

const trainingsPlanReducer = (state: NormalizedState<TrainingsPlan> = initialState, action: AnyAction) => {
  const trainingsPlan = state.byId[action.trainingsPlanId];
  switch (action.type) {
    case 'ADD_TRAININGS_PLAN':
      const newId = determineNewId(state);
      return {
        ...state,
        byId: {
          ...state.byId,
          [newId]: {
            ...action.trainingsPlan,
            id: newId,
            trainings: {},
            mesos: [{id: 1, name: 'Meso 1', order: 1, startMicro: 1}],
          },
        },
        allIds: [...state.allIds, newId],
      };
    case 'EDIT_TRAININGS_PLAN':
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsPlanId]: {...state.byId[action.trainingsPlanId], name: action.name},
        },
      };
    case 'DELETE_TRAININGS_PLAN':
      const byId = {...state.byId};
      delete byId[action.trainingsPlanId];
      return {
        ...state,
        byId,
        allIds: state.allIds.filter((id) => id !== action.trainingsPlanId),
      };
    case 'ADD_PLANED_TRAINING_WORKOUT':
    case 'SUGGEST_TRAINING':
    case 'MODIFY_EXERCISES_IN_TRAINING':
      if (action.trainingsId === undefined) {
        state.byId[action.trainingsPlanId] = {
          ...trainingsPlan,
          trainings: {
            ...trainingsPlan.trainings,
            [trainingInMicroIndex(action.microNumber, action.trainingInMicroNumber)]: action.nextTrainingsId,
          },
        };
      }
      return {...state, byId: {...state.byId}};
    case 'CHANGE_TRAININGS_NAME': {
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsPlanId]: {
            ...trainingsPlan,
            trainingNames: {
              ...trainingsPlan.trainingNames,
              [action.trainingsNumber]: action.trainingsName,
            },
          },
        },
      };
    }
    case 'FINISH_TRAINING':
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsPlanId]: {
            ...trainingsPlan,
            lastTraining: action.trainingsId,
          },
        },
      };
    case 'DELETE_TRAINING': {
      if (!trainingsPlan) return state;
      const trainings = {...trainingsPlan.trainings};
      delete trainings[trainingInMicroIndex(action.micro, action.trainingInMicro)];
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsPlanId]: {
            ...trainingsPlan,
            trainings,
          },
        },
      };
    }
    case 'ADD_MESO': {
      if (!trainingsPlan) return state;
      const existingMesos = trainingsPlan.mesos ?? [];
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsPlanId]: {
            ...trainingsPlan,
            mesos: [...existingMesos, action.meso],
          },
        },
      };
    }
    case 'EDIT_MESO': {
      if (!trainingsPlan) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsPlanId]: {
            ...trainingsPlan,
            mesos: (trainingsPlan.mesos ?? []).map((m) => (m.id === action.mesoId ? {...m, name: action.name} : m)),
          },
        },
      };
    }
    case 'DELETE_MESO': {
      if (!trainingsPlan) return state;
      return {
        ...state,
        byId: {
          ...state.byId,
          [action.trainingsPlanId]: {
            ...trainingsPlan,
            mesos: (trainingsPlan.mesos ?? []).filter((m) => m.id !== action.mesoId),
          },
        },
      };
    }
    default:
      return state;
  }
};

export default trainingsPlanReducer;
