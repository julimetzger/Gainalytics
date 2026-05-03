import {AnyAction} from '@reduxjs/toolkit';
import {Metric, MetricOverviewSection, resolveMetricOverviewSlots} from '../../models/Metric';

export interface MetricOverviewSettings {
  muscles?: Metric[];
  exercises?: Metric[];
}

export type MuscleMapMetric = 'sets' | 'volume';
export type MuscleMapCompare = 'none' | 'last_plan' | 'current_total_plan';

export interface PlanSettings {
  muscleMap?: {
    enabled?: boolean;
    metric?: MuscleMapMetric;
    compare?: MuscleMapCompare;
  };
}

export interface ActiveRestState {
  startedAt: number;
  targetSeconds: number;
  exerciseId?: number;
  setIndex?: number;
}

export interface RestTimerSettings {
  userDefaultSeconds?: number;
  defaultPerExercise?: {[exerciseId: number]: number};
  active?: ActiveRestState | null;
}

export interface AppSettings {
  mode: 'light' | 'dark';
  palette?: 'blue' | 'green' | 'purple';
  videoAnalysisFiltersExpanded?: boolean;
  localNotification?: {
    pauseTimerInSeconds?: number;
    finishTrainingTimerInSeconds?: number;
    exactAlarmPermission?: boolean;
  };
  toggles?: {
    useRpe?: boolean;
    disable1RMButton?: boolean;
    disableTimer?: boolean;
    disableToasts?: boolean;
    showPlusButtonLeft?: boolean;
  };
  metricOverview?: MetricOverviewSettings;
  anthropicModel?: string;
  aiChatPrompt?: string;
  aiTrainingPrompt?: string;
  plan?: PlanSettings;
  restTimer?: RestTimerSettings;
}

const initialState = {
  mode: 'dark',
  palette: 'blue',
  videoAnalysisFiltersExpanded: false,
} as AppSettings;

const settingsReducer = (settings: AppSettings = initialState, action: AnyAction): AppSettings => {
  switch (action.type) {
    case 'TOGGLE_MODE': {
      return {
        ...settings,
        mode: settings?.mode === 'dark' ? 'light' : 'dark',
      } as AppSettings;
    }
    case 'SET_PALETTE': {
      return {
        ...settings,
        palette: action.palette,
      } as AppSettings;
    }
    case 'SET_VIDEO_ANALYSIS_FILTERS_EXPANDED': {
      return {
        ...settings,
        videoAnalysisFiltersExpanded: action.expanded,
      } as AppSettings;
    }
    case 'SET_PAUSE_TIMER': {
      return {
        ...settings,
        localNotification: {
          ...settings.localNotification,
          pauseTimerInSeconds: action.seconds,
        },
      } as AppSettings;
    }
    case 'SET_FINISH_TRAINING_TIMER': {
      return {
        ...settings,
        localNotification: {
          ...settings.localNotification,
          finishTrainingTimerInSeconds: action.seconds,
        },
      } as AppSettings;
    }
    case 'TOGGLE_USE_RPE': {
      return {
        ...settings,
        toggles: {
          ...settings.toggles,
          useRpe: !settings.toggles?.useRpe,
        },
      } as AppSettings;
    }
    case 'TOGGLE_ENABLE_1RM_BUTTON': {
      return {
        ...settings,
        toggles: {
          ...settings.toggles,
          disable1RMButton: !settings.toggles?.disable1RMButton,
        },
      } as AppSettings;
    }
    case 'TOGGLE_DISABLE_TIMER': {
      return {
        ...settings,
        toggles: {
          ...settings.toggles,
          disableTimer: !settings.toggles?.disableTimer,
        },
      } as AppSettings;
    }
    case 'TOGGLE_DISABLE_TOASTS': {
      return {
        ...settings,
        toggles: {
          ...settings.toggles,
          disableToasts: !settings.toggles?.disableToasts,
        },
      } as AppSettings;
    }
    case 'SHOW_PLUS_BUTTON_LEFT': {
      return {
        ...settings,
        toggles: {
          ...settings.toggles,
          showPlusButtonLeft: !settings.toggles?.showPlusButtonLeft,
        },
      } as AppSettings;
    }
    case 'SET_EXACT_ALARM_PERMISSION':
      return {
        ...settings,
        localNotification: {
          ...settings.localNotification,
          exactAlarmPermission: action.hasPermission,
        },
      };
    case 'SET_ANTHROPIC_MODEL': {
      const trimmed = ((action.model as string) ?? '').trim();
      return {
        ...settings,
        anthropicModel: trimmed || undefined,
      };
    }
    case 'SET_AI_CHAT_PROMPT': {
      const trimmed = ((action.prompt as string) ?? '').trim();
      return {
        ...settings,
        aiChatPrompt: trimmed || undefined,
      };
    }
    case 'RESET_AI_CHAT_PROMPT': {
      return {
        ...settings,
        aiChatPrompt: undefined,
      };
    }
    case 'SET_AI_TRAINING_PROMPT': {
      const trimmed = ((action.prompt as string) ?? '').trim();
      return {
        ...settings,
        aiTrainingPrompt: trimmed || undefined,
      };
    }
    case 'RESET_AI_TRAINING_PROMPT': {
      return {
        ...settings,
        aiTrainingPrompt: undefined,
      };
    }
    case 'SET_PLAN_MUSCLE_MAP_ENABLED': {
      return {
        ...settings,
        plan: {
          ...settings.plan,
          muscleMap: {
            ...settings.plan?.muscleMap,
            enabled: !!action.enabled,
          },
        },
      };
    }
    case 'SET_PLAN_MUSCLE_MAP_METRIC': {
      return {
        ...settings,
        plan: {
          ...settings.plan,
          muscleMap: {
            ...settings.plan?.muscleMap,
            metric: action.metric as MuscleMapMetric,
          },
        },
      };
    }
    case 'SET_PLAN_MUSCLE_MAP_COMPARE': {
      return {
        ...settings,
        plan: {
          ...settings.plan,
          muscleMap: {
            ...settings.plan?.muscleMap,
            compare: action.compare as MuscleMapCompare,
          },
        },
      };
    }
    case 'SET_REST_TIMER_USER_DEFAULT': {
      return {
        ...settings,
        restTimer: {
          ...settings.restTimer,
          userDefaultSeconds: action.seconds,
        },
      };
    }
    case 'SET_REST_TIMER_EXERCISE_DEFAULT': {
      return {
        ...settings,
        restTimer: {
          ...settings.restTimer,
          defaultPerExercise: {
            ...(settings.restTimer?.defaultPerExercise ?? {}),
            [action.exerciseId]: action.seconds,
          },
        },
      };
    }
    case 'START_REST_TIMER': {
      return {
        ...settings,
        restTimer: {
          ...settings.restTimer,
          active: {
            startedAt: action.startedAt,
            targetSeconds: action.targetSeconds,
            exerciseId: action.exerciseId,
            setIndex: action.setIndex,
          },
        },
      };
    }
    case 'UPDATE_REST_TIMER_TARGET': {
      const current = settings.restTimer?.active;
      if (!current) return settings;
      return {
        ...settings,
        restTimer: {
          ...settings.restTimer,
          active: {
            ...current,
            targetSeconds: action.targetSeconds,
          },
        },
      };
    }
    case 'RESET_REST_TIMER': {
      const current = settings.restTimer?.active;
      if (!current) return settings;
      return {
        ...settings,
        restTimer: {
          ...settings.restTimer,
          active: {
            ...current,
            startedAt: action.startedAt,
          },
        },
      };
    }
    case 'DISMISS_REST_TIMER': {
      return {
        ...settings,
        restTimer: {
          ...settings.restTimer,
          active: null,
        },
      };
    }
    case 'SET_METRIC_OVERVIEW_SLOT': {
      const slots = resolveMetricOverviewSlots(settings.metricOverview?.[action.section as MetricOverviewSection], action.section as MetricOverviewSection).map((metric, index) =>
        index === action.slotIndex ? action.metric : metric,
      );

      return {
        ...settings,
        metricOverview: {
          ...settings.metricOverview,
          [action.section]: slots,
        },
      };
    }

    default:
      return settings;
  }
};

export default settingsReducer;
