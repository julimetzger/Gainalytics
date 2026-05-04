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
            seedCandidates: undefined,
            seedFrameWidthPx: undefined,
            seedFrameHeightPx: undefined,
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
            setIndex: action.setIndex,
          },
        },
      };
    }
    case 'SET_VIDEO_ANALYSIS_MANUAL_SEED_FRAME_PATH': {
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
            manualSeedFramePath: action.manualSeedFramePath,
            localVideoPath: action.localVideoPath ?? current.localVideoPath,
            seedCandidates: undefined,
            seedFrameWidthPx: undefined,
            seedFrameHeightPx: undefined,
          },
        },
      };
    }
    case 'SET_VIDEO_ANALYSIS_SEED_PREFLIGHT': {
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
            manualSeedFramePath: action.manualSeedFramePath,
            localVideoPath: action.localVideoPath ?? current.localVideoPath,
            seedCandidates: action.seedCandidates,
            seedFrameWidthPx: action.seedFrameWidthPx,
            seedFrameHeightPx: action.seedFrameHeightPx,
          },
        },
      };
    }
    case 'SET_VIDEO_ANALYSIS_DURATION': {
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
            videoMeta: {
              ...current.videoMeta,
              durationMs: action.durationMs,
            },
          },
        },
      };
    }
    case 'SAVE_VIDEO_ANALYSIS_SET_RESULT': {
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
            setResult: action.setResult,
          },
        },
      };
    }
    case 'SET_VIDEO_ANALYSIS_METERS_PER_PIXEL': {
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
            metersPerPixel: action.metersPerPixel,
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
    case 'RECOVER_STALE_VIDEO_ANALYSES': {
      // On app restart, any analysis stuck in an in-progress state (QUEUED/COPYING/PREFLIGHT/PROCESSING)
      // will never complete — the background work was lost when the app was killed. Reset them to FAILED.
      const staleStatuses: VideoAnalysisStatus[] = [
        VideoAnalysisStatus.QUEUED,
        VideoAnalysisStatus.COPYING,
        VideoAnalysisStatus.PREFLIGHT,
        VideoAnalysisStatus.PROCESSING,
      ];
      const updatedById = {...state.byId};
      let changed = false;
      Object.keys(updatedById).forEach((idStr) => {
        const analysis = updatedById[idStr];
        if (staleStatuses.includes(analysis.status)) {
          updatedById[idStr] = {
            ...analysis,
            status: VideoAnalysisStatus.FAILED,
            error: 'App was closed while import or analysis was running',
          };
          changed = true;
        }
      });
      return changed ? {...state, byId: updatedById} : state;
    }
    default:
      return state;
  }
};

export default videoAnalysisReducer;
