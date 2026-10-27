import {AnyAction} from '@reduxjs/toolkit';
import {Metric, MetricOverviewSection, resolveMetricOverviewSlots} from '../../models/Metric';
import {customPaletteHex, PaletteSelection} from '../../theme/palette';
import {ThemeModeSetting} from '../../theme/themeMode';
import {AiProvider} from '../../models/AiProvider';
import {resolveVideoAnalysisFps, VideoAnalysisFps} from '../../models/VideoAnalysisFps';
import {addMuscle, removeMuscle, setMuscleInOverviews} from '../../utils/muscle-catalog';

export interface MetricOverviewSettings {
  muscles?: Metric[];
  exercises?: Metric[];
}

export type AnalysisSectionId = 'muscleMap' | 'metrics';

export type MuscleMapMetric = 'sets' | 'volume';
export type MuscleMapCompare =
  | 'none'
  | 'last_plan'
  | 'current_total_plan'
  | 'last_training_plan'
  | 'last_training_done'
  /** GH-444 — the plan of this very training (analysis view only). */
  | 'this_training_plan';

/** Persisted compare selection for the Plan-View card. */
export const muscleMapCompareSelectionPlanKey = 'muscleMapCompareSelectionPlan';
/** Persisted compare selection for the Analyse (Done) -View card. */
export const muscleMapCompareSelectionAnalyseKey = 'muscleMapCompareSelectionAnalyse';

export interface PlanSettings {
  muscleMap?: {
    // GH-417: the `enabled` flag is gone — the muscle map is no longer toggled
    // from the drawer, it is a fixed part of the analysis view's Plan position.
    metric?: MuscleMapMetric;
    /** @deprecated kept for migration only — read muscleMapCompareSelectionPlan instead. */
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

/**
 * GH-523: the user's changes to the muscle list. Absent on older installs, which
 * then keep exactly the built-in muscles, all shown in the overviews.
 */
export interface MuscleSettings {
  /** Muscles the user added, in the order they were added. */
  custom?: string[];
  /** Built-in muscles the user removed. */
  removed?: string[];
  /** Muscles left out of the overviews (muscle map, radar, Muscle Overview). */
  hiddenInOverviews?: string[];
}

export interface AppSettings {
  /**
   * @deprecated GH-404 — kept in sync so a downgrade still finds a usable value.
   * Read the effective mode through `resolveThemeModeSetting` instead.
   */
  mode: 'light' | 'dark';
  /**
   * `'system' | 'light' | 'dark'`. Absent on installs from before GH-404;
   * `resolveThemeModeSetting` then falls back to `mode`.
   */
  themeMode?: ThemeModeSetting;
  /**
   * `'blue' | 'green' | 'purple'` for the built-in palettes, or a `#RRGGBB`
   * source colour picked from the colour wheel. Older installs only ever hold
   * one of the three names, so their theme survives the update unchanged.
   */
  palette?: PaletteSelection;
  /**
   * The last `#RRGGBB` colour applied from the colour wheel, kept while a
   * built-in palette is active so the Settings "Custom" segment can still
   * preview it (GH-478). Absent until a colour is picked.
   */
  customPalette?: string;
  videoAnalysisFiltersExpanded?: boolean;
  videoAnalysisLearnedRateSecondsPerVideoSecond?: number;
  /** GH-621: analysis frame rate for NEW analyses. Absent → DEFAULT_VIDEO_ANALYSIS_FPS. */
  videoAnalysisFps?: VideoAnalysisFps;
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
  };
  metricOverview?: MetricOverviewSettings;
  anthropicModel?: string;
  /** GH-504: AI provider for chat and coach insights. Absent → Claude (existing users). */
  aiProvider?: AiProvider;
  /** GH-504: ChatGPT model slug. Absent → the first model the user's plan lists. */
  chatgptModel?: string;
  aiChatPrompt?: string;
  aiTrainingPrompt?: string;
  plan?: PlanSettings;
  restTimer?: RestTimerSettings;
  /**
   * Persisted compare selection for the Plan-View muscle map.
   * Separate from the Analyse selection so the two views can be tuned independently.
   */
  muscleMapCompareSelectionPlan?: MuscleMapCompare;
  /** Persisted compare selection for the Analyse (Done) -View muscle map. */
  muscleMapCompareSelectionAnalyse?: MuscleMapCompare;
  /** Persisted collapsed/expanded state of the in-training Muscle Map / Metrics analysis sections. */
  analysisSectionsCollapsed?: {[K in AnalysisSectionId]?: boolean};
  /** GH-497: the first-start onboarding was finished or skipped — it never opens on its own again. */
  onboardingCompleted?: boolean;
  /** GH-497: reopened from the Settings; shown regardless of existing data until finished. */
  onboardingRequested?: boolean;
  /**
   * GH-518: the plan that drives the Training home dashboard (the starred plan).
   * Absent on installs from before GH-518 — the dashboard then keeps picking the
   * plan automatically, so an update changes nothing. Set when a plan is created
   * and when the user taps a plan's star.
   */
  currentTrainingsPlanId?: number;
  muscles?: MuscleSettings;
}

const initialState = {
  mode: 'dark',
  // A fresh install keeps the app's long-standing dark default; nobody is
  // pushed onto 'system' without choosing it (GH-404).
  themeMode: 'dark',
  palette: 'blue',
  videoAnalysisFiltersExpanded: false,
} as AppSettings;

// A rejected muscle change returns the same object — keep the settings reference then too.
const withMuscles = (settings: AppSettings, muscles: MuscleSettings | undefined): AppSettings => (muscles === settings.muscles ? settings : {...settings, muscles});

const settingsReducer = (settings: AppSettings = initialState, action: AnyAction): AppSettings => {
  switch (action.type) {
    case 'TOGGLE_MODE': {
      const next = settings?.mode === 'dark' ? 'light' : 'dark';
      return {
        ...settings,
        mode: next,
        themeMode: next,
      } as AppSettings;
    }
    case 'SET_THEME_MODE': {
      const themeMode = action.themeMode as ThemeModeSetting;
      return {
        ...settings,
        themeMode,
        // Keep the legacy flag pointing at the same scheme for the explicit
        // choices, so anything still reading `mode` stays consistent. 'system'
        // has no legacy equivalent, so the last explicit value is left alone.
        mode: themeMode === 'system' ? settings.mode : themeMode,
      } as AppSettings;
    }
    case 'SET_PALETTE': {
      // Remember the custom colour for the Settings "Custom" preview: the one
      // being applied, else the one being left (a pre-GH-478 store only ever
      // held it in `palette`), else the one remembered before.
      const customPalette =
        customPaletteHex(action.palette) ?? customPaletteHex(settings.palette) ?? settings.customPalette;
      return {
        ...settings,
        palette: action.palette,
        ...(customPalette ? {customPalette} : {}),
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
        restTimer: {
          ...settings.restTimer,
          userDefaultSeconds: action.seconds,
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
    case 'SET_AI_PROVIDER':
      return {
        ...settings,
        aiProvider: action.provider === 'chatgpt' ? 'chatgpt' : 'claude',
      };
    case 'SET_CHATGPT_MODEL': {
      const trimmed = ((action.model as string) ?? '').trim();
      return {
        ...settings,
        chatgptModel: trimmed || undefined,
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
        muscleMapCompareSelectionPlan: action.compare as MuscleMapCompare,
        // Keep the legacy nested slot in sync so any code still reading
        // settings.plan.muscleMap.compare during the deprecation window
        // sees the latest user choice.
        plan: {
          ...settings.plan,
          muscleMap: {
            ...settings.plan?.muscleMap,
            compare: action.compare as MuscleMapCompare,
          },
        },
      };
    }
    case 'SET_ANALYSE_MUSCLE_MAP_COMPARE': {
      return {
        ...settings,
        muscleMapCompareSelectionAnalyse: action.compare as MuscleMapCompare,
      };
    }
    case 'SET_REST_TIMER_USER_DEFAULT': {
      return {
        ...settings,
        localNotification: {
          ...settings.localNotification,
          pauseTimerInSeconds: action.seconds,
        },
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
    case 'SET_VIDEO_ANALYSIS_FPS':
      return {
        ...settings,
        videoAnalysisFps: resolveVideoAnalysisFps(action.fps),
      };
    case 'SET_VIDEO_ANALYSIS_LEARNED_RATE': {
      return {
        ...settings,
        videoAnalysisLearnedRateSecondsPerVideoSecond: action.rate,
      };
    }
    case 'SET_ANALYSIS_SECTION_COLLAPSED': {
      return {
        ...settings,
        analysisSectionsCollapsed: {
          ...settings.analysisSectionsCollapsed,
          [action.section as AnalysisSectionId]: !!action.collapsed,
        },
      };
    }
    case 'COMPLETE_ONBOARDING': {
      return {
        ...settings,
        onboardingCompleted: true,
        onboardingRequested: false,
      };
    }
    case 'SHOW_ONBOARDING': {
      return {
        ...settings,
        onboardingRequested: true,
      };
    }
    case 'SET_CURRENT_TRAININGS_PLAN': {
      return {
        ...settings,
        currentTrainingsPlanId: action.trainingsPlanId,
      };
    }
    case 'DELETE_TRAININGS_PLAN': {
      // GH-518: a deleted current plan hands the dashboard back to the automatic choice.
      if (settings.currentTrainingsPlanId !== action.trainingsPlanId) return settings;
      return {
        ...settings,
        currentTrainingsPlanId: undefined,
      };
    }
    case 'ADD_MUSCLE':
      return withMuscles(settings, addMuscle(settings.muscles, action.muscle));
    case 'REMOVE_MUSCLE':
      return withMuscles(settings, removeMuscle(settings.muscles, action.muscle));
    case 'SET_MUSCLE_IN_OVERVIEWS':
      return withMuscles(settings, setMuscleInOverviews(settings.muscles, action.muscle, !!action.visible));
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
