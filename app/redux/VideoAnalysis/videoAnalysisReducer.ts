import {AnyAction} from '@reduxjs/toolkit';
import {VideoAnalysis, VideoAnalysisStatus} from '../../models/entities/VideoAnalysis';
import {NormalizedState, determineNewId} from '../normalizedState';

const initialState = {
  byId: {},
  allIds: [],
} as NormalizedState<VideoAnalysis>;

const videoAnalysisReducer = (state: NormalizedState<VideoAnalysis> = initialState, action: AnyAction) => {
  switch (action.type) {
    case 'ADD_VIDEO_ANALYSIS': {
      const id = action.videoAnalysis.id ?? determineNewId(state);
      return {
        ...state,
        byId: {
          ...state.byId,
          [id]: {
            ...action.videoAnalysis,
            id,
          } as VideoAnalysis,
        },
        allIds: state.allIds.includes(id) ? state.allIds : [...state.allIds, id],
      };
    }
    case 'SET_VIDEO_ANALYSIS_STATUS': {
      const current = state.byId[action.analysisId];
      if (!current) {
        return state;
      }

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.analysisId]: {
            ...current,
            status: action.status as VideoAnalysisStatus,
            error: action.error,
          },
        },
      };
    }
    case 'ATTACH_VIDEO_ANALYSIS_RESULT': {
      const current = state.byId[action.analysisId];
      if (!current) {
        return state;
      }

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.analysisId]: {
            ...current,
            resultPath: action.resultPath,
            localVideoPath: action.localVideoPath ?? current.localVideoPath,
            status: VideoAnalysisStatus.DONE,
            error: undefined,
          },
        },
      };
    }
    case 'LINK_VIDEO_ANALYSIS_TO_WORKOUT': {
      const current = state.byId[action.analysisId];
      if (!current) {
        return state;
      }

      return {
        ...state,
        byId: {
          ...state.byId,
          [action.analysisId]: {
            ...current,
            workoutId: action.workoutId,
            exerciseId: action.exerciseId,
          },
        },
      };
    }
    case 'DELETE_VIDEO_ANALYSIS': {
      if (state.byId[action.analysisId] === undefined) {
        return state;
      }

      const byId = {...state.byId};
      delete byId[action.analysisId];
      return {
        ...state,
        byId,
        allIds: state.allIds.filter((id) => id !== action.analysisId),
      };
    }
    default:
      return state;
  }
};

export default videoAnalysisReducer;
